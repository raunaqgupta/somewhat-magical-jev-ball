import { test } from "node:test";
import assert from "node:assert/strict";
import { capScale, zoomsOnFocus } from "../public/viewport.js";

// iOS Safari zooms the page in when a field with text under 16px is focused, and the question box's
// text is the design's 14px. The page caps the scale at 1 on iOS to stop that, and only there.

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("an iPhone, an iPod and an iPad are iOS Safari", () => {
  assert.equal(zoomsOnFocus({ userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5 }), true);
  assert.equal(zoomsOnFocus({ userAgent: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)" }), true);
  assert.equal(zoomsOnFocus({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)" }), true);
});

test("an iPad asking for the desktop site reports itself as a Mac, but with a touch screen", () => {
  assert.equal(zoomsOnFocus({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 5 }), true);
});

test("a Mac, Android and other browsers are left alone", () => {
  assert.equal(zoomsOnFocus({ userAgent: MAC, platform: "MacIntel", maxTouchPoints: 0 }), false);
  assert.equal(zoomsOnFocus({ userAgent: ANDROID, platform: "Linux armv81", maxTouchPoints: 5 }), false);
  assert.equal(zoomsOnFocus({}), false);
});

test("the scale is capped at 1, keeping the rest of the viewport, once", () => {
  const viewport = "width=device-width, initial-scale=1, viewport-fit=cover";
  assert.equal(capScale(viewport), `${viewport}, maximum-scale=1`);
  assert.equal(capScale(capScale(viewport)), `${viewport}, maximum-scale=1`);
  assert.equal(capScale("width=device-width, maximum-scale=2"), "width=device-width, maximum-scale=2", "an existing cap is not overridden");
});
