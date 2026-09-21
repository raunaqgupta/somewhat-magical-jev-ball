import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLICK_MAX_MOVE_PX,
  createClickHandler,
  DOUBLE_CLICK_DISTANCE_PX,
  DOUBLE_CLICK_MS,
  isClick,
  isDoubleClick,
} from "../public/click.js";

// A handler on a fake clock, so time can be stepped through exactly. `advance` runs any
// timers that fall due on the way, in order.
function harness() {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  const reactions = [];
  const handler = createClickHandler({
    onClick: () => reactions.push(time),
    now: () => time,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: time + ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  const advance = (ms) => {
    const end = time + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    time = end;
  };
  const press = (x = 100, y = 100) => handler.down({ x, y });
  const release = (opts = {}) => handler.up({ x: 100, y: 100, movedPx: 0, ...opts });
  /** A whole click: press, a moment, release. */
  const click = (opts = {}, heldMs = 50) => {
    press(opts.x, opts.y);
    advance(heldMs);
    return release(opts);
  };
  return { handler, reactions, advance, press, release, click, pending: () => timers.size, now: () => time };
}

test("pressing the ball does nothing, however long it is held", () => {
  const h = harness();
  h.press();
  h.advance(5000);
  assert.deepEqual(h.reactions, []);
  assert.equal(h.pending(), 0, "nothing is even waiting");
});

test("the ball reacts only once a click has fully registered, after the double-click window", () => {
  const h = harness();
  h.press();
  h.advance(60);
  assert.deepEqual(h.reactions, [], "not on the press");
  assert.equal(h.release(), "click");
  assert.deepEqual(h.reactions, [], "not on the release either: it waits to see if a second click follows");
  h.advance(DOUBLE_CLICK_MS - 1);
  assert.deepEqual(h.reactions, []);
  h.advance(1);
  assert.deepEqual(h.reactions, [60 + DOUBLE_CLICK_MS], "then it reacts, once");
  h.advance(5000);
  assert.equal(h.reactions.length, 1);
});

test("a long hold and release is still a click, once it is let go", () => {
  const h = harness();
  h.press();
  h.advance(2000);
  assert.deepEqual(h.reactions, []);
  assert.equal(h.release(), "click");
  h.advance(DOUBLE_CLICK_MS);
  assert.equal(h.reactions.length, 1);
});

test("a double click is reported for the caller to act on, and NEVER gives the single click's reaction", () => {
  const h = harness();
  assert.equal(h.click(), "click");
  h.advance(DOUBLE_CLICK_MS - 50);
  assert.equal(h.click(), "double-click");
  h.advance(10_000);
  assert.deepEqual(h.reactions, [], "the single click's own reaction never happens");
  assert.equal(h.pending(), 0);
});

test("the second press cancels the first click's wait the moment it goes down", () => {
  const h = harness();
  h.click();
  h.advance(DOUBLE_CLICK_MS - 50);
  assert.equal(h.pending(), 1, "the first click is waiting");
  h.press();
  assert.equal(h.pending(), 0, "pressing again cancels it, before it is even released");
  h.advance(2000);
  assert.deepEqual(h.reactions, []);
});

test("the window runs from the first click being let go to the second press beginning", () => {
  const justInside = harness();
  justInside.click();
  justInside.advance(DOUBLE_CLICK_MS - 1);
  justInside.press();
  justInside.advance(40);
  assert.equal(justInside.release(), "double-click", "began 1ms inside the window");

  const justOutside = harness();
  justOutside.click();
  justOutside.advance(DOUBLE_CLICK_MS);
  // The first click has already reacted by now, so this is a new click on its own.
  assert.equal(justOutside.reactions.length, 1);
  assert.equal(justOutside.click(), "click", "began right at the end of the window");
  justOutside.advance(DOUBLE_CLICK_MS);
  assert.equal(justOutside.reactions.length, 2);
});

test("how long the second press is held does not matter: what counts is when it began", () => {
  for (const heldMs of [10, 120, 400, 1500]) {
    const h = harness();
    h.click();
    h.advance(DOUBLE_CLICK_MS - 30);
    h.press();
    h.advance(heldMs);
    assert.equal(h.release(), "double-click", `second press held ${heldMs}ms`);
    assert.deepEqual(h.reactions, []);
  }
});

test("two clicks with the second beginning too late are two single clicks, each reacting", () => {
  const h = harness();
  assert.equal(h.click(), "click");
  h.advance(DOUBLE_CLICK_MS + 200);
  assert.equal(h.reactions.length, 1, "the first has already reacted");
  assert.equal(h.click(), "click");
  h.advance(DOUBLE_CLICK_MS);
  assert.equal(h.reactions.length, 2);
});

test("a drag is not a click: nothing reacts", () => {
  const h = harness();
  h.press();
  h.advance(300);
  assert.equal(h.release({ movedPx: 200 }), "drag");
  h.advance(5000);
  assert.deepEqual(h.reactions, []);
  assert.equal(h.pending(), 0);
});

test("a press that is cancelled is not a click", () => {
  const h = harness();
  h.press();
  h.advance(50);
  assert.equal(h.release({ cancelled: true }), "drag");
  h.advance(5000);
  assert.deepEqual(h.reactions, []);
});

test("a click followed by a drag: the drag takes over and the click never reacts", () => {
  const h = harness();
  h.click();
  h.advance(DOUBLE_CLICK_MS - 50);
  h.press();
  assert.equal(h.release({ movedPx: 90 }), "drag");
  h.advance(5000);
  assert.deepEqual(h.reactions, []);
});

test("a second press that turns into a drag is not a double click", () => {
  const h = harness();
  h.click();
  h.advance(DOUBLE_CLICK_MS - 50);
  h.press();
  h.advance(200);
  assert.equal(h.release({ movedPx: 120 }), "drag");
  // And it did not leave a half-finished double click behind: the next click starts afresh.
  h.advance(50);
  assert.equal(h.click(), "click");
  h.advance(DOUBLE_CLICK_MS);
  assert.equal(h.reactions.length, 1);
});

test("a drag in between stops two clicks from being a double click", () => {
  const h = harness();
  h.click();
  h.advance(40);
  h.press();
  h.advance(40);
  h.release({ movedPx: 60 }); // a drag
  h.advance(40);
  assert.equal(h.click(), "click", "not a double click: the drag came between");
  h.advance(DOUBLE_CLICK_MS);
  assert.equal(h.reactions.length, 1);
});

test("two quick clicks in different places are not a double click, and react once between them", () => {
  const h = harness();
  h.click({ x: 100, y: 100 });
  h.advance(60);
  assert.equal(h.click({ x: 100 + DOUBLE_CLICK_DISTANCE_PX + 20, y: 100 }), "click");
  h.advance(5000);
  assert.equal(h.reactions.length, 1, "the first was let go when the second was pressed; the second reacts");
});

test("a third click after a double click starts afresh; it is not another double click", () => {
  const h = harness();
  h.click();
  h.advance(60);
  assert.equal(h.click(), "double-click");
  h.advance(60);
  assert.equal(h.click(), "click");
  h.advance(DOUBLE_CLICK_MS);
  assert.equal(h.reactions.length, 1);
});

test("what counts as a click: the pointer hardly moved", () => {
  assert.equal(isClick({ movedPx: 0 }), true);
  assert.equal(isClick({ movedPx: CLICK_MAX_MOVE_PX }), true);
  assert.equal(isClick({ movedPx: CLICK_MAX_MOVE_PX + 1 }), false);
  assert.equal(isClick({ movedPx: 300 }), false);
});

test("what can start a double click: a press soon enough and near enough after a click", () => {
  const first = { at: 1000, x: 100, y: 100 };
  assert.equal(isDoubleClick(first, { at: 1000 + DOUBLE_CLICK_MS - 1, x: 100, y: 100 }), true);
  assert.equal(isDoubleClick(first, { at: 1000 + DOUBLE_CLICK_MS, x: 100, y: 100 }), false, "the window has closed");
  assert.equal(isDoubleClick(first, { at: 1050, x: 100 + DOUBLE_CLICK_DISTANCE_PX, y: 100 }), true);
  assert.equal(isDoubleClick(first, { at: 1050, x: 100 + DOUBLE_CLICK_DISTANCE_PX + 1, y: 100 }), false);
  assert.equal(isDoubleClick(null, { at: 1000, x: 0, y: 0 }), false);
  // 21px across and 21px down is about 29.7 in a straight line (inside 30); 22 and 22 is 31.1 (outside).
  assert.equal(isDoubleClick({ at: 0, x: 0, y: 0 }, { at: 50, x: 21, y: 21 }), true);
  assert.equal(isDoubleClick({ at: 0, x: 0, y: 0 }, { at: 50, x: 22, y: 22 }), false);
});

test("the wait is 0.15 seconds", () => {
  assert.equal(DOUBLE_CLICK_MS, 150);
});
