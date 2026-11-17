/**
 * Offline evaluation.
 *
 *   npm run eval              # every workspace
 *   npm run eval -- docs      # one workspace
 *   npm run eval -- --mode vector   # compare a retrieval strategy
 *
 * Four things are measured, because "it looked right" is not a result:
 *
 *   retrieval   did the document that holds the answer make the top-k?
 *   grounding   does every [n] in the answer point at a chunk we retrieved?
 *   accuracy    does the answer satisfy the rubric, graded by a second model?
 *   refusal     on questions the corpus cannot answer, did it decline?
 *
 * Results are written to data/evals/results.json, which the /evals page reads.
 */
import { config } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { judgeModel, judgeModelName, modelName, withGroqRetry } from "../src/lib/llm";
import { citedNumbers, looksLikeRefusal } from "../src/lib/citations";
import { getMode, MODES } from "../src/lib/modes";
import { NO_CONTEXT_REPLY, streamAnswer } from "../src/lib/rag";
import { hasUsableContext, retrieve } from "../src/lib/retriever";
import type { RetrievalMode } from "../src/lib/types";

interface EvalCase {
  id: string;
  question: string;
  expectedSources: string[];
  rubric: string;
  answerable: boolean;
}

interface CaseResult {
  id: string;
  question: string;
  answerable: boolean;
  retrievalHit: boolean | null;
  groundingOk: boolean;
  accurate: boolean;
  refusedCorrectly: boolean | null;
  judgeNote: string;
  latencyMs: number;
  retrievedSources: string[];
  answer: string;
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

async function judge(
  question: string,
  rubric: string,
  answer: string,
): Promise<{ pass: boolean; note: string }> {
  const model = judgeModel();
  const result = await withGroqRetry(() =>
    model.invoke([
      new SystemMessage(
        "You grade an assistant's answer against a rubric. The rubric lists what a correct answer must contain. " +
          "Pass if the answer covers the substance of the rubric and contains no claim that contradicts it. " +
          "Extra correct detail is fine. Wrong numbers, invented names or missing key facts fail. " +
          'Reply with JSON only, no prose: {"pass": true|false, "note": "one short sentence"}',
      ),
      new HumanMessage(
        `Question: ${question}\n\nRubric: ${rubric}\n\nAnswer:\n${answer}`,
      ),
    ]),
  );

  const text = String(result.content ?? "").trim();
  if (!text) return { pass: false, note: "judge returned an empty response" };

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const json = JSON.parse(text.slice(start, end + 1));
      return { pass: Boolean(json.pass), note: String(json.note ?? "") };
    } catch {
      /* fall through to the loose check below */
    }
  }

  // Some models answer in prose despite the instruction. Rather than score a
  // valid answer as a failure because the grader was chatty, fall back to
  // reading the verdict out of the text.
  if (/\bpass(ed)?\b|\bcorrect\b/i.test(text) && !/\bfail/i.test(text)) {
    return { pass: true, note: text.slice(0, 120) };
  }
  if (/\bfail(ed)?\b|\bincorrect\b/i.test(text)) {
    return { pass: false, note: text.slice(0, 120) };
  }
  return { pass: false, note: `unparseable grader output: ${text.slice(0, 80)}` };
}

/** Every [n] in the answer must point at a chunk that was actually retrieved. */
function checkGrounding(answer: string, chunkCount: number): boolean {
  const cited = citedNumbers(answer);
  if (!cited.length) return false;
  return cited.every((n) => n >= 1 && n <= chunkCount);
}

async function runCase(
  workspace: string,
  testCase: EvalCase,
  retrievalMode: RetrievalMode,
): Promise<CaseResult> {
  const mode = MODES.find((m) => m.workspace === workspace)!;
  const started = Date.now();

  const trace = await retrieve({
    workspace,
    query: testCase.question,
    mode: retrievalMode,
    matchCount: mode.retrieval.matchCount,
    maxPerDocument: mode.retrieval.maxPerDocument,
  });

  const retrievedSources = [
    ...new Set(trace.chunks.map((c) => c.sourcePath ?? c.documentTitle)),
  ];

  const retrievalHit = testCase.expectedSources.length
    ? testCase.expectedSources.some((s) => retrievedSources.includes(s))
    : null;

  let answer: string;
  const usable = hasUsableContext(trace);

  if (!usable) {
    answer = NO_CONTEXT_REPLY;
  } else {
    const parts: string[] = [];
    for await (const token of streamAnswer(mode, testCase.question, trace.chunks, [])) {
      parts.push(token);
    }
    answer = parts.join("");
  }

  const refused = !usable || looksLikeRefusal(answer);

  const groundingOk = refused ? true : checkGrounding(answer, trace.chunks.length);

  let accurate: boolean;
  let judgeNote: string;

  if (!testCase.answerable) {
    accurate = refused;
    judgeNote = refused ? "correctly declined" : "answered a question the corpus cannot support";
  } else if (refused) {
    accurate = false;
    judgeNote = "refused an answerable question";
  } else {
    const verdict = await judge(testCase.question, testCase.rubric, answer);
    accurate = verdict.pass;
    judgeNote = verdict.note;
  }

  return {
    id: testCase.id,
    question: testCase.question,
    answerable: testCase.answerable,
    retrievalHit,
    groundingOk,
    accurate,
    refusedCorrectly: testCase.answerable ? null : refused,
    judgeNote,
    latencyMs: Date.now() - started,
    retrievedSources,
    answer,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const modeFlag = args.indexOf("--mode");
  const retrievalMode = (modeFlag >= 0 ? args[modeFlag + 1] : "hybrid") as RetrievalMode;
  const only = args.filter((a) => !a.startsWith("--") && a !== retrievalMode);

  const workspaces = MODES.map((m) => m.workspace).filter(
    (w) => !only.length || only.includes(w),
  );

  console.log(
    `${bold("Evaluation")} ${dim(
      `· retrieval=${retrievalMode} · answers=${modelName()} · grader=${judgeModelName()}`,
    )}\n`,
  );

  const perWorkspace: Record<string, CaseResult[]> = {};

  for (const workspace of workspaces) {
    const file = path.join(process.cwd(), "data", "evals", `${workspace}.json`);
    const suite = JSON.parse(await readFile(file, "utf8")) as {
      cases: EvalCase[];
    };

    console.log(`${bold(getMode(workspace)?.name ?? workspace)}`);
    const results: CaseResult[] = [];

    for (const testCase of suite.cases) {
      // A long run must survive one bad case. Recording the failure and
      // carrying on beats losing 44 good results to a transient timeout.
      let result: CaseResult;
      try {
        result = await runCase(workspace, testCase, retrievalMode);
      } catch (error) {
        result = {
          id: testCase.id,
          question: testCase.question,
          answerable: testCase.answerable,
          retrievalHit: null,
          groundingOk: false,
          accurate: false,
          refusedCorrectly: null,
          judgeNote: `errored: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
          latencyMs: 0,
          retrievedSources: [],
          answer: "",
        };
      }
      results.push(result);

      const mark = result.accurate ? green("pass") : red("FAIL");
      const retrieval =
        result.retrievalHit === null ? dim("  n/a") : result.retrievalHit ? "  hit" : yellow(" miss");
      const grounding = result.groundingOk ? "cited" : yellow("uncited");

      console.log(
        `  ${mark} ${result.id}  ${retrieval}  ${grounding}  ${dim(
          `${result.latencyMs}ms`,
        )}  ${result.question.slice(0, 54)}`,
      );
      if (!result.accurate) console.log(dim(`        ↳ ${result.judgeNote}`));
    }

    perWorkspace[workspace] = results;
    console.log();
  }

  // ------------------------------------------------------------- summary --

  const all = Object.values(perWorkspace).flat();
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  const summary = Object.entries(perWorkspace).map(([workspace, results]) => {
    const withExpected = results.filter((r) => r.retrievalHit !== null);
    const unanswerable = results.filter((r) => !r.answerable);
    return {
      workspace,
      name: getMode(workspace)?.name ?? workspace,
      cases: results.length,
      accuracy: pct(results.filter((r) => r.accurate).length, results.length),
      retrieval: pct(withExpected.filter((r) => r.retrievalHit).length, withExpected.length),
      grounding: pct(results.filter((r) => r.groundingOk).length, results.length),
      refusal: pct(unanswerable.filter((r) => r.refusedCorrectly).length, unanswerable.length),
      medianLatencyMs: median(results.map((r) => r.latencyMs)),
    };
  });

  console.log(bold("Summary"));
  console.log(
    dim("  workspace    cases  accuracy  retrieval  grounding  refusal  median"),
  );
  for (const row of summary) {
    console.log(
      `  ${row.workspace.padEnd(12)} ${String(row.cases).padStart(5)}  ${String(
        row.accuracy + "%",
      ).padStart(8)}  ${String(row.retrieval + "%").padStart(9)}  ${String(
        row.grounding + "%",
      ).padStart(9)}  ${String(row.refusal + "%").padStart(7)}  ${String(
        row.medianLatencyMs + "ms",
      ).padStart(6)}`,
    );
  }

  const overall = {
    accuracy: pct(all.filter((r) => r.accurate).length, all.length),
    retrieval: pct(
      all.filter((r) => r.retrievalHit).length,
      all.filter((r) => r.retrievalHit !== null).length,
    ),
    grounding: pct(all.filter((r) => r.groundingOk).length, all.length),
  };
  console.log(
    `\n  ${bold("overall")}      ${String(all.length).padStart(5)}  ${String(
      overall.accuracy + "%",
    ).padStart(8)}  ${String(overall.retrieval + "%").padStart(9)}  ${String(
      overall.grounding + "%",
    ).padStart(9)}`,
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    retrievalMode,
    model: modelName(),
    judgeModel: judgeModelName(),
    overall: { ...overall, cases: all.length },
    summary,
    results: perWorkspace,
  };

  const out = path.join(process.cwd(), "data", "evals", "results.json");
  await writeFile(out, JSON.stringify(payload, null, 2));
  console.log(dim(`\nWrote ${path.relative(process.cwd(), out)}`));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

main().catch((error) => {
  console.error(red(`\n${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
