import type { Metadata } from "next";

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
    body: "The source apparatus in the margin lists every passage the model received, its fused score, and whether it came from semantic search, keyword search or both.",
    why: "When an answer is wrong, the useful question is whether retrieval missed or generation drifted. Without the trace you are guessing.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-[72rem] px-6 pb-24 pt-10">
      <div className="max-w-[68ch]">
        <p className="label">Method</p>

        <h1 className="mt-2 text-[2rem] leading-[1.12] tracking-[-0.018em]">
          How it works
        </h1>
        <p className="mt-4 max-w-[64ch] text-[1.05rem] leading-relaxed text-ink-muted">
          One engine, three corpora. Everything below runs on free tiers:
          Postgres with pgvector on Supabase, Llama on Groq for generation, and
          Gemini for embeddings.
        </p>

        <Pipeline />

        <ol className="mt-12 border-t border-rule">
          {STAGES.map((stage) => (
            <li key={stage.n} className="flex gap-5 border-b border-rule py-6">
              <span className="figure-num shrink-0 pt-1.5">{stage.n}</span>
              <div className="min-w-0">
                <h2 className="text-[1.2rem] leading-snug tracking-[-0.01em]">
                  {stage.title}
                </h2>
                <p className="mt-2 text-[1rem] leading-relaxed">{stage.body}</p>
                <p className="mt-3 border-l-2 border-rule-strong pl-4 text-[0.95rem] italic leading-relaxed text-ink-muted">
                  {stage.why}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-14">
          <p className="label border-b border-rule pb-2">Stack</p>
          <div className="mt-1">
            <table className="w-full text-[0.95rem]">
              <tbody>
                {[
                  ["Framework", "Next.js 15 · React 19 · TypeScript"],
                  ["Orchestration", "LangChain v1 (core, Groq, Google GenAI, text splitters)"],
                  ["Vector store", "Supabase Postgres · pgvector · HNSW"],
                  ["Keyword search", "Postgres full-text · GIN index · lexemes OR-ed, ranked by ts_rank_cd"],
                  ["Generation", "Groq gpt-oss-120b, streamed over SSE, stepping down a four-model chain across two providers when a per-minute quota is hit"],
                  ["Embeddings", "Gemini gemini-embedding-2 · 768 dimensions · separate document and query encoders"],
                  ["Evaluation", "45 fixed cases, model-graded against per-question rubrics"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-rule">
                    <td className="label w-44 py-2.5 pr-4 align-top">{k}</td>
                    <td className="py-2.5 text-ink-muted">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <p className="label border-b border-rule pb-2">What it does not do</p>
          <ul className="mt-4 flex list-disc flex-col gap-3 pl-5 text-[0.98rem] leading-relaxed text-ink-muted marker:text-ink-faint">
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
    <div className="mt-9 overflow-x-auto border-y border-rule py-5">
      <div className="flex min-w-[40rem] items-center gap-1.5">
        {nodes.map((node, i) => (
          <div key={node.label} className="flex flex-1 items-center gap-1.5">
            <div className="flex-1 border border-rule px-2.5 py-2 text-center">
              <p className="text-[0.85rem] leading-tight">{node.label}</p>
              <p className="figure-num mt-0.5 text-[0.62rem]">{node.sub}</p>
            </div>
            {i < nodes.length - 1 && (
              <svg viewBox="0 0 16 8" className="size-3 shrink-0 text-ink-faint" aria-hidden>
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
