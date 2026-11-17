import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evaluation",
  description:
    "Measured accuracy, retrieval hit rate, grounding and refusal behaviour across a fixed question set.",
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
  judgeModel?: string;
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
    <main className="mx-auto max-w-[86rem] px-6 pb-24 pt-10">
      <div className="max-w-[64ch] border-b border-rule pb-6">
        <p className="label">Measurement</p>
        <h1 className="mt-2 text-[2rem] leading-[1.12] tracking-[-0.018em]">
          What it gets right, and what it does not
        </h1>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-ink-muted">
          A demo that only shows its best question is a screenshot. These numbers come
          from a fixed question set run end to end with{" "}
          <code className="font-mono text-[0.9rem] text-ink">npm run eval</code>. Nothing
          below is hand-picked, including the failures.
        </p>
      </div>

      {!results ? (
        <p className="mt-8 max-w-[58ch] text-[0.95rem] italic leading-relaxed text-ink-muted">
          No results recorded yet. Run <code className="font-mono not-italic">npm run eval</code>{" "}
          and this page renders whatever it produced.
        </p>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 border-y border-rule sm:grid-cols-4">
            <Figure
              label="Answer accuracy"
              value={`${results.overall.accuracy}%`}
              note={`${results.overall.cases} questions`}
            />
            <Figure
              label="Retrieval hit rate"
              value={`${results.overall.retrieval}%`}
              note="right document found"
            />
            <Figure
              label="Grounding"
              value={`${results.overall.grounding}%`}
              note="no invented footnotes"
            />
            <Figure
              label="Strategy"
              value={results.retrievalMode}
              note={results.model}
              small
            />
          </section>

          <section className="mt-12">
            <p className="label border-b border-rule pb-2">By workspace</p>
            <table className="w-full text-[0.9rem]">
              <thead>
                <tr className="label border-b border-rule">
                  <th className="py-2 text-left font-medium">Workspace</th>
                  <th className="py-2 text-right font-medium">Cases</th>
                  <th className="py-2 text-right font-medium">Accuracy</th>
                  <th className="py-2 text-right font-medium">Retrieval</th>
                  <th className="py-2 text-right font-medium">Grounding</th>
                  <th className="py-2 text-right font-medium">Refusal</th>
                  <th className="py-2 text-right font-medium">Median</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-ink-muted">
                {results.summary.map((row) => (
                  <tr key={row.workspace} className="border-b border-rule">
                    <td className="py-2.5 pr-4 text-ink" style={{ fontFamily: "var(--font-serif)" }}>
                      {row.name}
                    </td>
                    <td className="py-2.5 text-right text-[0.82rem]">{row.cases}</td>
                    <td className="py-2.5 text-right text-[0.82rem] text-ink">{row.accuracy}%</td>
                    <td className="py-2.5 text-right text-[0.82rem]">{row.retrieval}%</td>
                    <td className="py-2.5 text-right text-[0.82rem]">{row.grounding}%</td>
                    <td className="py-2.5 text-right text-[0.82rem]">{row.refusal}%</td>
                    <td className="py-2.5 text-right text-[0.82rem] text-ink-faint">
                      {row.medianLatencyMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-12">
            <p className="label border-b border-rule pb-2">Every case</p>
            <div className="mt-6 flex flex-col gap-9">
              {results.summary.map((group) => (
                <div key={group.workspace}>
                  <p className="text-[1.05rem]">{group.name}</p>
                  <ol className="mt-2 border-t border-rule">
                    {(results.results[group.workspace] ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-baseline gap-3 border-b border-rule py-2.5"
                      >
                        <span
                          className="figure-num shrink-0"
                          style={{ color: item.accurate ? undefined : "var(--accent)" }}
                        >
                          {item.accurate ? "pass" : "fail"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.95rem] leading-snug">{item.question}</p>
                          {!item.accurate && (
                            <p className="mt-0.5 text-[0.84rem] italic text-ink-muted">
                              {item.judgeNote}
                            </p>
                          )}
                        </div>
                        <span className="figure-num hidden shrink-0 sm:inline">
                          {!item.answerable && "must decline · "}
                          {item.retrievalHit === null
                            ? "—"
                            : item.retrievalHit
                              ? "found"
                              : "missed"}
                          {" · "}
                          {item.groundingOk ? "cited" : "uncited"}
                        </span>
                        <span className="figure-num w-14 shrink-0 text-right">
                          {item.latencyMs}ms
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <p className="mt-10 border-t border-rule pt-4 text-[0.84rem] italic text-ink-faint">
            Generated {new Date(results.generatedAt).toLocaleString("en-GB")}. Answers
            written by {results.model}, graded by{" "}
            {results.judgeModel ?? "a second model"} against a written rubric per
            question.
          </p>
        </>
      )}
    </main>
  );
}

function Figure({
  label,
  value,
  note,
  small,
}: {
  label: string;
  value: string;
  note: string;
  small?: boolean;
}) {
  return (
    <div className="border-rule py-4 pr-6 [&:not(:last-child)]:border-r">
      <p className="label text-[0.6rem]">{label}</p>
      <p
        className={`mt-1.5 tracking-[-0.02em] ${small ? "text-[1.1rem]" : "text-[2rem] leading-none"}`}
      >
        {value}
      </p>
      <p className="figure-num mt-1 truncate text-[0.66rem]">{note}</p>
    </div>
  );
}
