// Geometry for rotating the ball by hand. Pure functions, no DOM or WebGL, so
// they can be tested in Node.
//
// The ball is a unit sphere seen head-on (orthographic, looking down -z with
// +x right and +y up). Its only visible features are two windows, discs on the
// surface: the front, with the answer, at rest facing the viewer at the ball's
// centre as in the Paper design; and the back, with the model version, on the
// opposite side. A pose is the ball's rotation about the y axis (`rotY`, from
// dragging sideways) and the x axis (`rotX`, from dragging up or down), in radians.

export const BALL_SIZE = 273;
// How far the ball can be tipped up or down; past this the window would just spin over the pole.
export const MAX_TILT = 1.4;
// How long the ball takes to rotate back to rest after it is let go.
export const RETURN_MS = 800;

const RADIUS = BALL_SIZE / 2;

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Where a window is, and how it looks, once the ball is rotated about the x axis
 * by `rotX` and then the y axis by `rotY` (radians). `face` is "front" or "back".
 *
 * Returns offsets in CSS pixels from the window's resting position (the centre of
 * the ball, for both faces), plus the foreshortening: squash the window by
 * `scale` along the direction `angle` (CSS space), and fade it out as it turns
 * away from the viewer. A face is only visible while it is on the near side.
 */
export function windowPlacement(rotY = 0, rotX = 0, face = "front") {
  // The centre of the window on the unit sphere before rotating: (0, 0, side).
  const side = face === "back" ? -1 : 1;
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);

  const y = -side * sx;
  const zAfterX = side * cx;
  const x = zAfterX * sy;
  const z = zAfterX * cy;

  return {
    dx: x * RADIUS,
    dy: -y * RADIUS,
    angle: Math.atan2(-y, x),
    // At rest the front is exactly the design's circle; it only ever squashes.
    scale: Math.min(1, Math.max(z, 0)),
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
