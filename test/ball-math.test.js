import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BALL_SIZE,
  dragPose,
  easeOutCubic,
  MAX_TILT,
  returnPose,
  windowPlacement,
  windowTransform,
  wrapAngle,
} from "../public/ball-math.js";

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not within ${eps} of ${expected}`);
const RADIUS = BALL_SIZE / 2;

test("at rest the window is exactly the design's circle, in place", () => {
  const p = windowPlacement(0, 0);
  near(p.dx, 0);
  near(p.dy, 0);
  near(p.scale, 1);
  near(p.opacity, 1);
});

test("turning the ball moves the window sideways, then behind it", () => {
  assert.ok(windowPlacement(0.3, 0).dx > 0);
  assert.ok(windowPlacement(-0.3, 0).dx < 0);

  const edge = windowPlacement(Math.PI / 2, 0);
  assert.ok(edge.dx > RADIUS - 20, "window reaches the ball's edge");
  assert.ok(edge.opacity < 0.05, "and is hidden there");

  assert.equal(windowPlacement(Math.PI, 0).opacity, 0);
  assert.equal(windowPlacement(Math.PI, 0).scale, 0);
});

test("tipping the ball forward or back moves the window vertically", () => {
  assert.ok(windowPlacement(0, 0.3).dy > 0, "tipping away drops it");
  assert.ok(windowPlacement(0, -0.3).dy < 0);
});

test("the window is only ever squashed, never stretched, and opacity stays in range", () => {
  for (let y = -Math.PI; y <= Math.PI; y += 0.1) {
    for (let x = -MAX_TILT; x <= MAX_TILT; x += 0.1) {
      const p = windowPlacement(y, x);
      assert.ok(p.scale >= 0 && p.scale <= 1, `scale ${p.scale}`);
      assert.ok(p.opacity >= 0 && p.opacity <= 1, `opacity ${p.opacity}`);
      assert.ok(Math.abs(p.dx) <= RADIUS + 1e-9, "stays within the ball's width");
    }
  }
});

test("windowTransform produces a CSS transform string", () => {
  assert.match(
    windowTransform(windowPlacement(0, 0)),
    /^translate\(-?0\.00px, -?0\.00px\) rotate\(.+rad\) scaleX\(1\.0000\) rotate\(.+rad\)$/,
  );
});

test("dragging follows the pointer: right moves the window right, down moves it down", () => {
  const right = dragPose({ rotX: 0, rotY: 0 }, 40, 0);
  assert.ok(windowPlacement(right.rotY, right.rotX).dx > 0);
  const down = dragPose({ rotX: 0, rotY: 0 }, 0, 40);
  assert.ok(windowPlacement(down.rotY, down.rotX).dy > 0);
  const left = dragPose({ rotX: 0, rotY: 0 }, -40, 0);
  assert.ok(windowPlacement(left.rotY, left.rotX).dx < 0);
});

test("one ball radius of drag is one radian of rotation, and drags accumulate", () => {
  near(dragPose({ rotX: 0, rotY: 0 }, RADIUS, 0).rotY, 1);
  near(dragPose({ rotX: 0, rotY: 0 }, 0, RADIUS).rotX, 1);
  const twice = dragPose(dragPose({ rotX: 0, rotY: 0 }, 10, 5), 10, 5);
  near(twice.rotY, 20 / RADIUS);
  near(twice.rotX, 10 / RADIUS);
});

test("tilting is limited so the window cannot flip over the pole, but turning is not", () => {
  assert.equal(dragPose({ rotX: 0, rotY: 0 }, 0, 100000).rotX, MAX_TILT);
  assert.equal(dragPose({ rotX: 0, rotY: 0 }, 0, -100000).rotX, -MAX_TILT);
  assert.ok(dragPose({ rotX: 0, rotY: 0 }, 100000, 0).rotY > 100);
});

test("wrapAngle brings any angle to the same orientation within one half turn", () => {
  near(wrapAngle(0), 0);
  near(wrapAngle(2 * Math.PI), 0);
  near(wrapAngle(3 * Math.PI), Math.PI);
  near(wrapAngle(-3 * Math.PI), Math.PI);
  near(wrapAngle(Math.PI + 0.1), -Math.PI + 0.1);
  near(wrapAngle(-Math.PI - 0.1), Math.PI - 0.1);
  for (let a = -30; a <= 30; a += 0.37) {
    const w = wrapAngle(a);
    assert.ok(w > -Math.PI && w <= Math.PI);
    near(Math.cos(w), Math.cos(a), 1e-9);
    near(Math.sin(w), Math.sin(a), 1e-9);
  }
});

test("easeOutCubic runs from 0 to 1 and clamps", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-1), 0);
  assert.equal(easeOutCubic(2), 1);
});

test("the ball returns to exactly where it started, from where it was let go", () => {
  const from = { rotX: 0.9, rotY: 2.4 };
  assert.deepEqual(returnPose(from, 0), from);
  assert.deepEqual(returnPose(from, 1), { rotX: 0, rotY: 0 });
});

test("the return is fast at first and slows down: each equal step covers less than the one before", () => {
  const from = { rotX: -0.8, rotY: 2.0 };
  const steps = 20;
  const angle = (t) => {
    const p = returnPose(from, t);
    return Math.hypot(p.rotX, p.rotY);
  };
  const covered = [];
  for (let i = 0; i < steps; i++) covered.push(angle(i / steps) - angle((i + 1) / steps));

  for (let i = 1; i < steps; i++) {
    assert.ok(covered[i] < covered[i - 1], `step ${i} (${covered[i]}) is not slower than step ${i - 1} (${covered[i - 1]})`);
  }
  assert.ok(covered[0] > covered[steps - 1] * 10, "the first step is far faster than the last");
  assert.ok(covered.every((c) => c > 0), "and it never turns back on itself");
});

test("a ball let go past half a turn returns the short way round", () => {
  // 3.5 radians is more than half a turn one way, so the short way is back through -2.78.
  const from = { rotX: 0, rotY: 3.5 };
  const halfway = returnPose(from, 0.5);
  assert.ok(Math.abs(wrapAngle(from.rotY)) < Math.PI);
  assert.ok(Math.abs(halfway.rotY) < Math.abs(wrapAngle(from.rotY)));
  // The window does not jump at the moment of release: same orientation before and after wrapping.
  const before = windowPlacement(from.rotY, 0);
  const after = windowPlacement(returnPose(from, 0).rotY, 0);
  near(before.dx, after.dx, 1e-9);
  near(before.opacity, after.opacity, 1e-9);
});
