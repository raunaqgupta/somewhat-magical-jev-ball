// The ball as a 3D model with three.js: a black sphere with the two faces
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
  MeshPhysicalMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from "./vendor/three.js";
import { paintBack, paintFront } from "./face-texture.js";

const BALL_SIZE = 273; // the design's ball on a desktop; a phone's is smaller (see style.css)
const WINDOW_SIZE = 149; // the design's window, the same size on every ball
// Each face is a cap of the sphere as wide as the design's 149px window, sitting a
// hair above the surface so it does not flicker against it.
const FACE_RADIUS = WINDOW_SIZE / BALL_SIZE; // as a fraction of the ball's radius

/** The share of a ball's radius that its 149px window covers, for a ball `size` px across. */
export const faceRadiusFor = (size) => WINDOW_SIZE / size;
const SURFACE = 1.002;
const TEXTURE_SIZE = 640;
const BACK_TEXT = "jev 1.13";
// three.js divides the light on a diffuse surface by pi, so a combined intensity of pi
// (at normal incidence, N·L = 1) shows a perfectly diffuse surface at its own colour. The
// key light sits well off to the side now (see KEY_DIRECTION), so a face turned to the
// viewer only gets a share of it (N·L is about 0.44 at dead-on): a real side-lit gradient
// rather than a flat, even wash, at the cost of needing a brighter key to still read at
// close to full brightness on its lit side. Split between a dim ambient fill and the
// directional key, rather than given to the ambient light alone, so the sphere and the
// faces both show real shading, not a flat, evenly-lit look.
const AMBIENT_INTENSITY = Math.PI * 0.5;
const KEY_INTENSITY = Math.PI * 1.2;
// Well off to the side (mostly +x) and a little up, rather than close to the camera's own
// axis: the highlight then sits clearly to one side rather than near dead-centre, and the
// sphere (and now the faces too, see their finish below) shows a real light-to-dark
// gradient across it, not just a near-uniform wash with a small glint in the middle.
const KEY_DIRECTION = [1, 0.3, 0.5];

/**
 * A cap of the sphere facing +z (the front, `side` = 1) or -z (the back, `side` =
 * -1), with texture coordinates that lay a square texture flat over it, seen
 * head-on. Up on the texture is up on the ball, so a texture is upright when the
 * ball's own up is up the screen. Seen from outside the back the x axis runs the
 * other way, so the back's coordinates are mirrored to keep its text from
 * reading backwards. `radius` is the cap's width as a share of the ball's radius.
 */
export function faceGeometry(side, radius = FACE_RADIUS) {
  const geometry = new SphereGeometry(SURFACE, 64, 32, 0, 2 * Math.PI, 0, Math.asin(radius / SURFACE));
  geometry.rotateX((side * Math.PI) / 2); // the cap's pole is +y; turn it to +z or -z

  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(
      i,
      0.5 + (side * position.getX(i)) / (2 * radius),
      0.5 + position.getY(i) / (2 * radius),
    );
  }
  return geometry;
}

/**
 * The model, its light and the camera. Needs no WebGL, so it is testable in Node.
 * `frontMap` and `backMap` are the textures for the two faces; `faceRadius` is how much
 * of the ball's radius each face covers (see faceRadiusFor).
 */
export function buildScene({ frontMap = null, backMap = null, faceRadius = FACE_RADIUS } = {}) {
  // Orthographic, radius 1: the sphere fills the canvas exactly, so it lines
  // up with the ball's circle in the Paper design.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;

  // The plain sphere is glossy, with a high clearcoatRoughness so its highlight spreads
  // into a soft sheen rather than concentrating into a small bright point. The two faces
  // carry text and the window's own painted-in glow (face-texture.js): a first attempt
  // gave them the sphere's own tight, low-roughness gloss, and the key light's specular
  // put a hard, blown-out spot right on the text. A softer clearcoat, at a lower amount
  // and an even higher roughness than the sphere's, gives them a reflection too without
  // that: broad and faint rather than a glint.
  const sphere = new Mesh(
    new SphereGeometry(1, 96, 64),
    new MeshPhysicalMaterial({ color: 0x030303, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.5 }),
  );
  const faceFinish = { roughness: 0.5, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.8 };
  const front = new Mesh(faceGeometry(1, faceRadius), new MeshPhysicalMaterial({ map: frontMap, ...faceFinish }));
  const back = new Mesh(faceGeometry(-1, faceRadius), new MeshPhysicalMaterial({ map: backMap, ...faceFinish }));

  // Turning the ball turns everything in this group; the lights stay where they are.
  const ball = new Group();
  ball.add(sphere, front, back);

  // A dim ambient fill, so nothing goes pure black, plus a directional key light for
  // shading and a highlight (see KEY_DIRECTION above for why whichever face is toward
  // the viewer stays legible). The key's default target is the origin, where the ball
  // already sits, so it needs no target added to the scene.
  const light = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  const key = new DirectionalLight(0xffffff, KEY_INTENSITY);
  key.position.set(...KEY_DIRECTION);

  const scene = new Scene();
  scene.add(ball, light, key);

  return { scene, camera, ball, sphere, front, back, light, key };
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
  // The ball is a different size on a phone; the canvas fills it, whatever it is.
  const sizeNow = () => ball.clientWidth || BALL_SIZE;
  renderer.setSize(sizeNow(), sizeNow(), false);

  const front = faceTexture(paintFront, answerEl.textContent, renderer);
  const back = faceTexture(paintBack, BACK_TEXT, renderer);
  const {
    scene,
    camera,
    ball: model,
    front: frontMesh,
    back: backMesh,
  } = buildScene({ frontMap: front.texture, backMap: back.texture, faceRadius: faceRadiusFor(sizeNow()) });

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

  // When the ball is resized (the window crosses into or out of the phone layout), redraw
  // at its new size, with the faces still covering 149px.
  let size = sizeNow();
  const resizer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (sizeNow() === size) return;
          size = sizeNow();
          renderer.setSize(size, size, false);
          for (const [mesh, side] of [[frontMesh, 1], [backMesh, -1]]) {
            mesh.geometry.dispose();
            mesh.geometry = faceGeometry(side, faceRadiusFor(size));
          }
          requestRender();
        })
      : null;
  resizer?.observe(ball);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    watcher.disconnect();
    resizer?.disconnect();
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
