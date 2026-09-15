# [Product name]

[One-sentence product statement from docs/PRODUCT.md]

| | |
|---|---|
| Team | [Thiago Kumlehn Fajardo Silva, tests and checking the result,shared files, task board and publishing] · [Diego Alvarez, client questions and requirements, shared files, task board and publishing] |
| Dev URL | [https://...] |
| Board | [https://...] |
| Course | PR-520 Software Development Team Project, EEK, 2026/27 |

## Run locally
```bash
npm install
cp .env.example .env        # fill in Supabase keys
npm run dev                 # http://localhost:5173
npm test                    # unit tests
npx playwright test         # end-to-end tests against the local dev server
```

## Milestones
1. [Session 4] Deployed hello page on the dev URL
2. [Session 6] First story live end to end
3. [Session 7] Core stories covered by end-to-end tests
4. [Session 10] v1 demo
5. [Session 11] v2 from persona feedback

## Agent-ready
The product exposes one MCP tool in `mcp/server.ts`. Register it in your agent with `.vscode/mcp.json` (Copilot) or `.mcp.json` (Claude Code). Cline stores MCP servers per machine, so add it once in the Cline settings panel.

## Gates
Run the prompt in `docs/GATE-REPORT-PROMPT.md` with your agent before every Moodle submission. The output is `docs/GATE-REPORT.md`.
