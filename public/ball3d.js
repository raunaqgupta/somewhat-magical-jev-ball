// The ball as a 3D model with three.js: a glossy black sphere with the two faces
// (the answer on the front, the model version on the back) as part of the model.
// The faces rotate with the sphere, so their text turns upside down when the ball
// is flipped over, as a label on a real ball would.
//
// The answer stays real text in the page (a screen-reader live region); the
// front face is drawn from it, and redrawn whenever it changes.
import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from "./vendor/three.js";
import { paintBack, paintFront } from "./face-texture.js";

const BALL_SIZE = 273;
const WINDOW_SIZE = 149;
// Each face is a cap of the sphere as wide as the design's 149px window, sitting a
// hair above the surface so it does not flicker against it.
const FACE_RADIUS = WINDOW_SIZE / BALL_SIZE; // as a fraction of the ball's radius
const SURFACE = 1.002;
const TEXTURE_SIZE = 640;
const BACK_TEXT = "jev 1.13";

/**
 * A cap of the sphere facing +z (the front, `side` = 1) or -z (the back, `side` =
 * -1), with texture coordinates that lay a square texture flat over it, seen
 * head-on. Up on the texture is up on the ball, so a texture is upright when the
 * ball's own up is up the screen. Seen from outside the back the x axis runs the
 * other way, so the back's coordinates are mirrored to keep its text from
 * reading backwards.
 */
export function faceGeometry(side) {
  const geometry = new SphereGeometry(SURFACE, 64, 32, 0, 2 * Math.PI, 0, Math.asin(FACE_RADIUS / SURFACE));
  geometry.rotateX((side * Math.PI) / 2); // the cap's pole is +y; turn it to +z or -z

  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(
      i,
      0.5 + (side * position.getX(i)) / (2 * FACE_RADIUS),
      0.5 + position.getY(i) / (2 * FACE_RADIUS),
    );
  }
  return geometry;
}

/**
 * The model, its lights and the camera. Needs no WebGL, so it is testable in Node.
 * `maps` are the textures for the two faces.
 */
export function buildScene({ frontMap = null, backMap = null } = {}) {
  // Orthographic, radius 1: the sphere fills the canvas exactly, so it lines
  // up with the 273px circle in the Paper design.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;

  const sphere = new Mesh(
    new SphereGeometry(1, 96, 64),
    new MeshPhysicalMaterial({
      color: 0x030303,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    }),
  );
  // The faces are unlit, so their colours are exactly the design's.
  const front = new Mesh(faceGeometry(1), new MeshBasicMaterial({ map: frontMap }));
  const back = new Mesh(faceGeometry(-1), new MeshBasicMaterial({ map: backMap }));

  // Turning the ball turns everything in this group; the lights stay where they are.
  const ball = new Group();
  ball.add(sphere, front, back);

  const scene = new Scene();
  scene.add(ball, new AmbientLight(0xffffff, 0.15));

  const key = new DirectionalLight(0xffffff, 3);
  key.position.set(-0.78, 0.5, -0.38).multiplyScalar(5);
  const kicker = new DirectionalLight(0xffffff, 1.2);
  kicker.position.set(0.67, -0.74, 0.1).multiplyScalar(5);
  scene.add(key, kicker);

  return { scene, camera, ball, sphere, front, back };
}

function faceTexture(paint, text, renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEXTURE_SIZE;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return {
    texture,
    repaint(newText = text) {
      paint(canvas.getContext("2d"), TEXTURE_SIZE, newText);
      texture.needsUpdate = true;
    },
  };
}

/**
 * Draw the model into `ball` and return `{ setPose(q) }`, which turns it to the
 * pose `q` (a quaternion, see ball-math.js). Returns null when WebGL is
 * unavailable, in which case the flat CSS ball and windows stay as the fallback.
 * `onLost` is called if the graphics context is lost later, and the fallback is
 * put back.
 */
export function createBall(ball, answerEl, onLost = () => {}) {
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

  const front = faceTexture(paintFront, answerEl.textContent, renderer);
  const back = faceTexture(paintBack, BACK_TEXT, renderer);
  const { scene, camera, ball: model } = buildScene({ frontMap: front.texture, backMap: back.texture });

  let queued = false;
  const render = () => {
    queued = false;
    renderer.render(scene, camera);
  };
  const requestRender = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(render);
    }
  };

  front.repaint(answerEl.textContent);
  back.repaint();

  // The answer is real text in the page; redraw the front whenever it changes.
  const watcher = new MutationObserver(() => {
    front.repaint(answerEl.textContent);
    requestRender();
  });
  watcher.observe(answerEl, { childList: true, characterData: true, subtree: true });

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    watcher.disconnect();
    ball.classList.remove("is-3d");
    canvas.remove();
    onLost();
  });

  ball.prepend(canvas);
  ball.classList.add("is-3d");
  render();

  return {
    setPose(q) {
      model.quaternion.set(q.x, q.y, q.z, q.w);
      requestRender();
    },
  };
}
