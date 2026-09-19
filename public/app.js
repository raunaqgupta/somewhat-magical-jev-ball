const ball = document.getElementById("ball");
const form = document.getElementById("ask");
const input = document.getElementById("question");
const send = document.getElementById("send");
const answer = document.getElementById("answer");
const error = document.getElementById("error");

// The text the page ships with, restored if a request fails.
const DEFAULT_TEXT = answer.textContent;
const SHAKE_MS = 600;
const CLOUDED = "The ball is clouded. Try again.";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ask(question) {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  }).catch(() => {
    throw new Error(CLOUDED);
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || CLOUDED);
  return body.answer;
}

let busy = false;

// Sending needs a typed question and no request already in flight.
function syncSend() {
  send.disabled = busy || !input.value.trim();
}

input.addEventListener("input", syncSend);
// Also covers a value the browser restored (autofill, back navigation).
syncSend();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || busy) return;

  busy = true;
  syncSend();
  error.textContent = "";
  answer.textContent = "…";
  ball.classList.add("thinking", "shaking");

  try {
    // Hold the shake for its full length even when Jev answers faster.
    const [text] = await Promise.all([ask(question), wait(SHAKE_MS)]);
    answer.textContent = text;
  } catch (err) {
    answer.textContent = DEFAULT_TEXT;
    error.textContent = err.message;
  } finally {
    ball.classList.remove("thinking", "shaking");
    busy = false;
    syncSend();
    input.focus();
  }
});
