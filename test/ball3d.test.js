import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { buildScene } from "../public/ball3d.js";

test("the scene is one unit sphere plus three lights, seen by an orthographic camera", () => {
  const { scene, camera } = buildScene();
  const types = scene.children.map((c) => c.type).sort();
  assert.deepEqual(types, ["AmbientLight", "DirectionalLight", "DirectionalLight", "Mesh"]);

  const sphere = scene.children.find((c) => c.type === "Mesh");
  sphere.geometry.computeBoundingSphere();
  // Vertices are float32, so allow for rounding.
  assert.ok(Math.abs(sphere.geometry.boundingSphere.radius - 1) < 1e-6);
  assert.equal(sphere.material.type, "MeshPhysicalMaterial");

  assert.equal(camera.type, "OrthographicCamera");
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
    assert.ok(Math.abs(ndc.x - expected[0]) < 1e-9 && Math.abs(ndc.y - expected[1]) < 1e-9);
  }
});

test("the vendored three.js bundle exports exactly what the ball imports", async () => {
  const vendored = await import("../public/vendor/three.js");
  assert.deepEqual(Object.keys(vendored).sort(), [
    "AmbientLight",
    "DirectionalLight",
    "Mesh",
    "MeshPhysicalMaterial",
    "OrthographicCamera",
    "Scene",
    "SphereGeometry",
    "WebGLRenderer",
  ]);
});
