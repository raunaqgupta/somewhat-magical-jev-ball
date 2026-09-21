// Telling a tap from a drag, and a double tap from two separate taps, for the ball.
// Pure functions, so they can be tested in Node. This is done from pointer events
// rather than the browser's own `dblclick`, so a mouse and a finger behave the same:
// browsers do not reliably send `dblclick` for touch.

/** A press is a tap if it was quick and the pointer hardly moved. Anything else is a drag or a long hold. */
export const TAP_MAX_MS = 300;
export const TAP_MAX_MOVE_PX = 8;

/** Two taps this close together in time and place are a double tap. */
export const DOUBLE_TAP_MS = 400;
export const DOUBLE_TAP_DISTANCE_PX = 30;

/** However quick the press, the ball stays pushed in this long, so a click's dip can be seen. */
export const PRESS_MIN_MS = 140;

/** `heldMs` is how long the pointer was down, `movedPx` how far from where it went down it ever got. */
export const isTap = ({ heldMs, movedPx }) => heldMs <= TAP_MAX_MS && movedPx <= TAP_MAX_MOVE_PX;

/** `previous` is the last tap ({ at, x, y }, or null) and `tap` this one. */
export function isDoubleTap(previous, tap) {
  if (!previous) return false;
  return (
    tap.at - previous.at <= DOUBLE_TAP_MS &&
    Math.hypot(tap.x - previous.x, tap.y - previous.y) <= DOUBLE_TAP_DISTANCE_PX
  );
}

/** How much longer the ball must stay pushed in, after a press that lasted `heldMs`. */
export const pressHoldRemaining = (heldMs) => Math.max(0, PRESS_MIN_MS - heldMs);
