import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOUBLE_TAP_DISTANCE_PX,
  DOUBLE_TAP_MS,
  isDoubleTap,
  isTap,
  PRESS_MIN_MS,
  pressHoldRemaining,
  TAP_MAX_MOVE_PX,
  TAP_MAX_MS,
} from "../public/tap.js";

test("a quick press that barely moves is a tap", () => {
  assert.equal(isTap({ heldMs: 80, movedPx: 0 }), true);
  assert.equal(isTap({ heldMs: 250, movedPx: 3 }), true);
  // Right at the limits still counts.
  assert.equal(isTap({ heldMs: TAP_MAX_MS, movedPx: TAP_MAX_MOVE_PX }), true);
});

test("a long hold or a drag is not a tap", () => {
  assert.equal(isTap({ heldMs: TAP_MAX_MS + 1, movedPx: 0 }), false, "held too long");
  assert.equal(isTap({ heldMs: 100, movedPx: TAP_MAX_MOVE_PX + 1 }), false, "moved too far");
  assert.equal(isTap({ heldMs: 900, movedPx: 200 }), false, "a drag");
});

test("two taps close in time and place are a double tap", () => {
  const first = { at: 1000, x: 100, y: 100 };
  assert.equal(isDoubleTap(first, { at: 1200, x: 104, y: 98 }), true);
  // Right at the limits still counts.
  assert.equal(isDoubleTap(first, { at: 1000 + DOUBLE_TAP_MS, x: 100 + DOUBLE_TAP_DISTANCE_PX, y: 100 }), true);
});

test("taps too far apart in time, or in space, are not a double tap", () => {
  const first = { at: 1000, x: 100, y: 100 };
  assert.equal(isDoubleTap(first, { at: 1000 + DOUBLE_TAP_MS + 1, x: 100, y: 100 }), false, "too slow");
  assert.equal(isDoubleTap(first, { at: 1100, x: 100 + DOUBLE_TAP_DISTANCE_PX + 1, y: 100 }), false, "too far");
  assert.equal(isDoubleTap(first, { at: 1100, x: 100, y: 100 - 200 }), false, "far, the other way");
});

test("the first tap is never a double tap", () => {
  assert.equal(isDoubleTap(null, { at: 1000, x: 0, y: 0 }), false);
  assert.equal(isDoubleTap(undefined, { at: 1000, x: 0, y: 0 }), false);
});

test("distance is measured in a straight line, not per axis", () => {
  const first = { at: 0, x: 0, y: 0 };
  // 21px across and 21px down is about 29.7px in a straight line: inside 30.
  assert.equal(isDoubleTap(first, { at: 100, x: 21, y: 21 }), true);
  // 22 and 22 is about 31.1: outside.
  assert.equal(isDoubleTap(first, { at: 100, x: 22, y: 22 }), false);
});

test("a click keeps the ball pushed in for at least the minimum, and a long press for no extra time", () => {
  assert.equal(pressHoldRemaining(0), PRESS_MIN_MS);
  assert.equal(pressHoldRemaining(60), PRESS_MIN_MS - 60);
  assert.equal(pressHoldRemaining(PRESS_MIN_MS), 0);
  assert.equal(pressHoldRemaining(2000), 0);
});

test("the timings are sensible together", () => {
  // A tap is quick enough that its push is over before a double tap's window closes...
  assert.ok(PRESS_MIN_MS < DOUBLE_TAP_MS);
  // ...and a press can be a tap for longer than the ball is held in for.
  assert.ok(PRESS_MIN_MS < TAP_MAX_MS);
});
