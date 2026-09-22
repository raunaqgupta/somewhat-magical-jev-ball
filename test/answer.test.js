import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The window's text before anyone has asked anything, and the fallback shown again if a
// request fails: app.js reads both from this one place in the page (DEFAULT_TEXT), so
// fixing it here is enough to fix both.
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test('the ball shows "..." before anyone has asked anything, as in the Paper design', () => {
  const answer = /<p class="answer" id="answer"[^>]*>([^<]*)<\/p>/.exec(html);
  assert.ok(answer, "no #answer element");
  assert.equal(answer[1], "...");
});

test("app.js reads the fallback text from the page, rather than hardcoding it", () => {
  assert.match(js, /DEFAULT_TEXT\s*=\s*answer\.textContent/);
  assert.doesNotMatch(js, /["'`]Jev["'`]/, "the old default text should not be hardcoded anywhere");
});
