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

test("it goes in quickly and comes back more slowly", () => {
  const out = ms(rule(".ball"), "transition");
  const inn = ms(rule(".ball.is-pushed"), "transition-duration");
  assert.ok(inn <= 200, `${inn}ms in`);
  assert.ok(out >= 300 && out <= 900, `${out}ms out`);
  assert.ok(inn < out);
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
  assert.match(down, /clicks\.down\(\)/, "it only tells the click handler a press began");
});

test("the push is only done through a registered click, and only ever from one place", () => {
  assert.match(rotate, /createClickHandler\(\{ onClick: push \}\)/);
  assert.equal((rotate.match(/classList\.add\("is-pushed"\)/g) ?? []).length, 1, "the class is added in one place");
  assert.equal((rotate.match(/(?<!function )\bpush\(\)/g) ?? []).length, 0, "and push() is never called directly");
  assert.match(rotate, /from "\.\/click\.js"/);
});

test("a double click spins the ball and a cancelled press counts as no click", () => {
  assert.match(rotate, /outcome === "double-click"\) return spin\(\)/);
  assert.match(rotate, /cancelled: event\.type === "pointercancel"/);
  assert.match(rotate, /spinFrom\(from, t\)/);
});
