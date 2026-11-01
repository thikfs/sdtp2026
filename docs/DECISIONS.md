# Decisions

Append one entry per decision that changes the stack, the scope or the process.

## 2026-09-28 · Stack
For the moment the stack seems to be:  
Cloudflare Pages  
Python  
Supabase  
Whatsapp Cloud API

## 2026-11-01 · Frontend build and scheduling app
- The repository had no app scaffold, so CI (`npm ci`, `npm run build`) could not run. Added Vite + TypeScript, Vitest and Playwright.
- The staff scheduling UI is plain TypeScript with FullCalendar, not React: it is a port of the existing design, and FullCalendar does the heavy lifting. Revisit if the UI grows many components.
- Two pages: `/` is the public landing page, `/app/` is the staff scheduling app.
- The frontend talks to the backend only through `src/app/api/` (contract in `docs/API.md`). Without `VITE_API_BASE_URL` it uses an in-browser mock, so the backend (Python + Supabase) can be built independently.
- Deploy: `wrangler.jsonc` serves `dist/` as static assets on Cloudflare Workers; the build command must be `npm run build`.

## 2026-11-01 · Supabase database
- Schema, access rules and tests live in `supabase/` as migrations; the Supabase GitHub integration applies them to production on merge to `main`. Details in `docs/DATABASE.md`.
- Staff write only through Postgres functions (one place for the rules: staff check, version check, request bookkeeping). Tables are read-only to the app; row level security limits reads to active staff.
- Patients are their own table so history stays together; appointments are soft-deleted (history is kept); every change goes to `audit_log`.
- Statuses are text + CHECK and treatments/opening hours are rows, so they change with a small migration instead of a type change.
- Staff sign in with email + password (Supabase Auth); public sign-up is disabled. The meta dashboard uses an API key on an Edge Function, the only third-party entry point.
- No Python backend is needed for the scheduling features; the stack note above still lists Python for the WhatsApp bot.
