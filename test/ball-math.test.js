import { test } from "node:test";
import assert from "node:assert/strict";
import { BALL_SIZE, tumblePose, windowPlacement, windowTransform } from "../public/ball-math.js";

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not within ${eps} of ${expected}`);

test("at rest the window is exactly the design's circle, in place", () => {
  const p = windowPlacement(0, 0);
  near(p.dx, 0);
  near(p.dy, 0);
  near(p.scale, 1);
  near(p.opacity, 1);
});

test("a tumble starts and ends exactly at rest", () => {
  for (const t of [0, 1]) {
    const { rotY, rotX } = tumblePose(t);
    const p = windowPlacement(rotY, rotX);
    near(p.dx, 0, 1e-6);
    near(p.dy, 0, 1e-6);
    near(p.scale, 1, 1e-9);
    near(p.opacity, 1, 1e-9);
  }
});

test("turning the ball moves the window sideways, then behind it", () => {
  assert.ok(windowPlacement(0.3, 0).dx > 0);
  assert.ok(windowPlacement(-0.3, 0).dx < 0);

  const edge = windowPlacement(Math.PI / 2, 0);
  assert.ok(edge.dx > BALL_SIZE / 2 - 20, "window reaches the ball's edge");
  assert.ok(edge.opacity < 0.05, "and is hidden there");

  assert.equal(windowPlacement(Math.PI, 0).opacity, 0);
  assert.equal(windowPlacement(Math.PI, 0).scale, 0);
});

test("tilting the ball forward or back moves the window vertically", () => {
  assert.ok(windowPlacement(0, 0.3).dy > 0, "tilt away drops it");
  assert.ok(windowPlacement(0, -0.3).dy < 0);
});

test("the window is only ever squashed, never stretched, and opacity stays in range", () => {
  for (let i = 0; i <= 200; i++) {
    const { rotY, rotX } = tumblePose(i / 200);
    const p = windowPlacement(rotY, rotX);
    assert.ok(p.scale >= 0 && p.scale <= 1, `scale ${p.scale}`);
    assert.ok(p.opacity >= 0 && p.opacity <= 1, `opacity ${p.opacity}`);
    assert.ok(Math.abs(p.dx) <= BALL_SIZE / 2 + 1e-9, "stays within the ball's width");
  }
});

test("the window stays on the ball's surface: its position never leaves the disc", () => {
  for (let i = 0; i <= 200; i++) {
    const { rotY, rotX } = tumblePose(i / 200);
    const { dx, dy } = windowPlacement(rotY, rotX);
    const r = BALL_SIZE / 2;
    // Offsets are from the resting point (0, -44px above centre), so add it back.
    const x = dx;
    const y = 44 - dy;
    assert.ok(Math.hypot(x, y) <= r + 1e-6, `(${x}, ${y}) outside the ball`);
  }
});

test("tumblePose clamps its input and decelerates to a full turn", () => {
  assert.deepEqual(tumblePose(-1), tumblePose(0));
  assert.deepEqual(tumblePose(2), tumblePose(1));
  near(tumblePose(1).rotY, 2 * Math.PI);
  // Decelerating: the first half covers more than the second.
  assert.ok(tumblePose(0.5).rotY > Math.PI);
});

test("windowTransform produces a CSS transform string", () => {
  assert.match(
    windowTransform(windowPlacement(0, 0)),
    /^translate\(-?0\.00px, -?0\.00px\) rotate\(.+rad\) scaleX\(1\.0000\) rotate\(.+rad\)$/,
  );
});
