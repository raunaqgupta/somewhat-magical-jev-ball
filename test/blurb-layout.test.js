import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blurbLook,
  estimateSize,
  FONT_MAX,
  FONT_MIN,
  LIFETIME_MAX_MS,
  LIFETIME_MIN_MS,
  OPACITY_MAX,
  OPACITY_MIN,
  pickMotion,
  pickPosition,
} from "../public/blurb-layout.js";

// A deterministic stand-in for Math.random that cycles through `values`.
const sequence = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test("depth sets size, opacity and drift together: nearer is larger, bolder and drifts further", () => {
  const far = blurbLook(0);
  const near = blurbLook(1);
  assert.equal(far.fontSize, FONT_MIN);
  assert.equal(near.fontSize, FONT_MAX);
  assert.equal(far.opacity, OPACITY_MIN);
  assert.equal(near.opacity, OPACITY_MAX);
  assert.ok(near.drift > far.drift);

  let previous = blurbLook(0);
  for (let d = 0.1; d <= 1; d += 0.1) {
    const look = blurbLook(d);
    assert.ok(look.fontSize > previous.fontSize && look.opacity > previous.opacity);
    previous = look;
  }
});

test("a longer question makes a wider pill, and a larger font a taller one", () => {
  assert.ok(estimateSize("Will she marry me?", 8).width < estimateSize("Will I have a good rest of the week?", 8).width);
  assert.ok(estimateSize("hi", 6).height < estimateSize("hi", 10).height);
});

test("blurbs are placed inside the viewport and clear of the ball and input", () => {
  const viewport = { width: 1280, height: 832 };
  const avoid = { x: 340, y: 180, width: 600, height: 480 };
  const size = { width: 150, height: 28 };
  for (let i = 0; i < 500; i++) {
    const spot = pickPosition(viewport, avoid, size);
    assert.ok(spot.x >= 0 && spot.x + size.width <= viewport.width, `x ${spot.x}`);
    assert.ok(spot.y >= 0 && spot.y + size.height <= viewport.height, `y ${spot.y}`);
    if (spot.clear) {
      const hit =
        spot.x < avoid.x + avoid.width && spot.x + size.width > avoid.x &&
        spot.y < avoid.y + avoid.height && spot.y + size.height > avoid.y;
      assert.equal(hit, false);
    }
  }
});

test("a rejected spot is retried, and the first clear one is used", () => {
  const viewport = { width: 1000, height: 1000 };
  const avoid = { x: 400, y: 400, width: 200, height: 200 };
  // First try lands in the middle (blocked), the second in the corner (clear).
  const spot = pickPosition(viewport, avoid, { width: 100, height: 20 }, sequence(0.5, 0.5, 0.01, 0.01));
  assert.equal(spot.clear, true);
  assert.ok(spot.x < 100 && spot.y < 100);
});

test("when the avoid area fills the screen a spot is still returned, flagged as not clear", () => {
  const spot = pickPosition(
    { width: 300, height: 300 },
    { x: 0, y: 0, width: 300, height: 300 },
    { width: 100, height: 20 },
  );
  assert.equal(spot.clear, false);
  assert.ok(Number.isFinite(spot.x) && Number.isFinite(spot.y));
});

test("a pill wider than the viewport is pinned to the left edge, never negative", () => {
  const spot = pickPosition({ width: 200, height: 200 }, { x: -1, y: -1, width: 0, height: 0 }, { width: 500, height: 20 });
  assert.equal(spot.x, 0);
});

test("motion drifts by exactly the requested distance, for a lifetime in range", () => {
  for (let i = 0; i < 200; i++) {
    const { dx, dy, duration } = pickMotion(60);
    assert.ok(Math.abs(Math.hypot(dx, dy) - 60) < 1e-9);
    assert.ok(duration >= LIFETIME_MIN_MS && duration <= LIFETIME_MAX_MS);
  }
});
