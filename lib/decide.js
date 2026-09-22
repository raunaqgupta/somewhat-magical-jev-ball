import { noul } from "@typesafe-ai/sdk";
import { AFFIRMATIVE, NEGATIVE, NON_COMMITTAL, TONE } from "./answers.js";

// A tone noul above this routes straight to that tone's answer.
const TONE_THRESHOLD = 0.5;
// Above this, the text is treated as not being a real yes/no question.
const UNFOCUSED_THRESHOLD = 0.6;
// A `fact` score above this means the question is about a fact, so `truth` applies.
const FACT_THRESHOLD = 0.8;
// A `truth` score above this is clearly true, and below 1 minus this is clearly
// false. Anything in between is not decisive and falls through to the other rules.
const TRUTH_JUDGMENT = 0.75;
// Above this `personal` score a question is not shown to other users. Set well
// under the middle because hiding a question is the safe way to be wrong.
const PERSONAL_THRESHOLD = 0.3;
// Above this hedge score (see decide), the ball declines to commit.
const HEDGE_THRESHOLD = 0.75;

// Twelve independent noul judgments over the same question. They run in
// parallel in a single Jev request and cannot see one another; code below
// combines them into one of the 20 answers.
const QUESTIONS = {
  // Whether the question is safe to show other users; see isShareable
  personal: noul(
    "Does the question contain private personal information, such as a private individual's name, phone number, email address or home address?"
  ),
  // Tone of the question
  snarky: noul("Is the tone of the question snarky?"),
  selfDeprecating: noul("Is the tone of the question self-deprecating?"),
  // Whether the question is about a fact at all. Gates `truth`: opinions and
  // predictions have no true answer, and Jev scores them as false.
  fact: noul("Does the question pertain to a fact?"),
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

  // For a question about a fact, a clearly true answer is affirmative and a
  // clearly false one is negative, as emphatic as the certainty of the answer.
  // An undecided truth falls through to the rules below.
  if (p.fact > FACT_THRESHOLD) {
    if (p.truth > TRUTH_JUDGMENT) {
      return { category: "affirmative", answer: byStrength(AFFIRMATIVE, p.certain) };
    }
    if (p.truth < 1 - TRUTH_JUDGMENT) {
      return { category: "negative", answer: byStrength(NEGATIVE, p.certain) };
    }
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

/** Whether the question may be shown to other users in the live background. */
export function isShareable(p) {
  return p.personal <= PERSONAL_THRESHOLD;
}

// The gateway Jev calls are routed through, for logging.
const GATEWAY_ID = "somewhat-magical-jev-ball";

/**
 * Ask Jev, a model in Workers AI's own catalog
 * (https://developers.cloudflare.com/ai/models/typesafe/jev/), through the Worker's `AI`
 * binding — no TypeSafe key held by the Worker at all; Cloudflare's account-level auth
 * covers it, billed against the TypeSafe key added to the gateway above as a Bring Your
 * Own Key.
 */
export async function askJev(question, ai) {
  const request = { state: { question }, questions: QUESTIONS };
  // The binding wraps the model's own result in { state: "Completed", result, ... }.
  const { result } = await ai.run("typesafe/jev", request, { gateway: { id: GATEWAY_ID } });

  const signals = Object.fromEntries(
    Object.entries(result.answers).map(([name, a]) => [name, a.noul])
  );
  return { ...decide(signals), shareable: isShareable(signals), signals };
}

/**
 * Warm the model path ahead of a real ask, so the ask itself starts warm: the first jev
 * call on a cold isolate spends over a second on connection setup before any inference,
 * against about a third of that warm (measured; see issue #46) — and that cold start, not
 * the inference, is most of a first answer's wait. This is the same one-request route
 * through the same gateway, cut to a single judgment over a fixed innocuous question (an
 * empty state is rejected by the model's content moderation), so warming costs almost
 * nothing and its result is discarded. Latency barely moves with the number of judgments
 * (one judgment and all twelve time about the same), so one judgment warms the path a real
 * ask uses just as well as twelve would.
 */
export async function warmJev(ai) {
  const request = { state: { question: "Is the sky blue?" }, questions: { unfocused: QUESTIONS.unfocused } };
  await ai.run("typesafe/jev", request, { gateway: { id: GATEWAY_ID } });
}
