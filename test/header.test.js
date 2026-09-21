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

test("the title is 24px Ballet on a 30px line, falling back to the system font", () => {
  const title = rule(".site-title");
  assert.match(title, /font:\s*400 24px\/30px "Ballet", system-ui, sans-serif/);
  assert.match(title, /color:\s*var\(--title\)/);
  assert.match(css, /--title:\s*#696969/i);
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

  assert.ok(html.includes(`<link rel="preload" href="${src[1]}" as="font" type="font/woff2" crossorigin`), "preloaded, with crossorigin as fonts require");
});

test("the font's SIL Open Font License and copyright notice ship with it", () => {
  const dir = new URL("../public/fonts/", import.meta.url);
  assert.ok(existsSync(new URL("ballet-OFL.txt", dir)));
  const license = readFileSync(new URL("ballet-OFL.txt", dir), "utf8");
  assert.match(license, /Copyright 2020 The Ballet Project Authors/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.ok(statSync(new URL("ballet-OFL.txt", dir)).size > 4_000, "the whole licence text");
});
