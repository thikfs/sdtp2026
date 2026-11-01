-- The scheduling API, as Postgres functions the app calls with supabase.rpc(...).
-- Every write goes through one of these, so the rules (staff only, version check,
-- request bookkeeping) live in one place, whatever client calls them.
--
-- Errors use PostgREST's PTxxx codes so the HTTP status is meaningful:
--   PT401 not signed in as staff · PT404 not found · PT409 changed by someone else / already handled · PT422 invalid input

create schema if not exists private;
comment on schema private is 'Helpers for the API functions. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------
-- Read model: appointments as the app sees them
-- ---------------------------------------------------------------------------

create view public.appointment_details with (security_invoker = true) as
select
  a.id,
  a.patient_id,
  p.full_name  as patient_name,
  p.phone      as patient_phone,
  a.treatment,
  a.starts_at,
  a.ends_at,
  a.status,
  a.notes,
  a.request_id,
  a.version,
  a.updated_at
from public.appointments a
join public.patients p on p.id = a.patient_id
where a.deleted_at is null;
comment on view public.appointment_details is 'Live (not deleted) appointments with patient name and phone. Read-only; write through the API functions.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where id = auth.uid() and active);
$$;
comment on function public.is_staff() is 'True when the signed-in user is active clinic staff. Used by row level security.';

create function private.require_staff() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Only signed-in clinic staff can do this.' using errcode = 'PT401';
  end if;
  return auth.uid();
end $$;

create function private.clean(t text) returns text
language sql immutable set search_path = '' as $$
  select nullif(trim(t), '');
$$;

-- Same phone (ignoring spaces and symbols) = same patient. Without a phone, an exact name match
-- among patients that also have no phone. Otherwise a new patient.
create function private.find_or_create_patient(p_name text, p_phone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name  text := private.clean(p_name);
  v_phone text := private.clean(p_phone);
  v_id    uuid;
begin
  if v_name is null then
    raise exception 'Enter the patient''s name.' using errcode = 'PT422';
  end if;
  if v_phone is not null then
    select id into v_id from public.patients
     where deleted_at is null
       and regexp_replace(phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
     order by created_at limit 1;
  else
    select id into v_id from public.patients
     where deleted_at is null and phone is null and lower(full_name) = lower(v_name)
     order by created_at limit 1;
  end if;
  if v_id is null then
    insert into public.patients (full_name, phone) values (v_name, v_phone) returning id into v_id;
  end if;
  return v_id;
end $$;

create function private.appointment(p_id uuid) returns public.appointment_details
language sql stable security definer set search_path = '' as $$
  select * from public.appointment_details where id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- Staff API
-- ---------------------------------------------------------------------------

create function public.create_appointment(
  p_patient_name  text,
  p_treatment     text,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_patient_phone text default null,
  p_notes         text default null,
  p_status        text default 'booked'
) returns public.appointment_details
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
  v_id    uuid;
begin
  insert into public.appointments (patient_id, treatment, starts_at, ends_at, status, notes, created_by, updated_by)
  values (private.find_or_create_patient(p_patient_name, p_patient_phone), p_treatment, p_starts_at, p_ends_at,
          coalesce(p_status, 'booked'), private.clean(p_notes), v_staff, v_staff)
  returning id into v_id;
  return private.appointment(v_id);
end $$;
comment on function public.create_appointment is 'Book an appointment. Finds the patient by phone (or name when there is no phone) or creates them.';

-- p_patch keys (all optional): patient_name, patient_phone, treatment, starts_at, ends_at, status, notes.
-- Changing patient_name / patient_phone corrects the patient record itself (all their appointments).
create function public.update_appointment(p_id uuid, p_version integer, p_patch jsonb)
returns public.appointment_details
language plpgsql security definer set search_path = '' as $$
declare
  v_staff   uuid := private.require_staff();
  v_appt    public.appointments;
  v_unknown text;
begin
  select key into v_unknown from jsonb_object_keys(coalesce(p_patch, '{}')) as key
   where key not in ('patient_name', 'patient_phone', 'treatment', 'starts_at', 'ends_at', 'status', 'notes') limit 1;
  if v_unknown is not null then
    raise exception 'Unknown field "%".', v_unknown using errcode = 'PT422';
  end if;

  select * into v_appt from public.appointments where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'This appointment no longer exists.' using errcode = 'PT404';
  end if;
  if v_appt.version <> p_version then
    raise exception 'Someone else changed this appointment first.' using errcode = 'PT409';
  end if;

  if p_patch ? 'patient_name' or p_patch ? 'patient_phone' then
    update public.patients set
      full_name = case when p_patch ? 'patient_name' then coalesce(private.clean(p_patch ->> 'patient_name'), full_name) else full_name end,
      phone     = case when p_patch ? 'patient_phone' then private.clean(p_patch ->> 'patient_phone') else phone end
    where id = v_appt.patient_id;
  end if;

  update public.appointments set
    treatment  = coalesce(p_patch ->> 'treatment', treatment),
    starts_at  = coalesce((p_patch ->> 'starts_at')::timestamptz, starts_at),
    ends_at    = coalesce((p_patch ->> 'ends_at')::timestamptz, ends_at),
    status     = coalesce(p_patch ->> 'status', status),
    notes      = case when p_patch ? 'notes' then private.clean(p_patch ->> 'notes') else notes end,
    updated_by = v_staff
  where id = p_id;

  return private.appointment(p_id);
end $$;
comment on function public.update_appointment is 'Change or move an appointment. p_version must be the version the user saw, else PT409.';

create function public.delete_appointment(p_id uuid, p_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
  v_version integer;
begin
  select version into v_version from public.appointments where id = p_id and deleted_at is null for update;
  if not found then
    raise exception 'This appointment no longer exists.' using errcode = 'PT404';
  end if;
  if v_version <> p_version then
    raise exception 'Someone else changed this appointment first.' using errcode = 'PT409';
  end if;
  -- Soft delete: the appointment disappears from the calendar but stays in the patient's history.
  update public.appointments set deleted_at = now(), deleted_by = v_staff, updated_by = v_staff where id = p_id;
end $$;
comment on function public.delete_appointment is 'Remove an appointment from the calendar (kept in history). Version-checked like update_appointment.';

create function public.schedule_request(p_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns public.appointment_details
language plpgsql security definer set search_path = '' as $$
declare
  v_staff   uuid := private.require_staff();
  v_req     public.appointment_requests;
  v_patient uuid;
  v_id      uuid;
begin
  select * into v_req from public.appointment_requests where id = p_id for update;
  if not found then
    raise exception 'This request no longer exists.' using errcode = 'PT404';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request was already handled.' using errcode = 'PT409';
  end if;

  v_patient := private.find_or_create_patient(v_req.patient_name, v_req.patient_phone);
  insert into public.appointments (patient_id, treatment, starts_at, ends_at, request_id, created_by, updated_by)
  values (v_patient, v_req.treatment, p_starts_at, p_ends_at, v_req.id, v_staff, v_staff)
  returning id into v_id;

  update public.appointment_requests
     set status = 'scheduled', patient_id = v_patient, handled_at = now(), handled_by = v_staff
   where id = p_id;
  return private.appointment(v_id);
end $$;
comment on function public.schedule_request is 'Turn a pending request into an appointment, in one transaction. PT409 if it was already handled.';

create function public.decline_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_staff uuid := private.require_staff();
begin
  update public.appointment_requests
     set status = 'declined', handled_at = now(), handled_by = v_staff
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'This request was already handled or no longer exists.' using errcode = 'PT409';
  end if;
end $$;
comment on function public.decline_request is 'Decline a pending request (it leaves the list but stays in history).';

-- ---------------------------------------------------------------------------
-- External API: the meta dashboard creates requests (service role only, via the external-requests Edge Function)
-- ---------------------------------------------------------------------------

-- p_request keys: patient_name, patient_phone?, treatment, preferred_date, preferred_slot, duration_minutes?, external_id?
-- Returns the request as JSON plus "created": false when external_id was already received.
create function public.submit_request(p_request jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.appointment_requests;
  v_created boolean := true;
begin
  insert into public.appointment_requests
    (external_id, patient_name, patient_phone, treatment, preferred_date, preferred_slot, duration_minutes)
  values (
    private.clean(p_request ->> 'external_id'),
    private.clean(p_request ->> 'patient_name'),
    private.clean(p_request ->> 'patient_phone'),
    p_request ->> 'treatment',
    (p_request ->> 'preferred_date')::date,
    p_request ->> 'preferred_slot',
    (p_request ->> 'duration_minutes')::integer
  )
  on conflict (external_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.appointment_requests where external_id = p_request ->> 'external_id';
    v_created := false;
  end if;
  return to_jsonb(v_row) || jsonb_build_object('created', v_created);
end $$;
comment on function public.submit_request is 'Create an appointment request from the meta dashboard. Idempotent on external_id.';
