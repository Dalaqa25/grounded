import { ChatGroq } from "@langchain/groq";
import { env } from "./env";

/**
 * Groq runs open-weight models on custom silicon, so time-to-first-token is in
 * the tens of milliseconds. For a retrieval demo that matters: the interesting
 * latency is the retrieval, and a slow model would hide it.
 *
 * reasoningEffort is "low" because gpt-oss counts its own reasoning against
 * maxTokens. Left at default, a short budget is spent thinking and the reply
 * comes back empty — which reads as a bug rather than a budget.
 *
 * (`reasoningFormat` is deliberately not set: @langchain/groq declares the
 * property but never assigns it from the constructor, so passing it would be
 * decoration. Groq's default already keeps reasoning out of `content`.)
 */
export function chatModel(opts: { temperature?: number; maxTokens?: number } = {}) {
  const { GROQ_API_KEY, GROQ_MODEL } = env();
  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: GROQ_MODEL,
    temperature: opts.temperature ?? 0.1,
    maxTokens: opts.maxTokens ?? 1024,
    reasoningEffort: "low",
    maxRetries: 0, // handled by withGroqRetry, which reads the server's hint
  });
}

/**
 * Grading runs on a second, smaller model. Two reasons: a grader should not be
 * the same weights that produced the answer, and Groq's rate limits are
 * per-model, so the eval suite does not starve the thing it is measuring.
 */
export function judgeModel() {
  const { GROQ_API_KEY, GROQ_JUDGE_MODEL } = env();
  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: GROQ_JUDGE_MODEL,
    temperature: 0,
    maxTokens: 500,
    reasoningEffort: "low",
    maxRetries: 0,
  });
}

export function modelName(): string {
  return env().GROQ_MODEL;
}

export function judgeModelName(): string {
  return env().GROQ_JUDGE_MODEL;
}

/** Pulls the server's own backoff out of a 429 instead of guessing at it. */
function rateLimitDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  if (!/429|rate.?limit/i.test(message)) return null;
  const ms = /try again in (\d+(?:\.\d+)?)ms/i.exec(message)?.[1];
  if (ms) return Math.ceil(Number(ms)) + 250;
  const s = /try again in (\d+(?:\.\d+)?)s/i.exec(message)?.[1];
  if (s) return Math.ceil(Number(s) * 1000) + 500;
  return 8_000;
}

/**
 * Timeouts, socket resets and 5xx are worth another go; a bad request is not.
 * Retrying everything would turn a malformed prompt into six slow failures.
 */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timed? ?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|fetch failed|network|\b5\d{2}\b|service unavailable|overloaded/i.test(
    message,
  );
}

/**
 * Groq's free tier caps tokens per minute, not just requests, so a burst of
 * long prompts trips it even at a sedate request rate. Retrying on the
 * server's suggested delay is the difference between an eval run that
 * completes and one that dies a third of the way through.
 */
export async function withGroqRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;

      const throttled = rateLimitDelayMs(error);
      if (throttled !== null) {
        await new Promise((r) => setTimeout(r, throttled));
        continue;
      }

      if (!isTransient(error)) throw error; // a real error — fail fast
      await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt + Math.random() * 400));
    }
  }
  throw lastError;
}
