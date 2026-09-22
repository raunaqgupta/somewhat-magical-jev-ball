import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The ball bobs mildly at all times, not just in response to a click. That is done in CSS,
// so this reads the numbers from the stylesheet.
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");

const blocks = (selector) => {
  const pattern = new RegExp(`(?:^|[\\s,])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "gm");
  return [...css.matchAll(pattern)].map((m) => m[1]);
};
const rule = (selector) => {
  const found = blocks(selector);
  assert.ok(found.length, `no rule for ${selector}`);
  return found.join("\n");
};
const keyframes = (name) => {
  const start = css.indexOf(`@keyframes ${name} {`);
  assert.ok(start >= 0, `no @keyframes ${name}`);
  return css.slice(start, css.indexOf("}", css.lastIndexOf("}", css.indexOf("\n\n", start))) + 1);
};

test("the ball bobs continuously at rest, not just while pressed or shaking", () => {
  const ball = rule(".ball");
  assert.match(ball, /animation:\s*bob\s+[\d.]+s\s+ease-in-out\s+infinite\s*;/);
});

test("it uses the standalone translate property, so it composes with the shake's transform and the push's scale", () => {
  const bob = keyframes("bob");
  assert.match(bob, /translate:/);
  assert.doesNotMatch(bob, /transform:/);
});

test("the bob is mild: a few pixels, over a few seconds, easing smoothly rather than snapping", () => {
  const ball = rule(".ball");
  const duration = Number(/animation:\s*bob\s+([\d.]+)s/.exec(ball)?.[1]);
  assert.ok(duration >= 2 && duration <= 8, `${duration}s is too fast or too slow to read as mild`);

  const bob = keyframes("bob");
  assert.match(bob, /0%,\s*100%\s*\{\s*translate:\s*0\s+0\s*;\s*\}/, "starts and ends at rest");
  const amplitude = Math.abs(Number(/50%\s*\{\s*translate:\s*0\s+(-?[\d.]+)px/.exec(bob)?.[1]));
  assert.ok(amplitude > 0 && amplitude <= 12, `${amplitude}px is not a mild bob`);
});

test("people who ask for less motion get no bob", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.ball,\s*\.ball\.shaking,\s*\.ball\.thinking \.answer\s*\{[^}]*animation:\s*none/);
});
