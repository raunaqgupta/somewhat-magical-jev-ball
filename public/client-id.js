// An anonymous, random id for this browser, shared by all its tabs through
// localStorage. The server uses it to avoid showing a visitor their own
// questions in the background. If storage is blocked, the id lasts for this page.
const KEY = "magic-jev-ball:client";

function generate() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Insecure contexts have no randomUUID; this only needs to be unguessable enough
  // to tell browsers apart, and is at least 8 characters.
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.padEnd(8, "0");
}

function load() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = generate();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return generate();
  }
}

export const clientId = load();
