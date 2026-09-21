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

test("the header is plain text centred at the top of the page, not a tab on the edge", () => {
  const header = rule(".site-header");
  assert.doesNotMatch(header, /position:\s*absolute/, "it takes its place in the page");
  assert.doesNotMatch(header, /(?:^|[\s;])(?:top|left):/m);
  assert.doesNotMatch(header, /border/);
  assert.doesNotMatch(css, /--header-line/);
  // The page is a column with the header at the top, centred across it.
  const body = rule("body");
  assert.match(body, /display:\s*flex/);
  assert.match(body, /flex-direction:\s*column/);
  assert.match(body, /align-items:\s*center/);
  assert.match(body, /justify-content:\s*space-between/);
});

test("the title is 14px Yellowtail on a 15px line, falling back to the system font", () => {
  const title = rule(".site-title");
  assert.match(title, /font:\s*400 14px\/15px "Yellowtail", system-ui, sans-serif/);
  assert.equal(px(title, "height"), 15);
  assert.match(title, /white-space:\s*pre/);
});

test("Yellowtail is served from this site, as a real WOFF2 file, preloaded", () => {
  const face = /@font-face\s*\{([^}]*)\}/.exec(css);
  assert.ok(face, "an @font-face");
  assert.match(face[1], /font-family:\s*"Yellowtail"/);
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

test("the font's Apache 2.0 licence and copyright notice ship with it", () => {
  const dir = new URL("../public/fonts/", import.meta.url);
  assert.ok(existsSync(new URL("yellowtail-LICENSE.txt", dir)));
  assert.ok(existsSync(new URL("yellowtail-NOTICE.txt", dir)));
  const license = readFileSync(new URL("yellowtail-LICENSE.txt", dir), "utf8");
  assert.match(license, /Apache License/);
  assert.match(license, /Version 2\.0, January 2004/);
  assert.ok(statSync(new URL("yellowtail-LICENSE.txt", dir)).size > 10_000, "the whole licence text");
  const notice = readFileSync(new URL("yellowtail-NOTICE.txt", dir), "utf8");
  assert.match(notice, /Copyright \(c\) 2011 by Brian J\. Bonislawsky DBA Astigmatic/);
  assert.match(notice, /Apache License, Version 2\.0/);
});
