// Lets the ball be handled with a mouse or a finger:
//   - Pressing it pushes it back into the page (see .is-pressed in style.css); it eases
//     back out when let go, and a quick click holds the push long enough to be seen.
//   - Dragging it turns it with the pointer, like a trackball; when it is let go the ball
//     rotates back to rest, starting fast and slowing down.
//   - Double-tapping it spins it one full turn, showing the back face on the way round.
//
// The ball is drawn as a 3D model (ball3d.js) with both faces on it. If WebGL is
// unavailable, the two windows (the answer on the front, the model version on the
// back) are moved around the flat ball instead, with the same geometry, so the
// text still turns upside down when the ball is flipped over.
import {
  dragPose,
  REST_POSE,
  RETURN_MS,
  returnPose,
  SPIN_MS,
  spinFrom,
  windowPlacement,
  windowTransform,
} from "./ball-math.js";
import { isDoubleTap, isTap, pressHoldRemaining } from "./tap.js";

const ball = document.getElementById("ball");
const answerEl = document.getElementById("answer");
const faces = ball
  ? [
      { face: "front", el: ball.querySelector(".window-front") },
      { face: "back", el: ball.querySelector(".window-back") },
    ]
  : [];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let pose = REST_POSE;
let drag = null;
let frame = 0;
let model = null; // the 3D model, once it has loaded
let lastTap = null; // the previous tap ({ at, x, y }), to spot a double tap
let releaseTimer = 0; // lets the push out once it has been held long enough to be seen

// The flat fallback: place each window on the ball.
function renderWindows() {
  for (const { face, el } of faces) {
    const placement = windowPlacement(pose, face);
    el.style.transform = windowTransform(placement);
    el.style.opacity = String(placement.opacity);
  }
}

// Back to the plain CSS look, which is exactly the design: front showing, back hidden.
function clearWindows() {
  for (const { el } of faces) {
    el.style.transform = "";
    el.style.opacity = "";
  }
}

function render() {
  if (model) model.setPose(pose);
  else renderWindows();
}

function rest() {
  pose = REST_POSE;
  if (model) model.setPose(pose);
  else clearWindows();
}

function rotateBack() {
  if (reducedMotion.matches || pose === REST_POSE) return rest();

  const from = pose;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / RETURN_MS);
    if (t === 1) return rest();
    pose = returnPose(from, t);
    render();
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

// One full turn from wherever the ball is, then on to rest if it was not already there.
function spin() {
  if (reducedMotion.matches) return rotateBack();

  const from = pose;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / SPIN_MS);
    pose = spinFrom(from, t);
    render();
    if (t < 1) frame = requestAnimationFrame(step);
    else rotateBack();
  };
  frame = requestAnimationFrame(step);
}

function release(event) {
  if (!drag || event.pointerId !== drag.id) return;
  const now = performance.now();
  const heldMs = now - drag.startedAt;
  const tap = { at: now, x: event.clientX, y: event.clientY };
  const tapped = event.type === "pointerup" && isTap({ heldMs, movedPx: drag.moved });
  drag = null;
  ball.classList.remove("is-dragging");

  // Ease the push out, but not before it has been held long enough to be seen.
  releaseTimer = setTimeout(() => ball.classList.remove("is-pressed"), pressHoldRemaining(heldMs));

  if (tapped && isDoubleTap(lastTap, tap)) {
    lastTap = null;
    return spin();
  }
  lastTap = tapped ? tap : null;
  rotateBack();
}

if (ball && answerEl && faces.every(({ el }) => el)) {
  ball.addEventListener("pointerdown", (event) => {
    // Left mouse button, touch or pen only; and one pointer at a time.
    if (drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Catching the ball mid-return picks it up from where it is.
    cancelAnimationFrame(frame);
    clearTimeout(releaseTimer);
    ball.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      moved: 0, // the furthest the pointer has been from where it went down
    };
    ball.classList.add("is-dragging", "is-pressed");
  });

  ball.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    pose = dragPose(pose, event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
    render();
  });

  ball.addEventListener("pointerup", release);
  ball.addEventListener("pointercancel", release);

  // The 3D model is an enhancement: if the module or WebGL is unavailable, or the
  // graphics context is lost later, the flat ball and its windows are used.
  import("./ball3d.js")
    .then((module) => {
      model = module.createBall(ball, answerEl, () => {
        model = null;
        render();
      });
      if (model) {
        clearWindows();
        model.setPose(pose);
      }
    })
    .catch(() => {});
}
