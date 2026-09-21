import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Clicking the ball pushes it back into the page. That is done in CSS, so this reads the numbers
// from the stylesheet, and checks the pointer code sets the class the stylesheet styles, and
// only when a click has fully registered.
const read = (path) => readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");
const css = read("style.css");
const rotate = read("ball-rotate.js");

const blocks = (selector) => {
  const pattern = new RegExp(`(?:^|[\\s,])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "gm");
  return [...css.matchAll(pattern)].map((m) => m[1]);
};
const rule = (selector) => {
  const found = blocks(selector);
  assert.ok(found.length, `no rule for ${selector}`);
  return found.join("\n");
};
const ms = (text, property) => {
  const match = new RegExp(`${property}:[^;]*?(\\d+)ms`).exec(text);
  assert.ok(match, `no ${property} in ms`);
  return Number(match[1]);
};

test("the ball is pushed back by shrinking it a little, and eases back out", () => {
  const ball = rule(".ball");
  assert.match(ball, /(?:^|[\s;])scale:\s*1\s*;/m, "resting at full size");
  assert.match(ball, /transition:\s*scale\s+\d+ms/, "eases back out");

  const pushed = rule(".ball.is-pushed");
  const scale = Number(/scale:\s*([\d.]+)\s*;/.exec(pushed)?.[1]);
  assert.ok(scale > 0.8 && scale < 0.97, `pushed to ${scale}: enough to see, not so much it looks broken`);
});

test("it takes about twice as long to go in as it once did, and comes back more slowly still", () => {
  const out = ms(rule(".ball"), "transition");
  const inn = ms(rule(".ball.is-pushed"), "transition-duration");
  // It used to reach its deepest point in 120ms; now about double that.
  assert.ok(inn >= 200 && inn <= 300, `${inn}ms in`);
  assert.ok(out >= 300 && out <= 900, `${out}ms out`);
  assert.ok(inn < out, "still quicker going in than coming back");
});

test("it uses the separate scale property, so it combines with the shake's transform", () => {
  assert.doesNotMatch(rule(".ball.is-pushed"), /transform:/);
  assert.match(rule(".ball.shaking"), /animation:\s*shake/);
});

test("people who ask for less motion get no push", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.ball\.is-pushed\s*\{[^}]*scale:\s*1/);
  assert.match(reduced, /\.ball,\s*\.ball\.is-pushed\s*\{[^}]*transition:\s*none/);
});

// The body of one event handler in the pointer code.
const handler = (event) => {
  const start = rotate.indexOf(`addEventListener("${event}"`);
  assert.ok(start >= 0, `no ${event} handler`);
  const end = rotate.indexOf("\n  });", start);
  return rotate.slice(start, end);
};

test("pressing the ball does not move it", () => {
  const down = handler("pointerdown");
  assert.doesNotMatch(down, /is-pushed/, "no push class on press");
  assert.doesNotMatch(down, /is-pressed/, "no pressed class either");
  assert.doesNotMatch(down, /\bpush\(/, "no push on press");
  assert.match(down, /clicks\.down\(\{ x: event\.clientX, y: event\.clientY \}\)/, "it only tells the click handler where a press began");
});

test("the push is reached only through a registered click or a double click, and from one place", () => {
  assert.match(rotate, /createClickHandler\(\{ onClick: push \}\)/, "a single click's push follows the wait");
  assert.equal((rotate.match(/classList\.add\("is-pushed"\)/g) ?? []).length, 1, "the class is added in one place");
  // The one direct call is the double click's, which starts the push with the spin.
  assert.equal((rotate.match(/(?<!function )\bpush\(\)/g) ?? []).length, 1, "push() is called directly once");
  assert.match(rotate, /from "\.\/click\.js"/);
});

test("a double click pushes and spins the ball at the same moment", () => {
  // Both start in the one branch, one straight after the other in the same task, so on the same frame.
  assert.match(rotate, /outcome === "double-click"\) \{\s*push\(\);[^}]*return spin\(\);\s*\}/);
  assert.match(rotate, /spinFrom\(from, t\)/);
});

test("a cancelled press counts as no click", () => {
  assert.match(rotate, /cancelled: event\.type === "pointercancel"/);
});

test("the push is held for the stylesheet's own duration, not a number that could drift from it", () => {
  assert.match(rotate, /pushHoldMs\(getComputedStyle\(ball\)\.transitionDuration\)/);
  assert.doesNotMatch(rotate, /PUSH_HOLD_MS/, "no separate fixed hold to keep in step with the CSS");
  assert.match(rotate, /setTimeout\(\(\) => ball\.classList\.remove\("is-pushed"\), hold\)/);
});
