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

test("desktop: a grid of 1fr, 421px, 1fr columns and five rows, the middle three the design's heights", () => {
  const body = rule(desktopCss, "body");
  assert.equal(value(body, "display"), "grid");
  // The design's middle column is 421px, its two 1px box lines included.
  assert.equal(value(body, "grid-template-columns"), "1fr 421px 1fr");
  // The empty rows above and below take what is left, so the middle three are centred. The
  // title's row is the desktop frame's 71px (the phone frame's stays 63px); the question
  // box's row is 117px plus the 1px line under it.
  assert.equal(value(body, "grid-template-rows"), "1fr 71px 346px 118px 1fr");
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
  // The title sits 20px from its cell's top and 16px from its bottom (the 71px row).
  assert.equal(value(rule(desktopCss, ".site-header"), "padding"), "20px 36px 16px");
});

test("desktop: the lines are dashed #EEEEEE across the page and solid #AAAAAA round the box", () => {
  assert.match(css, /--line:\s*#eeeeee/i);
  assert.match(css, /--line-style:\s*dashed/i);
  assert.match(css, /--frame:\s*#aaaaaa/i);
  assert.match(css, /--cell:\s*#fcfcfc/i);
  // The page's own lines run out dashed; the cells redraw them solid where they cross the
  // box, and the box's own lines (its sides and its top and bottom) are the darker frame.
  assert.match(rule(desktopCss, "body::before"), /border-inline:\s*1px var\(--line-style\) var\(--line\)/);
  // The three cells share the frame-drawing rule, which the last of them, .ask-cell,
  // stands for.
  assert.match(rule(desktopCss, ".ask-cell"), /border:\s*solid var\(--frame\)/);
  assert.match(rule(desktopCss, ".ball-cell"), /border-top:\s*1px solid var\(--line\)/);
  assert.match(rule(desktopCss, ".ask-cell"), /border-bottom:\s*1px solid var\(--frame\)/);
});

test("phone: the same grid, with the middle column as wide as the title and the design's row heights", () => {
  const body = rule(phoneCss, "body");
  assert.equal(value(body, "grid-template-columns"), "1fr minmax(0, max-content) 1fr");
  // The title's row can grow if the title has to wrap on a very narrow phone.
  assert.equal(value(body, "grid-template-rows"), "1fr minmax(63px, auto) 252px 118px 1fr");
  assert.equal(value(body, "padding"), undefined, "the cells have the padding, not the page");
  // The cells and the lines are the desktop's: the phone does not move or hide them.
  assert.doesNotMatch(phoneCss, /grid-area|display:\s*none|border/);
  // The phone frame keeps the paler, solid lines of the old design, on clear cells.
  assert.match(phoneCss, /--line:\s*#f4f4f4/i);
  assert.match(phoneCss, /--line-style:\s*solid/i);
  assert.match(phoneCss, /--frame:\s*#cccccc/i);
  assert.match(phoneCss, /--cell:\s*transparent/i);
  assert.equal(value(rule(phoneCss, ".site-header"), "padding"), "16px");
  // The ball's and the question box's cells share a rule, which the last of them stands for.
  assert.match(phoneCss, /\.ball-cell,\s*\.ask-cell\s*\{/);
  assert.equal(value(rule(phoneCss, ".ask-cell"), "padding"), "36px 16px");
});

test("the lines run out past their cells without making the page scroll sideways", () => {
  // The body's overflow is only its own if the page's is set (not left visible): otherwise it is passed
  // up to the page, which then scrolls to the far end of the lines.
  assert.equal(value(rule(desktopCss, "html"), "overflow"), "auto");
  assert.equal(value(rule(desktopCss, "body"), "overflow-x"), "clip");
});

test("the ball is 273px on a desktop and 179px on a phone", () => {
  const desktop = rule(desktopCss, ".ball");
  assert.equal(value(desktop, "width"), "273px");
  assert.equal(value(desktop, "height"), "273px");
  const phone = rule(phoneCss, ".ball");
  assert.equal(value(phone, "width"), "179px");
  assert.equal(value(phone, "height"), "179px");
});

test("the window is the design's 149px on a desktop and 96px on a phone, centred in the ball", () => {
  const window = rule(desktopCss, ".window");
  assert.equal(value(window, "width"), "149px");
  assert.equal(value(window, "height"), "149px");
  assert.equal(value(window, "top"), "calc(50% - 74.5px)");
  assert.equal(value(window, "left"), "calc(50% - 74.5px)");
  const phone = rule(phoneCss, ".window");
  // The phone frame's window is 96px (drawn 96×95 there, taken as a circle).
  assert.equal(value(phone, "width"), "96px");
  assert.equal(value(phone, "height"), "96px");
  assert.equal(value(phone, "top"), "calc(50% - 48px)");
  assert.equal(value(phone, "left"), "calc(50% - 48px)");
});

test("the window's shadow is the design's: #474747 at 0x4A, inset 0 2px 112px 58px", () => {
  assert.match(css, /--window-glow:\s*#4747474a/i);
  assert.equal(value(rule(css, ".window-front"), "box-shadow"), "var(--window-glow) 0 2px 112px 58px inset");
});

test("the question box fills its cell: 347px on a desktop and the full width on a phone", () => {
  assert.equal(value(rule(desktopCss, ".ask-wrap"), "width"), "100%");
  // 421px column, less the two 1px lines and 36px of padding each side.
  assert.equal(421 - 2 - 2 * 36, 347);
});
