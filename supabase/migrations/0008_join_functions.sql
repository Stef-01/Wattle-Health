-- The join flow writes the real tables with the publishable key (2026-11-08), through three functions
-- that do exactly what src/server/clinician.ts does with the service role, and nothing more:
--   join_claim    → practitioners (found by AHPRA number or source key, else created) + provider_claims (pending)
--   join_practice → locations (unverified), practitioner_roles, provider_services (declared), fee observation
--   join_profile  → personal_profiles (status draft, consent now)
-- Every row a stranger can create is unpublished (claim pending, location unverified, profile draft, a new
-- practitioner has no specialty and so never reaches the published_* views) until Wattle checks the register.
-- The functions run as their owner (security definer) with a fixed search_path, validate every input, and the
-- practice and profile steps require a pending claim on the practitioner from the last 30 days. No table
-- grants change: anon still cannot read or write these tables directly.

create or replace function public.join_claim(p_ahpra text, p_display_name text, p_given text, p_family text, p_domain text, p_source_key text default null)
returns table (claim_id uuid, practitioner_id uuid)
language plpgsql security definer set search_path = public
as $$
declare v_pid uuid; v_cid uuid; v_ahpra text := upper(regexp_replace(coalesce(p_ahpra, ''), '\s', '', 'g'));
begin
  if v_ahpra !~ '^[A-Z]{3}[0-9]{10}$' then raise exception 'AHPRA number must be three letters and ten digits'; end if;
  if lower(coalesce(p_domain, '')) !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'practice email domain required'; end if;
  if length(coalesce(p_display_name, '')) < 2 or length(p_display_name) > 80 then raise exception 'name required'; end if;
  if (select count(*) from provider_claims c join practitioners p on p.id = c.practitioner_id where p.ahpra_number = v_ahpra and c.created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many claims for this number today';
  end if;
  select id into v_pid from practitioners where ahpra_number = v_ahpra limit 1;
  if v_pid is null and p_source_key is not null then select id into v_pid from practitioners where source_key = p_source_key limit 1; end if;
  if v_pid is null then
    insert into practitioners (ahpra_number, display_name, given_name, family_name, profession, source_key)
    values (v_ahpra, left(p_display_name, 80), left(p_given, 60), left(p_family, 60), 'medical', p_source_key)
    returning id into v_pid;
  end if;
  insert into provider_claims (practitioner_id, claimant_email_domain, method, status)
  values (v_pid, lower(p_domain), 'ahpra+domain-email', 'pending') returning id into v_cid;
  return query select v_cid, v_pid;
end $$;

create or replace function public.join_practice(p_practitioner_id uuid, p_practice text, p_telehealth boolean, p_bulk_billing boolean, p_referral boolean, p_fee_cents integer default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_loc uuid; v_role uuid; v_now timestamptz := now(); v_practice text := left(btrim(coalesce(p_practice, '')), 120);
begin
  if v_practice = '' then raise exception 'practice required'; end if;
  if not exists (select 1 from provider_claims where practitioner_id = p_practitioner_id and status = 'pending' and created_at > now() - interval '30 days') then
    raise exception 'no pending claim for this practitioner';
  end if;
  select id into v_loc from locations where name = v_practice limit 1;
  if v_loc is null then insert into locations (name, status) values (v_practice, 'unverified') returning id into v_loc; end if;
  insert into practitioner_roles (practitioner_id, location_id, "primary", referral_required, fee_policy)
  values (p_practitioner_id, v_loc, true, p_referral, case when p_bulk_billing then 'bulk_bills_all' else 'private' end)
  on conflict (practitioner_id, location_id) do update set "primary" = true, referral_required = excluded.referral_required, fee_policy = excluded.fee_policy
  returning id into v_role;
  insert into provider_services (practitioner_role_id, telehealth, bulk_billing, referral_required, tier, source_id, declared_at, updated_at)
  values (v_role, case when p_telehealth then 'some' else 'none' end, case when p_bulk_billing then 'all' else 'none' end, p_referral, 'declared', 'claim', v_now, v_now)
  on conflict (practitioner_role_id) do update set telehealth = excluded.telehealth, bulk_billing = excluded.bulk_billing, referral_required = excluded.referral_required, tier = 'declared', source_id = 'claim', declared_at = v_now, updated_at = v_now;
  if p_fee_cents is not null and p_fee_cents between 0 and 1000000 then
    insert into observations (entity_type, entity_id, field, value, tier, source_id, observed_at, expires_at)
    values ('practitioner_role', v_role, 'fees', jsonb_build_object('label', 'Initial consult', 'amountCents', p_fee_cents), 'declared', 'claim', v_now, v_now + interval '90 days');
    insert into field_evidence (entity_type, entity_id, field, source_id, evidence_status, freshness_at)
    values ('practitioner_role', v_role, 'fees', 'claim', 'documented', v_now);
  end if;
  return v_role;
end $$;

create or replace function public.join_profile(p_practitioner_id uuid, p_profile jsonb)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_now timestamptz := now(); f text;
  v_lived text := nullif(left(btrim(coalesce(p_profile->>'lived_experience', '')), 2000), '');
begin
  if jsonb_typeof(p_profile) <> 'object' then raise exception 'profile must be an object'; end if;
  if not exists (select 1 from provider_claims where practitioner_id = p_practitioner_id and status = 'pending' and created_at > now() - interval '30 days') then
    raise exception 'no pending claim for this practitioner';
  end if;
  insert into personal_profiles (practitioner_id, communication_approach, enjoys_serving, why_medicine, professional_purpose, lived_experience, lived_experience_opt_in, outside_medicine, favourite_book, status, consent_at, updated_at)
  values (
    p_practitioner_id,
    nullif(left(btrim(coalesce(p_profile->>'communication_approach', '')), 2000), ''),
    nullif(left(btrim(coalesce(p_profile->>'enjoys_serving', '')), 2000), ''),
    nullif(left(btrim(coalesce(p_profile->>'why_medicine', '')), 2000), ''),
    nullif(left(btrim(coalesce(p_profile->>'professional_purpose', '')), 2000), ''),
    v_lived, v_lived is not null,
    nullif(left(btrim(coalesce(p_profile->>'outside_medicine', '')), 2000), ''),
    nullif(left(btrim(coalesce(p_profile->>'favourite_book', '')), 400), ''),
    'draft', v_now, v_now)
  on conflict (practitioner_id) do update set
    communication_approach = excluded.communication_approach, enjoys_serving = excluded.enjoys_serving, why_medicine = excluded.why_medicine,
    professional_purpose = excluded.professional_purpose, lived_experience = excluded.lived_experience, lived_experience_opt_in = excluded.lived_experience_opt_in,
    outside_medicine = excluded.outside_medicine, favourite_book = excluded.favourite_book, status = 'draft', consent_at = v_now, updated_at = v_now
  where personal_profiles.status in ('draft', 'illustrative');
  return 'draft';
end $$;

revoke all on function public.join_claim(text, text, text, text, text, text) from public;
revoke all on function public.join_practice(uuid, text, boolean, boolean, boolean, integer) from public;
revoke all on function public.join_profile(uuid, jsonb) from public;
grant execute on function public.join_claim(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.join_practice(uuid, text, boolean, boolean, boolean, integer) to anon, authenticated;
grant execute on function public.join_profile(uuid, jsonb) to anon, authenticated;

-- provider_services.source_id and observations.source_id reference sources(id); the join flow declares its rows
-- with source 'claim' (the doctor's own declaration), which the sources table did not have yet.
insert into public.sources (id, name, url, kind, legal_basis)
values ('claim', 'Doctor''s own declaration (join flow)', 'https://wattlehealth.vercel.app/join', 'declared', 'facts the practitioner entered about their own practice in the Wattle join flow, with consent, pending register check')
on conflict (id) do nothing;
