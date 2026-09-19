// Cloudflare Worker: static files from ./public are served by the assets
// binding; only /api/* reaches this code. It proxies questions to Jev so the
// TypeSafe API key stays server-side.
import { askJev } from "../lib/decide.js";

const MAX_QUESTION_LENGTH = 280;
const MAX_BODY_BYTES = 4096;

function json(status, body) {
  return Response.json(body, { status });
}

async function handleAsk(request, env) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  // The binding is absent when running without rate limiting configured.
  if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: ip })).success) {
    return json(429, { error: "The ball needs a moment. Try again shortly." });
  }

  let question;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Invalid request." });
    question = JSON.parse(raw)?.question;
  } catch {
    return json(400, { error: "Invalid request." });
  }

  question = typeof question === "string" ? question.trim() : "";
  if (!question) return json(400, { error: "Ask a question first." });
  if (question.length > MAX_QUESTION_LENGTH) {
    return json(400, { error: `Keep it under ${MAX_QUESTION_LENGTH} characters.` });
  }

  try {
    const { answer, category } = await askJev(question, env.TYPESAFE_API_KEY);
    return json(200, { answer, category });
  } catch (err) {
    console.error("Jev request failed:", err.message);
    return json(502, { error: "The ball is clouded. Try again." });
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/ask") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
      }
      return handleAsk(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};
