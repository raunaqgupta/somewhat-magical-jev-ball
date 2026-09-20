// Geometry for rotating the ball by hand. Pure functions, no DOM or WebGL, so
// they can be tested in Node.
//
// The ball is a unit sphere seen head-on (orthographic, looking down -z with
// +x right, +y up and +z towards the viewer). Its only visible features are two
// windows, discs on the surface: the front, with the answer, at rest facing the
// viewer at the ball's centre as in the Paper design; and the back, with the
// model version, on the opposite side.
//
// A pose is the ball's whole orientation, as a unit quaternion {x, y, z, w}. Each
// drag turns the ball about the screen's own axes, whatever its current
// orientation, like a trackball, so it can be turned to any orientation by
// dragging in any direction, and the back can be reached from every direction.

export const BALL_SIZE = 273;
// How long the ball takes to rotate back to rest after it is let go.
export const RETURN_MS = 800;

const RADIUS = BALL_SIZE / 2;

/** The ball at rest: the front facing the viewer. */
export const REST_POSE = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const multiply = (a, b) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

const normalize = (q) => {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
};

/** The vector `v` = {x, y, z} turned by the pose `q`. */
export function rotate(q, v) {
  // v + 2w(u x v) + 2u x (u x v), with u the vector part of q.
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** How far the pose is from rest, in radians, from 0 to PI (the short way round). */
export const rotationAngle = (q) => 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), Math.abs(q.w));

/**
 * Where a window is, and how it looks, with the ball in pose `q`. `face` is
 * "front" or "back".
 *
 * Returns offsets in CSS pixels from the window's resting position (the centre of
 * the ball, for both faces), plus the foreshortening: squash the window by
 * `scale` along the direction `angle` (CSS space), and fade it out as it turns
 * away from the viewer. A face is only visible while it is on the near side.
 * `roll` turns the window in its own plane with the ball, so its text goes
 * upside down when the ball is flipped over, as a label on a real ball would.
 */
export function windowPlacement(q, face = "front") {
  // The centre of the window on the unit sphere at rest: (0, 0, side).
  const { x, y, z } = rotate(q, { x: 0, y: 0, z: face === "back" ? -1 : 1 });
  // Text on either face reads upright when the ball's own "up" points up the screen.
  const up = rotate(q, { x: 0, y: 1, z: 0 });

  return {
    dx: x * RADIUS,
    dy: -y * RADIUS,
    angle: Math.atan2(-y, x),
    // At rest the front is exactly the design's circle; it only ever squashes.
    scale: Math.min(1, Math.max(z, 0)),
    opacity: smoothstep(0.05, 0.3, z),
    // Clockwise, as CSS measures it, from the screen's up to the ball's up.
    roll: Math.atan2(up.x, up.y),
  };
}

/** CSS `transform` value for a placement from `windowPlacement`. */
export function windowTransform({ dx, dy, angle, scale, roll = 0 }) {
  return (
    `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) ` +
    `rotate(${angle.toFixed(4)}rad) scaleX(${scale.toFixed(4)}) rotate(${(-angle).toFixed(4)}rad) ` +
    `rotate(${roll.toFixed(4)}rad)`
  );
}

/**
 * The pose after the pointer moves by (`dx`, `dy`) CSS pixels. The surface under
 * the pointer follows it: one ball radius of movement is one radian of rotation,
 * in the direction of the movement, about the screen's axes. Dragging right moves
 * the front of the ball right, and dragging down moves it down, from any pose.
 */
export function dragPose(q, dx, dy) {
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return q;

  // The axis lies in the screen plane, at right angles to the movement.
  const half = distance / RADIUS / 2;
  const s = Math.sin(half) / distance;
  return normalize(multiply({ x: dy * s, y: dx * s, z: 0, w: Math.cos(half) }, q));
}

/** Fast at first and slowing to a stop: the speed at t = 0 is three times the average. */
export const easeOutCubic = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/**
 * The pose `t` of the way (0 to 1) through the rotation back to rest, from
 * `from`. It turns about a single axis, the short way round, and eases out, so
 * it starts quickly and slows as it settles exactly at rest.
 */
export function returnPose(from, t) {
  const remaining = 1 - easeOutCubic(t);
  if (remaining === 0) return REST_POSE;

  // q and -q are the same orientation; take the one on the short side.
  const sign = from.w < 0 ? -1 : 1;
  const vector = Math.hypot(from.x, from.y, from.z);
  if (vector < 1e-12) return REST_POSE;

  const half = Math.atan2(vector, sign * from.w) * remaining;
  const k = (sign * Math.sin(half)) / vector;
  return { x: from.x * k, y: from.y * k, z: from.z * k, w: Math.cos(half) };
}
