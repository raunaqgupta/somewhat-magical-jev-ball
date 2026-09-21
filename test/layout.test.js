import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The page's layout is CSS, so this reads the numbers out of the stylesheet and checks them
// against the two Paper designs: the desktop (1280 wide) and the phone (370 wide).
const css = readFileSync(new URL("../public/style.css", import.meta.url), "utf8");

// The phone rules: the media query's block, up to its closing brace at the start of a line.
const phoneStart = css.indexOf("@media (max-width: 600px)");
assert.ok(phoneStart >= 0, "a phone media query");
const phoneCss = css.slice(phoneStart, css.indexOf("\n}\n", phoneStart));
const desktopCss = css.slice(0, phoneStart) + css.slice(phoneStart + phoneCss.length);

const rule = (source, selector) => {
  const pattern = new RegExp(`(?:^|[\\s,])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "gm");
  const blocks = [...source.matchAll(pattern)].map((m) => m[1]);
  assert.ok(blocks.length, `no rule for ${selector}`);
  return blocks.join("\n");
};
const value = (block, property) => new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`, "m").exec(block)?.[1].trim();

test("desktop: 42px above and below, 24px at the sides", () => {
  assert.equal(value(rule(desktopCss, "body"), "padding"), "42px 24px");
});

test("phone: 42px all round", () => {
  assert.equal(value(rule(phoneCss, "body"), "padding"), "42px");
});

test("the ball and the question box sit 42px apart, centred in the space below the title", () => {
  const stage = rule(desktopCss, ".stage");
  assert.equal(value(stage, "gap"), "42px");
  assert.equal(value(stage, "flex"), "1");
  assert.equal(value(stage, "justify-content"), "center");
  assert.equal(value(stage, "align-items"), "center");
  // The body's padding is the page's padding: the stage adds none of its own.
  assert.equal(value(stage, "padding"), undefined);
});

test("the ball is 273px on a desktop and 230px on a phone", () => {
  const desktop = rule(desktopCss, ".ball");
  assert.equal(value(desktop, "width"), "273px");
  assert.equal(value(desktop, "height"), "273px");
  const phone = rule(phoneCss, ".ball");
  assert.equal(value(phone, "width"), "230px");
  assert.equal(value(phone, "height"), "230px");
});

test("the window is 149px on both, and centred in the ball whatever its size", () => {
  const window = rule(desktopCss, ".window");
  assert.equal(value(window, "width"), "149px");
  assert.equal(value(window, "height"), "149px");
  assert.equal(value(window, "top"), "calc(50% - 74.5px)");
  assert.equal(value(window, "left"), "calc(50% - 74.5px)");
  assert.doesNotMatch(phoneCss, /\.window/, "the phone does not resize it");
});

test("the window's shadow is the design's: #474747 at 0x4A, inset 0 2px 112px 58px", () => {
  assert.match(css, /--window-glow:\s*#4747474a/i);
  assert.equal(value(rule(css, ".window-front"), "box-shadow"), "var(--window-glow) 0 2px 112px 58px inset");
});

test("the question box is 420px wide on a desktop and the full width on a phone", () => {
  const desktop = rule(desktopCss, ".ask-wrap");
  assert.equal(value(desktop, "width"), "420px");
  assert.equal(value(desktop, "max-width"), "100%");
  assert.equal(value(rule(phoneCss, ".ask-wrap"), "width"), "100%");
});
