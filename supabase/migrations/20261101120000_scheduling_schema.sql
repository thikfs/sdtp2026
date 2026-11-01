-- Scheduling schema: who works here, who the patients are, what is booked and what is requested.
--
-- Conventions (keep them when adding migrations):
--   * snake_case, plural table names, uuid primary keys, timestamptz for every point in time.
--   * Statuses are text + CHECK (easy to extend in a later migration), not Postgres enums.
--   * Lists that staff may want to change (treatments, opening hours) are rows, not code.
--   * Nothing is hard-deleted from patients/appointments: deleted_at keeps the history (archive story).
--   * Never edit a migration that has run on the real project; add a new one.

-- ---------------------------------------------------------------------------
-- Reference data and settings
-- ---------------------------------------------------------------------------

create table public.treatments (
  code             text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label            text not null,
  default_minutes  integer not null check (default_minutes between 5 and 720),
  sort_order       integer not null default 0,
  active           boolean not null default true
);
comment on table public.treatments is 'Treatment catalogue. Add a row to offer a new treatment; set active=false instead of deleting.';

insert into public.treatments (code, label, default_minutes, sort_order) values
  ('cons', 'Consulta',     45, 10),
  ('prof', 'Profilaxia',   60, 20),
  ('rest', 'Restauração',  90, 30),
  ('endo', 'Endodontia',   90, 40),
  ('orto', 'Ortodontia',   45, 50);

-- One row of clinic-wide settings. The CHECK on id keeps it a single row.
create table public.clinic_settings (
  id          boolean primary key default true check (id),
  name        text not null default 'Clínica Sorriso',
  timezone    text not null default 'Europe/Lisbon',
  opens_at    time not null default '08:00',
  closes_at   time not null default '20:00',
  -- When a request asks for e.g. "morning", the slot starts at this local time.
  preferred_slot_starts jsonb not null default
    '{"morning": "09:30", "early_afternoon": "13:00", "mid_afternoon": "15:00", "late_afternoon": "17:00"}',
  check (opens_at < closes_at)
);
comment on table public.clinic_settings is 'Single row of clinic settings: time zone and opening hours used to validate bookings.';
insert into public.clinic_settings default values;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- A Supabase Auth user is clinic staff only if they have an active row here.
create table public.staff (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) > 0),
  role        text not null check (role in ('dentist', 'assistant')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.staff is 'Clinic staff. Signing in is not enough to see data: the user must have an active row here.';

create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (length(trim(full_name)) > 0),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
comment on table public.patients is 'One row per person. Appointments and requests point here, so a patient''s history stays together.';
-- Lookups when a booking or request arrives with a phone number.
create index patients_phone_idx on public.patients (regexp_replace(phone, '\D', '', 'g')) where deleted_at is null;
create index patients_name_idx on public.patients (lower(full_name)) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Requests (created by the meta dashboard) and appointments (the calendar)
-- ---------------------------------------------------------------------------

create table public.appointment_requests (
  id                uuid primary key default gen_random_uuid(),
  external_id       text unique,                -- the meta dashboard's own id; makes re-sending safe
  source            text not null default 'whatsapp' check (source in ('whatsapp')),
  patient_id        uuid references public.patients (id),  -- set when the request is scheduled
  patient_name      text not null check (length(trim(patient_name)) > 0),
  patient_phone     text check (patient_phone is null or patient_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  treatment         text not null references public.treatments (code),
  preferred_date    date not null,
  preferred_slot    text not null check (preferred_slot in ('morning', 'early_afternoon', 'mid_afternoon', 'late_afternoon')),
  duration_minutes  integer check (duration_minutes between 5 and 720),
  status            text not null default 'pending' check (status in ('pending', 'scheduled', 'declined')),
  created_at        timestamptz not null default now(),
  handled_at        timestamptz,
  handled_by        uuid references public.staff (id),
  check ((status = 'pending') = (handled_at is null))
);
comment on table public.appointment_requests is 'Appointment requests from the WhatsApp bot via the meta dashboard. Staff schedule or decline them.';
create index appointment_requests_pending_idx on public.appointment_requests (preferred_date) where status = 'pending';

create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id),
  treatment   text not null references public.treatments (code),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'booked' check (status in ('booked', 'confirmed')),
  notes       text,
  request_id  uuid unique references public.appointment_requests (id),
  version     integer not null default 1,     -- optimistic locking, see update_appointment()
  created_at  timestamptz not null default now(),
  created_by  uuid references public.staff (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.staff (id),
  deleted_at  timestamptz,
  deleted_by  uuid references public.staff (id),
  check (ends_at > starts_at)
);
comment on table public.appointments is 'The calendar. Overlaps are allowed on purpose (emergencies are squeezed in); the app warns about them.';
comment on column public.appointments.version is 'Bumped on every change. Writers must pass the version they read; a mismatch means someone else changed it first (HTTP 409).';
-- "What is booked between A and B" is the main query; a range index serves it.
create index appointments_time_idx on public.appointments using gist (tstzrange(starts_at, ends_at)) where deleted_at is null;
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);

-- ---------------------------------------------------------------------------
-- Housekeeping triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger patients_touch before update on public.patients
  for each row execute function public.touch_updated_at();

-- Every change to an appointment bumps its version, whoever makes it (app, SQL editor, future backend).
create function public.appointments_bump_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

create trigger appointments_bump_version before update on public.appointments
  for each row execute function public.appointments_bump_version();

-- Bookings must fit the clinic's opening hours, in the clinic's time zone, on one day.
create function public.appointments_check_hours() returns trigger
language plpgsql set search_path = '' as $$
declare
  s public.clinic_settings;
  local_start timestamp;
  local_end timestamp;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  select * into s from public.clinic_settings;
  local_start := new.starts_at at time zone s.timezone;
  local_end := new.ends_at at time zone s.timezone;
  if local_start::date <> (local_end - interval '1 microsecond')::date then
    raise exception 'An appointment must start and end on the same day.' using errcode = 'PT422';
  end if;
  if local_start::time < s.opens_at or local_end::time > s.closes_at or local_end::date > local_start::date then
    raise exception 'The clinic is open %–%.', to_char(s.opens_at, 'HH24:MI'), to_char(s.closes_at, 'HH24:MI')
      using errcode = 'PT422';
  end if;
  return new;
end $$;

create trigger appointments_check_hours before insert or update of starts_at, ends_at, deleted_at on public.appointments
  for each row execute function public.appointments_check_hours();

-- ---------------------------------------------------------------------------
-- Audit trail: who changed what, when. Append-only.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,              -- auth.uid() of the staff member; null for the meta dashboard / admins
  table_name  text not null,
  row_id      uuid not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old_row     jsonb,
  new_row     jsonb
);
comment on table public.audit_log is 'Append-only history of changes to appointments, patients and requests.';
create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);

create function public.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, table_name, row_id, action, old_row, new_row)
  values (
    auth.uid(), tg_table_name, coalesce(new.id, old.id), lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger appointments_audit after insert or update or delete on public.appointments
  for each row execute function public.audit();
create trigger patients_audit after insert or update or delete on public.patients
  for each row execute function public.audit();
create trigger appointment_requests_audit after insert or update or delete on public.appointment_requests
  for each row execute function public.audit();
