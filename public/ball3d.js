// Renders the ball as a lit glossy sphere with three.js and moves the answer
// window (a DOM element, so the text stays real text) around it in 3D.
import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "./vendor/three.js";
import { BALL_SIZE, tumblePose, windowPlacement, windowTransform } from "./ball-math.js";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The sphere, its lights and the camera. Needs no WebGL, so it is testable in Node. */
export function buildScene() {
  // Orthographic, radius 1: the sphere fills the canvas exactly, so it lines
  // up with the 273px circle in the Paper design.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;

  const scene = new Scene();
  scene.add(
    new Mesh(
      new SphereGeometry(1, 96, 64),
      new MeshPhysicalMaterial({
        color: 0x030303,
        roughness: 0.3,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      }),
    ),
  );
  scene.add(new AmbientLight(0xffffff, 0.15));

  const key = new DirectionalLight(0xffffff, 3);
  key.position.set(-0.78, 0.5, -0.38).multiplyScalar(5);
  const kicker = new DirectionalLight(0xffffff, 1.2);
  kicker.position.set(0.67, -0.74, 0.1).multiplyScalar(5);
  scene.add(key, kicker);

  return { scene, camera };
}

/**
 * Draw the sphere into `ball` and return `{ tumble(ms) }`, or `null` when WebGL
 * is unavailable, in which case the CSS ball stays as the fallback.
 */
export function createBall(ball, windowEl) {
  const canvas = document.createElement("canvas");
  canvas.className = "ball-canvas";
  canvas.setAttribute("aria-hidden", "true");

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(BALL_SIZE, BALL_SIZE, false);

  const { scene, camera } = buildScene();

  const draw = () => renderer.render(scene, camera);
  const place = (rotY, rotX) => {
    const p = windowPlacement(rotY, rotX);
    windowEl.style.transform = windowTransform(p);
    windowEl.style.opacity = String(p.opacity);
  };

  const disable = () => {
    ball.classList.remove("is-3d");
    windowEl.style.transform = "";
    windowEl.style.opacity = "";
    canvas.remove();
  };
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    disable();
  });

  ball.prepend(canvas);
  ball.classList.add("is-3d");
  draw();

  let frame = 0;
  return {
    tumble(ms) {
      cancelAnimationFrame(frame);
      if (window.matchMedia(REDUCED_MOTION).matches) return;

      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const { rotY, rotX } = tumblePose(t);
        place(rotY, rotX);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    },
  };
}
