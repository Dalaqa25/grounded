import { supabaseAdmin } from "./supabase";
import { embedQuery } from "./embeddings";
import type { RetrievalMode, RetrievalTrace, RetrievedChunk } from "./types";

interface HybridRow {
  id: string;
  document_id: string;
  document_title: string;
  source_path: string | null;
  chunk_index: number;
  content: string;
  similarity: number;
  vector_rank: number | null;
  keyword_rank: number | null;
  score: number;
}

export interface RetrieveOptions {
  workspace: string;
  query: string;
  /** The query actually sent to search, if it was rewritten from chat history. */
  searchQuery?: string;
  mode?: RetrievalMode;
  matchCount?: number;
  candidateCount?: number;
  /** Chunks any single document may occupy in the final set. */
  maxPerDocument?: number;
}

/**
 * Caps how much of the context window one document can occupy.
 *
 * This exists because of a measured failure, not a hunch. Asked "who has
 * production experience with OAuth?", pure score ordering returned three
 * chunks of one candidate and three of another: six slots, two people, out of
 * twelve profiles. The model then named two candidates and was marked wrong
 * for missing the third — but the third was never in its context. Relevance
 * ordering is right for "what does this error mean" and wrong for "list
 * everyone who matches", and a per-document cap buys breadth for the second
 * without hurting the first.
 *
 * Chunks dropped by the cap are not discarded; they top the list back up if
 * there were not enough distinct documents to fill it.
 */
function diversify<T extends { document_id: string }>(
  rows: T[],
  limit: number,
  maxPerDocument: number,
): T[] {
  const taken = new Map<string, number>();
  const picked: T[] = [];
  const overflow: T[] = [];

  for (const row of rows) {
    const used = taken.get(row.document_id) ?? 0;
    if (used < maxPerDocument) {
      picked.push(row);
      taken.set(row.document_id, used + 1);
    } else {
      overflow.push(row);
    }
  }

  for (const row of overflow) {
    if (picked.length >= limit) break;
    picked.push(row);
  }

  return picked.slice(0, limit);
}

/**
 * One round trip to Postgres does both searches and fuses them, so the vector
 * and keyword candidate sets never cross the network. Reciprocal Rank Fusion
 * is deliberate: it combines *ranks*, not scores, so cosine similarity and
 * ts_rank_cd — which are not on the same scale — can be merged without
 * inventing a normalisation constant that would need tuning per corpus.
 */
export async function retrieve(opts: RetrieveOptions): Promise<RetrievalTrace> {
  const started = Date.now();
  const mode = opts.mode ?? "hybrid";
  const matchCount = opts.matchCount ?? 6;
  const candidateCount = opts.candidateCount ?? 40;
  const maxPerDocument = opts.maxPerDocument ?? 2;
  const searchQuery = (opts.searchQuery ?? opts.query).trim();

  const embedStart = Date.now();
  // Keyword-only still needs a vector argument for the RPC signature; a zero
  // vector is inert because the semantic CTE is discarded afterwards.
  const vector =
    mode === "keyword" ? new Array(768).fill(0) : await embedQuery(searchQuery);
  const embeddingMs = Date.now() - embedStart;

  const searchStart = Date.now();
  const { data, error } = await supabaseAdmin().rpc("hybrid_search", {
    query_text: searchQuery,
    query_embedding: vector as unknown as string,
    ws: opts.workspace,
    match_count: mode === "hybrid" ? matchCount * 3 : candidateCount,
    candidate_count: candidateCount,
    rrf_k: 50,
  });
  const searchMs = Date.now() - searchStart;

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  let rows = (data ?? []) as HybridRow[];

  // For the single-strategy comparison views, drop the other ranking and
  // re-sort. Running one RPC keeps the three modes honestly comparable: same
  // candidate pool, same corpus, only the ordering changes.
  if (mode === "vector") {
    rows = rows
      .filter((r) => r.vector_rank != null)
      .sort((a, b) => (a.vector_rank ?? 0) - (b.vector_rank ?? 0));
  } else if (mode === "keyword") {
    rows = rows
      .filter((r) => r.keyword_rank != null)
      .sort((a, b) => (a.keyword_rank ?? 0) - (b.keyword_rank ?? 0));
  }

  rows = diversify(rows, matchCount, maxPerDocument);

  // Keyword-only sends a zero vector, so the semantic CTE still runs and
  // produces ranks against nothing. Reporting those would be a lie: the panel
  // said "semantic + keyword · vec 3" for a search that never embedded
  // anything. They are dropped here rather than displayed.
  const semanticIsReal = mode !== "keyword";

  const chunks: RetrievedChunk[] = rows.map((row, i) => ({
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    sourcePath: row.source_path,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: semanticIsReal ? (row.similarity ?? 0) : 0,
    vectorRank: semanticIsReal ? (row.vector_rank ?? null) : null,
    keywordRank: row.keyword_rank ?? null,
    score: row.score,
    citation: i + 1,
  }));

  return {
    query: opts.query,
    rewrittenQuery: searchQuery === opts.query.trim() ? null : searchQuery,
    mode,
    chunks,
    latencyMs: Date.now() - started,
    embeddingMs,
    searchMs,
  };
}

/**
 * The floor is measured on cosine similarity, not on the fused score.
 *
 * This is worth stating plainly because the obvious choice is wrong: an RRF
 * score is built from ranks, so whatever comes back first always scores about
 * 1/(k+1) no matter how irrelevant it is. Measured on this corpus, "what is the
 * best recipe for khinkali" scored 0.0392 against the candidate pool — higher
 * than a real question about OAuth experience at 0.0378. Rank says nothing
 * about relevance. Similarity does: real questions land at 0.73–0.85 here,
 * off-corpus ones at 0.57–0.66.
 *
 * Two layers, deliberately:
 *
 *   1. This floor is a cheap hard gate for questions that are plainly not about
 *      the corpus. Below it the model is never called, which is also free.
 *   2. For the grey zone — on-topic questions the corpus happens not to answer,
 *      like asking a candidate pool about security clearances — the floor is
 *      left alone and the model is instructed to decline. That behaviour is
 *      measured in the eval suite rather than assumed.
 *
 * Set low on purpose. A false refusal is worse than a cited "the sources do
 * not cover this", and the second layer catches what this one lets through.
 */
export const RELEVANCE_FLOOR = 0.62;

export function hasUsableContext(trace: RetrievalTrace): boolean {
  const best = trace.chunks[0];
  if (!best) return false;

  // Keyword-only computes no embedding, so there is no similarity to compare
  // against. Applying the floor there made the comparison mode refuse every
  // question, which looked like a broken toggle rather than the honest point
  // it is meant to make: the same question, answered from worse passages.
  // A Postgres full-text match is itself evidence of some relevance, so the
  // gate becomes "did anything match at all" and the model decides the rest.
  if (trace.mode === "keyword") return true;

  return best.similarity >= RELEVANCE_FLOOR;
}
