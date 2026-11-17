import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Check, FlaskConical, Minus, X } from "lucide-react";

export const metadata: Metadata = {
  title: "Evaluation",
  description:
    "Measured accuracy, retrieval hit rate, grounding and refusal behaviour across 45 questions.",
};

export const dynamic = "force-dynamic";

interface CaseResult {
  id: string;
  question: string;
  answerable: boolean;
  retrievalHit: boolean | null;
  groundingOk: boolean;
  accurate: boolean;
  judgeNote: string;
  latencyMs: number;
}

interface Results {
  generatedAt: string;
  retrievalMode: string;
  model: string;
  overall: { accuracy: number; retrieval: number; grounding: number; cases: number };
  summary: {
    workspace: string;
    name: string;
    cases: number;
    accuracy: number;
    retrieval: number;
    grounding: number;
    refusal: number;
    medianLatencyMs: number;
  }[];
  results: Record<string, CaseResult[]>;
}

async function loadResults(): Promise<Results | null> {
  try {
    const file = path.join(process.cwd(), "data", "evals", "results.json");
    return JSON.parse(await readFile(file, "utf8")) as Results;
  } catch {
    return null;
  }
}

export default async function EvalsPage() {
  const results = await loadResults();

  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-400/12 ring-1 ring-indigo-400/25">
          <FlaskConical className="size-4 text-indigo-300" strokeWidth={2} />
        </div>

        <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-white">
          Evaluation
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-300">
          A demo that only shows its best question is a screenshot. These numbers
          come from a fixed set of 45 questions across the three workspaces, run
          end to end with <code className="font-mono text-[13px] text-ink-200">npm run eval</code>
          . Nothing here is hand-picked, including the failures.
        </p>

        {!results ? (
          <div className="panel mt-8 rounded-xl p-5 text-[13.5px] leading-relaxed text-ink-300">
            No results yet. Run{" "}
            <code className="font-mono text-ink-100">npm run eval</code> and this page
            will render what it produced.
          </div>
        ) : (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                label="Answer accuracy"
                value={`${results.overall.accuracy}%`}
                note={`${results.overall.cases} questions`}
              />
              <Metric
                label="Retrieval hit rate"
                value={`${results.overall.retrieval}%`}
                note="expected doc in top 6"
              />
              <Metric
                label="Grounding"
                value={`${results.overall.grounding}%`}
                note="no invented citations"
              />
              <Metric
                label="Strategy"
                value={results.retrievalMode}
                note={results.model}
                mono
              />
            </section>

            <section className="mt-8">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                By workspace
              </h2>
              <div className="panel mt-3 overflow-x-auto rounded-xl">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-white/7 text-left text-[11px] uppercase tracking-wider text-ink-500">
                      <th className="px-4 py-2.5 font-medium">Workspace</th>
                      <th className="px-4 py-2.5 text-right font-medium">Cases</th>
                      <th className="px-4 py-2.5 text-right font-medium">Accuracy</th>
                      <th className="px-4 py-2.5 text-right font-medium">Retrieval</th>
                      <th className="px-4 py-2.5 text-right font-medium">Grounding</th>
                      <th className="px-4 py-2.5 text-right font-medium">Refusal</th>
                      <th className="px-4 py-2.5 text-right font-medium">Median</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums text-ink-200">
                    {results.summary.map((row) => (
                      <tr key={row.workspace} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 font-sans text-ink-100">{row.name}</td>
                        <td className="px-4 py-2.5 text-right">{row.cases}</td>
                        <td className="px-4 py-2.5 text-right">{row.accuracy}%</td>
                        <td className="px-4 py-2.5 text-right">{row.retrieval}%</td>
                        <td className="px-4 py-2.5 text-right">{row.grounding}%</td>
                        <td className="px-4 py-2.5 text-right">{row.refusal}%</td>
                        <td className="px-4 py-2.5 text-right text-ink-400">
                          {row.medianLatencyMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                Every case
              </h2>
              <div className="mt-3 flex flex-col gap-5">
                {results.summary.map((group) => (
                  <div key={group.workspace}>
                    <p className="mb-2 text-[12px] font-medium text-ink-400">{group.name}</p>
                    <ul className="panel divide-y divide-white/5 overflow-hidden rounded-xl">
                      {(results.results[group.workspace] ?? []).map((item) => (
                        <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                          <StatusDot ok={item.accurate} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-ink-100">
                              {item.question}
                            </p>
                            {!item.accurate && (
                              <p className="mt-0.5 text-[12px] text-amber-200/70">
                                {item.judgeNote}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 pt-0.5">
                            {!item.answerable && (
                              <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-ink-400 ring-1 ring-white/8">
                                must refuse
                              </span>
                            )}
                            <Flag ok={item.retrievalHit} title="retrieval" />
                            <Flag ok={item.groundingOk} title="grounding" />
                            <span className="w-12 text-right font-mono text-[10.5px] tabular-nums text-ink-500">
                              {item.latencyMs}ms
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <p className="mt-8 border-t border-white/7 pt-4 text-[12px] text-ink-500">
              Generated {new Date(results.generatedAt).toLocaleString("en-GB")} · answers
              graded by a second model against a written rubric per question.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  note,
  mono,
}: {
  label: string;
  value: string;
  note: string;
  mono?: boolean;
}) {
  return (
    <div className="panel rounded-xl px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
      <p
        className={`mt-1 text-[22px] font-semibold tracking-tight text-white ${
          mono ? "font-mono text-[16px]" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-500">{note}</p>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
        ok ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
      }`}
    >
      {ok ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
    </span>
  );
}

function Flag({ ok, title }: { ok: boolean | null; title: string }) {
  if (ok === null) {
    return <Minus className="size-3 text-ink-600" strokeWidth={2} />;
  }
  return (
    <span title={title}>
      {ok ? (
        <Check className="size-3 text-emerald-400/70" strokeWidth={2.5} />
      ) : (
        <X className="size-3 text-amber-400/70" strokeWidth={2.5} />
      )}
    </span>
  );
}
