"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, PanelRightClose, PanelRightOpen, RotateCcw, Square } from "lucide-react";
import { ACCENTS, type Mode } from "@/lib/modes";
import type { ChatEvent, RetrievalMode, RetrievalTrace } from "@/lib/types";
import { Answer } from "./answer";
import { RetrievalPanel, StrategyToggle } from "./retrieval-panel";

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
  rewriting: "Resolving the question against the conversation",
  retrieving: "Searching the corpus",
  generating: "Writing the answer",
} as const;

export function Workspace({ mode, stats }: { mode: Mode; stats: { documents: number; chunks: number } | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [strategy, setStrategy] = useState<RetrievalMode>("hybrid");
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const accent = ACCENTS[mode.accent];
  const lastTrace = [...messages].reverse().find((m) => m.trace)?.trace ?? null;

  // Reset when the workspace changes — a trace from another corpus is noise.
  useEffect(() => {
    setMessages([]);
    setActiveCitation(null);
    abortRef.current?.abort();
  }, [mode.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        stage: "retrieving",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

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

            if (event.type === "status") {
              patch((m) => ({ ...m, stage: event.stage }));
            } else if (event.type === "retrieval") {
              patch((m) => ({ ...m, trace: event.trace }));
            } else if (event.type === "token") {
              patch((m) => ({ ...m, content: m.content + event.value, stage: null }));
            } else if (event.type === "done") {
              patch((m) => ({
                ...m,
                stage: null,
                timing: {
                  answerMs: event.answerMs,
                  totalMs: event.totalMs,
                  model: event.model,
                },
              }));
            } else if (event.type === "error") {
              patch((m) => ({ ...m, stage: null, error: event.message }));
            }
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

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  return (
    <div className="flex h-dvh min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ------------------------------------------------------ header -- */}
        <header className="flex shrink-0 items-center gap-4 border-b border-white/7 px-6 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${accent.dot}`} />
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
                {mode.name}
              </h1>
              {stats && (
                <span className="hidden font-mono text-[11px] text-ink-500 sm:inline">
                  {stats.documents} docs · {stats.chunks} chunks
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-ink-400">{mode.blurb}</p>
          </div>

          <StrategyToggle value={strategy} onChange={setStrategy} disabled={busy} />

          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setActiveCitation(null);
              }}
              title="Clear conversation"
              className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/6 hover:text-ink-100"
            >
              <RotateCcw className="size-4" strokeWidth={1.8} />
            </button>
          )}

          <button
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? "Hide retrieval panel" : "Show retrieval panel"}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-white/6 hover:text-ink-100"
          >
            {panelOpen ? (
              <PanelRightClose className="size-4" strokeWidth={1.8} />
            ) : (
              <PanelRightOpen className="size-4" strokeWidth={1.8} />
            )}
          </button>
        </header>

        {/* ---------------------------------------------------- messages -- */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[46rem] px-6 py-6">
            {messages.length === 0 ? (
              <EmptyState mode={mode} onPick={send} />
            ) : (
              <ul className="flex flex-col gap-7">
                {messages.map((message) => (
                  <li key={message.id} className="animate-rise">
                    {message.role === "user" ? (
                      <div className="flex justify-end">
                        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white/8 px-3.5 py-2 text-[14px] leading-relaxed text-ink-100 ring-1 ring-white/8">
                          {message.content}
                        </p>
                      </div>
                    ) : (
                      <AssistantMessage
                        message={message}
                        activeCitation={activeCitation}
                        onSelectCitation={(n) => {
                          setActiveCitation(n);
                          setPanelOpen(true);
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------- composer -- */}
        <div className="shrink-0 px-6 pb-5">
          <div className="mx-auto max-w-[46rem]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="panel flex items-end gap-2 rounded-2xl px-3 py-2.5 transition focus-within:ring-1 focus-within:ring-indigo-400/40"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={`Ask about ${
                  mode.id === "talent" ? "the candidates" : mode.id === "handbook" ? "the handbook" : "the platform"
                }…`}
                className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-relaxed text-ink-100 outline-none placeholder:text-ink-500"
              />

              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  title="Stop"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-ink-100 transition hover:bg-white/15"
                >
                  <Square className="size-3.5 fill-current" strokeWidth={0} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  title="Send"
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-400 text-ink-950 transition enabled:hover:bg-indigo-300 disabled:bg-white/8 disabled:text-ink-500"
                >
                  <ArrowUp className="size-4" strokeWidth={2.4} />
                </button>
              )}
            </form>
            <p className="mt-2 text-center text-[11px] text-ink-500">
              Answers come only from this workspace. Every claim is cited, and the
              passages behind it are on the right.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ retrieval panel -- */}
      {panelOpen && (
        <aside className="hidden w-[21rem] shrink-0 border-l border-white/7 bg-ink-900/40 lg:block">
          <RetrievalPanel
            trace={lastTrace}
            activeCitation={activeCitation}
            onSelectCitation={setActiveCitation}
            busy={busy}
          />
        </aside>
      )}
    </div>
  );
}

function AssistantMessage({
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
      <div className="rounded-xl bg-red-500/8 px-4 py-3 text-[13px] text-red-200 ring-1 ring-red-500/20">
        <p className="font-medium">That request failed.</p>
        <p className="mt-1 font-mono text-[12px] leading-relaxed text-red-200/70">
          {message.error}
        </p>
      </div>
    );
  }

  return (
    <div>
      {message.stage && (
        <p className="mb-2 flex items-center gap-2 text-[12px] text-ink-400">
          <span className="animate-shimmer size-1.5 rounded-full bg-indigo-300" />
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
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink-500">
          <span>retrieval {message.trace.latencyMs}ms</span>
          <span>·</span>
          <span>answer {message.timing.answerMs}ms</span>
          <span>·</span>
          <span>{message.trace.chunks.length} chunks</span>
          <span>·</span>
          <span>{message.timing.model}</span>
        </p>
      )}
    </div>
  );
}

function EmptyState({ mode, onPick }: { mode: Mode; onPick: (q: string) => void }) {
  const accent = ACCENTS[mode.accent];
  return (
    <div className="animate-fade pt-10">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${accent.bg} ${accent.text} ${accent.ring}`}
      >
        <span className={`size-1.5 rounded-full ${accent.dot}`} />
        {mode.tagline}
      </div>

      <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight text-white">
        Ask anything about this {mode.noun} corpus.
      </h2>
      <p className="mt-2 max-w-[48ch] text-[14px] leading-relaxed text-ink-300">
        Hybrid retrieval finds the passages, the model answers from those alone,
        and every sentence carries a citation you can open.
      </p>

      <ul className="mt-7 flex flex-col gap-2">
        {mode.samples.map((sample) => (
          <li key={sample}>
            <button
              onClick={() => onPick(sample)}
              className="group flex w-full items-center gap-3 rounded-xl bg-white/3 px-3.5 py-2.5 text-left text-[13.5px] text-ink-200 ring-1 ring-white/7 transition hover:bg-white/6 hover:text-white"
            >
              <span className="flex-1">{sample}</span>
              <ArrowUp className="size-3.5 shrink-0 rotate-45 text-ink-600 transition group-hover:text-ink-300" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
