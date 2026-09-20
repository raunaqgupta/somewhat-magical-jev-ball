import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../lib/decide.js";
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
  fact: 0,
};
const run = (overrides) => decide({ ...quiet, ...overrides });

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

test("a question about a fact gets an affirmative answer, whichever way it leans", () => {
  for (const favorable of [0, 0.5, 1]) {
    const r = run({ fact: 0.76, favorable, certain: 0.5 });
    assert.equal(r.category, "affirmative");
    assert.ok(AFFIRMATIVE.includes(r.answer), r.answer);
  }
});

test("fact answers are as emphatic as the certainty", () => {
  assert.equal(run({ fact: 0.9, favorable: 0, certain: 1 }).answer, "It is certain");
  assert.equal(run({ fact: 0.9, favorable: 0, certain: 0 }).answer, "Signs point to yes");
});

test("a fact is only routed above the threshold of 0.75", () => {
  const atThreshold = run({ fact: 0.75, favorable: 0, certain: 1 });
  assert.equal(atThreshold.category, "negative");
  assert.equal(run({ fact: 0.751, favorable: 0, certain: 1 }).category, "affirmative");
});

test("a fact beats hedging", () => {
  assert.equal(run({ fact: 0.9, certain: 1, later: 0.95, hazy: 0.95 }).answer, "It is certain");
});

test("tone and non-questions beat a fact", () => {
  assert.equal(run({ fact: 0.9, snarky: 0.9, certain: 1 }).answer, TONE.snarky);
  assert.equal(run({ fact: 0.9, selfDeprecating: 0.9, certain: 1 }).answer, TONE.selfDeprecating);
  assert.equal(run({ fact: 0.9, unfocused: 0.9, certain: 1 }).answer, NON_COMMITTAL.unfocused);
});
