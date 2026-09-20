import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The question box is laid out in CSS, so this reads the numbers out of the stylesheet.
// The bug it guards against: with the input's line box shorter than its font, the tails
// of g, y, p, q and j are cut off.
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");

const rule = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `no rule for ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};
const px = (block, property) => {
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*([\\d.]+)px`, "m").exec(block);
  assert.ok(match, `no ${property} in ${block.split("\n")[0]}`);
  return Number(match[1]);
};

const DESIGN_HEIGHT = 41; // the Paper design's question box, borders included
const BORDER = 1;

test("the input's text box is taller than its font, so descenders are not cut off", () => {
  const input = rule(".ask input");
  const fontSize = px(input, "font-size");
  const lineHeight = px(input, "line-height");
  const height = px(input, "height");

  // Sans-serif text needs a line of about 1.2 times its size for its ascenders and descenders.
  assert.ok(lineHeight >= fontSize * 1.2, `line-height ${lineHeight}px is too short for ${fontSize}px text`);
  // The text box must be at least as tall as the line, or the last of the line is clipped.
  assert.ok(height >= lineHeight, `height ${height}px is shorter than the ${lineHeight}px line`);
});

test("the question box is still the design's 41px tall", () => {
  const ask = rule(".ask");
  const padding = /padding:\s*([\d.]+)px\s+[\d.]+px/.exec(ask) ?? /padding:\s*([\d.]+)px\s*;/.exec(ask);
  assert.ok(padding, "no padding on .ask");
  const paddingY = Number(padding[1]);
  const inputHeight = px(rule(".ask input"), "height");
  assert.equal(2 * paddingY + inputHeight + 2 * BORDER, DESIGN_HEIGHT);
});

test("the send icon still fits inside the box", () => {
  const button = rule(".ask button");
  const size = px(button, "height");
  assert.equal(px(button, "width"), size);
  const inputHeight = px(rule(".ask input"), "height");
  assert.ok(size <= Math.max(inputHeight, 15) + 1e-9);
});
