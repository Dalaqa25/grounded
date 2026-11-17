"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/modes";
import type { ChatEvent, RetrievalMode, RetrievalTrace } from "@/lib/types";
import { Answer } from "./answer";
import { Apparatus, StrategyToggle } from "./apparatus";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  trace?: RetrievalTrace;
  stage?: "rewriting" | "retrieving" | "generating" | null;
  timing?: { answerMs: number; totalMs: number; model: string };
  error?: string;
}

const STAGE_COPY = {
  rewriting: "Reading the question against the conversation",
  retrieving: "Searching the corpus",
  generating: "Writing",
} as const;

export function Workspace({
  mode,
  stats,
}: {
  mode: Mode;
  stats: { documents: number; chunks: number } | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [strategy, setStrategy] = useState<RetrievalMode>("hybrid");
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const lastTrace = [...messages].reverse().find((m) => m.trace)?.trace ?? null;

  useEffect(() => {
    setMessages([]);
    setActiveCitation(null);
    abortRef.current?.abort();
  }, [mode.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;

      setInput("");
      setActiveCitation(null);
      setBusy(true);

      const history = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed },
        { id: assistantId, role: "assistant", content: "", stage: "retrieving" },
      ]);

      const patch = (fn: (m: Message) => Message) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: mode.id,
            question: trimmed,
            retrieval: strategy,
            history,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.error ?? `Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            let event: ChatEvent;
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            if (event.type === "status") patch((m) => ({ ...m, stage: event.stage }));
            else if (event.type === "retrieval") patch((m) => ({ ...m, trace: event.trace }));
            else if (event.type === "token")
              patch((m) => ({ ...m, content: m.content + event.value, stage: null }));
            else if (event.type === "done")
              patch((m) => ({
                ...m,
                stage: null,
                timing: {
                  answerMs: event.answerMs,
                  totalMs: event.totalMs,
                  model: event.model,
                },
              }));
            else if (event.type === "error")
              patch((m) => ({ ...m, stage: null, error: event.message }));
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          patch((m) => ({
            ...m,
            stage: null,
            error: error instanceof Error ? error.message : "Something went wrong",
          }));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages, mode.id, strategy],
  );

  return (
    <div className="mx-auto w-full max-w-[86rem] px-6">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ------------------------------------------------- the document -- */}
        <main className="min-w-0 pb-40 pt-10 lg:border-r lg:border-rule lg:pr-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
            <div>
              <h1 className="text-[1.5rem] leading-tight tracking-[-0.012em]">
                {mode.name}
              </h1>
              <p className="mt-0.5 text-[0.88rem] italic text-ink-muted">
                {mode.tagline}
              </p>
            </div>
            <div className="flex items-center gap-5">
              {stats && (
                <p className="figure-num">
                  {stats.documents} documents · {stats.chunks} passages
                </p>
              )}
              <StrategyToggle value={strategy} onChange={setStrategy} disabled={busy} />
            </div>
          </div>

          {messages.length === 0 ? (
            <Opening mode={mode} onPick={send} />
          ) : (
            <ol className="mt-8 flex flex-col gap-10">
              {messages.map((message) =>
                message.role === "user" ? (
                  <li key={message.id} className="animate-rise">
                    <p className="label mb-1.5">Question</p>
                    <p className="max-w-[58ch] text-[1.18rem] leading-snug tracking-[-0.008em]">
                      {message.content}
                    </p>
                  </li>
                ) : (
                  <li key={message.id} className="animate-rise max-w-[62ch]">
                    <Reply
                      message={message}
                      activeCitation={activeCitation}
                      onSelectCitation={setActiveCitation}
                    />
                  </li>
                ),
              )}
            </ol>
          )}

          <div ref={endRef} />
        </main>

        {/* ----------------------------------------------- the apparatus -- */}
        <aside className="hidden lg:block">
          <div className="sticky top-[7.4rem] max-h-[calc(100dvh-9rem)] overflow-y-auto pb-10">
            <Apparatus
              trace={lastTrace}
              activeCitation={activeCitation}
              onSelectCitation={setActiveCitation}
              busy={busy}
            />
          </div>
        </aside>
      </div>

      {/* --------------------------------------------------------- ask -- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div className="h-16 bg-gradient-to-t from-paper to-transparent" />
        <div className="bg-paper pb-5">
          <div className="mx-auto max-w-[86rem] px-6">
            <div className="lg:max-w-[calc(100%-22rem)] lg:pr-10">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="pointer-events-auto flex items-end gap-3 border-t-2 border-ink pt-2.5"
              >
                <span className="label pb-2 pt-1">Ask</span>
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder={mode.placeholder}
                  className="max-h-36 flex-1 resize-none bg-transparent py-1 text-[1.02rem] leading-relaxed outline-none placeholder:italic placeholder:text-ink-faint"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => {
                      abortRef.current?.abort();
                      setBusy(false);
                    }}
                    className="pb-1.5 text-[0.82rem] text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
                  >
                    stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="pb-1.5 text-[0.82rem] underline underline-offset-4 transition-colors disabled:no-underline disabled:opacity-35"
                    style={{ color: input.trim() ? "var(--accent)" : undefined }}
                  >
                    answer
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reply({
  message,
  activeCitation,
  onSelectCitation,
}: {
  message: Message;
  activeCitation: number | null;
  onSelectCitation: (n: number) => void;
}) {
  if (message.error) {
    return (
      <div className="border-l-2 pl-4" style={{ borderColor: "var(--accent)" }}>
        <p className="label" style={{ color: "var(--accent)" }}>
          Failed
        </p>
        <p className="mt-1 font-mono text-[0.78rem] leading-relaxed text-ink-muted">
          {message.error}
        </p>
      </div>
    );
  }

  return (
    <div>
      {message.stage && (
        <p className="label flex items-center gap-2">
          <span
            className="animate-pulse-slow inline-block size-1 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          {STAGE_COPY[message.stage]}…
        </p>
      )}

      {message.content && (
        <Answer
          content={message.content}
          activeCitation={activeCitation}
          onSelectCitation={onSelectCitation}
        />
      )}

      {message.timing && message.trace && (
        <p className="figure-num mt-4 border-t border-rule pt-2">
          retrieval {message.trace.latencyMs}ms · answer {message.timing.answerMs}ms ·{" "}
          {message.trace.chunks.length} passages · {message.timing.model}
        </p>
      )}
    </div>
  );
}

function Opening({ mode, onPick }: { mode: Mode; onPick: (q: string) => void }) {
  return (
    <div className="animate-fade mt-10 max-w-[60ch]">
      <p className="text-[1.3rem] leading-[1.5] tracking-[-0.008em]">{mode.blurb}</p>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-muted">
        Ask anything. Hybrid search finds the passages, the answer is written from
        those alone, and every claim carries a footnote you can open.
      </p>

      <p className="label mt-10 border-b border-rule pb-2">Try one</p>
      <ul>
        {mode.samples.map((sample, i) => (
          <li key={sample} className="border-b border-rule">
            <button
              onClick={() => onPick(sample)}
              className="group flex w-full items-baseline gap-3 py-2.5 text-left"
            >
              <span className="figure-num shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[1rem] leading-snug text-ink-muted transition-colors group-hover:text-ink">
                {sample}
              </span>
              <span
                className="shrink-0 text-[0.8rem] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--accent)" }}
              >
                ask →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
