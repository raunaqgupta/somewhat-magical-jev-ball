import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { buildScene, faceGeometry, faceRadiusFor } from "../public/ball3d.js";
import { BALL_SIZE, dragPose, REST_POSE, windowPlacement } from "../public/ball-math.js";

const RADIUS = BALL_SIZE / 2;
const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} is not within ${eps} of ${expected}`);
const HALF_TURN = Math.PI * RADIUS;

// Turn the model to a pose exactly as the page does.
function posed(q) {
  const model = buildScene();
  model.ball.quaternion.set(q.x, q.y, q.z, q.w);
  model.scene.updateMatrixWorld(true);
  model.camera.updateMatrixWorld(true);
  return model;
}

// A point on a face, in model space, as it appears on screen: x right, y up, z towards the viewer.
const onScreen = (model, local) => {
  const v = new Vector3(local.x, local.y, local.z).applyQuaternion(model.ball.quaternion);
  return { x: v.x, y: v.y, z: v.z };
};

// The vertex of a face whose texture coordinate is `(u, v)`, in model space.
function vertexAt(mesh, u, v) {
  const position = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < position.count; i++) {
    const d = Math.hypot(uv.getX(i) - u, uv.getY(i) - v);
    if (d < bestDistance) [best, bestDistance] = [i, d];
  }
  return { x: position.getX(best), y: position.getY(best), z: position.getZ(best) };
}

// Where a face's texture points on screen when the ball is in pose `q`: the direction
// of the texture's "up" and "right" axes at the middle of the face. Each is measured
// between two points placed symmetrically about the middle, so that the curve of the
// sphere cancels out.
function textureAxes(q, face) {
  const model = posed(q);
  const mesh = model[face];
  const at = (u, v) => onScreen(model, vertexAt(mesh, u, v));
  const unit = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const len = Math.hypot(dx, dy);
    return { x: dx / len, y: dy / len };
  };
  return {
    up: unit(at(0.5, 0.7), at(0.5, 0.3)),
    right: unit(at(0.7, 0.5), at(0.3, 0.5)),
    facing: at(0.5, 0.5).z,
  };
}

test("the model is a sphere and its two faces, turned together, seen by an orthographic camera", () => {
  const { scene, camera, ball } = buildScene();
  assert.deepEqual(scene.children.map((c) => c.type).sort(), ["AmbientLight", "DirectionalLight", "Group"]);
  assert.deepEqual(ball.children.map((c) => c.type), ["Mesh", "Mesh", "Mesh"]);
  assert.equal(camera.type, "OrthographicCamera");
});

test("there are exactly two light sources in the scene: an ambient fill and a directional key light", () => {
  const { scene } = buildScene();
  const lights = [];
  scene.traverse((object) => {
    if (object.isLight) lights.push(object);
  });
  assert.deepEqual(lights.map((l) => l.type).sort(), ["AmbientLight", "DirectionalLight"]);
  // No other fill, no lights hiding inside the ball, no environment map.
  assert.equal(scene.environment, null);
  assert.equal(scene.background, null);
});

test("both lights are white, and together are strong enough to show a face in its own colours head-on", () => {
  const { light, key } = buildScene();
  assert.equal(light.type, "AmbientLight");
  assert.equal(light.color.getHex(), 0xffffff);
  assert.equal(key.type, "DirectionalLight");
  assert.equal(key.color.getHex(), 0xffffff);
  // three.js divides light on a diffuse surface by pi, so pi is the least combined intensity, at
  // normal incidence, that shows a face at its own colour; the glossy material gives up a little
  // of it, so it is a touch more. Too much would wash the faces out, so it is held close to pi.
  const headOn = light.intensity + key.intensity; // the key's direction is nearly +z (see below)
  assert.ok(headOn >= Math.PI * 0.9, `too dim: ${headOn}`);
  assert.ok(headOn <= Math.PI * 1.2, `too bright: ${headOn}`);
  // Most of it is the key light, so the sphere still shows real shading, not a flat wash.
  assert.ok(key.intensity > light.intensity, "the key should outweigh the ambient fill");
});

test("the key light sits close to the camera's axis, so whichever face is turned to the viewer stays legible", () => {
  const { key } = buildScene();
  assert.equal(key.isDirectionalLight, true);
  const { x, y, z } = key.position.clone().normalize();
  // Mostly +z (the camera's direction, and a face's normal when it is turned to the viewer),
  // with a gentle offset so the sphere still shows a highlight and shades toward its edge.
  assert.ok(z > 0.85, `too far off-axis to keep a face legible: z=${z}`);
  assert.ok(Math.hypot(x, y) > 0.1, `too close to dead-on to shade the sphere: x=${x}, y=${y}`);
});

test("the ambient light has no direction, and is dimmer than the key: it only keeps shadows off pure black", () => {
  const { light, key } = buildScene();
  assert.equal(light.isAmbientLight, true);
  assert.equal(light.isDirectionalLight, undefined);
  assert.ok(light.intensity < key.intensity);
});

test("the sphere and both faces are lit by the same lights, and the faces carry their textures", () => {
  const maps = { frontMap: { name: "front" }, backMap: { name: "back" } };
  const { sphere, front, back } = buildScene(maps);
  for (const mesh of [sphere, front, back]) {
    // A material lit by lights, not an unlit one that ignores them.
    assert.equal(mesh.material.type, "MeshPhysicalMaterial");
    assert.equal(mesh.material.metalness, 0);
  }
  assert.equal(front.material.map, maps.frontMap);
  assert.equal(back.material.map, maps.backMap);
  assert.equal(sphere.material.map, null);
});

test("only the plain sphere is glossy: the faces are fully matte, so the key light adds no specular glint over the text", () => {
  const { sphere, front, back } = buildScene();
  assert.ok(sphere.material.clearcoat > 0, "the sphere should have its highlight");
  assert.ok(sphere.material.roughness < 1, "and a tight enough one to read as glossy");
  for (const mesh of [front, back]) {
    assert.equal(mesh.material.clearcoat ?? 0, 0, "a face should not add its own specular glint over the text");
    assert.equal(mesh.material.roughness, 1, "fully matte: no specular lobe from the base material either");
  }
});

test("the sphere exactly fills the canvas: its extremes land on the canvas edges", () => {
  const { camera } = buildScene();
  camera.updateMatrixWorld();
  for (const [point, expected] of [
    [new Vector3(1, 0, 0), [1, 0]],
    [new Vector3(-1, 0, 0), [-1, 0]],
    [new Vector3(0, 1, 0), [0, 1]],
    [new Vector3(0, -1, 0), [0, -1]],
  ]) {
    const ndc = point.project(camera);
    near(ndc.x, expected[0], 1e-9);
    near(ndc.y, expected[1], 1e-9);
  }
});

test("each face is a cap of the sphere as wide as the design's 149px window, on its own side", () => {
  for (const [side, z] of [[1, 1], [-1, -1]]) {
    const geometry = faceGeometry(side);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    // Across: 149px of a 273px ball.
    near((max.x - min.x) * RADIUS, 149, 0.5);
    near((max.y - min.y) * RADIUS, 149, 0.5);
    // On the near side for the front, the far side for the back.
    assert.ok(z > 0 ? min.z > 0.8 : max.z < -0.8, `side ${side}`);
    // Sits on the sphere, a hair above it.
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 17) {
      const r = Math.hypot(position.getX(i), position.getY(i), position.getZ(i));
      near(r, 1.002, 1e-6);
    }
  }
});

test("on a smaller ball the window is still 149px, so its cap covers more of the sphere", () => {
  // The phone design's ball is 230px across, with the same 149px window in it.
  assert.equal(faceRadiusFor(273), 149 / 273);
  const radius = faceRadiusFor(230);
  assert.ok(radius > faceRadiusFor(273));
  for (const side of [1, -1]) {
    const geometry = faceGeometry(side, radius);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    near((max.x - min.x) * (230 / 2), 149, 0.5);
    near((max.y - min.y) * (230 / 2), 149, 0.5);
  }
  // The texture still spans the face exactly, whatever its size.
  const uv = faceGeometry(1, radius).attributes.uv;
  let minU = Infinity, maxU = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    minU = Math.min(minU, uv.getX(i));
    maxU = Math.max(maxU, uv.getX(i));
  }
  near(minU, 0, 0.01);
  near(maxU, 1, 0.01);
  // The scene's faces take it too.
  const { front, back } = buildScene({ faceRadius: radius });
  for (const mesh of [front, back]) {
    mesh.geometry.computeBoundingBox();
    near((mesh.geometry.boundingBox.max.x - mesh.geometry.boundingBox.min.x) * (230 / 2), 149, 0.5);
  }
});

test("a texture covers exactly the face: texture coordinates span 0 to 1 and nothing outside", () => {
  for (const side of [1, -1]) {
    const uv = faceGeometry(side).attributes.uv;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      maxU = Math.max(maxU, uv.getX(i));
      minV = Math.min(minV, uv.getY(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    for (const value of [minU, minV]) near(value, 0, 0.01);
    for (const value of [maxU, maxV]) near(value, 1, 0.01);
  }
});

test("at rest the front reads upright and the right way round", () => {
  const { up, right, facing } = textureAxes(REST_POSE, "front");
  assert.ok(facing > 0.9);
  near(up.x, 0);
  near(up.y, 1);
  near(right.x, 1);
  near(right.y, 0);
});

test("flipped sideways, the back faces the viewer and its text is upright and not reversed", () => {
  const q = dragPose(REST_POSE, HALF_TURN, 0);
  const { up, right, facing } = textureAxes(q, "back");
  assert.ok(facing > 0.9);
  near(up.x, 0, 1e-6);
  near(up.y, 1, 1e-6);
  near(right.x, 1, 1e-6);
  near(right.y, 0, 1e-6);
});

test("flipped over the top or bottom, the back faces the viewer with its text upside down, not reversed", () => {
  for (const direction of [Math.PI / 2, -Math.PI / 2]) {
    const q = dragPose(REST_POSE, 0, Math.sign(direction) * HALF_TURN);
    const { up, right, facing } = textureAxes(q, "back");
    assert.ok(facing > 0.9);
    near(up.y, -1, 1e-6);
    near(up.x, 0, 1e-6);
    // Upside down but not mirrored: right is still to the right of up (a rotation, not a reflection).
    near(right.x, -1, 1e-6);
  }
});

test("the front flipped over and brought round again is also upside down", () => {
  // A full flip over the top is a half turn about the x axis, then a half turn about y brings the front back.
  let q = dragPose(REST_POSE, 0, HALF_TURN);
  q = dragPose(q, HALF_TURN, 0);
  const { up, facing } = textureAxes(q, "front");
  assert.ok(facing > 0.9);
  near(up.y, -1, 1e-6);
});

test("text is never mirrored, from any orientation: a face is only ever turned, not reflected", () => {
  for (const face of ["front", "back"]) {
    for (let i = 0; i < 300; i++) {
      // A repeatable wander through poses.
      let q = REST_POSE;
      for (let k = 0; k <= i % 7; k++) q = dragPose(q, Math.sin(i * 12.9 + k) * 300, Math.cos(i * 7.7 + k * 3) * 300);
      const { up, right, facing } = textureAxes(q, face);
      if (facing < 0.3) continue; // only the near side is seen
      // Text that is only turned, never reflected, has "right" clockwise from "up": the
      // 2D cross product of up and right is negative. (Tilted faces are squashed, so the
      // two axes need not be at right angles on screen; only which way round matters.)
      assert.ok(up.x * right.y - up.y * right.x < 0, `mirrored: face ${face}, case ${i}`);
    }
  }
});

test("the model turns text exactly as the flat fallback does, for both faces, from any orientation", () => {
  for (const face of ["front", "back"]) {
    for (let i = 0; i < 300; i++) {
      let q = REST_POSE;
      for (let k = 0; k <= i % 5; k++) q = dragPose(q, Math.sin(i * 3.1 + k) * 350, Math.cos(i * 5.3 + k * 2) * 350);
      const { up, facing } = textureAxes(q, face);
      if (facing < 0.3) continue;
      // The angle of the text's up edge, clockwise from the top of the screen, as CSS measures it.
      const fromModel = Math.atan2(up.x, up.y);
      const fromFallback = windowPlacement(q, face).roll;
      near(Math.cos(fromModel), Math.cos(fromFallback), 0.05);
      near(Math.sin(fromModel), Math.sin(fromFallback), 0.05);
    }
  }
});

test("a face is in the model on the side it should be: the front centre at rest, the back centre at half a turn", () => {
  const rest = textureAxes(REST_POSE, "front");
  near(rest.facing, 1.002, 1e-6);
  const flipped = textureAxes(dragPose(REST_POSE, 0, HALF_TURN), "back");
  near(flipped.facing, 1.002, 1e-6);
});

test("the vendored three.js bundle exports exactly what the ball imports", async () => {
  const vendored = await import("../public/vendor/three.js");
  assert.deepEqual(Object.keys(vendored).sort(), [
    "AmbientLight",
    "CanvasTexture",
    "DirectionalLight",
    "Group",
    "Mesh",
    "MeshPhysicalMaterial",
    "OrthographicCamera",
    "SRGBColorSpace",
    "Scene",
    "SphereGeometry",
    "WebGLRenderer",
  ]);
});
