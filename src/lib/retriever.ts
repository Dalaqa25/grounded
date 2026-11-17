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
    match_count: mode === "hybrid" ? matchCount : candidateCount,
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
      .sort((a, b) => (a.vector_rank ?? 0) - (b.vector_rank ?? 0))
      .slice(0, matchCount);
  } else if (mode === "keyword") {
    rows = rows
      .filter((r) => r.keyword_rank != null)
      .sort((a, b) => (a.keyword_rank ?? 0) - (b.keyword_rank ?? 0))
      .slice(0, matchCount);
  }

  const chunks: RetrievedChunk[] = rows.map((row, i) => ({
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    sourcePath: row.source_path,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: row.similarity ?? 0,
    vectorRank: row.vector_rank ?? null,
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
 * Lowest fused score we will still answer from. Below this the retrieval found
 * nothing that resembles the question, and the honest response is to say so
 * rather than let the model improvise from loosely related text.
 */
export const RELEVANCE_FLOOR = 0.0155;

export function hasUsableContext(trace: RetrievalTrace): boolean {
  const best = trace.chunks[0];
  if (!best) return false;
  return best.score >= RELEVANCE_FLOOR || best.similarity >= 0.62;
}
