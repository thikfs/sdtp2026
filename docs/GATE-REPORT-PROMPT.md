Audit this repository against the PR-520 gates below. Do not change any file.
For each gate write PASS or FAIL, the file path or URL that proves it, and one
sentence on what is missing. Write the result to docs/GATE-REPORT.md with today's
date and the git commit hash at the top.

G1  docs/PRODUCT.md names a real client, contains the one-sentence product
    statement in the form "When [persona] is [use case] but [problem],
    [our capability]", and a baseline metric of the current process.
G2  docs/REQUIREMENTS.md lists functional requirements, non-functional
    requirements for performance, accessibility, security, privacy and
    availability, and at least eight stories with Given/When/Then criteria.
G3  AGENTS.md and README.md exist; CI config exists; README links a live dev URL
    and a board.
G4  docs/UX.md describes screens, states and flows; links a prototype; contains
    notes from two hallway tests.
G5  At least three stories from REQUIREMENTS.md are marked done with PR links;
    a v2 tag exists with a changelog (after session 11).
G6  Playwright tests exist for the core stories; the latest CI run on main is green.
G7  A PR labelled "agent-found" fixes a bug discovered through Playwright MCP or
    Chrome DevTools; the product exposes at least one MCP tool with a README entry.
G8  docs/VALIDATION.md contains usability test notes with the client and an NFR
    report (Lighthouse, axe, dependency audit).
G9  README links the demo recording or slides.
G10 For each team member: commits under their name in at least six distinct
    ISO weeks, an agent session log under docs/sessions/, and a reflection letter
    under docs/letters/.
