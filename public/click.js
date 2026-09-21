// Working out what a press on the ball meant: a click, a double click, or a drag.
// No DOM in here, and the clock and timers can be swapped for fakes, so it can be
// tested in Node. It works from pointer events rather than the browser's `dblclick`,
// so a mouse and a finger behave the same: browsers do not reliably send `dblclick`
// for touch.
//
// The ball does nothing when it is pressed. A *click* is a press let go without
// having been dragged, and only then does the ball react. Because a click might be
// the first half of a double click, its reaction waits for the double-click window
// to pass; if a second click arrives inside it, the ball does the double click's
// reaction instead and the single click's never happens.

/** A press is a click if the pointer hardly moved from where it went down; more and it was a drag. */
export const CLICK_MAX_MOVE_PX = 8;

/** Two clicks this close together in time (release to release) and place are a double click. */
export const DOUBLE_CLICK_MS = 300;
export const DOUBLE_CLICK_DISTANCE_PX = 30;

/** `movedPx` is the furthest the pointer got from where it went down. */
export const isClick = ({ movedPx }) => movedPx <= CLICK_MAX_MOVE_PX;

/** `previous` is the last click ({ at, x, y }, or null) and `click` this one. */
export function isDoubleClick(previous, click) {
  if (!previous) return false;
  return (
    click.at - previous.at <= DOUBLE_CLICK_MS &&
    Math.hypot(click.x - previous.x, click.y - previous.y) <= DOUBLE_CLICK_DISTANCE_PX
  );
}

/**
 * Tracks presses on the ball. Call `down()` when the pointer goes down and `up(...)`
 * when it comes up (or is cancelled). `onClick` is called for a single click, once the
 * double-click window has passed with no second click. `up` returns what the press was:
 * "double-click" (the caller does that reaction itself), "click" (`onClick` follows
 * after the window), or "drag" (nothing follows).
 */
export function createClickHandler({
  onClick,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let last = null; // the previous click, to spot a double click
  let waiting = null; // the timer for a single click's reaction

  const stopWaiting = () => {
    if (waiting !== null) clearTimer(waiting);
    waiting = null;
  };

  return {
    // Pressing does not make the ball react. It only means a click that was waiting to
    // react is no longer alone: if this press turns out to be a second click, the double
    // click takes over; if it turns out to be a drag, the first click is let go.
    down() {
      stopWaiting();
    },

    up({ x, y, movedPx, cancelled = false }) {
      if (cancelled || !isClick({ movedPx })) {
        last = null;
        return "drag";
      }

      const click = { at: now(), x, y };
      if (isDoubleClick(last, click)) {
        last = null;
        stopWaiting();
        return "double-click";
      }

      last = click;
      stopWaiting();
      waiting = setTimer(() => {
        waiting = null;
        onClick();
      }, DOUBLE_CLICK_MS);
      return "click";
    },
  };
}
