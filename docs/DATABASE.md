# Database (Supabase)

Everything about the database lives in `supabase/` and is reviewed like code:

| Path | What it is |
|---|---|
| `supabase/migrations/` | The schema, in order. The Supabase GitHub integration applies new files to production when a PR is merged into `main`. |
| `supabase/seed.sql` | Invented sample data + two local staff logins. Runs locally and on preview branches, **never** on production. |
| `supabase/tests/database/` | pgTAP tests: access rules, version conflicts, validation, request handling. |
| `supabase/functions/external-requests/` | The endpoint the meta dashboard calls to create requests. |
| `supabase/config.toml` | Local stack settings (auth, ports, functions). |

## Data model

```
staff ──(signed-in user is staff only with an active row here)
treatments ◄── appointments ──► patients ◄── appointment_requests
                    │                              │
                    └── request_id ────────────────┘
clinic_settings (1 row: time zone, opening hours)      audit_log (every change)
```

- **patients**: one row per person, so a patient's whole history stays together (archive story). Found by phone number (formatting ignored), or by exact name when there is no phone.
- **appointments**: the calendar. `version` goes up on every change (optimistic locking). Deleting sets `deleted_at`; the row stays for the history.
- **appointment_requests**: from the WhatsApp bot via the meta dashboard. `pending` → `scheduled` (gets an appointment) or `declined`. `external_id` makes re-sending the same request harmless.
- **treatments**, **clinic_settings**: data, not code. Add a treatment or change opening hours with an `insert`/`update` in a migration. (The app's labels for treatments are still in `src/app/schedule.ts`; keep them in step.)
- **audit_log**: who changed what and when, written by triggers. Nobody can edit it from the app.

## Rules the database enforces
- Not signed in: no access at all. Signed in but not in `staff`: sees nothing, can do nothing.
- Staff can **read** the tables, but **write only through the functions** in `*_scheduling_api.sql` (`create_appointment`, `update_appointment`, `delete_appointment`, `schedule_request`, `decline_request`). The rules live there once, whatever client calls them.
- Opening hours, same-day bookings and `end > start` are checked by the database, in the clinic's time zone (`clinic_settings.timezone`, default `Europe/Lisbon`: change it if the clinic is elsewhere).
- Error codes become HTTP statuses: `PT401` not staff, `PT404` gone, `PT409` someone changed it first / already handled, `PT422` invalid input.

## Work on it locally
Needs Docker running.

```bash
npx supabase start           # starts Postgres, Auth, API, Realtime; applies migrations + seed
npx supabase status          # prints the local URL and ANON_KEY for .env
npx supabase test db         # database tests
npx supabase db reset        # back to a clean database with the seed
npx supabase stop
```

Put the local URL and anon key in `.env` (see `.env.example`), run `npm run dev`, open `/app/` and sign in as
`assistant@clinica.test` / `assistant-local-pw` or `dentist@clinica.test` / `dentist-local-pw`.

## Change the schema
1. Create a new migration: `npx supabase migration new add_something` and write the SQL there.
   Never edit a migration that is already on `main`: production has run it.
2. A new table needs the same treatment as the others (see `*_scheduling_security.sql`):
   `revoke all ... from anon, authenticated`, `grant select ... to authenticated`, `enable row level security`, a `using (public.is_staff())` policy.
   A new function must be granted to `authenticated` explicitly; by default nobody can call it.
3. Add a pgTAP test in `supabase/tests/database/`.
4. `npx supabase db reset && npx supabase test db`, then open a PR. CI (`.github/workflows/supabase.yml`) runs the same checks plus the app's end-to-end tests against the database.
5. Merging into `main` lets the Supabase GitHub integration apply it to production.

## Production setup (one time, by an admin)
1. **GitHub integration**: Supabase dashboard → Project Settings → Integrations → GitHub. Supabase directory: `supabase`. Turn on "Deploy to production" for `main`.
2. **Auth**: Authentication → Sign In / Providers → turn **off** "Allow new users to sign up" (staff accounts are created by an admin). Authentication → URL Configuration: Site URL = the dev URL.
3. **Staff accounts**: Authentication → Users → Add user (email + password, auto-confirm). Then in the SQL editor:
   ```sql
   insert into public.staff (id, full_name, role)
   select id, 'Full Name', 'dentist'   -- or 'assistant'
   from auth.users where email = 'person@example.com';
   ```
   To remove access: `update public.staff set active = false where id = ...`.
4. **Edge Function**: `npx supabase functions deploy external-requests --project-ref <ref>` (if the GitHub integration does not deploy functions for you), then
   `npx supabase secrets set META_DASHBOARD_API_KEY=<long random value> --project-ref <ref>` and give that key to the meta dashboard.
5. **App build** (Cloudflare): set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build variables, from Project Settings → API.
6. **Backups**: Supabase backs up daily on all plans; check Database → Backups.
