-- Verified patient reviews (2026-10-18). Patients write one after a visit; every review is held as
-- 'pending' until a person checks it, and only 'approved' rows are readable. No review is ever
-- imported from another site or written by Wattle. AHPRA (National Law s133) restricts testimonials
-- in health advertising; moderation removes clinical-outcome claims before approval.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 1000),
  visited text not null check (visited in ('this-month', 'this-year', 'earlier')),
  saw_doctor boolean not null check (saw_doctor),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists reviews_doctor_status on public.reviews (doctor_id, status);

alter table public.reviews enable row level security;

-- Anyone can submit, and a submission can only ever start as pending.
drop policy if exists reviews_insert_pending on public.reviews;
create policy reviews_insert_pending on public.reviews
  for insert to anon, authenticated
  with check (status = 'pending' and moderated_at is null and saw_doctor);

-- Only approved reviews are visible.
drop policy if exists reviews_read_approved on public.reviews;
create policy reviews_read_approved on public.reviews
  for select to anon, authenticated
  using (status = 'approved');

-- The public read shape: no internal fields.
create or replace view public.published_reviews with (security_invoker = true) as
  select id, doctor_id, rating, body, visited, created_at from public.reviews where status = 'approved';

grant select on public.published_reviews to anon, authenticated;
grant insert (doctor_id, rating, body, visited, saw_doctor) on public.reviews to anon, authenticated;
