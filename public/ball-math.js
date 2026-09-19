// Geometry for the answer window on the 3D ball. Pure functions, no DOM or
// WebGL, so they can be tested in Node.
//
// The ball is a unit sphere seen head-on (orthographic, looking down -z with
// +x right and +y up). The window is a disc on its surface; at rest it sits
// where the Paper design puts it: 44px above the ball's centre.

export const BALL_SIZE = 273;
export const WINDOW_OFFSET_Y = 44;

const RADIUS = BALL_SIZE / 2;
const REST = (() => {
  const y = WINDOW_OFFSET_Y / RADIUS;
  return { y, z: Math.sqrt(1 - y * y) };
})();

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Where the window is, and how it looks, once the ball is rotated about the
 * x axis by `rotX` and then the y axis by `rotY` (radians).
 *
 * Returns offsets in CSS pixels from the resting position, plus the
 * foreshortening: squash the window by `scale` along the direction `angle`
 * (CSS space), and fade it out as it turns away from the viewer.
 */
export function windowPlacement(rotY = 0, rotX = 0) {
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);

  const y = REST.y * cx - REST.z * sx;
  const zAfterX = REST.y * sx + REST.z * cx;
  const x = zAfterX * sy;
  const z = zAfterX * cy;

  return {
    dx: x * RADIUS,
    dy: -(y - REST.y) * RADIUS,
    angle: Math.atan2(-y, x),
    // Normalised so the resting window is exactly the design's circle.
    scale: Math.min(1, Math.max(z, 0) / REST.z),
    opacity: smoothstep(0.05, 0.3, z),
  };
}

/**
 * Ball pose `t` of the way (0 to 1) through a tumble: one full turn about the
 * y axis that decelerates, with a wobble about x that dies away. Starts and
 * ends exactly at rest.
 */
export function tumblePose(t) {
  const u = Math.min(1, Math.max(0, t));
  return {
    rotY: 2 * Math.PI * (1 - (1 - u) ** 3),
    rotX: 0.35 * Math.sin(4 * Math.PI * u) * (1 - u),
  };
}

/** CSS `transform` value for a placement from `windowPlacement`. */
export function windowTransform({ dx, dy, angle, scale }) {
  return (
    `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ` +
    `rotate(${angle.toFixed(4)}rad) scaleX(${scale.toFixed(4)}) rotate(${(-angle).toFixed(4)}rad)`
  );
}
