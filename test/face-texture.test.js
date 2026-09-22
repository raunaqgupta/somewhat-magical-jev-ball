import { test } from "node:test";
import assert from "node:assert/strict";
import { paintBack, paintFront, wrapText } from "../public/face-texture.js";
import { AFFIRMATIVE, NEGATIVE, NON_COMMITTAL, TONE } from "../lib/answers.js";

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not within ${eps} of ${expected}`);

// A stand-in for a canvas 2D context that records what is drawn. Text is 0.4 of its
// font size wide per character: the Paper design measures "It is certain" (13
// characters, 14px) at 72px wide.
function fakeContext() {
  const drawn = { fills: [], texts: [], gradients: [] };
  const ctx = {
    font: "",
    fillStyle: "",
    textAlign: "",
    textBaseline: "",
    fillRect: (x, y, w, h) => drawn.fills.push({ style: ctx.fillStyle, x, y, w, h }),
    fillText: (text, x, y) =>
      drawn.texts.push({ text, x, y, font: ctx.font, style: ctx.fillStyle, align: ctx.textAlign, baseline: ctx.textBaseline }),
    measureText: (s) => ({ width: s.length * 0.4 * parseFloat(ctx.font) }),
    createRadialGradient: (...args) => {
      const gradient = { args, stops: [], addColorStop: (at, colour) => gradient.stops.push([at, colour]) };
      drawn.gradients.push(gradient);
      return gradient;
    },
  };
  return { ctx, drawn };
}
const SIZE = 640;
const scale = SIZE / 149;

test("wrapText breaks at spaces, never exceeds the width, and keeps every word", () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapText(measure, "It is certain", 300), ["It is certain"]);
  assert.deepEqual(wrapText(measure, "Concentrate and ask again", 130), ["Concentrate", "and ask again"]);
  assert.deepEqual(wrapText(measure, "Concentrate and ask again", 120), ["Concentrate", "and ask", "again"]);
  for (const answer of [...AFFIRMATIVE, ...NEGATIVE, ...Object.values(NON_COMMITTAL), ...Object.values(TONE)]) {
    const lines = wrapText(measure, answer, 130);
    assert.equal(lines.join(" "), answer);
    for (const line of lines) assert.ok(measure(line) <= 130 || !line.includes(" "), line);
  }
});

test("wrapText copes with empty text, stray spaces and a word wider than the line", () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapText(measure, "", 100), []);
  assert.deepEqual(wrapText(measure, "   ", 100), []);
  assert.deepEqual(wrapText(measure, "  a   b  ", 100), ["a b"]);
  assert.deepEqual(wrapText(measure, "Supercalifragilistic word", 100), ["Supercalifragilistic", "word"]);
});

test("the back is a white window with the model version in black monospace, centred", () => {
  const { ctx, drawn } = fakeContext();
  paintBack(ctx, SIZE, "jev 1.13");

  assert.deepEqual(drawn.fills, [{ style: "#fff", x: 0, y: 0, w: SIZE, h: SIZE }]);
  assert.equal(drawn.texts.length, 1);
  const [text] = drawn.texts;
  assert.equal(text.text, "jev 1.13");
  assert.equal(text.style, "#000");
  assert.equal(text.align, "center");
  assert.equal(text.baseline, "middle");
  near(text.x, SIZE / 2);
  near(text.y, SIZE / 2);
  // 14px in the design, scaled to the texture, in the monospace stack.
  near(parseFloat(text.font), 14 * scale, 1e-6);
  assert.match(text.font, /ui-monospace/);
  assert.match(text.font, /monospace$/);
});

test("the front is a dark grey window, nearly flat as in the design, and the answer in grey", () => {
  const { ctx, drawn } = fakeContext();
  paintFront(ctx, SIZE, "It is certain");

  assert.equal(drawn.fills[0].style, "#000");
  // The shadow is a radial gradient drawn over it, from the middle out to the edge.
  assert.equal(drawn.gradients.length, 1);
  const [gradient] = drawn.gradients;
  near(gradient.args[2], 0); // starts at a point in the middle
  near(gradient.args[5], SIZE / 2); // and reaches the edge of the window
  assert.equal(drawn.fills[1].style, gradient);

  const opacities = gradient.stops.map(([, colour]) => parseFloat(/,([\d.]+)\)$/.exec(colour)[1]));
  const positions = gradient.stops.map(([at]) => at);
  assert.equal(positions[0], 0);
  assert.equal(positions.at(-1), 1);
  // The design's shadow is #474747 at 0x4A / 255 opacity (inset 0 2px 112px 58px). Its blur is
  // so wide that it covers the window almost evenly: 0.957 of that in the middle, 0.982 at the edge.
  near(opacities[0], 0.957 * (0x4a / 255), 1e-3);
  near(opacities.at(-1), 0.982 * (0x4a / 255), 1e-3);
  for (const colour of gradient.stops.map(([, c]) => c)) assert.match(colour, /^rgba\(71,71,71,/);
  // Over black that is a grey of about 20 out of 255 everywhere, and no lighter at the edge than that.
  for (const opacity of opacities) near(71 * opacity, 20, 0.5);

  const [text] = drawn.texts;
  assert.equal(text.text, "It is certain");
  assert.equal(text.style, "#aaaaaa");
  near(text.x, SIZE / 2);
  near(text.y, SIZE / 2);
  near(parseFloat(text.font), 14 * scale, 1e-6);
  assert.match(text.font, /system-ui/);
});

test("a long answer wraps onto centred lines, an 18px line height apart", () => {
  const { ctx, drawn } = fakeContext();
  paintFront(ctx, SIZE, "Concentrate and ask again");

  assert.ok(drawn.texts.length >= 2, "wrapped");
  const lineHeight = 18 * scale;
  for (let i = 1; i < drawn.texts.length; i++) {
    near(drawn.texts[i].y - drawn.texts[i - 1].y, lineHeight, 1e-6);
  }
  // Centred as a block: the middle of the lines is the middle of the window.
  near((drawn.texts[0].y + drawn.texts.at(-1).y) / 2, SIZE / 2, 1e-6);
  for (const t of drawn.texts) near(t.x, SIZE / 2);
  // No line is wider than the design's 100px.
  for (const t of drawn.texts) {
    assert.ok(ctx.measureText(t.text).width <= 100 * scale + 1e-6 || !t.text.includes(" "), t.text);
  }
});

test("the same 14px text paints larger on the texture of the phone's smaller 96px window", () => {
  const { ctx, drawn } = fakeContext();
  const phoneScale = SIZE / 96;
  paintFront(ctx, SIZE, "Yes", 96);

  const [text] = drawn.texts;
  near(parseFloat(text.font), 14 * phoneScale, 1e-6);
  near(text.x, SIZE / 2);
  near(text.y, SIZE / 2, 1e-6);
  // The wrap is the desktop's 100px scaled to the smaller window (64px of it), so an
  // answer that fits the desktop's window on one line wraps on the phone's.
  const wide = fakeContext();
  paintFront(wide.ctx, SIZE, "It is certain");
  assert.equal(wide.drawn.texts.length, 1, "one line on the desktop window");
  const phone = fakeContext();
  paintFront(phone.ctx, SIZE, "It is certain", 96);
  assert.ok(phone.drawn.texts.length >= 2, "wrapped on the phone's window");
});

test("every answer the ball can give fits inside the window", () => {
  const all = [...AFFIRMATIVE, ...NEGATIVE, ...Object.values(NON_COMMITTAL), ...Object.values(TONE), "…", "..."];
  for (const answer of all) {
    const { ctx, drawn } = fakeContext();
    paintFront(ctx, SIZE, answer);
    const lines = drawn.texts.length;
    assert.ok(lines >= 1 && lines <= 3, `${answer}: ${lines} lines`);
    // The block of lines fits inside the 149px window with room to spare.
    assert.ok(lines * 18 * scale < SIZE * 0.8, answer);
  }
});
