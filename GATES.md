# YESI-1 gates

Ticket: https://app.hypertask.ai/detail/project-8906/1

Each gate is a command. Done means every gate prints PASS on the live site.

| Gate | What it proves | Command |
|---|---|---|
| G1 | Every old admin.yeoux.net URL from the R2 listing answers 301 to a live page | `node tools/gates.mjs g1` |
| G2 | Old bucket object count equals new bucket object count equals the index item count | `node tools/gates.mjs g2` |
| G3 | A logged-out request to yeoux.net gets the Zero Trust login, not content | `node tools/gates.mjs g3` |
| G4 | A yeoshare upload shows first on /explorations within a minute | `node tools/gates.mjs g4` |
| G5 | No Hypertask key, Neon string or Hypertask account id in the repo | `node tools/no-hypertask.mjs` and the `secret-scan` check |
| G6 | The yeoshare script has no `.config` path and sources no credentials file; it reads keys through `yeo-key` | `node --test test/yeoshare.test.mjs` |
| G7 | `~/.claude/reference/hosting.md` and the doc-artifacts skill name yeoux.net/explorations for Yeo UX explorations | `grep -c 'yeoux.net/explorations' ~/.claude/reference/hosting.md ~/.claude/skills/doc-artifacts/SKILL.md` |

## Status

| Gate | Status |
|---|---|
| G1 | waiting for Cloudflare access |
| G2 | waiting for Cloudflare access |
| G3 | waiting for Cloudflare access |
| G4 | waiting for Cloudflare access |
| G5 | PASS in CI |
| G6 | PASS in CI |
| G7 | waiting for cutover |
