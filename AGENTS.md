# AGENTS.md · [Team name] · PR-520 Software Development Team Project 2026/27

You are a coding agent working for a student team at Estonian Entrepreneurship University of Applied Sciences. Read this file before every task.

## Read first
- docs/PRODUCT.md        the client, the problem, the one-sentence product statement, the baseline metric
- docs/REQUIREMENTS.md   functional and non-functional requirements, stories with acceptance criteria
- docs/UX.md             screens, states, flows
- docs/TESTPLAN.md       what is tested and how
- docs/LEARNINGS.md      what the team learned; append, never rewrite
- docs/DECISIONS.md      why the stack is what it is; append when it changes

## How we work
- One task is one user story or one bug. Name it before you start.
- Plan first: list the files you will touch and the tests you will add.
  Wait for a human "go" on anything touching auth, payments or data deletion.
- Small changes. A pull request stays under 300 changed lines. Never push to main directly.
- Every story ships with a test: a Playwright end-to-end test for anything a user sees, a unit test for logic.
- Never merge red. If CI fails, fix it or revert.
- No secrets in code, prompts or logs. Use .env locally and the host's secret store in production.
- Interviewee names never enter the repository. Personas are anonymised.
- Write the pull request description in plain language. A student must be able to explain every line.

## Stack (change only with a note in docs/DECISIONS.md)
- Vite, React, TypeScript
- Supabase for auth and data
- Playwright for end-to-end tests, Vitest for unit tests
- GitHub Actions for CI; main deploys to [dev URL] on every merge

## Definition of done
- The acceptance criteria in REQUIREMENTS.md pass
- Tests added and green in CI
- Deployed to the dev URL
- Board card moved to Done with the PR link
