# CLAUDE.md

The yeoux.net hub: dashboards, explorations and reports for Yeo UX projects (never Hypertask), behind Zero Trust. Astro and daisyUI on a Cloudflare Worker, content in R2. Ticket: https://app.hypertask.ai/detail/project-8906/1

## Parts

- `src/lib/content.mjs`: sections (`x/` explorations, `r/` reports), upload rules, index order, old admin.yeoux.net link mapping.
- `src/lib/dash.mjs`: interactive `dash` apps under R2 `d/`. First app AI Movers at `/dash/ai-movers` and `/dash/ai-movers/<UTC-date>`. Catalog has twenty shown stories plus reserves, source labels, and reject-to-replace. Catalog PUT needs `SHARE_TOKEN`. Decision POST and order PUT need Access email. Ticket: https://app.hypertask.ai/detail/project-11612/1
- `src/lib/coreReports.mjs`: the one list of core reports (`CORE`). Feeds the hamburger menu and the home tiles. Add a report as one line: `name`, `line`, and `href` or a title `match` for dated pages.
- `src/pages`: `/` hub, `/dash`, `/explorations`, `/reports`. Artifact pages use `DELETE`/`PUT` with `Authorization: Bearer <SHARE_TOKEN>` and `X-Title`, `X-Project`, `X-Date`.
- `src/middleware.js`: on host admin.yeoux.net, 301 every old `/p/<id>/<name>` link to its new place. Switch: `YESI_1_REDIRECTS` in `wrangler.toml`.
- `bin/yeoshare.mjs`: the `yeoshare` command, including `--delete <file-or-url>`. Keys come from `yeo-key "Yeoux Site Share"` and `yeo-key "Yeoux Site Access Gates"`, never a file.
- `tools/migrate.mjs <old bucket> [--apply]`: copies every old admin.yeoux.net object here; never deletes the old bucket.
- `tools/gates.mjs`: the YESI-1 gates in `GATES.md`.

## Test

```bash
npm ci && npm run check && npm run build
```

## Ship

Run `npm run ship` from a clean main after the PR merges.
It runs the same checks as CI, deploys only to the Yeo UX account, stamps the deploy with the commit, and checks the live site is behind Zero Trust.

## Rules and what enforces them

| Rule | Enforced by |
|---|---|
| No code comments | required `no-comments` check (`tools/strip-comments.mjs --check`, covers JS, CSS, HTML, Astro, YAML and TOML) |
| No Hypertask account id, Access audience, Neon string or Hypertask secret path | `tools/no-hypertask.mjs` in CI |
| No keys in git | `secret-scan` in CI |
| Live migration gates fail on empty sources and on any non-200 page; no vacuous PASS | `test/gates.test.mjs` in `tests` |
| yeoshare reads keys only through yeo-key | `test/yeoshare.test.mjs` |
| Cloudflare account Yeo UX `7865043d9ae730882b77f3d5d670c158` only | `wrangler.toml` |
| Deploy only from a clean origin/main | `tools/ship.mjs` |
| CLAUDE.md names only real commands and files | `test/claude-md.test.mjs` |
| Workflow jobs run on GitHub-hosted runners, never this VPS | `test/workflows.test.mjs` in `tests` |
| Ship only through `npm run ship`; no raw deploy npm script | `test/ship.test.mjs` in `tests` |
