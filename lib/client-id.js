// A browser's anonymous id, used only so the server can skip that browser when
// relaying its own question. It is never sent to other visitors.

/** The id if it is well formed, otherwise null. Ids are random, so no more than this is checked. */
export function parseClientId(value) {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}
