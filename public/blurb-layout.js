// Layout rules for the question blurbs drifting in the background. Pure
// functions (no DOM), so they can be tested in Node.
//
// Each blurb gets a depth from 0 (far) to 1 (near). Nearer blurbs are larger,
// more opaque and drift further, so the background reads as having depth. The
// size range follows the Paper design's 6px to 10px pills.

export const FONT_MIN = 6;
export const FONT_MAX = 10;
export const OPACITY_MIN = 0.5;
export const OPACITY_MAX = 1;
export const DRIFT_MIN = 24;
export const DRIFT_MAX = 96;
export const LIFETIME_MIN_MS = 8000;
export const LIFETIME_MAX_MS = 14000;

// Pill chrome from the design: 8px padding and a 1px border on each side.
const PAD = 8 + 1;
const AVG_CHAR_WIDTH = 0.55; // in ems, for the system sans-serif
const LINE_HEIGHT = 1.25;

const lerp = (a, b, t) => a + (b - a) * t;

/** Size, opacity and drift for a blurb at `depth` (0 to 1). */
export function blurbLook(depth) {
  return {
    fontSize: lerp(FONT_MIN, FONT_MAX, depth),
    opacity: lerp(OPACITY_MIN, OPACITY_MAX, depth),
    drift: lerp(DRIFT_MIN, DRIFT_MAX, depth),
  };
}

/** Rough pixel size of a one-line pill, before it is measured in the DOM. */
export function estimateSize(text, fontSize) {
  return {
    width: text.length * fontSize * AVG_CHAR_WIDTH + PAD * 2,
    height: fontSize * LINE_HEIGHT + PAD * 2,
  };
}

const overlaps = (a, b) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * A random top-left position inside `viewport` for a pill of `size`, kept out
 * of the `avoid` rectangle (the ball and input) when there is room. On a small
 * screen where there is none, it is placed anyway, behind the content.
 */
export function pickPosition(viewport, avoid, size, rand = Math.random, tries = 12) {
  const maxX = Math.max(0, viewport.width - size.width);
  const maxY = Math.max(0, viewport.height - size.height);

  let spot;
  for (let i = 0; i < tries; i++) {
    spot = { x: rand() * maxX, y: rand() * maxY };
    if (!overlaps({ ...spot, ...size }, avoid)) return { ...spot, clear: true };
  }
  return { ...spot, clear: false };
}

/** A random lifetime, and a drift direction, for a new blurb. */
export function pickMotion(drift, rand = Math.random) {
  const angle = rand() * 2 * Math.PI;
  return {
    dx: Math.cos(angle) * drift,
    dy: Math.sin(angle) * drift,
    duration: lerp(LIFETIME_MIN_MS, LIFETIME_MAX_MS, rand()),
  };
}
