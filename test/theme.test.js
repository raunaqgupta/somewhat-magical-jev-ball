import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BALL_COLOR } from "../public/ball3d.js";

// The page's colours live in CSS custom properties, so this reads them from the stylesheet.
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const token = (name) => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(root);
  assert.ok(match, `no --${name} colour in :root`);
  return match[1].toLowerCase();
};
// All the declarations for a selector, from every rule that ends in it. A selector can
// be in a group (`html,\nbody {`) or appear more than once, so this joins them.
const rule = (selector) => {
  const blocks = [];
  const pattern = new RegExp(`(?:^|[\\s,])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "gm");
  for (const match of css.matchAll(pattern)) blocks.push(match[1]);
  assert.ok(blocks.length, `no rule for ${selector}`);
  return blocks.join("\n");
};

// WCAG relative luminance and contrast ratio.
const channel = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("the page background is #000000", () => {
  assert.equal(token("page"), "#000000");
  // And it is what the page, and the document behind it (overscroll, the area around the page), actually use.
  assert.match(rule("body"), /background:\s*var\(--page\)/);
  assert.match(rule("html"), /background:\s*var\(--page\)/);
  // Browsers on phones tint their own chrome from this.
  assert.match(html, /<meta name="theme-color" content="#000000"/i);
});

test("form controls and scrollbars are drawn dark to match", () => {
  assert.match(rule("html"), /color-scheme:\s*dark/);
});

test("the ball is visible on the black page: a dark body with a defined edge", () => {
  const page = token("page");
  // The body is not the page's own black, or it would vanish...
  assert.notEqual(token("ball"), page);
  assert.ok(contrast(token("ball"), page) > 1.15, "the ball's body is indistinguishable from the page");
  // ...and its edge is a fine line that meets the usual 3:1 minimum for the boundary of a graphic.
  assert.ok(contrast(token("ball-rim"), page) >= 3, `rim contrast ${contrast(token("ball-rim"), page).toFixed(2)}`);
  assert.match(rule(".ball"), /box-shadow:\s*0 0 0 1px var\(--ball-rim\)/);
  assert.match(rule(".ball"), /background:\s*var\(--ball\)/);
});

test("the 3D sphere and the flat fallback ball are the same colour", () => {
  const cssBall = parseInt(token("ball").slice(1), 16);
  assert.equal(BALL_COLOR, cssBall, `BALL_COLOR is #${BALL_COLOR.toString(16)}, --ball is ${token("ball")}`);
});

test("text on the page is readable against black", () => {
  const page = token("page");
  assert.ok(contrast(token("text"), page) >= 7, "typed text");
  assert.ok(contrast(token("muted"), page) >= 4.5, "placeholder and error text");
  assert.ok(contrast(token("window-text"), page) >= 4.5, "blurb text");
  assert.ok(contrast(token("line-focus"), page) >= 3, "the focused question box's border and focus ring");
});

test("the question box and its text use the page colours, not the ball's", () => {
  assert.match(rule(".ask"), /background:\s*var\(--page\)/);
  assert.match(rule(".ask"), /border:\s*1px solid var\(--line\)/);
  assert.match(rule(".ask input"), /color:\s*var\(--text\)/);
  assert.match(rule(".ask button"), /color:\s*var\(--text\)/);
  assert.match(rule(".ask:focus-within"), /border-color:\s*var\(--line-focus\)/);
});

test("the ball's windows keep the design's own colours whatever the page is", () => {
  // Black front, white back, black text on the white: none of them follow the page.
  assert.equal(token("window-front"), "#000000");
  assert.equal(token("window-back"), "#ffffff");
  assert.equal(token("model-text"), "#000000");
  assert.match(rule(".window-front"), /background:\s*var\(--window-front\)/);
  assert.match(rule(".window-back"), /background:\s*var\(--window-back\)/);
  assert.match(rule(".model"), /color:\s*var\(--model-text\)/);
  for (const selector of [".window-front", ".window-back", ".model"]) {
    assert.doesNotMatch(rule(selector), /var\(--(page|text)\)/, `${selector} must not follow the page colours`);
  }
});

test("no leftover use of the old light-page colour tokens", () => {
  assert.doesNotMatch(css, /var\(--(bg|ink|border)\)/);
});
