import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClientId } from "../lib/client-id.js";

// public/client-id.js reads localStorage when it loads, so each scenario imports a
// fresh copy (a unique query string defeats the module cache) with its own storage.
let n = 0;
async function loadWith({ storage, crypto: cryptoStub }) {
  const saved = { storage: globalThis.localStorage, crypto: Object.getOwnPropertyDescriptor(globalThis, "crypto") };
  globalThis.localStorage = storage;
  if (cryptoStub !== undefined) Object.defineProperty(globalThis, "crypto", { value: cryptoStub, configurable: true });
  try {
    return (await import(`../public/client-id.js?case=${n++}`)).clientId;
  } finally {
    globalThis.localStorage = saved.storage;
    if (cryptoStub !== undefined) Object.defineProperty(globalThis, "crypto", saved.crypto);
  }
}

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
};
const KEY = "magic-jev-ball:client";

test("the server accepts well-formed ids and rejects anything else", () => {
  assert.equal(parseClientId("3f2b8c1e-9d4a-4e6b-8a1c-0d5e7f9a2b34"), "3f2b8c1e-9d4a-4e6b-8a1c-0d5e7f9a2b34");
  assert.equal(parseClientId("abcdefgh"), "abcdefgh");
  for (const bad of [undefined, null, 42, {}, [], "", "short", "a".repeat(65), "has space in it", "../../etc/passwd", "id;drop", "ünïcödé-id-here"]) {
    assert.equal(parseClientId(bad), null, String(bad));
  }
});

test("a new browser gets a random id and it is saved", async () => {
  const storage = memoryStorage();
  const id = await loadWith({ storage });
  assert.ok(parseClientId(id), `${id} is not a valid id`);
  assert.equal(storage.data[KEY], id);
});

test("the same browser keeps its id, so its other tabs count as the same user", async () => {
  const storage = memoryStorage();
  const first = await loadWith({ storage });
  const second = await loadWith({ storage });
  assert.equal(second, first);
});

test("different browsers get different ids", async () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(await loadWith({ storage: memoryStorage() }));
  assert.equal(ids.size, 20);
});

test("blocked storage still gives a valid id, for the life of the page", async () => {
  const blocked = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("SecurityError"); },
  };
  const id = await loadWith({ storage: blocked });
  assert.ok(parseClientId(id), id);
});

test("without crypto.randomUUID (an insecure page) the fallback id is still valid and distinct", async () => {
  const a = await loadWith({ storage: memoryStorage(), crypto: {} });
  const b = await loadWith({ storage: memoryStorage(), crypto: {} });
  assert.ok(parseClientId(a) && parseClientId(b), `${a} ${b}`);
  assert.notEqual(a, b);
});
