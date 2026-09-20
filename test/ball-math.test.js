import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BALL_SIZE,
  dragPose,
  easeOutCubic,
  REST_POSE,
  returnPose,
  rotate,
  rotationAngle,
  windowPlacement,
  windowTransform,
} from "../public/ball-math.js";

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not within ${eps} of ${expected}`);
const RADIUS = BALL_SIZE / 2;
// Dragging this far (in pixels) turns the ball half a turn, so the far side comes round.
const HALF_TURN = Math.PI * RADIUS;

// Every direction of drag, in 15 degree steps all the way round.
const DIRECTIONS = Array.from({ length: 24 }, (_, i) => (i * Math.PI) / 12);
const drag = (q, distance, direction) =>
  dragPose(q, Math.cos(direction) * distance, Math.sin(direction) * distance);

// A repeatable spread of poses, reached the way a person would: by dragging around.
const poses = (count = 200) => {
  let seed = 7;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = [REST_POSE];
  let q = REST_POSE;
  for (let i = 1; i < count; i++) {
    q = dragPose(q, (rand() - 0.5) * 400, (rand() - 0.5) * 400);
    out.push(q);
  }
  return out;
};

test("at rest the front is exactly the design's circle, in place, and the back is hidden", () => {
  const front = windowPlacement(REST_POSE, "front");
  near(front.dx, 0);
  near(front.dy, 0);
  near(front.scale, 1);
  near(front.opacity, 1);

  const back = windowPlacement(REST_POSE, "back");
  assert.equal(back.opacity, 0);
  assert.equal(back.scale, 0);
});

test("dragging follows the pointer: right moves the front right, down moves it down", () => {
  assert.ok(windowPlacement(dragPose(REST_POSE, 40, 0)).dx > 0);
  assert.ok(windowPlacement(dragPose(REST_POSE, -40, 0)).dx < 0);
  assert.ok(windowPlacement(dragPose(REST_POSE, 0, 40)).dy > 0);
  assert.ok(windowPlacement(dragPose(REST_POSE, 0, -40)).dy < 0);
});

test("one ball radius of drag is one radian of rotation, in any direction", () => {
  for (const direction of DIRECTIONS) near(rotationAngle(drag(REST_POSE, RADIUS, direction)), 1, 1e-9);
});

test("the back shows up for every direction of rotation", () => {
  for (const direction of DIRECTIONS) {
    const q = drag(REST_POSE, HALF_TURN, direction);
    const back = windowPlacement(q, "back");
    const label = `direction ${Math.round((direction * 180) / Math.PI)} degrees`;
    near(back.dx, 0, 1e-6);
    near(back.dy, 0, 1e-6);
    near(back.scale, 1, 1e-9);
    near(back.opacity, 1, 1e-9);
    assert.equal(windowPlacement(q, "front").opacity, 0, `front still showing at ${label}`);
  }
});

test("the back comes into view part-way, in every direction, and the front leaves", () => {
  for (const direction of DIRECTIONS) {
    const q = drag(REST_POSE, HALF_TURN * 0.75, direction);
    assert.ok(windowPlacement(q, "back").opacity > 0, `back hidden at ${direction}`);
    assert.equal(windowPlacement(q, "front").opacity, 0);
  }
});

test("the back is reached by dragging in small moves too, not only in one big one", () => {
  for (const direction of DIRECTIONS) {
    let q = REST_POSE;
    for (let i = 0; i < 200; i++) q = drag(q, HALF_TURN / 200, direction);
    near(windowPlacement(q, "back").opacity, 1, 1e-6);
    near(windowPlacement(q, "back").dx, 0, 1e-4);
    near(windowPlacement(q, "back").dy, 0, 1e-4);
  }
});

test("a drag moves the surface the way the pointer moves, from any orientation", () => {
  const eps = 1e-4; // radians
  for (const q of poses()) {
    const before = rotate(q, { x: 0, y: 0, z: 1 });
    if (before.z < 0.2) continue; // only a point on the near side follows the pointer

    const right = rotate(dragPose(q, eps * RADIUS, 0), { x: 0, y: 0, z: 1 });
    near(right.x - before.x, eps * before.z, 1e-6);
    near(right.y - before.y, 0, 1e-6);

    const down = rotate(dragPose(q, 0, eps * RADIUS), { x: 0, y: 0, z: 1 });
    near(down.y - before.y, -eps * before.z, 1e-6);
    near(down.x - before.x, 0, 1e-6);
  }
});

test("many small drags in one direction equal one big drag", () => {
  for (const direction of DIRECTIONS) {
    let small = REST_POSE;
    for (let i = 0; i < 100; i++) small = drag(small, 3, direction);
    const big = drag(REST_POSE, 300, direction);
    const a = rotate(small, { x: 0.3, y: 0.5, z: 0.8 });
    const b = rotate(big, { x: 0.3, y: 0.5, z: 0.8 });
    near(a.x, b.x, 1e-9);
    near(a.y, b.y, 1e-9);
    near(a.z, b.z, 1e-9);
  }
});

test("the pose stays a proper rotation however long the ball is dragged around", () => {
  let q = REST_POSE;
  let seed = 3;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 10000; i++) q = dragPose(q, (rand() - 0.5) * 60, (rand() - 0.5) * 60);
  near(Math.hypot(q.x, q.y, q.z, q.w), 1, 1e-9);
});

test("the two faces are opposite sides of the ball: never both showing, and mirrored", () => {
  for (const q of poses()) {
    const front = windowPlacement(q, "front");
    const back = windowPlacement(q, "back");
    assert.ok(front.scale === 0 || back.scale === 0, "both faces visible");
    near(back.dx, -front.dx, 1e-9);
    near(back.dy, -front.dy, 1e-9);
  }
});

test("a window is only ever squashed and faded, and stays on the ball", () => {
  for (const q of poses()) {
    for (const face of ["front", "back"]) {
      const p = windowPlacement(q, face);
      assert.ok(p.scale >= 0 && p.scale <= 1, `scale ${p.scale}`);
      assert.ok(p.opacity >= 0 && p.opacity <= 1, `opacity ${p.opacity}`);
      assert.ok(Math.hypot(p.dx, p.dy) <= RADIUS + 1e-9, "stays within the ball");
    }
  }
});

test("rotationAngle is how far from rest by the short way, never more than half a turn", () => {
  near(rotationAngle(REST_POSE), 0);
  near(rotationAngle(drag(REST_POSE, HALF_TURN, 0.4)), Math.PI, 1e-9);
  // Three quarters of a turn is the same orientation as a quarter turn the other way.
  near(rotationAngle(drag(REST_POSE, HALF_TURN * 1.5, 1.0)), Math.PI / 2, 1e-9);
  for (const q of poses()) assert.ok(rotationAngle(q) <= Math.PI + 1e-9);
});

test("windowTransform produces a CSS transform string", () => {
  assert.match(
    windowTransform(windowPlacement(REST_POSE)),
    /^translate\(-?0\.00px, -?0\.00px\) rotate\(.+rad\) scaleX\(1\.0000\) rotate\(.+rad\)$/,
  );
});

test("easeOutCubic runs from 0 to 1 and clamps", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-1), 0);
  assert.equal(easeOutCubic(2), 1);
});

test("the ball returns to exactly where it started, from wherever it was let go", () => {
  for (const from of poses()) {
    const start = returnPose(from, 0);
    for (const face of ["front", "back"]) {
      const a = windowPlacement(from, face);
      const b = windowPlacement(start, face);
      near(a.dx, b.dx, 1e-9);
      near(a.dy, b.dy, 1e-9);
      near(a.opacity, b.opacity, 1e-9);
    }
    assert.deepEqual(returnPose(from, 1), REST_POSE);
  }
});

test("the return is fast at first and slows down: each equal step covers less than the one before", () => {
  const steps = 20;
  for (const direction of DIRECTIONS) {
    for (const turn of [0.4, 1.3, 2.4, 3.1]) {
      const from = drag(REST_POSE, turn * RADIUS, direction);
      const angle = (t) => rotationAngle(returnPose(from, t));
      const covered = [];
      for (let i = 0; i < steps; i++) covered.push(angle(i / steps) - angle((i + 1) / steps));

      for (let i = 1; i < steps; i++) {
        assert.ok(covered[i] < covered[i - 1], `step ${i} is not slower than step ${i - 1}`);
      }
      assert.ok(covered[0] > covered[steps - 1] * 10, "the first step is far faster than the last");
      assert.ok(covered.every((c) => c > 0), "and it never turns back on itself");
    }
  }
});

test("the return turns about one axis, the short way round", () => {
  for (const from of poses(60)) {
    if (rotationAngle(from) < 0.05) continue;
    const mid = returnPose(from, 0.5);
    assert.ok(rotationAngle(mid) < rotationAngle(from));
    // Same axis all the way: the vector parts are parallel (or opposite, for -q).
    const cross = {
      x: from.y * mid.z - from.z * mid.y,
      y: from.z * mid.x - from.x * mid.z,
      z: from.x * mid.y - from.y * mid.x,
    };
    near(Math.hypot(cross.x, cross.y, cross.z), 0, 1e-9);
  }
});

test("a pose written as its negative is the same orientation and returns the same way", () => {
  const from = drag(REST_POSE, 2 * RADIUS, 0.7);
  const negated = { x: -from.x, y: -from.y, z: -from.z, w: -from.w };
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const a = windowPlacement(returnPose(from, t), "front");
    const b = windowPlacement(returnPose(negated, t), "front");
    near(a.dx, b.dx, 1e-9);
    near(a.dy, b.dy, 1e-9);
  }
});

test("text is upright at rest, and upright when the ball is turned sideways to show the back", () => {
  near(windowPlacement(REST_POSE, "front").roll, 0);
  const turned = dragPose(REST_POSE, HALF_TURN, 0);
  near(windowPlacement(turned, "back").roll, 0, 1e-9);
});

test("text is upside down when the ball is flipped over the top or the bottom", () => {
  for (const sign of [1, -1]) {
    const flipped = dragPose(REST_POSE, 0, sign * HALF_TURN);
    near(Math.abs(windowPlacement(flipped, "back").roll), Math.PI, 1e-9);
  }
});

test("text turns with the ball: a quarter flip over the top rolls it a quarter, and the front too", () => {
  // Bring the front back to face the viewer after a full flip over the top and half a turn sideways.
  const q = dragPose(dragPose(REST_POSE, 0, HALF_TURN), HALF_TURN, 0);
  near(Math.abs(windowPlacement(q, "front").roll), Math.PI, 1e-9);

  // Tipped part-way, the text is tipped part-way by the same amount and the same way.
  const tipped = dragPose(REST_POSE, RADIUS * 0.6, RADIUS * 0.8);
  const { roll } = windowPlacement(tipped, "front");
  assert.ok(Math.abs(roll) > 0.05 && Math.abs(roll) < Math.PI / 2, `roll ${roll}`);
  const mirrored = dragPose(REST_POSE, -RADIUS * 0.6, RADIUS * 0.8);
  near(windowPlacement(mirrored, "front").roll, -roll, 1e-9);
});

test("roll is always a proper angle, never more than half a turn either way", () => {
  for (const q of poses()) {
    for (const face of ["front", "back"]) {
      const { roll } = windowPlacement(q, face);
      assert.ok(roll >= -Math.PI - 1e-12 && roll <= Math.PI + 1e-12, `roll ${roll}`);
    }
  }
});

test("windowTransform turns the window in its own plane last, by the roll", () => {
  const placement = { dx: 0, dy: 0, angle: 0, scale: 1, roll: Math.PI };
  assert.match(windowTransform(placement), /rotate\(3\.1416rad\)$/);
  // With no roll given it is a quarter of nothing, and the window is as before.
  assert.match(windowTransform({ dx: 1, dy: 2, angle: 0, scale: 1 }), /rotate\(0\.0000rad\)$/);
});
