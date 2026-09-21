// Lets the ball be handled with a mouse or a finger. Pressing it does nothing by itself:
//   - Dragging it turns it with the pointer, like a trackball; when it is let go the ball
//     rotates back to rest, starting fast and slowing down.
//   - Clicking it (a press let go without a drag) pushes it back into the page and lets it
//     come back (see .is-pushed in style.css). The push waits a moment, to see whether the
//     click is the first of a double click.
//   - Double-clicking it pushes it back and spins it one full turn at the same moment,
//     showing the back face on the way round. The single click's own, earlier push does
//     not happen: the push begins with the spin.
//
// The ball is drawn as a 3D model (ball3d.js) with both faces on it. If WebGL is
// unavailable, the two windows (the answer on the front, the model version on the
// back) are moved around the flat ball instead, with the same geometry, so the
// text still turns upside down when the ball is flipped over.
import {
  BALL_SIZE,
  dragPose,
  REST_POSE,
  RETURN_MS,
  returnPose,
  SPIN_MS,
  spinFrom,
  windowPlacement,
  windowTransform,
} from "./ball-math.js";
import { createClickHandler, pushHoldMs } from "./click.js";

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
let pushTimer = 0; // lets the push out after it has been held for a moment

// The turning is worked out for the design's 273px ball; a phone's ball is smaller. This is
// its size as a share of that, to scale the drag and the flat windows by.
const sizeRatio = () => (ball.clientWidth || BALL_SIZE) / BALL_SIZE;

// The flat fallback: place each window on the ball.
function renderWindows() {
  for (const { face, el } of faces) {
    const placement = windowPlacement(pose, face);
    const ratio = sizeRatio();
    el.style.transform = windowTransform({ ...placement, dx: placement.dx * ratio, dy: placement.dy * ratio });
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

// The ball is pushed back into the page, then eases out again.
function push() {
  clearTimeout(pushTimer);
  ball.classList.add("is-pushed");
  // Stay pushed until the ball has reached its deepest point (the transition the stylesheet
  // gives it), and a moment more, then let go and it eases back out.
  const hold = pushHoldMs(getComputedStyle(ball).transitionDuration);
  pushTimer = setTimeout(() => ball.classList.remove("is-pushed"), hold);
}

// Decides what each press was: a drag, a click (whose push follows after the double-click
// window), or a double click.
const clicks = createClickHandler({ onClick: push });

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
  const outcome = clicks.up({
    x: event.clientX,
    y: event.clientY,
    movedPx: drag.moved,
    cancelled: event.type === "pointercancel",
  });
  drag = null;
  ball.classList.remove("is-dragging");

  if (outcome === "double-click") {
    push(); // the push and the spin start together
    return spin();
  }
  rotateBack();
}

if (ball && answerEl && faces.every(({ el }) => el)) {
  ball.addEventListener("pointerdown", (event) => {
    // Left mouse button, touch or pen only; and one pointer at a time.
    if (drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Catching the ball mid-return picks it up from where it is.
    cancelAnimationFrame(frame);
    clicks.down({ x: event.clientX, y: event.clientY });
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
    ball.classList.add("is-dragging");
  });

  ball.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const ratio = sizeRatio();
    pose = dragPose(pose, (event.clientX - drag.x) / ratio, (event.clientY - drag.y) / ratio);
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
