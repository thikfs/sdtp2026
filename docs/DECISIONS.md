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
