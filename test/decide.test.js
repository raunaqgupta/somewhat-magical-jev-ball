import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../lib/decide.js";
import { AFFIRMATIVE, NEGATIVE, NON_COMMITTAL } from "../lib/answers.js";

// Signals with everything quiet; override per case.
const quiet = {
  favorable: 0.5,
  certain: 0,
  hazy: 0,
  later: 0,
  unwelcome: 0,
  unpredictable: 0,
  unfocused: 0,
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
