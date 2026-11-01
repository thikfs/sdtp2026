-- Sample data for LOCAL development and preview branches only (`supabase db reset`).
-- It never runs on the production project. All people are invented.
--
-- Local sign-in:  dentist@clinica.test / dentist-local-pw   ·   assistant@clinica.test / assistant-local-pw

-- Staff accounts --------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'dentist@clinica.test', extensions.crypt('dentist-local-pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'assistant@clinica.test', extensions.crypt('assistant-local-pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email in ('dentist@clinica.test', 'assistant@clinica.test');

insert into public.staff (id, full_name, role) values
  ('11111111-1111-4111-8111-111111111111', 'Dra. Helena Matos', 'dentist'),
  ('22222222-2222-4222-8222-222222222222', 'Rita Assistente', 'assistant');

-- Patients, appointments and requests, placed relative to today in the clinic's time zone ----
do $$
declare
  tz    text := (select timezone from public.clinic_settings);
  today timestamp := date_trunc('day', now() at time zone tz);
  r     record;
  pid   uuid;
begin
  for r in
    select * from (values
      ('Joaquina Dentadura', '+351 910 000 000', 'cons',  0, 14.0, 120, 'confirmed'),
      ('Ana Paz',            '+351 910 000 001', 'prof', -2,  9.0,  60, 'confirmed'),
      ('Carlos Cárie',       '+351 910 000 002', 'rest', -2, 11.0,  90, 'confirmed'),
      ('Inês Aparelho',      '+351 910 000 003', 'orto', -1, 10.0,  45, 'confirmed'),
      ('Pedro Nervo',        '+351 910 000 004', 'endo', -1, 15.0,  90, 'confirmed'),
      ('Luís Coroa',         '+351 910 000 005', 'cons',  0,  9.0,  45, 'confirmed'),
      ('Marta Branca',       '+351 910 000 006', 'prof',  1, 10.0,  60, 'booked'),
      ('Sofia Presa',        '+351 910 000 007', 'orto',  1, 16.0,  45, 'booked'),
      ('Hugo Siso',          '+351 910 000 008', 'rest',  2,  9.0,  90, 'booked'),
      ('Teresa Dente',       '+351 910 000 009', 'cons',  2, 14.5,  45, 'booked'),
      ('Jorge Boca',         '+351 910 000 010', 'endo',  5, 10.0,  90, 'booked'),
      ('Clara Lima',         '+351 910 000 011', 'prof',  6, 11.0,  60, 'booked'),
      ('Rita Molar',         '+351 910 000 012', 'cons',  8, 15.0,  45, 'booked')
    ) as t(name, phone, tx, day_offset, hour, minutes, status)
  loop
    insert into public.patients (full_name, phone) values (r.name, r.phone) returning id into pid;
    insert into public.appointments (patient_id, treatment, starts_at, ends_at, status, created_by)
    values (pid, r.tx,
            (today + make_interval(days => r.day_offset, mins => (r.hour * 60)::int)) at time zone tz,
            (today + make_interval(days => r.day_offset, mins => (r.hour * 60)::int + r.minutes)) at time zone tz,
            r.status, '22222222-2222-4222-8222-222222222222');
  end loop;

  insert into public.appointment_requests (external_id, patient_name, patient_phone, treatment, preferred_date, preferred_slot)
  select 'seed-' || n, name, phone, tx, (today + make_interval(days => d))::date, slot
  from (values
    (1, 'Zé da Roça',     '+351 920 000 000', 'rest', 2, 'early_afternoon'),
    (2, 'João Furacão',   '+351 920 000 001', 'prof', 5, 'mid_afternoon'),
    (3, 'Maria Sorriso',  '+351 920 000 002', 'orto', 3, 'morning'),
    (4, 'Tiago Molar',    '+351 920 000 003', 'endo', 6, 'late_afternoon'),
    (5, 'Beatriz Canino', '+351 920 000 004', 'cons', 4, 'morning'),
    (6, 'Rui Siso',       '+351 920 000 005', 'prof', 7, 'early_afternoon')
  ) as t(n, name, phone, tx, d, slot);
end $$;
