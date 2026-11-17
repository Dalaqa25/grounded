import { ChatGroq } from "@langchain/groq";
import { env } from "./env";

/**
 * Groq runs open-weight models on custom silicon, so time-to-first-token is in
 * the tens of milliseconds. For a retrieval demo that matters: the interesting
 * latency is the retrieval, and a slow model would hide it.
 */
export function chatModel(opts: { temperature?: number; maxTokens?: number } = {}) {
  const { GROQ_API_KEY, GROQ_MODEL } = env();
  return new ChatGroq({
    apiKey: GROQ_API_KEY,
    model: GROQ_MODEL,
    temperature: opts.temperature ?? 0.1,
    maxTokens: opts.maxTokens ?? 1024,
  });
}

export function modelName(): string {
  return env().GROQ_MODEL;
}
