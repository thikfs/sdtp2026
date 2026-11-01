-- Who may do what.
--   anon (not signed in):       nothing.
--   authenticated, not staff:   nothing (row level security returns no rows; API functions raise PT401).
--   active staff:               read everything below; write only through the API functions.
--   service_role (server side): submit_request for the meta dashboard.
--
-- Supabase grants everything in `public` to anon/authenticated by default, so we revoke first
-- and grant back only what is needed. New tables in later migrations must do the same.

-- ---------------------------------------------------------------------------
-- Tables and views
-- ---------------------------------------------------------------------------

revoke all on public.treatments, public.clinic_settings, public.staff, public.patients,
              public.appointment_requests, public.appointments, public.audit_log, public.appointment_details
  from anon, authenticated;

grant select on public.treatments, public.clinic_settings, public.staff, public.patients,
                public.appointment_requests, public.appointments, public.audit_log, public.appointment_details
  to authenticated;

alter table public.treatments           enable row level security;
alter table public.clinic_settings      enable row level security;
alter table public.staff                enable row level security;
alter table public.patients             enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.appointments         enable row level security;
alter table public.audit_log            enable row level security;

create policy "staff read treatments"      on public.treatments           for select to authenticated using (public.is_staff());
create policy "staff read settings"        on public.clinic_settings      for select to authenticated using (public.is_staff());
create policy "staff read staff"           on public.staff                for select to authenticated using (public.is_staff());
create policy "staff read patients"        on public.patients             for select to authenticated using (public.is_staff() and deleted_at is null);
create policy "staff read requests"        on public.appointment_requests for select to authenticated using (public.is_staff());
create policy "staff read appointments"    on public.appointments         for select to authenticated using (public.is_staff());
create policy "staff read audit log"       on public.audit_log            for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Functions: nothing is callable unless granted here
-- ---------------------------------------------------------------------------

revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_staff(),
  public.create_appointment(text, text, timestamptz, timestamptz, text, text, text),
  public.update_appointment(uuid, integer, jsonb),
  public.delete_appointment(uuid, integer),
  public.schedule_request(uuid, timestamptz, timestamptz),
  public.decline_request(uuid)
to authenticated;

grant execute on function public.submit_request(jsonb) to service_role;

-- Functions created later in `public` are not executable by clients until granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: the app refreshes as soon as the other person changes something
-- (row level security above still decides who receives which rows).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.appointments, public.appointment_requests;
