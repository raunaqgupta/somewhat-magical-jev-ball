import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("style.css");

// All the declarations for a selector, from every rule that ends in it.
const rule = (selector) => {
  const pattern = new RegExp(`(?:^|[\\s,])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "gm");
  const blocks = [...css.matchAll(pattern)].map((m) => m[1]);
  assert.ok(blocks.length, `no rule for ${selector}`);
  return blocks.join("\n");
};
const px = (block, property) => {
  const match = new RegExp(`(?:^|[\\s;])${property}:\\s*([\\d.]+)px`, "m").exec(block);
  assert.ok(match, `no ${property} in ${block.trim().split("\n")[0]}`);
  return Number(match[1]);
};

const TITLE = "Somewhat Magical Jev Ball";

// Whether the page preloads a font file, however its <link> is laid out across lines.
const preloaded = (href) =>
  new RegExp(`<link\\s+rel="preload"\\s+href="${href}"\\s+as="font"\\s+type="font/woff2"\\s+crossorigin`).test(html);

test("the page has one header with the page's name as its heading", () => {
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, "exactly one h1");
  const header = /<header class="site-header">\s*<h1 class="site-title">([^<]*)<\/h1>\s*<\/header>/.exec(html);
  assert.ok(header, "an h1 inside the header");
  assert.equal(header[1], TITLE);
  // The same name as the browser tab.
  assert.equal(/<title>([^<]*)<\/title>/.exec(html)[1], TITLE);
});

test("the header comes first in the page, before the ball", () => {
  assert.ok(html.indexOf('class="site-header"') < html.indexOf('class="stage"'));
});

test("the header is the title cell of the page's grid, not a tab on the edge", () => {
  const header = rule(".site-header");
  assert.doesNotMatch(header, /position:\s*absolute/, "it takes its place in the page");
  assert.match(header, /grid-area:\s*2 \/ 2/, "the middle column, below the empty row above it");
  // The page is a grid, and the title is centred in its cell.
  const body = rule("body");
  assert.match(body, /display:\s*grid/);
  // (the three cells share a rule, which the last of them, .ask-cell, stands for)
  assert.match(rule(".ask-cell"), /align-items:\s*center/);
  assert.match(rule(".ask-cell"), /justify-content:\s*center/);
});

test("the title is 24px Ballet on the design's 34px line (18px on a 22px line on a phone), falling back to the system font", () => {
  const title = rule(".site-title");
  assert.match(title, /font:\s*400 24px\/34px "Ballet", system-ui, sans-serif/);
  assert.match(title, /color:\s*var\(--title\)/);
  assert.match(css, /--title:\s*#696969/i);
  // The phone frame's title is smaller: 18px on a 22px line.
  const phoneStart = css.indexOf("@media (max-width: 600px)");
  const phoneCss = css.slice(phoneStart, css.indexOf("\n}\n", phoneStart));
  const phoneTitle = /(?:^|[\s,])\.site-title\s*\{([^}]*)\}/gm.exec(phoneCss);
  assert.ok(phoneTitle, "a phone rule for .site-title");
  assert.match(phoneTitle[1], /font-size:\s*18px/);
  assert.match(phoneTitle[1], /line-height:\s*22px/);
});

test("Ballet is served from this site, as a real WOFF2 file, preloaded", () => {
  const face = /@font-face\s*\{([^}]*)\}/.exec(css);
  assert.ok(face, "an @font-face");
  assert.match(face[1], /font-family:\s*"Ballet"/);
  assert.match(face[1], /font-display:\s*swap/, "text is shown at once in the fallback, not hidden");
  const src = /src:\s*url\("(\/fonts\/[^"]+)"\)\s*format\("woff2"\)/.exec(face[1]);
  assert.ok(src, "a local woff2 src, not another site");
  assert.ok(!/https?:\/\//.test(face[1]), "no third-party font request");

  const file = `public${src[1]}`;
  assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} exists`);
  const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", "a WOFF2 file");
  assert.ok(bytes.length > 5_000 && bytes.length < 60_000, `${bytes.length} bytes`);

  assert.ok(preloaded(src[1]), "preloaded, with crossorigin as fonts require");
});

test("the font's SIL Open Font License and copyright notice ship with it", () => {
  const dir = new URL("../public/fonts/", import.meta.url);
  assert.ok(existsSync(new URL("ballet-OFL.txt", dir)));
  const license = readFileSync(new URL("ballet-OFL.txt", dir), "utf8");
  assert.match(license, /Copyright 2020 The Ballet Project Authors/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.ok(statSync(new URL("ballet-OFL.txt", dir)).size > 4_000, "the whole licence text");
});

test("the question box's face, Hyperlegible Sans, is served from this site too, and preloaded", () => {
  const face = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]).find((b) => /font-family:\s*"Hyperlegible Sans"/.test(b));
  assert.ok(face, "an @font-face for Hyperlegible Sans");
  assert.match(face, /font-weight:\s*400/);
  assert.match(face, /font-display:\s*swap/, "the box is usable at once in the fallback");
  const src = /src:\s*url\("(\/fonts\/[^"]+)"\)\s*format\("woff2"\)/.exec(face);
  assert.ok(src, "a local woff2 src, not another site");
  assert.ok(!/https?:\/\//.test(face), "no third-party font request");

  const file = new URL(`../public${src[1]}`, import.meta.url);
  assert.ok(existsSync(file), `${src[1]} exists`);
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", "a WOFF2 file");
  assert.ok(bytes.length > 5_000 && bytes.length < 60_000, `${bytes.length} bytes: the Latin subset, not the whole font`);
  assert.ok(preloaded(src[1]), "preloaded, with crossorigin as fonts require");

  // The design's input text is Hyperlegible Sans, ahead of the system font.
  assert.match(css, /--input-font:\s*"Hyperlegible Sans", system-ui, sans-serif/);
  assert.match(rule(".ask input"), /font-family:\s*var\(--input-font\)/);
});

test("Hyperlegible Sans's SIL Open Font License and copyright notice ship with it", () => {
  const file = new URL("../public/fonts/hyperlegible-sans-OFL.txt", import.meta.url);
  assert.ok(existsSync(file));
  const license = readFileSync(file, "utf8");
  assert.match(license, /Copyright 2026 The Hyperlegible Sans Project Authors/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.ok(statSync(file).size > 4_000, "the whole licence text");
});
