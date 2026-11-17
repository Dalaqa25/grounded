"use client";

import { useEffect, useRef, useState } from "react";
import type { RetrievalTrace, RetrievedChunk } from "@/lib/types";

const STRATEGY_LABEL: Record<string, string> = {
  hybrid: "hybrid · rrf",
  vector: "vector only",
  keyword: "keyword only",
};

/**
 * The source apparatus: the column a scholarly edition puts in the margin.
 *
 * Most retrieval demos hide this. It is the most interesting part of the
 * system — when an answer is wrong, the only useful question is whether
 * retrieval missed or generation drifted, and you cannot tell without it.
 */
export function Apparatus({
  trace,
  activeCitation,
  onSelectCitation,
  busy,
}: {
  trace: RetrievalTrace | null;
  activeCitation: number | null;
  onSelectCitation: (n: number | null) => void;
  busy: boolean;
}) {
  if (!trace) {
    // Before the first question there is nothing to show, and on a phone an
    // empty panel under the sample questions is just noise.
    return (
      <div className="hidden px-6 pt-10 lg:block">
        <p className="label">Sources</p>
        <div className="mt-3 border-t border-rule pt-3">
          <p className="max-w-[26ch] text-[0.84rem] italic leading-relaxed text-ink-faint">
            {busy
              ? "Searching the corpus…"
              : "Every passage the model is given will be listed here, with its score and how it was found."}
          </p>
        </div>
      </div>
    );
  }

  const maxScore = Math.max(...trace.chunks.map((c) => c.score), 1e-9);

  return (
    <div className="px-0 pb-28 pt-8 lg:px-6 lg:pb-0 lg:pt-10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label">Sources</p>
        <p className="figure-num">{STRATEGY_LABEL[trace.mode] ?? trace.mode}</p>
      </div>

      <dl className="mt-3 flex gap-5 border-y border-rule py-2">
        <Reading label="embed" value={`${trace.embeddingMs}ms`} />
        <Reading label="search" value={`${trace.searchMs}ms`} />
        <Reading label="passages" value={String(trace.chunks.length)} />
      </dl>

      {trace.rewrittenQuery && (
        <p className="mt-3 border-l-2 border-rule-strong pl-3 text-[0.82rem] italic leading-snug text-ink-muted">
          Searched as: {trace.rewrittenQuery}
        </p>
      )}

      {trace.chunks.length === 0 ? (
        <p className="mt-6 text-[0.84rem] italic text-ink-faint">
          Nothing in this workspace matched.
        </p>
      ) : (
        <ol className="mt-1">
          {trace.chunks.map((chunk) => (
            <SourceEntry
              key={chunk.id}
              chunk={chunk}
              widthPct={(chunk.score / maxScore) * 100}
              active={activeCitation === chunk.citation}
              onSelect={onSelectCitation}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label text-[0.6rem]">{label}</dt>
      <dd className="figure-num text-[0.78rem] text-ink-muted">{value}</dd>
    </div>
  );
}

function SourceEntry({
  chunk,
  widthPct,
  active,
  onSelect,
}: {
  chunk: RetrievedChunk;
  widthPct: number;
  active: boolean;
  onSelect: (n: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setOpen(true);
    }
  }, [active]);

  const origin =
    chunk.vectorRank && chunk.keywordRank
      ? "semantic + keyword"
      : chunk.vectorRank
        ? "semantic"
        : "keyword";

  // Strip the breadcrumb added at ingest so the entry shows the passage itself.
  const body = chunk.content.split("\n\n").slice(1).join("\n\n") || chunk.content;

  return (
    <li ref={ref} className="border-b border-rule">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          onSelect(active ? null : chunk.citation);
        }}
        className="group w-full py-2.5 text-left"
      >
        <div className="flex gap-2.5">
          <span
            className="shrink-0 pt-px font-mono text-[0.72rem] tabular-nums"
            style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
          >
            {String(chunk.citation).padStart(2, "0")}
          </span>

          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[0.88rem] leading-snug transition-colors ${
                active ? "text-ink" : "text-ink-muted group-hover:text-ink"
              }`}
            >
              {chunk.documentTitle}
            </p>
            <p className="figure-num mt-0.5 truncate text-[0.66rem]">
              {chunk.sourcePath?.replace(/^data\//, "") ?? "uploaded"} · §{chunk.chunkIndex}
            </p>

            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-px flex-1 bg-rule">
                <span
                  className="block h-px transition-[width] duration-500"
                  style={{
                    width: `${Math.max(widthPct, 6)}%`,
                    background: active ? "var(--accent)" : "var(--rule-strong)",
                  }}
                />
              </span>
              <span className="figure-num text-[0.66rem]">{chunk.score.toFixed(4)}</span>
            </div>

            <p className="figure-num mt-1 text-[0.64rem]">
              {origin}
              {chunk.vectorRank ? ` · vec ${chunk.vectorRank}` : ""}
              {chunk.keywordRank ? ` · kw ${chunk.keywordRank}` : ""}
              {chunk.similarity > 0 ? ` · sim ${chunk.similarity.toFixed(2)}` : ""}
            </p>
          </div>
        </div>
      </button>

      {open && (
        <p className="animate-fade mb-3 max-h-52 overflow-y-auto whitespace-pre-wrap border-l-2 border-rule-strong pl-3 text-[0.8rem] leading-relaxed text-ink-muted">
          {body}
        </p>
      )}
    </li>
  );
}

export function StrategyToggle({
  value,
  onChange,
  disabled,
}: {
  value: "hybrid" | "vector" | "keyword";
  onChange: (v: "hybrid" | "vector" | "keyword") => void;
  disabled: boolean;
}) {
  const options = ["hybrid", "vector", "keyword"] as const;

  return (
    <div role="radiogroup" aria-label="Retrieval strategy" className="flex items-center">
      <span className="label mr-2.5 text-[0.6rem]">Search</span>
      <div className="flex items-center border border-rule">
        {options.map((option, i) => {
          const selected = value === option;
          return (
            <button
              key={option}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              title={`Retrieve with ${option} search`}
              className={`px-2.5 py-1 text-[0.72rem] transition-colors disabled:opacity-40 ${
                i > 0 ? "border-l border-rule" : ""
              } ${selected ? "text-accent" : "text-ink-faint hover:text-ink"}`}
              style={selected ? { background: "var(--accent-soft)" } : undefined}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
