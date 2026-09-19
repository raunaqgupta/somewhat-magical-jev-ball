// Tiny dependency-free server: serves ./public and proxies questions to Jev,
// so the TypeSafe API key stays on the server and never reaches the browser.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { askJev } from "./lib/decide.js";

const PUBLIC_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const PORT = Number(process.env.PORT) || 3210;
const MAX_QUESTION_LENGTH = 280;
const RATE_LIMIT = { windowMs: 60_000, max: 20 };

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.max;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req, limit = 4096) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleAsk(req, res) {
  if (rateLimited(req.socket.remoteAddress)) {
    return sendJson(res, 429, { error: "The ball needs a moment. Try again shortly." });
  }

  let question;
  try {
    question = JSON.parse(await readBody(req))?.question;
  } catch (err) {
    return sendJson(res, err.status ?? 400, { error: "Invalid request." });
  }

  question = typeof question === "string" ? question.trim() : "";
  if (!question) return sendJson(res, 400, { error: "Ask a question first." });
  if (question.length > MAX_QUESTION_LENGTH) {
    return sendJson(res, 400, { error: `Keep it under ${MAX_QUESTION_LENGTH} characters.` });
  }

  try {
    const { answer, category } = await askJev(question);
    sendJson(res, 200, { answer, category });
  } catch (err) {
    console.error("Jev request failed:", err.message);
    sendJson(res, 502, { error: "The ball is clouded. Try again." });
  }
}

async function handleStatic(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).slice(1);
  const file = normalize(join(PUBLIC_DIR, relative));

  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
}

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/ask") return handleAsk(req, res);
  if (req.method === "GET" || req.method === "HEAD") return handleStatic(req, res);
  res.writeHead(405).end("Method not allowed");
}).listen(PORT, () => console.log(`Magic Jev Ball: http://localhost:${PORT}`));
