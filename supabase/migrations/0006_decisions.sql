-- The decisions loop (2026-10-24): categories approved in /admin, candidates awaiting review,
-- case studies the decision tree trains on, trained models and run summaries. One table of JSON
-- documents keyed by (collection, id). Server-only: RLS is on with no policies, so only the
-- service role (src/decisions/store.ts) reads or writes it. Case studies can carry details from
-- meeting notes, so nothing here is ever exposed through a published_* view. Runs hold a hash of
-- the transcript, never the text.
create table if not exists public.decision_docs (
  collection text not null check (collection in ('categories', 'candidates', 'cases', 'models', 'runs')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists decision_docs_collection_updated on public.decision_docs (collection, updated_at desc);

alter table public.decision_docs enable row level security;
