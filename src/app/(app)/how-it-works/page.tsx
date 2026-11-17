import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "The retrieval pipeline behind Grounded: chunking with breadcrumbs, hybrid search fused with RRF, citation-enforced generation, and a refusal floor.",
};

const STAGES = [
  {
    n: "01",
    title: "Chunk with a breadcrumb",
    body: "Markdown is split on headings first, then recursively to ~900 characters with 150 of overlap. Each chunk is prefixed with its document title and nearest heading.",
    why: "A bare chunk reading “Up to EUR 800 in the first year” has no idea it is about equipment budget. Carrying a little structure into the text is the cheapest retrieval win available.",
  },
  {
    n: "02",
    title: "Embed and store",
    body: "768-dimensional embeddings go into Postgres with pgvector, next to a generated tsvector of the same text. One row serves both searches.",
    why: "Keeping the vector and the keyword index in the same table means fusion happens in the database, not across two services with two failure modes.",
  },
  {
    n: "03",
    title: "Condense the question",
    body: "On a follow-up, the question is rewritten into something that stands alone before it ever reaches search.",
    why: "Retrieval has no memory. “What about her Python?” embeds to nothing useful, because the subject lives in the previous turn.",
  },
  {
    n: "04",
    title: "Search both ways, fuse the ranks",
    body: "HNSW cosine search and Postgres full-text search each return candidates, merged with Reciprocal Rank Fusion in a single SQL function.",
    why: "RRF combines ranks rather than scores. Cosine similarity and ts_rank_cd are not on the same scale, so fusing ranks avoids inventing a normalisation constant that would need tuning for every corpus.",
  },
  {
    n: "05",
    title: "Cap what one document can take",
    body: "The fused list is over-fetched, then trimmed with a per-document cap before it reaches the model. The cap differs per workspace: breadth for the candidate pool, depth for the docs.",
    why: "Measured: asked who had OAuth experience, pure relevance ordering returned three chunks of one candidate and three of another — six slots, two people, out of twelve profiles. The model named two and was graded wrong for missing a third that had never been in its context. With the cap, the same ten slots cover eight candidates, and talent accuracy went from 40% to 67%.",
  },
  {
    n: "06",
    title: "Decline in two layers",
    body: "A cosine-similarity floor catches questions that are plainly not about the corpus, and the model is never called. For on-topic questions the corpus happens not to answer, the model is instructed to decline and cite nothing.",
    why: "The floor deliberately measures similarity, not the fused score — an RRF score is built from ranks, so the top hit always scores about 1/(k+1) however irrelevant it is. On this corpus “the best recipe for khinkali” scored 0.0392 against the candidate pool, beating a real question about OAuth at 0.0378. Similarity separates cleanly: 0.73–0.85 for real questions, 0.57–0.66 for off-corpus ones.",
  },
  {
    n: "07",
    title: "Show the work",
    body: "The retrieval panel shows every chunk the model received, its fused score, and whether it came from semantic search, keyword search or both.",
    why: "When an answer is wrong, the useful question is whether retrieval missed or generation drifted. Without the trace you are guessing.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-400/12 ring-1 ring-indigo-400/25">
          <BookOpen className="size-4 text-indigo-300" strokeWidth={2} />
        </div>

        <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-white">
          How it works
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-300">
          One engine, three corpora. Everything below runs on free tiers:
          Postgres with pgvector on Supabase, Llama on Groq for generation, and
          Gemini for embeddings.
        </p>

        <Pipeline />

        <ol className="mt-10 flex flex-col gap-7">
          {STAGES.map((stage) => (
            <li key={stage.n} className="flex gap-4">
              <span className="mt-0.5 font-mono text-[12px] text-ink-600">{stage.n}</span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-white">
                  {stage.title}
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-200">
                  {stage.body}
                </p>
                <p className="mt-2 border-l-2 border-white/10 pl-3 text-[13px] leading-relaxed text-ink-400">
                  {stage.why}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-12">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            Stack
          </h2>
          <div className="panel mt-3 overflow-hidden rounded-xl">
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-white/5">
                {[
                  ["Framework", "Next.js 15 · React 19 · TypeScript"],
                  ["Orchestration", "LangChain v1 (core, Groq, Google GenAI, text splitters)"],
                  ["Vector store", "Supabase Postgres · pgvector · HNSW"],
                  ["Keyword search", "Postgres full-text · GIN index · lexemes OR-ed, ranked by ts_rank_cd"],
                  ["Generation", "Groq gpt-oss-120b — streamed over SSE, falls back to gpt-oss-20b at the quota"],
                  ["Embeddings", "Gemini gemini-embedding-2 · 768 dimensions · separate document and query encoders"],
                  ["Evaluation", "45 fixed cases, model-graded against per-question rubrics"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="w-40 px-4 py-2.5 align-top text-ink-400">{k}</td>
                    <td className="px-4 py-2.5 text-ink-100">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            What it does not do
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-relaxed text-ink-300 marker:text-ink-600">
            <li>
              No reranker. A cross-encoder would likely add a few points of
              accuracy on the docs corpus, at the cost of latency and another
              dependency.
            </li>
            <li>
              No per-user auth. The corpora are fictional and public on purpose,
              so the demo opens and works without a signup wall.
            </li>
            <li>
              Chunk size is not tuned per corpus. One setting across three very
              different document shapes, which is a deliberate honesty: the
              numbers on the evaluation page are what a sensible default gets you.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Pipeline() {
  const nodes = [
    { label: "Question", sub: "user" },
    { label: "Condense", sub: "if follow-up" },
    { label: "Embed", sub: "768-d" },
    { label: "Hybrid search", sub: "vector + FTS" },
    { label: "RRF fuse", sub: "rank merge" },
    { label: "Diversify", sub: "per-doc cap" },
    { label: "Generate", sub: "cited" },
  ];

  return (
    <div className="panel mt-8 overflow-x-auto rounded-xl px-4 py-5">
      <div className="flex min-w-[40rem] items-center gap-1.5">
        {nodes.map((node, i) => (
          <div key={node.label} className="flex flex-1 items-center gap-1.5">
            <div className="flex-1 rounded-lg bg-white/4 px-3 py-2.5 text-center ring-1 ring-white/7">
              <p className="text-[12.5px] font-medium text-ink-100">{node.label}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-500">{node.sub}</p>
            </div>
            {i < nodes.length - 1 && (
              <svg viewBox="0 0 16 8" className="size-3 shrink-0 text-ink-600" aria-hidden>
                <path
                  d="M0 4h13m0 0-3-3m3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
