"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Database, Layers, Search, Sparkles } from "lucide-react";
import type { RetrievalTrace, RetrievedChunk } from "@/lib/types";

const STRATEGY_LABEL: Record<string, string> = {
  hybrid: "Hybrid · RRF",
  vector: "Vector only",
  keyword: "Keyword only",
};

export function RetrievalPanel({
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <Layers className="size-5 text-ink-500" strokeWidth={1.5} />
        <p className="max-w-[24ch] text-[13px] leading-relaxed text-ink-400">
          {busy
            ? "Searching…"
            : "Ask something and the exact passages the model was given will appear here, with their scores."}
        </p>
      </div>
    );
  }

  const maxScore = Math.max(...trace.chunks.map((c) => c.score), 1e-9);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-white/7 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            <Database className="size-3.5" strokeWidth={2} />
            Retrieval
          </h2>
          <span className="rounded-full bg-white/6 px-2 py-0.5 font-mono text-[10px] text-ink-300 ring-1 ring-white/10">
            {STRATEGY_LABEL[trace.mode] ?? trace.mode}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <Stat label="embed" value={`${trace.embeddingMs}ms`} />
          <Stat label="search" value={`${trace.searchMs}ms`} />
          <Stat label="chunks" value={String(trace.chunks.length)} />
        </dl>

        {trace.rewrittenQuery && (
          <div className="mt-3 rounded-lg bg-white/4 p-2.5 ring-1 ring-white/7">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
              <Sparkles className="size-3" strokeWidth={2} />
              Rewritten for search
            </p>
            <p className="mt-1 text-[12px] leading-snug text-ink-200">
              {trace.rewrittenQuery}
            </p>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {trace.chunks.length === 0 ? (
          <p className="px-2 py-8 text-center text-[13px] text-ink-400">
            Nothing matched in this workspace.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {trace.chunks.map((chunk) => (
              <SourceCard
                key={chunk.id}
                chunk={chunk}
                widthPct={(chunk.score / maxScore) * 100}
                active={activeCitation === chunk.citation}
                onSelect={onSelectCitation}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/4 px-2 py-1.5 ring-1 ring-white/6">
      <dt className="text-[9px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-100">{value}</dd>
    </div>
  );
}

function SourceCard({
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
        ? "semantic only"
        : "keyword only";

  // Strip the breadcrumb we prepend at ingest so the panel shows the passage.
  const body = chunk.content.split("\n\n").slice(1).join("\n\n") || chunk.content;

  return (
    <li
      ref={ref}
      className={`group overflow-hidden rounded-xl ring-1 transition ${
        active
          ? "bg-indigo-400/8 ring-indigo-400/40"
          : "bg-white/3 ring-white/7 hover:bg-white/5"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          onSelect(active ? null : chunk.citation);
        }}
        className="w-full px-3 py-2.5 text-left"
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-medium ${
              active
                ? "bg-indigo-400 text-ink-950"
                : "bg-white/8 text-ink-300 ring-1 ring-white/10"
            }`}
          >
            {chunk.citation}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-snug text-ink-100">
              {chunk.documentTitle}
            </p>
            <p className="truncate font-mono text-[10px] text-ink-500">
              {chunk.sourcePath ?? "uploaded"} · chunk {chunk.chunkIndex}
            </p>
          </div>

          <ChevronDown
            className={`mt-0.5 size-3.5 shrink-0 text-ink-500 transition ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/7">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400/70 to-indigo-300 transition-[width] duration-500"
              style={{ width: `${Math.max(widthPct, 4)}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-ink-400">
            {chunk.score.toFixed(4)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Tag>{origin}</Tag>
          {chunk.vectorRank && <Tag mono>vec #{chunk.vectorRank}</Tag>}
          {chunk.keywordRank && <Tag mono>kw #{chunk.keywordRank}</Tag>}
          {chunk.similarity > 0 && (
            <Tag mono>sim {chunk.similarity.toFixed(2)}</Tag>
          )}
        </div>
      </button>

      {open && (
        <div className="animate-fade border-t border-white/7 bg-ink-950/50 px-3 py-2.5">
          <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-ink-300">
            {body}
          </p>
        </div>
      )}
    </li>
  );
}

function Tag({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] text-ink-400 ring-1 ring-white/7 ${
        mono ? "font-mono tabular-nums" : ""
      }`}
    >
      {children}
    </span>
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
  const options = [
    { id: "hybrid" as const, label: "Hybrid", icon: Layers },
    { id: "vector" as const, label: "Vector", icon: Sparkles },
    { id: "keyword" as const, label: "Keyword", icon: Search },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Retrieval strategy"
      className="flex items-center gap-0.5 rounded-lg bg-white/4 p-0.5 ring-1 ring-white/7"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            title={`Retrieve with ${option.label.toLowerCase()} search`}
            className={`flex items-center gap-1.5 rounded-[0.4rem] px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
              selected
                ? "bg-white/10 text-white shadow-sm"
                : "text-ink-400 hover:text-ink-200"
            }`}
          >
            <Icon className="size-3" strokeWidth={2.2} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
