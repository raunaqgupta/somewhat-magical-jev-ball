// Geometry for rotating the ball by hand. Pure functions, no DOM or WebGL, so
// they can be tested in Node.
//
// The ball is a unit sphere seen head-on (orthographic, looking down -z with
// +x right and +y up). Its only visible feature is the answer window, a disc on
// the surface that at rest sits where the Paper design puts it: 44px above the
// ball's centre. A pose is the ball's rotation about the y axis (`rotY`, from
// dragging sideways) and the x axis (`rotX`, from dragging up or down), in radians.

export const BALL_SIZE = 273;
export const WINDOW_OFFSET_Y = 44;
// How far the ball can be tipped up or down; past this the window would just spin over the pole.
export const MAX_TILT = 1.4;
// How long the ball takes to rotate back to rest after it is let go.
export const RETURN_MS = 800;

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

/** CSS `transform` value for a placement from `windowPlacement`. */
export function windowTransform({ dx, dy, angle, scale }) {
  return (
    `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ` +
    `rotate(${angle.toFixed(4)}rad) scaleX(${scale.toFixed(4)}) rotate(${(-angle).toFixed(4)}rad)`
  );
}

/**
 * The pose after the pointer moves by (`dx`, `dy`) CSS pixels. The surface under
 * the pointer follows it, as if the ball were a trackball: one ball radius of
 * movement is one radian of rotation. Dragging right moves the window right,
 * and dragging down moves it down.
 */
export function dragPose(pose, dx, dy) {
  return {
    rotY: pose.rotY + dx / RADIUS,
    rotX: Math.min(MAX_TILT, Math.max(-MAX_TILT, pose.rotX + dy / RADIUS)),
  };
}

/** An angle brought into (-PI, PI], the same orientation by the shortest way round. */
export function wrapAngle(angle) {
  const turn = 2 * Math.PI;
  const wrapped = angle - turn * Math.round(angle / turn);
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Fast at first and slowing to a stop: the speed at t = 0 is three times the average. */
export const easeOutCubic = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/**
 * The pose `t` of the way (0 to 1) through the rotation back to rest, from
 * `from`. It turns the short way round, and eases out, so it starts quickly and
 * slows as it settles exactly at rest.
 */
export function returnPose(from, t) {
  const remaining = 1 - easeOutCubic(t);
  return {
    rotY: wrapAngle(from.rotY) * remaining,
    rotX: from.rotX * remaining,
  };
}
