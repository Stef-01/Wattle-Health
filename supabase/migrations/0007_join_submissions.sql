-- A write-only inbox for the clinician join flow (2026-11-08). Production has no service role key on
-- Vercel, so the join screens could not persist anything; this table lets the flow post each step with the
-- publishable key under an insert-only policy. Nothing can be read back without the service role: Wattle
-- reviews submissions and promotes them into practitioners/provider_claims/personal_profiles by hand.
create table if not exists public.join_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('claim', 'practice', 'profile')),
  payload jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.join_submissions enable row level security;
drop policy if exists "join_submissions_insert_public" on public.join_submissions;
create policy "join_submissions_insert_public" on public.join_submissions
  for insert to anon, authenticated with check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 65536);
revoke all on public.join_submissions from anon, authenticated;
grant insert on public.join_submissions to anon, authenticated;
comment on table public.join_submissions is 'Write-only inbox from /join; reviewed and promoted by Wattle with the service role.';
