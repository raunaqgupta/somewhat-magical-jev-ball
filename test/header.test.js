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

const TITLE = "Magic Jev Ball";

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

test("the header is the design's tab hanging from the left edge", () => {
  const header = rule(".site-header");
  assert.match(header, /position:\s*absolute/);
  assert.equal(px(header, "top"), 24);
  assert.match(header, /(?:^|[\s;])left:\s*0\s*;/m);
  // 8px above and below, 16px on the right, 12px on the left.
  assert.match(header, /padding:\s*8px 16px 8px 12px/);
  // A 1px #E3E3E3 border on the top, right and bottom only, and square on the left.
  assert.match(header, /border:\s*1px solid var\(--header-line\)/);
  assert.match(header, /border-left:\s*0/);
  assert.match(header, /border-radius:\s*0 99px 99px 0/);
  assert.match(css.slice(0, css.indexOf("}")), /--header-line:\s*#e3e3e3/i);
});

test("the title is 14px Yellowtail on a 15px line, falling back to the system font", () => {
  const title = rule(".site-title");
  assert.match(title, /font:\s*400 14px\/15px "Yellowtail", system-ui, sans-serif/);
  assert.equal(px(title, "height"), 15);
  assert.match(title, /white-space:\s*pre/);
});

test("the stage clears the header on a small screen without moving the ball off centre", () => {
  const stage = rule(".stage");
  const padding = /padding:\s*([\d.]+)px\s+[\d.]+px/.exec(stage);
  assert.ok(padding, "vertical padding on .stage");
  const headerBottom = px(rule(".site-header"), "top") + 33; // 24px down, 33px tall in the design
  assert.ok(Number(padding[1]) >= headerBottom, `padding ${padding[1]}px is less than the header's ${headerBottom}px`);
  // Equal top and bottom, so the group stays centred.
  assert.match(stage, /padding:\s*([\d.]+)px\s+[\d.]+px\s*;/);
  assert.doesNotMatch(stage, /padding:\s*[\d.]+px\s+[\d.]+px\s+[\d.]+px/);
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
