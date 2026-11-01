# Test plan

## What we test
| Story | End-to-end test file | Unit tests | Status |
|---|---|---|---|
| S1 | tests/e2e/s1-*.spec.ts | | todo |
| Schedule a requested appointment by dragging it onto the calendar | tests/e2e/scheduling.spec.ts | tests/unit/schedule.test.ts | done |
| Move an appointment (drag, or edit date/time) with undo; overlap warning; opening-hours check; delete with undo; book by selecting a range; keyboard shortcuts | tests/e2e/scheduling.spec.ts | tests/unit/schedule.test.ts | done |
| Two people editing the same appointment get a 409, not a silent overwrite; live updates | tests/e2e/supabase.spec.ts | supabase/tests/database/scheduling.test.sql, tests/unit/http.test.ts | done |
| Calendar is private: login wall, only staff see data (story 5) | tests/e2e/supabase.spec.ts | supabase/tests/database/scheduling.test.sql | done |

## How we run it
- Locally: `npx playwright test` against the dev server; `npm test` for unit tests
- Database: `npx supabase start && npx supabase test db` (pgTAP, `supabase/tests/database/`)
- App against the real database: `E2E_SUPABASE=1 VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<ANON_KEY> npx playwright test supabase` (after `npx supabase db reset`)
- On every pull request: GitHub Actions, see .github/workflows/ci.yml
- Against the deployed dev URL: `BASE_URL=https://... npx playwright test`

## What the agent may not skip
A story is done only when its end-to-end test is green in CI.

## Agent-driven bug hunt (session 8)
Prompt used, bugs found, PR links.
