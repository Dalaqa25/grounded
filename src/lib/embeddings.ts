import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { env } from "./env";

/**
 * The embedding model is the one piece most likely to be swapped — for cost, for
 * a self-hosted model, or because a provider retires a version. Everything else
 * depends on this narrow interface plus the column width in Postgres, so a swap
 * is a one-file change and a re-ingest.
 */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Gemini embeddings are asymmetric: a passage and the question that should find
 * it are encoded with different task types, and the pair is trained to land
 * near each other. Using RETRIEVAL_DOCUMENT at ingest and RETRIEVAL_QUERY at
 * search time is free accuracy — the common mistake is to use one client for
 * both and lose it.
 */
let documentClient: GoogleGenerativeAIEmbeddings | null = null;
let queryClient: GoogleGenerativeAIEmbeddings | null = null;

function client(taskType: TaskType): GoogleGenerativeAIEmbeddings {
  const { GOOGLE_API_KEY, EMBEDDING_MODEL } = env();
  return new GoogleGenerativeAIEmbeddings({
    apiKey: GOOGLE_API_KEY,
    model: EMBEDDING_MODEL,
    outputDimensionality: EMBEDDING_DIMENSIONS,
    taskType,
  });
}

function documents(): GoogleGenerativeAIEmbeddings {
  documentClient ??= client(TaskType.RETRIEVAL_DOCUMENT);
  return documentClient;
}

function queries(): GoogleGenerativeAIEmbeddings {
  queryClient ??= client(TaskType.RETRIEVAL_QUERY);
  return queryClient;
}

/**
 * Gemini only returns unit-length vectors at its native 3072 dimensions. Asking
 * for 768 truncates, which leaves the magnitude wrong. pgvector's cosine
 * operator divides by magnitude anyway, so this is belt and braces — but it
 * keeps the similarity numbers shown in the UI honest, and it means switching
 * the index to inner product later would not silently change the ranking.
 */
function normalise(vector: number[]): number[] {
  let sum = 0;
  for (const v of vector) sum += v * v;
  const magnitude = Math.sqrt(sum);
  if (!magnitude || !Number.isFinite(magnitude)) return vector;
  return vector.map((v) => v / magnitude);
}

function assertDimensions(n: number) {
  if (n !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${n} dimensions but the database column is vector(${EMBEDDING_DIMENSIONS}). ` +
        `Change EMBEDDING_DIMENSIONS and supabase/schema.sql together, then re-ingest.`,
    );
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  const vector = await withRetry(() => queries().embedQuery(text));
  assertDimensions(vector.length);
  return normalise(vector);
}

/**
 * Embeds many texts with a small concurrency limit.
 *
 * Deliberately one request per chunk rather than the provider's batch endpoint:
 * batching returned silently empty vectors for part of a batch, which would
 * have written unsearchable rows into the index. One call per chunk fails
 * loudly instead, and with a concurrency of four it is no slower in practice.
 * Free tiers also rate-limit hard, so an unbounded fan-out is not an option.
 */
export async function embedDocuments(
  texts: string[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<number[][]> {
  const concurrency = opts.concurrency ?? 4;
  const out: number[][] = new Array(texts.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= texts.length) return;
      const vector = await withRetry(() => documents().embedQuery(texts[i]));
      assertDimensions(vector.length);
      out[i] = normalise(vector);
      opts.onProgress?.(++done, texts.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, texts.length) }, worker),
  );

  return out;
}

/**
 * The Gemini free tier allows 100 embed requests a minute. Pacing to a little
 * under that is the difference between an ingest that finishes and one that
 * dies two thirds of the way through with half an index written.
 *
 * A single shared gate serialises start times across all workers, so raising
 * concurrency changes how much overlaps, never how fast requests are issued.
 */
const MIN_INTERVAL_MS = 60_000 / 85;
let gate: Promise<void> = Promise.resolve();

function pace<T>(fn: () => Promise<T>): Promise<T> {
  const ready = gate.then(
    () => new Promise<void>((r) => setTimeout(r, MIN_INTERVAL_MS)),
  );
  gate = ready;
  return ready.then(fn);
}

/** Reads the server's own backoff hint out of a 429 rather than guessing. */
function retryDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  if (!/429|Too Many Requests|quota/i.test(message)) return null;
  const seconds = /retry in (\d+(?:\.\d+)?)s/i.exec(message)?.[1];
  return seconds ? Math.ceil(Number(seconds) * 1000) + 1_000 : 20_000;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await pace(fn);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      const throttled = retryDelayMs(error);
      const wait = throttled ?? 700 * 2 ** attempt + Math.random() * 300;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}
