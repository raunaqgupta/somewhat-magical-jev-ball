import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IDLE_DELAY_MAX_MS,
  IDLE_DELAY_MIN_MS,
  QUIET_MS,
  createDeck,
  idleDelay,
  isQuiet,
} from "../public/idle-feed.js";
import { IDLE_QUESTIONS } from "../public/idle-questions.js";

const source = (path) => readFileSync(new URL(`../public/${path}`, import.meta.url), "utf8");

// A repeatable "random": a small linear congruential generator.
const seeded = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;

test("there are exactly 1000 built-in questions, none of them repeated", () => {
  assert.equal(IDLE_QUESTIONS.length, 1000);
  assert.equal(new Set(IDLE_QUESTIONS.map((q) => q.toLowerCase())).size, 1000);
});

test("each is a single-line question that fits the blurb's pill", () => {
  for (const q of IDLE_QUESTIONS) {
    assert.equal(typeof q, "string");
    assert.equal(q, q.trim(), `"${q}" has spaces round it`);
    assert.match(q, /^[^\n]+\?$/, `"${q}" is not one line ending in a question mark`);
    // The pill is 260px wide at most, and at its largest (10px text) that is about 40 characters
    // before it is cut off with an ellipsis; a longer question would lose its end.
    assert.ok(q.length <= 60, `"${q}" is ${q.length} characters`);
  }
});

test("none of them asks for or gives personal details", () => {
  // The live feed keeps personal questions out (see `shareable` in the worker); these must be safe too.
  const personal = /@|https?:|www\.|\d{3}|\b(my|our) (name|address|email|number|phone number|boss|doctor|ex|wife|husband|girlfriend|boyfriend)\b/i;
  for (const q of IDLE_QUESTIONS) assert.doesNotMatch(q, personal, q);
});

test("it is quiet once no live question has arrived for QUIET_MS", () => {
  assert.equal(isQuiet(100_000, 0), true, "none has ever arrived");
  assert.equal(isQuiet(100_000, 100_000 - QUIET_MS), true);
  assert.equal(isQuiet(100_000, 100_000 - QUIET_MS + 1), false);
  assert.equal(isQuiet(100_000, 100_000), false, "one has just arrived");
});

test("the wait for the next built-in question is between the minimum and the maximum", () => {
  assert.ok(IDLE_DELAY_MIN_MS > 0 && IDLE_DELAY_MIN_MS < IDLE_DELAY_MAX_MS);
  assert.equal(idleDelay(() => 0), IDLE_DELAY_MIN_MS);
  assert.equal(idleDelay(() => 0.5), (IDLE_DELAY_MIN_MS + IDLE_DELAY_MAX_MS) / 2);
  assert.ok(idleDelay(() => 0.999999) < IDLE_DELAY_MAX_MS);
  // Quiet long enough that a live question is not followed at once by built-in ones.
  assert.ok(QUIET_MS >= IDLE_DELAY_MAX_MS);
});

test("the deck shows every question once before any comes round again", () => {
  const deck = createDeck(IDLE_QUESTIONS, seeded(1));
  const first = Array.from({ length: 1000 }, () => deck.next());
  assert.equal(new Set(first).size, 1000, "all 1000, each once");
  assert.deepEqual(new Set(first), new Set(IDLE_QUESTIONS));
  const second = Array.from({ length: 1000 }, () => deck.next());
  assert.equal(new Set(second).size, 1000, "and again in the next round");
  assert.notDeepEqual(first, second, "in a different order");
});

test("the deck's order is random, not the list's order", () => {
  const deck = createDeck(IDLE_QUESTIONS, seeded(7));
  const shown = Array.from({ length: 20 }, () => deck.next());
  assert.notDeepEqual(shown, IDLE_QUESTIONS.slice(0, 20));
  assert.notDeepEqual(shown, IDLE_QUESTIONS.slice(-20).reverse());
});

test("the deck never shows the same question twice in a row, even across rounds", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const deck = createDeck(["a", "b", "c"], seeded(seed));
    let previous;
    for (let i = 0; i < 300; i++) {
      const next = deck.next();
      assert.notEqual(next, previous, `seed ${seed}, question ${i}`);
      previous = next;
    }
  }
});

test("the deck copes with one question, and with none", () => {
  const one = createDeck(["Only?"]);
  assert.equal(one.next(), "Only?");
  assert.equal(one.next(), "Only?");
  assert.equal(createDeck([]).next(), undefined);
});

test("the deck does not change the list it is given", () => {
  const list = ["a", "b", "c", "d"];
  const deck = createDeck(list, seeded(3));
  for (let i = 0; i < 10; i++) deck.next();
  assert.deepEqual(list, ["a", "b", "c", "d"]);
});

test("the background shows a built-in question only when quiet, and loads the list only when needed", () => {
  const background = source("background.js");
  // Not loaded with the page: a dynamic import, the first time it is needed.
  assert.doesNotMatch(background, /^import[^;]*idle-questions/m);
  assert.match(background, /await import\("\.\/idle-questions\.js"\)/);
  // A live question resets the clock; a built-in one is shown only while quiet, checked again
  // after the list has loaded.
  assert.match(background, /lastLiveAt = Date\.now\(\)/);
  assert.equal(background.match(/isQuiet\(Date\.now\(\), lastLiveAt\)/g).length, 2);
  // It keeps going, and stays out of the way of a hidden tab.
  assert.match(background, /setTimeout\(showIdleQuestion, idleDelay\(\)\)/);
  assert.match(background, /!document\.hidden/);
});

test("a question from another visitor is marked live, a built-in one is not", () => {
  const background = source("background.js");
  // Only the feed's message handler passes `live`; the idle path shows a plain blurb.
  assert.match(background, /show\(question, true\)/);
  assert.match(background, /show\(question\);/);
  assert.match(background, /live \? "blurb blurb-live" : "blurb"/);
  // The design's live-blurb (Paper 1X-0): a pale cyan fill and border, unlike the plain outline.
  const css = source("style.css");
  assert.match(css, /--live-fill:\s*#f3ffff/i);
  assert.match(css, /--live-border:\s*#c7f1f1/i);
  assert.match(css, /\.blurb-live\s*\{[^}]*background:\s*var\(--live-fill\)[^}]*border-color:\s*var\(--live-border\)/);
});

test("the background layer comes before the title and the cells, so they paint over the blurbs", () => {
  const html = source("index.html");
  const layer = html.indexOf('id="background"');
  assert.ok(layer > -1);
  assert.ok(layer < html.indexOf('class="site-header"'), "the layer must precede the title");
  assert.ok(layer < html.indexOf('class="stage"'), "the layer must precede the ball and input");
});

test("clicking a blurb asks its question: the background announces it, and app.js fills the input and submits", () => {
  const background = source("background.js");
  const app = source("app.js");
  const css = source("style.css");
  // The background layer stays out of the input's way; it only announces the click.
  assert.match(background, /el\.addEventListener\("click"/);
  assert.match(background, /new CustomEvent\("blurb-ask", \{ detail: \{ question \} \}\)/);
  assert.doesNotMatch(background, /getElementById\("question"\)|requestSubmit/);
  // app.js fills the input, tells it it was "typed", and submits the form, unless it is busy.
  const handler = /addEventListener\("blurb-ask"[\s\S]*?\n\}\);/.exec(app)?.[0];
  assert.ok(handler, "no blurb-ask handler in app.js");
  assert.match(handler, /if \(busy\) return;/);
  assert.match(handler, /input\.value = event\.detail\.question/);
  assert.match(handler, /new Event\("input"\)/);
  assert.match(handler, /form\.requestSubmit\(\)/);
  // The layer lets clicks through; a blurb takes them.
  assert.match(css, /\.blurb\s*\{[^}]*pointer-events:\s*auto[^}]*cursor:\s*pointer/);
  assert.match(css, /\.background\s*\{[^}]*pointer-events:\s*none/);
});
