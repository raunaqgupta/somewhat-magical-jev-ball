// Cloudflare Worker: static files from ./public are served by the assets
// binding; only /api/* reaches this code. It proxies questions to Jev so the
// TypeSafe API key stays server-side, and relays each shareable question to
// every connected visitor through the Feed Durable Object.
import { DurableObject } from "cloudflare:workers";
import { parseClientId } from "../lib/client-id.js";
import { askJev, jevConfig } from "../lib/decide.js";

const MAX_QUESTION_LENGTH = 280;
const MAX_BODY_BYTES = 4096;

/**
 * The live feed of questions. One global instance holds a WebSocket per visitor
 * and relays each published question to all of them. Nothing is stored: a
 * question is only seen by visitors connected when it is asked.
 */
export class Feed extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Answers the client's keep-alive without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  fetch(request) {
    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    // Tag the socket with its browser's id so that browser's own questions can be skipped.
    const id = parseClientId(new URL(request.url).searchParams.get("client"));
    this.ctx.acceptWebSocket(server, id ? [id] : []);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Send `question` to every visitor except the browser that asked it, if known. */
  publish(question, askedBy = null) {
    const message = JSON.stringify({ question });
    for (const socket of this.ctx.getWebSockets()) {
      if (askedBy && this.ctx.getTags(socket).includes(askedBy)) continue;
      try {
        socket.send(message);
      } catch {
        // The socket is already closing; it will be cleaned up on close.
      }
    }
  }

  // Visitors only listen; anything they send is ignored.
  webSocketMessage() {}

  webSocketClose(socket) {
    try {
      socket.close(1000);
    } catch {
      // Already closed.
    }
  }
}

const feed = (env) => env.FEED.get(env.FEED.idFromName("global"));

function json(status, body) {
  return Response.json(body, { status });
}

async function handleAsk(request, env, ctx) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  // The binding is absent when running without rate limiting configured.
  if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: ip })).success) {
    return json(429, { error: "The ball needs a moment. Try again shortly." });
  }

  let question;
  let askedBy;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Invalid request." });
    const body = JSON.parse(raw);
    question = body?.question;
    askedBy = parseClientId(body?.clientId);
  } catch {
    return json(400, { error: "Invalid request." });
  }

  question = typeof question === "string" ? question.trim() : "";
  if (!question) return json(400, { error: "Ask a question first." });
  if (question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: `Keep it under ${MAX_QUESTION_LENGTH} characters.` });
  }

  try {
    const { answer, category, shareable } = await askJev(question, jevConfig(env));
    // Show the question to other visitors, unless it contains personal information.
    if (shareable) ctx.waitUntil(feed(env).publish(question.replace(/\s+/g, " "), askedBy));
    return json(200, { answer, category });
  } catch (err) {
    console.error("Jev request failed:", err.message);
    return json(502, { error: "The ball is clouded. Try again." });
  }
}

async function handleFeed(request, env) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (env.FEED_LIMITER && !(await env.FEED_LIMITER.limit({ key: ip })).success) {
    return new Response("Too many connections", { status: 429 });
  }
  return feed(env).fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/ask") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
      }
      return handleAsk(request, env, ctx);
    }
    if (pathname === "/api/feed") return handleFeed(request, env);
    return new Response("Not found", { status: 404 });
  },
};
