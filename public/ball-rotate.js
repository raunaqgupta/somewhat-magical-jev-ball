// Lets the ball be rotated with a mouse or a finger. While it is held, the two
// windows (the answer on the front, the model version on the back) follow the
// pointer around the sphere; when it is let go the ball rotates back to rest,
// starting fast and slowing down. Works whether or not the 3D sphere loaded,
// since only the windows move.
import { dragPose, RETURN_MS, returnPose, windowPlacement, windowTransform } from "./ball-math.js";

const ball = document.getElementById("ball");
const faces = ball
  ? [
      { face: "front", el: ball.querySelector(".window-front") },
      { face: "back", el: ball.querySelector(".window-back") },
    ]
  : [];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const REST = { rotX: 0, rotY: 0 };
let pose = REST;
let drag = null;
let frame = 0;

function render() {
  for (const { face, el } of faces) {
    const placement = windowPlacement(pose.rotY, pose.rotX, face);
    el.style.transform = windowTransform(placement);
    el.style.opacity = String(placement.opacity);
  }
}

// Back to the plain CSS look, which is exactly the design: front showing, back hidden.
function rest() {
  pose = REST;
  for (const { el } of faces) {
    el.style.transform = "";
    el.style.opacity = "";
  }
}

function rotateBack() {
  if (reducedMotion.matches) return rest();

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

function release(event) {
  if (!drag || event.pointerId !== drag.id) return;
  drag = null;
  ball.classList.remove("is-dragging");
  rotateBack();
}

if (ball && faces.every(({ el }) => el)) {
  ball.addEventListener("pointerdown", (event) => {
    // Left mouse button, touch or pen only; and one pointer at a time.
    if (drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    // Catching the ball mid-return picks it up from where it is.
    cancelAnimationFrame(frame);
    ball.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    ball.classList.add("is-dragging");
  });

  ball.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    pose = dragPose(pose, event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
    render();
  });

  ball.addEventListener("pointerup", release);
  ball.addEventListener("pointercancel", release);
}
