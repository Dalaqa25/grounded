import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MODES } from "@/lib/modes";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

interface Overall {
  accuracy: number;
  retrieval: number;
  grounding: number;
  cases: number;
}

async function loadOverall(): Promise<Overall | null> {
  try {
    const file = path.join(process.cwd(), "data", "evals", "results.json");
    const json = JSON.parse(await readFile(file, "utf8"));
    return json.overall as Overall;
  } catch {
    return null;
  }
}

const DIFFERENCES = [
  {
    title: "Two searches, fused",
    body: "Meaning-based search finds the paraphrase; keyword search finds the exact token — a name, an error code, the word OAuth. Most demos pick one. This runs both in a single database query and merges the rankings, and you can switch either off in the header to watch the answer get worse.",
  },
  {
    title: "Footnotes that resolve",
    body: "Every factual sentence carries a raised numeral. Press it and the exact passage opens in the margin, with its score and whether it was found by meaning, by keyword, or by both.",
  },
  {
    title: "It says when it does not know",
    body: "Ask the candidate pool about security clearances and it tells you the corpus does not cover that, instead of assembling something plausible from the nearest six paragraphs.",
  },
  {
    title: "Measured, failures included",
    body: "A fixed question set runs end to end and the results — the ones it fails as well as the ones it passes — are published on the evaluation page rather than summarised in a sentence.",
  },
];

export default async function Landing() {
  const overall = await loadOverall();

  return (
    <main className="mx-auto max-w-[86rem] px-6 pb-24">
      {/* ------------------------------------------------------- title -- */}
      <section className="border-b border-rule py-14 md:py-20">
        <p className="label">A working demonstration</p>
        <h1 className="mt-4 max-w-[17ch] text-[2.6rem] leading-[1.05] tracking-[-0.025em] md:text-[4rem]">
          Answers you can check, line by line.
        </h1>
        <p className="mt-6 max-w-[56ch] text-[1.15rem] leading-[1.6] text-ink-muted md:text-[1.3rem]">
          Ask a question about a set of documents and get a written answer where
          every claim carries a footnote. Press the footnote and the exact
          passage opens, with the score that put it there.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
          <Link
            href={`/${MODES[0].id}`}
            className="border-b-2 pb-0.5 text-[1.05rem] transition-opacity hover:opacity-70"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Try it now →
          </Link>
          <Link
            href="/how-it-works"
            className="text-[1.05rem] text-ink-muted underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink"
          >
            How it works
          </Link>
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[1.05rem] text-ink-muted underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink"
          >
            Read the code
          </a>
        </div>
      </section>

      {/* ----------------------------------------------------- problem -- */}
      <section className="grid gap-x-12 gap-y-6 border-b border-rule py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
        <p className="label pt-1">Why it exists</p>
        <div className="max-w-[62ch]">
          <p className="text-[1.15rem] leading-[1.65]">
            An AI assistant that reads your company&rsquo;s documents is easy to
            demonstrate and hard to trust. You are shown the question that works.
            When an answer is wrong, nothing on the screen tells you whether the
            search fetched the wrong paragraph or the model made something up —
            and those two failures need completely different fixes.
          </p>
          <p className="mt-4 text-[1.05rem] leading-[1.65] text-ink-muted">
            Grounded is the same idea built so that question always has an answer.
            The retrieval is visible, the citations resolve, the refusals are
            deliberate, and the accuracy is measured rather than asserted.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- demos -- */}
      <section className="border-b border-rule py-12">
        <div className="grid gap-x-12 gap-y-6 md:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="pt-1">
            <p className="label">Three corpora</p>
            <p className="mt-2 max-w-[22ch] text-[0.92rem] italic leading-snug text-ink-faint">
              One engine. Three very different document shapes, to show the same
              code holding up.
            </p>
          </div>

          <ol className="border-t border-rule">
            {MODES.map((mode, i) => (
              <li key={mode.id} className="border-b border-rule">
                <Link href={`/${mode.id}`} className="group flex gap-5 py-5">
                  <span className="figure-num shrink-0 pt-1.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[1.25rem] leading-snug tracking-[-0.01em]">
                      {mode.name}
                    </h2>
                    <p className="mt-1.5 max-w-[58ch] text-[0.98rem] leading-relaxed text-ink-muted">
                      {mode.blurb}
                    </p>
                    <p className="mt-2.5 max-w-[58ch] text-[0.92rem] italic text-ink-faint">
                      e.g. &ldquo;{mode.samples[0]}&rdquo;
                    </p>
                  </div>
                  <span
                    className="shrink-0 self-center text-[0.9rem] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--accent)" }}
                  >
                    open →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------- difference -- */}
      <section className="grid gap-x-12 gap-y-6 border-b border-rule py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
        <p className="label pt-1">What is different</p>
        <ol className="max-w-[62ch] border-t border-rule">
          {DIFFERENCES.map((item, i) => (
            <li key={item.title} className="flex gap-5 border-b border-rule py-5">
              <span className="figure-num shrink-0 pt-1.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[1.1rem] leading-snug tracking-[-0.008em]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[0.98rem] leading-relaxed text-ink-muted">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------------- numbers -- */}
      {overall && (
        <section className="grid gap-x-12 gap-y-6 border-b border-rule py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
          <p className="label pt-1">Measured</p>
          <div className="max-w-[62ch]">
            <div className="grid grid-cols-3 border-y border-rule">
              <Figure value={`${overall.accuracy}%`} label="answers correct" />
              <Figure value={`${overall.retrieval}%`} label="right source found" />
              <Figure value={`${overall.grounding}%`} label="no invented footnotes" />
            </div>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-muted">
              Across {overall.cases} fixed questions, graded against a written
              rubric for each one.{" "}
              <Link
                href="/evals"
                className="underline decoration-rule-strong underline-offset-4 transition-colors hover:text-ink"
              >
                Every case is listed
              </Link>
              , including the ones it gets wrong and why.
            </p>
          </div>
        </section>
      )}

      {/* --------------------------------------------------- colophon -- */}
      <section className="grid gap-x-12 gap-y-6 py-12 md:grid-cols-[14rem_minmax(0,1fr)]">
        <p className="label pt-1">Colophon</p>
        <div className="max-w-[62ch]">
          <p className="text-[1.02rem] leading-[1.65] text-ink-muted">
            Built by{" "}
            <a
              href={SITE.authorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink underline decoration-rule-strong underline-offset-4"
            >
              {SITE.author}
            </a>{" "}
            as a demonstration of how a retrieval system should behave when
            somebody has to rely on it. Next.js and TypeScript on the front,
            Postgres with pgvector doing both searches, open-weight models for
            the writing. It runs entirely on free tiers, and the{" "}
            <a
              href={SITE.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink underline decoration-rule-strong underline-offset-4"
            >
              source is public
            </a>
            .
          </p>
          <p className="mt-4 text-[0.92rem] italic leading-relaxed text-ink-faint">
            The candidates, the company and the platform in these corpora are
            invented, so the demo can be opened by anyone without a signup wall.
            Any resemblance to a real person is accidental.
          </p>
        </div>
      </section>
    </main>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-rule py-4 pr-5 [&:not(:last-child)]:border-r">
      <p className="text-[2rem] leading-none tracking-[-0.02em]">{value}</p>
      <p className="label mt-1.5 text-[0.6rem]">{label}</p>
    </div>
  );
}
