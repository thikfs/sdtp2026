# Test plan

## What we test
| Story | End-to-end test file | Unit tests | Status |
|---|---|---|---|
| S1 | tests/e2e/s1-*.spec.ts | | todo |

## How we run it
- Locally: `npx playwright test` against the dev server
- On every pull request: GitHub Actions, see .github/workflows/ci.yml
- Against the deployed dev URL: `BASE_URL=https://... npx playwright test`

## What the agent may not skip
A story is done only when its end-to-end test is green in CI.

## Agent-driven bug hunt (session 8)
Prompt used, bugs found, PR links.
