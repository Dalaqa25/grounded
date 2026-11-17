import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import type { Embeddings } from "@langchain/core/embeddings";
import { env } from "./env";

/**
 * The embedding model is the one piece most likely to be swapped — for cost, for
 * a self-hosted model, or because a provider retires a version. Everything else
 * depends on this narrow interface, and the column width in Postgres, so a swap
 * is a one-file change plus a re-index.
 */
export const EMBEDDING_DIMENSIONS = 768;

let client: Embeddings | null = null;

export function embeddings(): Embeddings {
  if (client) return client;
  const { GOOGLE_API_KEY, EMBEDDING_MODEL } = env();
  client = new GoogleGenerativeAIEmbeddings({
    apiKey: GOOGLE_API_KEY,
    model: EMBEDDING_MODEL,
    taskType: undefined,
  });
  return client;
}

export async function embedQuery(text: string): Promise<number[]> {
  const vector = await embeddings().embedQuery(text);
  assertDimensions(vector.length);
  return vector;
}

/**
 * Embeds in batches with a small concurrency limit. Free tiers rate-limit hard,
 * and a 400-chunk ingest fired all at once is the fastest way to get throttled.
 */
export async function embedDocuments(
  texts: string[],
  opts: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<number[][]> {
  const batchSize = opts.batchSize ?? 16;
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vectors = await withRetry(() => embeddings().embedDocuments(batch));
    for (const v of vectors) assertDimensions(v.length);
    out.push(...vectors);
    opts.onProgress?.(Math.min(i + batchSize, texts.length), texts.length);
  }

  return out;
}

function assertDimensions(n: number) {
  if (n !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${n} dimensions but the database column is vector(${EMBEDDING_DIMENSIONS}). ` +
        `Change EMBEDDING_DIMENSIONS and the schema together, then re-ingest.`,
    );
  }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const wait = 500 * 2 ** attempt + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}
