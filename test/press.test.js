import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pressing the ball pushes it back into the page. That is done in CSS, so this reads the numbers
// from the stylesheet, and checks the pointer code sets the class the stylesheet styles.
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

  const pressed = rule(".ball.is-pressed");
  const scale = Number(/scale:\s*([\d.]+)\s*;/.exec(pressed)?.[1]);
  assert.ok(scale > 0.8 && scale < 0.97, `pushed to ${scale}: enough to see, not so much it looks broken`);
});

test("it goes in quickly and comes back more slowly", () => {
  const out = ms(rule(".ball"), "transition");
  const inn = ms(rule(".ball.is-pressed"), "transition-duration");
  assert.ok(inn <= 200, `${inn}ms in`);
  assert.ok(out >= 300 && out <= 900, `${out}ms out`);
  assert.ok(inn < out);
});

test("it uses the separate scale property, so it combines with the shake's transform", () => {
  assert.doesNotMatch(rule(".ball.is-pressed"), /transform:/);
  assert.match(rule(".ball.shaking"), /animation:\s*shake/);
});

test("people who ask for less motion get no push", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.ball\.is-pressed\s*\{[^}]*scale:\s*1/);
  assert.match(reduced, /\.ball,\s*\.ball\.is-pressed\s*\{[^}]*transition:\s*none/);
});

test("the pointer code presses on the way down, keeps it long enough to see, and lets go after", () => {
  assert.match(rotate, /classList\.add\("is-dragging", "is-pressed"\)/);
  assert.match(rotate, /classList\.remove\("is-pressed"\)/);
  assert.match(rotate, /pressHoldRemaining\(heldMs\)/, "a quick click still holds the push");
  assert.match(rotate, /clearTimeout\(releaseTimer\)/, "a new press cancels a pending let-go");
  assert.match(rotate, /from "\.\/tap\.js"/);
});

test("a double tap spins the ball, a cancelled press does not count as a tap", () => {
  assert.match(rotate, /isDoubleTap\(lastTap, tap\)/);
  assert.match(rotate, /event\.type === "pointerup" && isTap/, "pointercancel is not a tap");
  assert.match(rotate, /spinFrom\(from, t\)/);
});
