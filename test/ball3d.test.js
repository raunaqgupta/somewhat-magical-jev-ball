import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { buildScene, faceGeometry } from "../public/ball3d.js";
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
  assert.deepEqual(scene.children.map((c) => c.type).sort(), ["DirectionalLight", "Group"]);
  assert.deepEqual(ball.children.map((c) => c.type), ["Mesh", "Mesh", "Mesh"]);
  assert.equal(camera.type, "OrthographicCamera");
});

test("there is exactly one light source in the scene, whatever kind it is", () => {
  const { scene } = buildScene();
  const lights = [];
  scene.traverse((object) => {
    if (object.isLight) lights.push(object);
  });
  assert.equal(lights.length, 1);
  assert.equal(lights[0].type, "DirectionalLight");
  // No ambient or hemisphere fill, no lights hiding inside the ball, no environment map.
  assert.equal(scene.environment, null);
  assert.equal(scene.background, null);
});

test("the light is on the viewer's side and up and to the left, so a face turned to the viewer is lit", () => {
  const { light } = buildScene();
  const direction = light.position.clone().normalize();
  assert.ok(direction.z > 0.5, "in front of the ball");
  assert.ok(direction.y > 0, "above it");
  assert.ok(direction.x < 0, "to its left");
  // A face at rest, or a back turned to face the viewer, points at +z: lit head-on enough to read.
  assert.ok(direction.z > 0.6, `a face turned to the viewer would be lit at only ${direction.z.toFixed(2)}`);
});

test("the sphere and both faces are lit by it and share one glossy finish, and the faces carry their textures", () => {
  const maps = { frontMap: { name: "front" }, backMap: { name: "back" } };
  const { sphere, front, back } = buildScene(maps);
  for (const mesh of [sphere, front, back]) {
    // A material lit by lights, not an unlit one that ignores them.
    assert.equal(mesh.material.type, "MeshPhysicalMaterial");
    assert.equal(mesh.material.roughness, sphere.material.roughness);
    assert.equal(mesh.material.clearcoat, sphere.material.clearcoat);
    assert.equal(mesh.material.clearcoatRoughness, sphere.material.clearcoatRoughness);
  }
  assert.equal(front.material.map, maps.frontMap);
  assert.equal(back.material.map, maps.backMap);
  assert.equal(sphere.material.map, null);
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
