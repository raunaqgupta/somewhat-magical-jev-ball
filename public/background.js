// Shows the questions other visitors are asking as faint blurbs drifting in the
// background. Purely decorative: it never touches the ball or the input, and the
// page works the same if the feed is unavailable.
import { blurbLook, estimateSize, pickMotion, pickPosition } from "./blurb-layout.js";

const layer = document.getElementById("background");
const MAX_BLURBS = 24;
const AVOID_PADDING = 24;
const PING_MS = 25_000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// The ball and the input, so blurbs stay clear of them.
function contentRect() {
  const rects = [...document.querySelectorAll("#ball, .ask-wrap")].map((el) =>
    el.getBoundingClientRect(),
  );
  const left = Math.min(...rects.map((r) => r.left)) - AVOID_PADDING;
  const top = Math.min(...rects.map((r) => r.top)) - AVOID_PADDING;
  const right = Math.max(...rects.map((r) => r.right)) + AVOID_PADDING;
  const bottom = Math.max(...rects.map((r) => r.bottom)) + AVOID_PADDING;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function show(question) {
  if (document.hidden) return;
  while (layer.children.length >= MAX_BLURBS) layer.firstChild.remove();

  const { fontSize, opacity, drift } = blurbLook(Math.random());
  const size = estimateSize(question, fontSize);
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const { x, y } = pickPosition(viewport, contentRect(), size);
  const { dx, dy, duration } = pickMotion(drift);

  const el = document.createElement("div");
  el.className = "blurb";
  // textContent, never innerHTML: the text comes from other visitors.
  el.textContent = question;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.fontSize = `${fontSize}px`;
  layer.append(el);

  // Flash in, hold while drifting, then fade out.
  const keyframes = reducedMotion.matches
    ? [{ opacity: 0 }, { opacity, offset: 0.1 }, { opacity, offset: 0.85 }, { opacity: 0 }]
    : [
        { opacity: 0, transform: "translate(0, 0)" },
        { opacity, offset: 0.1 },
        { opacity, offset: 0.8 },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px)` },
      ];
  el.animate(keyframes, { duration, easing: "linear", fill: "forwards" }).addEventListener(
    "finish",
    () => el.remove(),
  );
}

let delay = RECONNECT_MIN_MS;

function connect() {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${scheme}//${location.host}/api/feed`);
  let ping;

  socket.addEventListener("open", () => {
    delay = RECONNECT_MIN_MS;
    ping = setInterval(() => socket.send("ping"), PING_MS);
  });

  socket.addEventListener("message", (event) => {
    if (event.data === "pong") return;
    let question;
    try {
      ({ question } = JSON.parse(event.data));
    } catch {
      return; // Not a question.
    }
    if (typeof question === "string" && question) show(question);
  });

  socket.addEventListener("close", () => {
    clearInterval(ping);
    setTimeout(connect, delay);
    delay = Math.min(delay * 2, RECONNECT_MAX_MS);
  });
}

if (layer && "WebSocket" in window) connect();
