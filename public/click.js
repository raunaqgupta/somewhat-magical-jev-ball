// Working out what a press on the ball meant: a click, a double click, or a drag.
// No DOM in here, and the clock and timers can be swapped for fakes, so it can be
// tested in Node. It works from pointer events rather than the browser's `dblclick`,
// so a mouse and a finger behave the same: browsers do not reliably send `dblclick`
// for touch.
//
// The ball does nothing when it is pressed. A *click* is a press let go without
// having been dragged, and only then does the ball react. Because a click might be
// the first half of a double click, its reaction waits for the double-click window
// to pass. If a second press begins inside the window and is let go as a click, that
// is a double click: the waiting single click's reaction is cancelled and the caller
// does the double click's reaction, all at once, instead.

/** A press is a click if the pointer hardly moved from where it went down; more and it was a drag. */
export const CLICK_MAX_MOVE_PX = 8;

/**
 * How long a click waits for a second one to begin: the second press has to start
 * within this long of the first click being let go, and within this distance of it.
 * It is also how long a single click's reaction is delayed.
 */
export const DOUBLE_CLICK_MS = 150;
export const DOUBLE_CLICK_DISTANCE_PX = 30;

/** `movedPx` is the furthest the pointer got from where it went down. */
export const isClick = ({ movedPx }) => movedPx <= CLICK_MAX_MOVE_PX;

/**
 * `previous` is the last click ({ at, x, y }: when it was let go, and where) and `press`
 * the next press ({ at, x, y }: when it began, and where). The press can be the second
 * half of a double click if it starts soon enough and near enough.
 */
export function isDoubleClick(previous, press) {
  if (!previous) return false;
  return (
    press.at - previous.at < DOUBLE_CLICK_MS &&
    Math.hypot(press.x - previous.x, press.y - previous.y) <= DOUBLE_CLICK_DISTANCE_PX
  );
}

/**
 * Tracks presses on the ball. Call `down({ x, y })` when the pointer goes down and
 * `up(...)` when it comes up (or is cancelled). `onClick` is called for a single click,
 * once the double-click window has passed with no second click. `up` returns what the
 * press was: "double-click" (the caller does that reaction itself), "click" (`onClick`
 * follows after the window), or "drag" (nothing follows).
 */
export function createClickHandler({
  onClick,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let last = null; // the previous click ({ at, x, y }: when it was let go), to spot a double click
  let waiting = null; // the timer for a single click's reaction
  let second = false; // whether the press now down began a double click

  const stopWaiting = () => {
    if (waiting !== null) clearTimer(waiting);
    waiting = null;
  };

  return {
    // Pressing does not make the ball react. It only decides whether this press could be
    // the second half of a double click: it is if a click is still waiting (so the window
    // has not passed) and this press is close enough to it. Either way the waiting click
    // is cancelled here: if this press turns out to be the second click, the double click
    // takes over; if it turns out to be a drag, the first click is let go.
    down({ x, y }) {
      second = waiting !== null && isDoubleClick(last, { at: now(), x, y });
      stopWaiting();
    },

    up({ x, y, movedPx, cancelled = false }) {
      const wasSecond = second;
      second = false;

      if (cancelled || !isClick({ movedPx })) {
        last = null;
        return "drag";
      }

      if (wasSecond) {
        last = null;
        return "double-click";
      }

      last = { at: now(), x, y };
      stopWaiting();
      waiting = setTimer(() => {
        waiting = null;
        onClick();
      }, DOUBLE_CLICK_MS);
      return "click";
    },
  };
}
