-- Grounded — database schema
-- Postgres + pgvector. Run this once in the Supabase SQL editor.
--
-- Design notes
--   * One row per chunk, with both a vector embedding and a generated tsvector.
--     That lets a single table serve semantic search and keyword search.
--   * hybrid_search() fuses the two rankings with Reciprocal Rank Fusion, so a
--     chunk that is strong in either ranking surfaces, and a chunk that is good
--     in both wins. Keyword search catches exact tokens (names, error codes,
--     "OAuth") that embeddings blur; vectors catch paraphrases keywords miss.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- documents --

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  workspace   text        not null,
  title       text        not null,
  source_path text,
  meta        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists documents_workspace_idx on documents (workspace);

-- ------------------------------------------------------------------- chunks --

create table if not exists chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid        not null references documents (id) on delete cascade,
  workspace   text        not null,
  chunk_index int         not null,
  content     text        not null,
  embedding   vector(768),
  fts         tsvector generated always as (to_tsvector('english', content)) stored,
  created_at  timestamptz not null default now()
);

create index if not exists chunks_workspace_idx on chunks (workspace);
create index if not exists chunks_document_idx  on chunks (document_id);
create index if not exists chunks_fts_idx       on chunks using gin (fts);

-- HNSW beats IVFFlat here: no training step, and recall stays high while the
-- corpus grows during a live demo.
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------ hybrid search --

drop function if exists hybrid_search (text, vector, text, int, int, int);

create or replace function hybrid_search (
  query_text      text,
  query_embedding vector(768),
  ws              text,
  match_count     int default 8,
  candidate_count int default 40,
  rrf_k           int default 50
)
returns table (
  id            uuid,
  document_id   uuid,
  document_title text,
  source_path   text,
  chunk_index   int,
  content       text,
  similarity    float,
  vector_rank   int,
  keyword_rank  int,
  score         float
)
language sql
stable
as $$
  with semantic as (
    select
      c.id,
      1 - (c.embedding <=> query_embedding) as similarity,
      row_number() over (order by c.embedding <=> query_embedding) as rank
    from chunks c
    where c.workspace = ws and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit candidate_count
  ),
  keyword as (
    select
      c.id,
      row_number() over (
        order by ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) desc
      ) as rank
    from chunks c
    where c.workspace = ws
      and c.fts @@ websearch_to_tsquery('english', query_text)
    limit candidate_count
  ),
  fused as (
    select
      coalesce(s.id, k.id)                                  as id,
      coalesce(s.similarity, 0)                             as similarity,
      s.rank                                                as vector_rank,
      k.rank                                                as keyword_rank,
      coalesce(1.0 / (rrf_k + s.rank), 0)
        + coalesce(1.0 / (rrf_k + k.rank), 0)               as score
    from semantic s
    full outer join keyword k on k.id = s.id
  )
  select
    f.id,
    c.document_id,
    d.title        as document_title,
    d.source_path,
    c.chunk_index,
    c.content,
    f.similarity::float,
    f.vector_rank::int,
    f.keyword_rank::int,
    f.score::float
  from fused f
  join chunks c    on c.id = f.id
  join documents d on d.id = c.document_id
  order by f.score desc
  limit match_count;
$$;

-- ------------------------------------------------------------------- counts --

create or replace function workspace_stats ()
returns table (workspace text, documents bigint, chunks bigint)
language sql
stable
as $$
  select
    c.workspace,
    count(distinct c.document_id) as documents,
    count(*)                      as chunks
  from chunks c
  group by c.workspace;
$$;

-- --------------------------------------------------------------------- RLS --
-- Reads are public (demo corpora only). Writes go through the service-role key
-- on the server, which bypasses RLS, so no write policy is granted to anon.

alter table documents enable row level security;
alter table chunks    enable row level security;

drop policy if exists documents_read on documents;
drop policy if exists chunks_read    on chunks;

create policy documents_read on documents for select using (true);
create policy chunks_read    on chunks    for select using (true);
