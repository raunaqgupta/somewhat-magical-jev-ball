// Only the three.js classes the ball uses; bundled into public/vendor/three.js
// by `npm run vendor:three` so the page needs no CDN and ships a small file.
export {
  ACESFilmicToneMapping,
  CanvasTexture,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  RectAreaLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
// A separate module (not part of the main three.js build): the lookup-table textures
// RectAreaLight needs, which RectAreaLightUniformsLib.init() (see ball3d.js) installs.
export { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
