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

test("desktop: a grid of 1fr, 420px, 1fr columns and five rows, the middle three the design's heights", () => {
  const body = rule(desktopCss, "body");
  assert.equal(value(body, "display"), "grid");
  assert.equal(value(body, "grid-template-columns"), "1fr 420px 1fr");
  // The empty rows above and below take what is left, so the middle three are centred. The
  // question box's row is 117px plus the 1px line under it.
  assert.equal(value(body, "grid-template-rows"), "1fr 63px 346px 118px 1fr");
  assert.equal(value(body, "padding"), undefined, "the cells have the padding, not the page");
});

test("desktop: the title, ball and question box are the middle column's three cells", () => {
  assert.equal(value(rule(desktopCss, ".site-header"), "grid-area"), "2 / 2");
  assert.equal(value(rule(desktopCss, ".ball-cell"), "grid-area"), "3 / 2");
  assert.equal(value(rule(desktopCss, ".ask-cell"), "grid-area"), "4 / 2");
  // <main> takes no box of its own, so its children are cells of the body's grid.
  assert.equal(value(rule(desktopCss, ".stage"), "display"), "contents");
  assert.equal(value(rule(desktopCss, ".ball-cell"), "padding"), "36px");
  assert.equal(value(rule(desktopCss, ".ask-cell"), "padding"), "36px");
  assert.equal(value(rule(desktopCss, ".site-header"), "padding"), "16px 36px");
});

test("desktop: the lines are #f4f4f4 across the page and #cccccc round the middle column's box", () => {
  assert.match(css, /--line:\s*#f4f4f4/i);
  assert.match(css, /--frame:\s*#cccccc/i);
  assert.match(rule(desktopCss, "body::before"), /border-inline:\s*1px solid var\(--line\)/);
  // The three cells share this rule, which the last of them, .ask-cell, stands for.
  assert.match(rule(desktopCss, ".ask-cell"), /border:\s*solid var\(--frame\)/);
});

test("phone: one column, no lines, 42px all round, the ball and question box 42px apart", () => {
  const body = rule(phoneCss, "body");
  assert.equal(value(body, "grid-template-columns"), "minmax(0, 1fr)");
  assert.equal(value(body, "grid-template-rows"), "auto 1fr auto auto 1fr");
  assert.equal(value(body, "padding"), "42px");
  assert.equal(value(rule(phoneCss, ".site-header"), "grid-area"), "1 / 1");
  assert.equal(value(rule(phoneCss, ".ball-cell"), "grid-area"), "3 / 1");
  assert.equal(value(rule(phoneCss, ".ask-cell"), "grid-area"), "4 / 1");
  assert.equal(value(rule(phoneCss, ".ask-cell"), "margin-top"), "42px");
  assert.equal(value(rule(phoneCss, ".ask-cell"), "padding"), "0");
  assert.equal(value(rule(phoneCss, ".ask-cell"), "border"), "0");
  assert.match(phoneCss, /body::before[^{]*\{\s*display:\s*none/);
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

test("the question box fills its cell: 348px on a desktop and the full width on a phone", () => {
  assert.equal(value(rule(desktopCss, ".ask-wrap"), "width"), "100%");
  // 420px column, less the two 1px lines and 36px of padding each side.
  assert.equal(420 - 2 - 2 * 36, 346);
});
