// Only the three.js classes the ball uses; bundled into public/vendor/three.js
// by `npm run vendor:three` so the page needs no CDN and ships a small file.
export {
  ACESFilmicToneMapping,
  CanvasTexture,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
