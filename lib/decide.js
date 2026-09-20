import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { AFFIRMATIVE, NEGATIVE, NON_COMMITTAL, TONE } from "./answers.js";

// A tone noul above this routes straight to that tone's answer.
const TONE_THRESHOLD = 0.5;
// Above this, the text is treated as not being a real yes/no question.
const UNFOCUSED_THRESHOLD = 0.6;
// A `truth` score above this is clearly true, and below 1 minus this is clearly
// false. Anything in between is not decisive and falls through to the other rules.
const TRUTH_JUDGMENT = 0.75;
// Above this hedge score (see decide), the ball declines to commit.
const HEDGE_THRESHOLD = 0.75;

// Ten independent noul judgments over the same question. They run in
// parallel in a single Jev request and cannot see one another; code below
// combines them into one of the 20 answers.
const QUESTIONS = {
  // Tone of the question
  snarky: noul("Is the tone of the question snarky?"),
  selfDeprecating: noul("Is the tone of the question self-deprecating?"),
  // Whether the answer to the question is factually true
  truth: noul("Is the answer to the question factually true?"),
  // Direction of the answer
  favorable: noul(
    "Does the most sensible answer to this question lean towards yes, or towards a favorable outcome for the asker?"
  ),
  // Strength of the answer
  certain: noul(
    "Is the answer to this question clear-cut and close to certain, rather than merely plausible?"
  ),
  // One signal per non-committal answer
  hazy: noul(
    "Is this question vague or ambiguous, so that it is too unclear to answer well?"
  ),
  later: noul(
    "Is the answer to this question something that has not been settled yet, and would be easier to know at a later time?"
  ),
  unwelcome: noul(
    "Would a truthful answer to this question probably be unwelcome or upsetting to the asker?"
  ),
  unpredictable: noul(
    "Does the answer to this question depend on chance or unknowable factors, making it impossible to predict?"
  ),
  unfocused: noul(
    "Is this text not a genuine yes/no question, for example an open-ended question, a statement, a command, or empty of meaning?"
  ),
};

// The answer at `strength` (0 to 1) along a list ordered most to least emphatic.
const byStrength = (list, strength) =>
  list[Math.min(list.length - 1, Math.floor((1 - strength) * list.length))];

/**
 * Combine the raw noul probabilities into one of the 20 answers.
 * Pure function, so the policy can be tuned and tested without the API.
 */
export function decide(p) {
  // Tone overrides everything else; snark wins if both fire.
  if (p.snarky > TONE_THRESHOLD) {
    return { category: "negative", answer: TONE.snarky };
  }
  if (p.selfDeprecating > TONE_THRESHOLD) {
    return { category: "affirmative", answer: TONE.selfDeprecating };
  }

  // Not a real yes/no question: nothing to answer, whatever the other signals say.
  if (p.unfocused >= UNFOCUSED_THRESHOLD) {
    return { category: "non-committal", answer: NON_COMMITTAL.unfocused };
  }

  // A clearly true answer is affirmative and a clearly false one is negative,
  // as emphatic as the certainty of the answer. Opinions and predictions have
  // no clear truth, so they score in between and are left to the rules below.
  if (p.truth > TRUTH_JUDGMENT) {
    return { category: "affirmative", answer: byStrength(AFFIRMATIVE, p.certain) };
  }
  if (p.truth < 1 - TRUTH_JUDGMENT) {
    return { category: "negative", answer: byStrength(NEGATIVE, p.certain) };
  }

  // How lopsided the yes/no lean is, from 0 (coin flip) to 1 (one-sided).
  const lean = Math.abs(p.favorable - 0.5) * 2;

  // The strongest hedging signal, discounted by how clear the lean is: a
  // confident yes/no commits even when the question is about the future, while
  // a near coin-flip with a strong hedging signal declines to commit.
  const [signal, level] = Object.keys(NON_COMMITTAL)
    .filter((name) => name !== "unfocused")
    .map((name) => [name, p[name]])
    .reduce((best, entry) => (entry[1] > best[1] ? entry : best));

  if (level * (1 - lean) >= HEDGE_THRESHOLD) {
    return { category: "non-committal", answer: NON_COMMITTAL[signal] };
  }

  // Strength blends the lean with how certain the answer is.
  const strength = (lean + p.certain) / 2;

  const affirmative = p.favorable >= 0.5;
  return {
    category: affirmative ? "affirmative" : "negative",
    answer: byStrength(affirmative ? AFFIRMATIVE : NEGATIVE, strength),
  };
}

export async function askJev(question, apiKey) {
  const client = new TypeSafeClient({ apiKey });
  const { answers } = await client.systemOne({
    state: { question },
    questions: QUESTIONS,
  });

  const signals = Object.fromEntries(
    Object.entries(answers).map(([name, a]) => [name, a.noul])
  );
  return { ...decide(signals), signals };
}
