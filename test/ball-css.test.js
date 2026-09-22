import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The flat CSS ball, used when WebGL is unavailable, gets its own subtle "lit sphere" look
// so it does not read as a flat disc either (see ball3d.test.js for the WebGL ball's lights).
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");

const rule = (selector) => {
  const pattern = new RegExp(`(?:^|[\\s,])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "gm");
  const blocks = [...css.matchAll(pattern)].map((m) => m[1]);
  assert.ok(blocks.length, `no rule for ${selector}`);
  return blocks.join("\n");
};

// Splits a CSS value on top-level commas only, not ones nested inside a function's parens.
const topLevelSplit = (value) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth--;
    else if (value[i] === "," && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((p) => p.trim());
};

test("the flat ball has a highlight and a vignette layered over its base colour, not a flat fill", () => {
  const ball = rule(".ball");
  const background = /background:\s*([^;]+);/.exec(ball)?.[1];
  assert.ok(background, "no background on .ball");
  const layers = topLevelSplit(background);
  assert.equal(layers.length, 3, "a highlight, a vignette, and the base colour");
  assert.match(layers[0], /^radial-gradient\(circle at [\d.]+% [\d.]+%,\s*rgba\(255,\s*255,\s*255,/, "a light highlight");
  assert.match(layers[1], /^radial-gradient\(circle at 50% 50%,\s*transparent/, "a centred vignette");
  assert.match(layers[1], /rgba\(0,\s*0,\s*0,/, "darkening, not lightening, toward the edge");
  assert.equal(layers[2], "var(--ink)", "still falls back to the plain colour underneath");
});

test("the 3D ball's own canvas replaces the gradient: is-3d clears the background", () => {
  assert.match(rule(".ball.is-3d"), /(?:^|[\s;])background:\s*transparent\s*;/);
});
