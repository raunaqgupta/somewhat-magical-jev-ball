// When to fill the background with the built-in questions, and which one to show. Pure
// functions (no DOM), so they can be tested in Node. The questions themselves are in
// idle-questions.js; background.js does the showing.

// The background is "quiet" when no question from another visitor has arrived for this long.
export const QUIET_MS = 8000;
// While it is quiet, a built-in question drifts in every so often, somewhere in this range.
export const IDLE_DELAY_MIN_MS = 2500;
export const IDLE_DELAY_MAX_MS = 6000;

/** True when no live question has arrived within QUIET_MS of `now` (`lastLiveAt` is a time, or 0 for never). */
export function isQuiet(now, lastLiveAt) {
  return now - lastLiveAt >= QUIET_MS;
}

/** How long to wait before the next built-in question; `random` returns a number from 0 up to 1. */
export function idleDelay(random = Math.random) {
  return IDLE_DELAY_MIN_MS + random() * (IDLE_DELAY_MAX_MS - IDLE_DELAY_MIN_MS);
}

/**
 * The questions in a random order, each shown once before any comes round again. When they have
 * all been shown they are shuffled again, and the first of the new order is never the last of the
 * old one, so nothing is shown twice in a row.
 */
export function createDeck(questions, random = Math.random) {
  let order = [];
  let last;

  const shuffle = () => {
    order = [...questions];
    // Fisher-Yates.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // The next one is taken from the end.
    if (order.length > 1 && order[order.length - 1] === last) {
      [order[0], order[order.length - 1]] = [order[order.length - 1], order[0]];
    }
  };

  return {
    next() {
      if (!questions.length) return undefined;
      if (!order.length) shuffle();
      last = order.pop();
      return last;
    },
  };
}
