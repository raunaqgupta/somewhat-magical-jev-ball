// Draws the two faces of the ball onto a square canvas, to be wrapped onto the 3D
// model as textures. Each function takes the 2D drawing context, so it can be
// tested without a browser. The measurements are the Paper designs' (a 149px
// window, 14px text on an 18px line), scaled to the texture size.

const WINDOW_PX = 149;
const TEXT_MAX_WIDTH_PX = 100;
const FONT_PX = 14;
const LINE_PX = 18;

const FRONT_FONT = "system-ui, sans-serif";
const BACK_FONT = 'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

// The front's inner glow, from the design: inset 0 2px 112px 58px #4747474A. The 58px
// spread leaves only a 33px disc unshadowed, and the 112px blur spreads that so far that
// the whole window is a near-flat dark grey (about 20 of 255). This is the shadow's
// opacity, as a share of the glow colour's own opacity, at each fraction of the way from
// the centre (0) to the edge (1) of the 149px window: 1 minus the share of the blur that
// falls on the unshadowed disc.
const GLOW_COLOR = [71, 71, 71];
const GLOW_OPACITY = 0x4a / 255;
const GLOW_STOPS = [
  [0, 0.957],
  [0.5, 0.966],
  [1, 0.982],
];

/** Split `text` into lines no wider than `maxWidth`, breaking at spaces. `measure` gives a string's width. */
export function wrapText(measure, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centredText(ctx, size, text, { font, color }) {
  const scale = size / WINDOW_PX;
  ctx.font = `${FONT_PX * scale}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = wrapText((s) => ctx.measureText(s).width, text, TEXT_MAX_WIDTH_PX * scale);
  const lineHeight = LINE_PX * scale;
  const top = size / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, size / 2, top + i * lineHeight));
}

/** The front: a dark window with a soft lighter glow round its edge, and the answer in grey. */
export function paintFront(ctx, size, text) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  // The design offsets the shadow 2px down.
  const centreY = size / 2 + 2 * (size / WINDOW_PX);
  const glow = ctx.createRadialGradient(size / 2, centreY, 0, size / 2, centreY, size / 2);
  for (const [at, share] of GLOW_STOPS) {
    glow.addColorStop(at, `rgba(${GLOW_COLOR.join(",")},${(share * GLOW_OPACITY).toFixed(4)})`);
  }
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  centredText(ctx, size, text, { font: FRONT_FONT, color: "#aaaaaa" });
}

/** The back: a white window with the model version in black monospace. */
export function paintBack(ctx, size, text) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  centredText(ctx, size, text, { font: BACK_FONT, color: "#000" });
}
