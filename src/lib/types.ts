/** A chunk returned by retrieval, with the ranking detail the UI exposes. */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  sourcePath: string | null;
  chunkIndex: number;
  content: string;
  /** Cosine similarity, 0–1. Null when the chunk only matched on keywords. */
  similarity: number;
  /** 1-based position in the vector ranking, or null if it did not appear. */
  vectorRank: number | null;
  /** 1-based position in the keyword ranking, or null if it did not appear. */
  keywordRank: number | null;
  /** Reciprocal Rank Fusion score — what the final ordering uses. */
  score: number;
  /** Citation number shown to the reader, 1-based. */
  citation: number;
}

export type RetrievalMode = "hybrid" | "vector" | "keyword";

export interface RetrievalTrace {
  query: string;
  rewrittenQuery: string | null;
  mode: RetrievalMode;
  chunks: RetrievedChunk[];
  /** Milliseconds spent in embedding + database. */
  latencyMs: number;
  embeddingMs: number;
  searchMs: number;
}

/** Server-sent events emitted by /api/chat, in order. */
export type ChatEvent =
  | { type: "status"; stage: "rewriting" | "retrieving" | "generating" }
  | { type: "retrieval"; trace: RetrievalTrace }
  | { type: "token"; value: string }
  | { type: "done"; answerMs: number; totalMs: number; model: string }
  | { type: "error"; message: string };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface WorkspaceStat {
  workspace: string;
  documents: number;
  chunks: number;
}
