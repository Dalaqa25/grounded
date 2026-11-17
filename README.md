<div align="center">

# Grounded

**Retrieval-augmented question answering you can audit.**

Hybrid search over Postgres, inline citations, a visible trace of every passage
the model was given, and a fixed evaluation suite that reports the failures too.

[Live demo](https://grounded-demo.vercel.app) · [How it works](https://grounded-demo.vercel.app/how-it-works) · [Evaluation](https://grounded-demo.vercel.app/evals)

</div>

---

## What this is

Most RAG demos are a text box over a vector store. They look convincing because
you only ever see the question that works, and when the answer is wrong there is
no way to tell whether retrieval missed or the model drifted.

Grounded is the same idea built the way it would have to be built for a
customer:

- **Hybrid retrieval.** pgvector cosine search and Postgres full-text search run
  in one SQL function and are fused with Reciprocal Rank Fusion. Keyword search
  catches the exact tokens embeddings blur — names, error codes, `OAuth`.
  Vectors catch the paraphrases keywords miss.
- **Citations that resolve.** Every factual sentence carries `[n]`. Clicking it
  opens the exact chunk, with its fused score and where it ranked in each
  strategy.
- **It declines, in two layers.** A similarity floor catches questions that are
  plainly not about the corpus, and the model is never called. For on-topic
  questions the corpus happens not to answer, the model is instructed to say so
  and cite nothing. Both are measured rather than assumed.
- **A visible trace.** Embedding time, search time, the candidate set, and
  whether each chunk arrived via semantic search, keyword search or both.
- **Three corpora, one engine.** A candidate pool, a company handbook, and
  developer documentation — three very different shapes over identical code.

Everything runs on free tiers.

## Measured, not asserted

45 fixed questions, graded end to end by `npm run eval`. Results, including the
ones that fail, are rendered at [`/evals`](https://grounded-demo.vercel.app/evals).

| Metric | What it checks |
|---|---|
| Answer accuracy | A second model grades the answer against a written rubric per question |
| Retrieval hit rate | Did the document that holds the answer make the top 6? |
| Grounding | Does every `[n]` point at a chunk that was actually retrieved? |
| Refusal | On questions the corpus cannot answer, did it decline instead of improvising? |

Ten of the 45 cases exist only to be failed by a careless system: three ask
about things no corpus covers, and the rest need a fact that keyword search
alone or vector search alone will not surface.

Switch the strategy toggle in the header to `Vector` or `Keyword` and ask the
same question twice — the retrieval panel shows why fusion is there.

## Stack

| | |
|---|---|
| Framework | Next.js 15 · React 19 · TypeScript · Tailwind v4 |
| Orchestration | LangChain v1 — `@langchain/core`, `@langchain/groq`, `@langchain/google-genai`, `@langchain/textsplitters` |
| Vector store | Supabase Postgres · pgvector · HNSW index |
| Keyword search | Postgres full-text · GIN index · `websearch_to_tsquery` |
| Generation | Groq (Llama), streamed over server-sent events |
| Embeddings | Gemini `text-embedding-004`, 768 dimensions |

## Running it

Needs Node 20+ and three free accounts.

```bash
git clone https://github.com/Dalaqa25/grounded
cd grounded
npm install
```

**1 — Supabase.** Create a project, open the SQL editor, and run
[`supabase/schema.sql`](supabase/schema.sql). It enables `pgvector`, creates the
tables, and installs the `hybrid_search` function.

**2 — Keys.**

```bash
cp .env.example .env.local
```

| Variable | Where from |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

Groq does not serve embeddings, which is the only reason a second provider is
in here. The embedding layer sits behind one narrow interface in
[`src/lib/embeddings.ts`](src/lib/embeddings.ts), so swapping it is a one-file
change plus a re-index.

**3 — Load the corpora.**

```bash
npm run ingest           # all three workspaces, about a minute
npm run ingest -- docs   # or just one
```

**4 — Run.**

```bash
npm run dev
```

### Other commands

```bash
npm run eval                 # the full 45-case suite
npm run eval -- docs         # one workspace
npm run eval -- --mode vector  # same questions, vector-only retrieval
npm run models               # Groq model ids this key can use
npm run typecheck
```

If `GROQ_MODEL` ever stops resolving — providers retire ids — `npm run models`
prints the current list rather than leaving you to guess.

## Deploying

Push to GitHub, import the repository on Vercel, and add the same four
variables in **Settings → Environment Variables**. Ingest runs from your
machine against the same Supabase project, so the deployment has data the
moment it goes up.

## How it works

```
question → condense (if follow-up) → embed → ┌ vector search ┐
                                             │               ├ RRF fuse → top 6 → generate with citations
                                             └ keyword search┘
```

Six decisions worth calling out, each with the reasoning, are on the
[How it works](https://grounded-demo.vercel.app/how-it-works) page. The short
version:

1. **Chunks carry a breadcrumb.** Each chunk is prefixed with its document title
   and nearest heading. A bare chunk reading *"Up to EUR 800 in the first year"*
   has no idea it is about equipment budget, and a question about equipment will
   never retrieve it.

2. **Fusion combines ranks, not scores.** Cosine similarity and `ts_rank_cd` are
   not on the same scale. RRF sidesteps the normalisation constant that would
   otherwise need tuning per corpus.

3. **Follow-ups are condensed before search.** Retrieval has no memory;
   *"what about her Python?"* embeds to nothing useful on its own.

4. **The floor measures similarity, not the fused score.** This one is easy to
   get wrong. An RRF score is built from ranks, so whatever comes back first
   always scores about `1/(k+1)` however irrelevant it is — measured on this
   corpus, *"what is the best recipe for khinkali"* scored **0.0392** against
   the candidate pool, beating a real question about OAuth experience at
   **0.0378**. Cosine similarity separates properly: 0.73–0.85 for real
   questions, 0.57–0.66 for off-corpus ones. The floor sits at 0.62, low on
   purpose, because a false refusal is worse than a cited "the sources do not
   cover this" — and the model's own refusal is the second layer.

## Layout

```
src/
  lib/
    retriever.ts     hybrid search + the relevance floor
    rag.ts           query condensing, prompt, streaming
    chunk.ts         heading-aware splitting with breadcrumbs
    embeddings.ts    the swappable provider boundary
    modes.ts         the three corpora
  app/
    (app)/[mode]     the workspace
    (app)/evals      rendered evaluation results
    api/chat         SSE: status → retrieval trace → tokens → timings
  components/
    retrieval-panel.tsx   the part most demos leave out
supabase/schema.sql       tables, indexes, hybrid_search()
data/                     the three corpora + 45 eval cases
scripts/                  ingest, eval, models
```

## Notes and limits

- **No reranker.** A cross-encoder would likely add a few points on the docs
  corpus, at the cost of latency and another dependency. The numbers on `/evals`
  are what the pipeline does without one.
- **Chunk size is not tuned per corpus.** One setting across three document
  shapes, deliberately — so the measurements reflect a sensible default rather
  than per-corpus fitting.
- **The corpora are fictional.** Candidates, company and platform are invented,
  so the demo can be public without a signup wall. Any resemblance to a real
  person is accidental.
- **No auth.** It is a demo. Writes are server-side with the service-role key;
  the browser only ever reads.

## Licence

MIT.

---

Built by [Giorgi Dalakishvili](https://modelgrow.com).
