import { test } from "node:test";
import assert from "node:assert/strict";
import { askJev, decide, isShareable, jevConfig } from "../lib/decide.js";
import { AFFIRMATIVE, NEGATIVE, NON_COMMITTAL, TONE } from "../lib/answers.js";

// Signals with everything quiet; override per case.
const quiet = {
  favorable: 0.5,
  certain: 0,
  hazy: 0,
  later: 0,
  unwelcome: 0,
  unpredictable: 0,
  unfocused: 0,
  snarky: 0,
  selfDeprecating: 0,
  truth: 0.5,
  fact: 0,
};
const run = (overrides) => decide({ ...quiet, ...overrides });
// A question about a fact, so that `truth` applies.
const factual = (overrides) => run({ fact: 0.9, ...overrides });

test("the answer pool is exactly the 20 canonical answers", () => {
  const all = [...AFFIRMATIVE, ...NEGATIVE, ...Object.values(NON_COMMITTAL)];
  assert.equal(all.length, 20);
  assert.equal(new Set(all).size, 20);
  assert.equal(AFFIRMATIVE.length, 10);
  assert.equal(NEGATIVE.length, 5);
  assert.equal(Object.keys(NON_COMMITTAL).length, 5);
});

test("a certain yes gives the most emphatic affirmative answer", () => {
  assert.deepEqual(run({ favorable: 1, certain: 1 }), {
    category: "affirmative",
    answer: "It is certain",
  });
});

test("a weak yes gives a mild affirmative answer", () => {
  assert.equal(run({ favorable: 0.55, certain: 0 }).answer, "Signs point to yes");
});

test("a certain no gives the most emphatic negative answer", () => {
  assert.deepEqual(run({ favorable: 0, certain: 1 }), {
    category: "negative",
    answer: "My reply is no",
  });
});

test("a weak no gives a mild negative answer", () => {
  assert.equal(run({ favorable: 0.4, certain: 0.05 }).answer, "Very doubtful");
});

test("every affirmative and negative answer is reachable", () => {
  const seen = new Set();
  for (let f = 0; f <= 1; f += 0.01) {
    for (let c = 0; c <= 1; c += 0.05) seen.add(run({ favorable: f, certain: c }).answer);
  }
  for (const answer of [...AFFIRMATIVE, ...NEGATIVE]) assert.ok(seen.has(answer), answer);
});

test("each hedging signal selects its own non-committal answer", () => {
  for (const signal of ["hazy", "later", "unwelcome", "unpredictable", "unfocused"]) {
    assert.deepEqual(run({ [signal]: 0.95 }), {
      category: "non-committal",
      answer: NON_COMMITTAL[signal],
    });
  }
});

test("a confident lean commits even when a hedging signal is high", () => {
  assert.equal(run({ favorable: 0.05, certain: 0.9, later: 0.95 }).category, "negative");
});

test("a non-question is never answered, whatever the lean", () => {
  assert.equal(run({ favorable: 0.95, certain: 0.95, unfocused: 0.9 }).answer, "Concentrate and ask again");
});

test("tone answers are members of the canonical lists", () => {
  assert.ok(NEGATIVE.includes(TONE.snarky));
  assert.ok(AFFIRMATIVE.includes(TONE.selfDeprecating));
});

test("a snarky question gets \"Don't count on it\"", () => {
  assert.deepEqual(run({ snarky: 0.51, favorable: 1, certain: 1 }), {
    category: "negative",
    answer: "Don't count on it",
  });
});

test("a self-deprecating question gets \"As I see it, yes\"", () => {
  assert.deepEqual(run({ selfDeprecating: 0.51, favorable: 0, certain: 1 }), {
    category: "affirmative",
    answer: "As I see it, yes",
  });
});

test("tone routes only above 0.50", () => {
  assert.notEqual(run({ snarky: 0.5, favorable: 1, certain: 1 }).answer, TONE.snarky);
  assert.notEqual(run({ selfDeprecating: 0.5, favorable: 0, certain: 1 }).answer, TONE.selfDeprecating);
});

test("tone overrides hedging and non-question handling", () => {
  assert.equal(run({ snarky: 0.9, unfocused: 0.9, later: 0.95 }).answer, TONE.snarky);
  assert.equal(run({ selfDeprecating: 0.9, hazy: 0.95 }).answer, TONE.selfDeprecating);
});

test("snark wins when both tones fire", () => {
  assert.equal(run({ snarky: 0.8, selfDeprecating: 0.8 }).answer, TONE.snarky);
});

test("a clearly true answer is affirmative, whichever way the lean points", () => {
  for (const favorable of [0, 0.5, 1]) {
    const r = factual({ truth: 0.76, favorable, certain: 0.5 });
    assert.equal(r.category, "affirmative");
    assert.ok(AFFIRMATIVE.includes(r.answer), r.answer);
  }
});

test("a clearly false answer is negative, whichever way the lean points", () => {
  for (const favorable of [0, 0.5, 1]) {
    const r = factual({ truth: 0.24, favorable, certain: 0.5 });
    assert.equal(r.category, "negative");
    assert.ok(NEGATIVE.includes(r.answer), r.answer);
  }
});

test("truth answers are as emphatic as the certainty", () => {
  assert.equal(factual({ truth: 0.95, certain: 1 }).answer, "It is certain");
  assert.equal(factual({ truth: 0.95, certain: 0 }).answer, "Signs point to yes");
  assert.equal(factual({ truth: 0.05, certain: 1 }).answer, "My reply is no");
  assert.equal(factual({ truth: 0.05, certain: 0 }).answer, "Very doubtful");
});

test("truth routes only above 0.75 and below 0.25", () => {
  // At the cutoffs the answer is not decisive, so the lean decides instead.
  assert.equal(factual({ truth: 0.75, favorable: 0, certain: 1 }).category, "negative");
  assert.equal(factual({ truth: 0.751, favorable: 0, certain: 1 }).category, "affirmative");
  assert.equal(factual({ truth: 0.25, favorable: 1, certain: 1 }).category, "affirmative");
  assert.equal(factual({ truth: 0.249, favorable: 1, certain: 1 }).category, "negative");
});

test("an undecided truth falls through to the lean and to hedging", () => {
  assert.equal(factual({ truth: 0.5, favorable: 1, certain: 1 }).answer, "It is certain");
  assert.equal(factual({ truth: 0.5, favorable: 0, certain: 1 }).answer, "My reply is no");
  assert.equal(factual({ truth: 0.5, later: 0.95 }).answer, NON_COMMITTAL.later);
});

test("a decisive truth beats hedging", () => {
  assert.equal(factual({ truth: 0.9, certain: 1, later: 0.95, hazy: 0.95 }).answer, "It is certain");
  assert.equal(factual({ truth: 0.1, certain: 1, later: 0.95, hazy: 0.95 }).answer, "My reply is no");
});

test("tone and non-questions beat truth", () => {
  assert.equal(factual({ truth: 0.9, snarky: 0.9, certain: 1 }).answer, TONE.snarky);
  assert.equal(factual({ truth: 0.1, selfDeprecating: 0.9, certain: 1 }).answer, TONE.selfDeprecating);
  assert.equal(factual({ truth: 0.9, unfocused: 0.9, certain: 1 }).answer, NON_COMMITTAL.unfocused);
});

test("truth only applies to a question about a fact", () => {
  // The same clearly-false truth is ignored for an opinion, so the lean decides.
  const opinion = run({ fact: 0.2, truth: 0.1, favorable: 1, certain: 1 });
  assert.deepEqual(opinion, { category: "affirmative", answer: "It is certain" });
  assert.equal(run({ fact: 0.2, truth: 0.9, favorable: 0, certain: 1 }).category, "negative");
});

test("a fact is only recognised above 0.8", () => {
  assert.equal(run({ fact: 0.8, truth: 0.05, favorable: 1, certain: 1 }).category, "affirmative");
  assert.equal(run({ fact: 0.801, truth: 0.05, favorable: 1, certain: 1 }).category, "negative");
});

test("an opinion can still hedge", () => {
  assert.equal(run({ fact: 0.1, truth: 0.1, later: 0.95 }).answer, NON_COMMITTAL.later);
});

test("a question is shareable unless it contains personal information", () => {
  assert.equal(isShareable({ personal: 0.05 }), true);
  assert.equal(isShareable({ personal: 0.3 }), true);
  assert.equal(isShareable({ personal: 0.31 }), false);
  assert.equal(isShareable({ personal: 0.98 }), false);
});

test("personal information does not change the answer", () => {
  assert.deepEqual(run({ personal: 0.99, favorable: 1, certain: 1 }), run({ favorable: 1, certain: 1 }));
});

test("jevConfig calls TypeSafe directly until the AI Gateway token is set", () => {
  assert.deepEqual(jevConfig({ TYPESAFE_API_KEY: "direct-key" }), { apiKey: "direct-key" });
  // Half-configured (e.g. the gateway URL shipped before the secret was set) still falls back.
  assert.deepEqual(
    jevConfig({ TYPESAFE_API_KEY: "direct-key", AI_GATEWAY_BASE_URL: "https://gateway.example/typesafe" }),
    { apiKey: "direct-key" }
  );
  assert.deepEqual(
    jevConfig({ TYPESAFE_API_KEY: "direct-key", CF_AI_GATEWAY_TOKEN: "gw-token" }),
    { apiKey: "direct-key" }
  );
});

test("jevConfig routes through the AI Gateway once both its settings are present, and drops the direct key", () => {
  const config = jevConfig({
    TYPESAFE_API_KEY: "direct-key",
    AI_GATEWAY_BASE_URL: "https://gateway.example/typesafe",
    CF_AI_GATEWAY_TOKEN: "gw-token",
  });
  assert.equal(config.baseURL, "https://gateway.example/typesafe");
  assert.equal(config.gatewayToken, "gw-token");
  assert.notEqual(config.apiKey, "direct-key", "the Worker's own TypeSafe key is never sent");
});

test("askJev sends the request to the configured baseURL with the gateway's own auth header", async () => {
  const calls = [];
  const noulAnswers = Object.fromEntries(
    ["personal", "snarky", "selfDeprecating", "fact", "truth", "favorable", "certain", "hazy", "later", "unwelcome", "unpredictable", "unfocused"]
      .map((name) => [name, { type: "noul", noul: 0.1 }])
  );
  const fakeFetch = async (url, init) => {
    calls.push({ url, headers: new Headers(init.headers) });
    return new Response(
      JSON.stringify({ model: "test", answers: noulAnswers, usage: { input_tokens: 0, output_tokens: 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  await askJev("Will this work?", {
    apiKey: "placeholder",
    baseURL: "https://gateway.example/typesafe",
    gatewayToken: "gw-token",
    fetch: fakeFetch,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://gateway.example/typesafe/v1/systemone");
  assert.equal(calls[0].headers.get("cf-aig-authorization"), "gw-token");
  // The SDK still sends some Authorization header (its placeholder), which the gateway
  // is the one that replaces with the real, BYOK-stored TypeSafe key.
  assert.equal(calls[0].headers.get("authorization"), "Bearer placeholder");
});

test("askJev omits the gateway header when calling TypeSafe directly", async () => {
  const calls = [];
  const noulAnswers = Object.fromEntries(
    ["personal", "snarky", "selfDeprecating", "fact", "truth", "favorable", "certain", "hazy", "later", "unwelcome", "unpredictable", "unfocused"]
      .map((name) => [name, { type: "noul", noul: 0.1 }])
  );
  const fakeFetch = async (url, init) => {
    calls.push({ url, headers: new Headers(init.headers) });
    return new Response(
      JSON.stringify({ model: "test", answers: noulAnswers, usage: { input_tokens: 0, output_tokens: 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  await askJev("Will this work?", { apiKey: "direct-key", fetch: fakeFetch });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(calls[0].headers.get("cf-aig-authorization"), null);
  assert.equal(calls[0].headers.get("authorization"), "Bearer direct-key");
});
