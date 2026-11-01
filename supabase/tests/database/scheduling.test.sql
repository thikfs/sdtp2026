-- Run with: npx supabase test db   (needs `npx supabase start`; uses the seed data)
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Helpers to act as a given user, the way PostgREST does for each request.
create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
-- A future weekday-independent time, in the clinic's time zone.
create function pg_temp.at(hhmm text, days int default 30) returns timestamptz language sql as $$
  select ((current_date + days) + hhmm::time) at time zone (select timezone from public.clinic_settings);
$$;

-- A signed-in user who is NOT clinic staff.
insert into auth.users (id, email, aud, role) values ('33333333-3333-4333-8333-333333333333', 'stranger@example.test', 'authenticated', 'authenticated');
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------------------------------------------------------------- reading
select pg_temp.act_as_anon();
select throws_ok($$ select count(*) from public.appointment_details $$, '42501', null, 'anon cannot read appointments at all');
select throws_ok($$ select public.create_appointment('X', 'cons', pg_temp.at('10:00'), pg_temp.at('11:00')) $$, '42501', null, 'anon cannot call the API');
reset role;

select pg_temp.act_as('33333333-3333-4333-8333-333333333333');
select is((select count(*) from public.appointment_details), 0::bigint, 'a signed-in non-staff user sees no appointments');
select is((select count(*) from public.patients), 0::bigint, '... and no patients');
select throws_ok($$ select public.create_appointment('X', 'cons', pg_temp.at('10:00'), pg_temp.at('11:00')) $$, 'PT401', null, '... and cannot book');
reset role;

select pg_temp.act_as('22222222-2222-4222-8222-222222222222');
select ok((select count(*) from public.appointment_details) > 0, 'staff see appointments');
select ok((select count(*) from public.appointment_requests where status = 'pending') = 6, 'staff see the pending requests');
select throws_ok($$ insert into public.patients (full_name) values ('Direct') $$, '42501', null, 'staff cannot write tables directly');
select throws_ok($$ update public.appointments set notes = 'x' $$, '42501', null, '... nor update them directly');

-- ---------------------------------------------------------------- creating
create temp table t as select * from public.create_appointment('Teste Paciente', 'cons', pg_temp.at('10:00'), pg_temp.at('11:00'), '+351 900 111 222', 'first visit');
select is((select version from t), 1, 'a new appointment starts at version 1');
select is((select patient_name from t), 'Teste Paciente', 'returns the patient name');
select is(
  (select patient_id from public.create_appointment('Other Spelling', 'prof', pg_temp.at('12:00'), pg_temp.at('13:00'), '+351900111222')),
  (select patient_id from t), 'the same phone (any formatting) is the same patient');
select throws_ok($$ select public.create_appointment('Early', 'cons', pg_temp.at('07:30'), pg_temp.at('08:30')) $$, 'PT422', null, 'before opening hours is refused');
select throws_ok($$ select public.create_appointment('Late', 'cons', pg_temp.at('19:30'), pg_temp.at('20:30')) $$, 'PT422', null, 'after closing is refused');
select throws_ok($$ select public.create_appointment('Back', 'cons', pg_temp.at('11:00'), pg_temp.at('10:00')) $$, '23514', null, 'ending before starting is refused');
select throws_ok($$ select public.create_appointment('Nope', 'xxx', pg_temp.at('10:00'), pg_temp.at('11:00')) $$, '23503', null, 'unknown treatment is refused');

-- ---------------------------------------------------------------- moving / editing
select is(
  (select version from public.update_appointment((select id from t), 1, jsonb_build_object('starts_at', pg_temp.at('15:00'), 'ends_at', pg_temp.at('16:00')))),
  2, 'moving bumps the version');
select throws_ok(format($$ select public.update_appointment(%L, 1, '{"notes":"stale"}') $$, (select id from t)), 'PT409', null, 'an edit based on an old version is refused');
select throws_ok(format($$ select public.update_appointment(%L, 2, '{"start":"x"}') $$, (select id from t)), 'PT422', null, 'unknown fields are refused');
select is(
  (select patient_phone from public.update_appointment((select id from t), 2, '{"patient_phone":"+351 900 999 999","status":"confirmed"}')),
  '+351 900 999 999', 'correcting the phone updates the patient');

-- ---------------------------------------------------------------- deleting
select throws_ok(format($$ select public.delete_appointment(%L, 1) $$, (select id from t)), 'PT409', null, 'delete is version-checked');
select lives_ok(format($$ select public.delete_appointment(%L, 3) $$, (select id from t)), 'delete with the current version works');
select is((select count(*) from public.appointment_details where id = (select id from t)), 0::bigint, 'deleted appointments leave the calendar');
reset role;
select isnt((select deleted_at from public.appointments where id = (select id from t)), null, '... but stay in the history');
select ok((select count(*) from public.audit_log where row_id = (select id from t)) >= 4, 'every change is in the audit log');

-- ---------------------------------------------------------------- requests
select pg_temp.act_as('11111111-1111-4111-8111-111111111111');
create temp table r as select id from public.appointment_requests where external_id = 'seed-1';
select is(
  (select request_id from public.schedule_request((select id from r), pg_temp.at('10:00', 31), pg_temp.at('11:30', 31))),
  (select id from r), 'scheduling a request creates its appointment');
select throws_ok(format($$ select public.schedule_request(%L, now(), now()) $$, (select id from r)), 'PT409', null, 'a request cannot be scheduled twice');
select throws_ok($$ select public.submit_request('{}') $$, '42501', null, 'staff cannot call the external intake');
reset role;

-- The meta dashboard goes through the Edge Function, which uses the service role.
set local role service_role;
select is(
  (select public.submit_request('{"external_id":"ext-1","patient_name":"Novo","treatment":"cons","preferred_date":"2030-01-02","preferred_slot":"morning"}') ->> 'created')
  || '/' ||
  (select public.submit_request('{"external_id":"ext-1","patient_name":"Novo","treatment":"cons","preferred_date":"2030-01-02","preferred_slot":"morning"}') ->> 'created'),
  'true/false', 'submitting the same external_id twice creates one request');
reset role;

select * from finish();
rollback;
