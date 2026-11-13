# yeoux.net transition

Ticket: https://app.hypertask.ai/detail/project-11514/361

Status: plan and coverage guard only. The rewrite is not built, previewed or live. Twelve ordered child tickets are filed below. This document satisfies the planning deliverable, not the parent's remaining completion gates.

## Authority and pins

- Rat Stack: https://github.com/joelhooks/rat-stack/tree/10152920820e717f889628d4c4793fd38967dbd5
- Incumbent: `valentinyeo/yeoux-site` at `6b1fc4191c42af7e6b5f177fee81e5ce7adee691`.
- Colour reference: https://github.com/plausible/analytics/blob/a39465fe3dcc59b1de5702b417e926d0b2473016/assets/css/app.css
- Use the template's exact pins, not package registry latest. Effect 4.1.2, Foldkit and @foldkit/ui 0.170.0, StyleX 0.19.1, Alchemy 2.0.0-beta.85, XState 6.0.0-beta.1, @xstate/effect 1.0.0-beta.0, TypeScript 7.0.2, pnpm 11.3.0, Node 24.18.0.
- Read the pinned AGENTS.md, VISION.md, rat-stack-mode, learn-rat-stack and keep-or-cut before implementation. For each slice, load its named skill. Read installed Effect instructions and pinned sources before Effect changes.
- Work solo. The launcher's single-thread rule overrides the historical Sonnet-helper sentence on the ticket. No helper or other agent was started.

## Repository and rollout

Use `rat/` in this private repository, copied from the pinned template, not an in-place Astro conversion. Hosting already uses Workers, not Pages. Preserve the current deployment until parity passes. A separate private repository would isolate the new layout, but the runner App cannot create one: template generation returned HTTP 403, `Resource not accessible by integration`. No new credential or approval is necessary for the same-repository route.

Keep template pins, tsconfig diagnostics, Oxlint and anti-slop rules, Oxfmt, Lefthook and the GitHub-hosted CI fence. Change product-specific template law and demo code, not enforcement. Rename the workspace scope to `@yeoux`. Do not copy Joel's public content, discovery endpoints, signup, analytics, auth, database, cache or sandbox into this private hub. Trace imports before cutting: the template web reader currently depends on apps/site content generation and backend modules. Replace those with yeoux capabilities before deleting them. `apps/site` is not a home for the fleet watcher.

The legacy account-separation and secret scans stay active during coexistence. Do not exclude `rat/` from them to hide a failing import. Resolve generic template configuration conflicts explicitly without allowing real foreign-account identifiers or credentials.

## Source-derived inventory

`ratstack-transition.json` assigns each tracked source, asset, configuration, test and tool to exactly one inventory item and one owning slice. `tools/transition-coverage.mjs` rejects a missing file, duplicate owner, unknown slice, absent pin or cyclic slice dependency. It proves coverage of the plan, not parity of the implementation. The accompanying tests exercise rejected and accepted plans in CI.

Runtime groups:

| Item | Current behaviour | Rat Stack home | Owner |
| --- | --- | --- | --- |
| I01 | Workspace, installs and build | Template workspace and whole fence | S01 |
| I02 | Product instructions and release notes | Child AGENTS.md, VISION.md, narrowed public allowlist | S02 |
| I03 | Site domain, legacy domain, bucket, assets, redirect setting | apps/infra Alchemy resources; explicit adoption and retention | S03 |
| I04 | Watcher KV, cron and settings | App-named watcher resource in apps/infra | S03 |
| I05 | Upload metadata, sorted indexes, stable links, legacy lookup, binary reads, authenticated PUT and DELETE | Core contracts and capabilities; content R2 cartridge | S05 |
| I06 | Artifact shell insertion, charset checks, large HTML streaming, content types and private caching | Content capability plus Foldkit SSR shell; pinned htmlparser2 only if parsing is necessary | S05 |
| I07 | Catalog schemas, decisions, order, reserves and saved state | Core dashboard contracts and capability handlers | S06 |
| I08 | Dynamic report links and home groups | Capability-derived index data, no process-global mutable cache | S05 |
| I09 | Exploration and report HTTP compatibility routes | toHttpApi projections from the same content capabilities | S05 |
| I10 | Home, both indexes and empty states | Foldkit Features, Clients and StyleX | S07 |
| I11 | Navigation, both themes, saved preference, print and menus | Foldkit Messages, Commands and subscriptions; shared StyleX tokens | S07 |
| I12 | Dashboard picker, day list and daily board | Foldkit dashboard Feature and Client; RPC calls to I07 | S07 |
| I13 | Catalog GET/PUT, decisions GET/POST and order PUT | Dashboard capability HTTP projections; browser actions use RPC | S06 |
| I14 | Zero Trust boundary, admin redirects and response headers | Small Effect access cartridge and Worker composition | S04 |
| I15 | Supervisor heartbeat and silence alerts | App-named watcher Worker; Effect capabilities, KV adapter and XState lifecycle | S08 |
| I16 | yeoshare CLI, migration, live checks and release tools | Effect CLI over capabilities; Alchemy release driver; migration read/copy utility | S09 |
| I17 | GitHub workflows and security tests | Template CI on GitHub-hosted runners; kept secret/account scans | S09 |
| I18 | Transition coverage artefacts | Temporary planning guard, removed after cutover | S12 |

Read the actual route files too. Artifact routes accept GET, PUT and DELETE; unsupported methods return 405. An empty upload body currently deletes the object. That compatibility path must remain token-protected. Dashboard catalog publishing needs SHARE_TOKEN. Decisions and ordering need an Access identity. Neither boundary may become public during the move.

## Data ownership

- Existing R2 bucket `yeoux-site-content` remains authoritative. Preserve `x/` explorations, `r/` reports and `d/ai-movers/<date>/{catalog,decisions}.json`, metadata, dates, order and decision authors. No bucket copy, rename or deletion.
- yeoshare and current publishers keep writing the same URLs. During preview, production has the only writer. Preview can read production content, but test writes go only to a separate disposable preview bucket with seeded synthetic records. That bucket must have a distinct Alchemy identity. No email, Slack or heartbeat cron executes in preview.
- After cutover, the new content and dashboard capabilities become the writers. A route shim may preserve the old HTTP shape, but it must call those same handlers, not duplicate domain logic.
- Current dashboard writes read/modify/write one R2 object. Do not introduce a second writer or claim transactional guarantees R2 lacks. The move must preserve the current semantics; any stronger serialization needs its own evidenced design.
- Reports and explorations already uploaded to R2 are documents, not the app's source. Preserve their bytes and interactive contents. Never delete their charts, scripts or fonts merely because they are not Rat Stack dependencies. Port the site's shell, not arbitrary user documents. Generated report publishers outside this repository are not silently rewritten.
- The supervisor watcher's `hb:production`, `hb:drill` and `alarm:*` KV records remain separate facts owned by that Worker. Preserve its existing endpoint and cron while moving its implementation. Do not run a live alert drill as a migration read check.
- No D1, Postgres, queue or owned-user database exists in this source. Do not add database or Better Auth slices. Cloudflare Access remains in front. Do not replace it with the template's public-site auth.

## Resource and setting names

Site: Worker `yeoux-site`, `yeoux.net/*`, `admin.yeoux.net/*`, bucket `yeoux-site-content`, binding CONTENT, ASSETS, YESI_1_REDIRECTS, SHARE_TOKEN. Keep the Yeo UX account selected by the incumbent deployment configuration.

Watcher: read its current configuration and Cloudflare inventory before adopting. Preserve FLEET_SUPERVISOR_KV, HEARTBEAT_TOKEN, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID, ALERT_EMAIL_TO and the five-minute schedule. Do not infer an unconfigured KV ID from a template placeholder.

Operator access: CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET come from the existing Yeoux Site Access Gates item. yeoshare reads SHARE_TOKEN through Yeoux Site Share. `.env.schema` declares names, never values. Alchemy uses a Yeo UX profile. The current GitHub deploy secret is not permission to copy it into source or another account.

## Appearance

Use Foldkit defaults for layout and controls. Do not reuse the old daisyUI theme or apply app.hypertask.ai's shape rules to yeoux.net. Plausible supplies colours only, not React, Tailwind, fonts or components.

The pinned Plausible CSS maps gray to zinc, defines gray-75 as rgb(247 247 248), gray-750 as rgb(50 50 54), gray-850 as rgb(34 34 38), and uses indigo-600 for primary controls and indigo-500 for focus. Its background selector uses gray-75 by day and gray-850 by night. Carry these source values into StyleX theme tokens. Resolve any inherited token against Plausible's pinned Tailwind dependency before assigning a literal; do not guess hex values.

Keep light, dark and system preference behaviour, the saved `ht-theme` preference, cross-tab changes, print-light restoration, menu close-on-Escape and phone navigation. No custom redesign beyond the requested colours. Preserve the content and actions while cutting duplicated styling. Source and target screenshots must cover both themes, keyboard focus and phone layouts. A different runner does final design QA. The current task does not authorize launching that runner.

## Ordered slices

File each as a child of HYCI-361, with exactly one brain tag and the existing cluster label. Link the resulting full ticket URLs here and on the parent. These are a plan, not permission to launch agents or work another ticket in this run. A child owns each inventory item exactly once; spanning tests belong to parity, after their dependencies.

| Slice | Deliverable and Rat Stack skill | Depends on | Brain |
| --- | --- | --- | --- |
| [S01](https://app.hypertask.ai/detail/project-11514/363) | Copy pinned template to rat/, rename scope, trim unused demos without weakening fence; keep-or-cut, learn-rat-stack | none | medium |
| [S02](https://app.hypertask.ai/detail/project-11514/364) | Product law, VISION, private allowlist, profile name, sources:fetch and git-snapshot; rat-stack-mode | S01 | medium |
| [S03](https://app.hypertask.ai/detail/project-11514/365) | Alchemy adoption plan for existing site and watcher resources, no deploy; learn-alchemy | S02 | hard |
| [S04](https://app.hypertask.ai/detail/project-11514/366) | Access validation and admin redirect boundary; add-a-capability, security-audit | S03 | hard |
| [S05](https://app.hypertask.ai/detail/project-11514/367) | Content contracts, R2 cartridge, HTTP compatibility and artifact rendering; add-a-capability, add-a-store | S04 | medium |
| [S06](https://app.hypertask.ai/detail/project-11514/368) | Dashboard catalog, decisions, order and reserve capability group; add-a-capability, add-a-store | S05 | medium |
| [S07](https://app.hypertask.ai/detail/project-11514/369) | Foldkit home, indexes, navigation, daily board and Plausible day/night tokens; learn-rat-stack, test-behaviour | S06 | medium |
| [S08](https://app.hypertask.ai/detail/project-11514/370) | Supervisor heartbeat and silence lifecycle in Effect/XState, same KV and endpoint; add-a-lifecycle-machine, durability | S07 | hard |
| [S09](https://app.hypertask.ai/detail/project-11514/371) | Effect publishing/migration CLI and GitHub-only Alchemy release path; add-a-capability, ship | S08 | medium |
| [S10](https://app.hypertask.ai/detail/project-11514/372) | Private preview and complete behaviour parity; test-behaviour, ship | S09 | hard |
| [S11](https://app.hypertask.ai/detail/project-11514/373) | Live domain cutover, deployment receipt and live proof; learn-alchemy, ship | S10 | hard |
| [S12](https://app.hypertask.ai/detail/project-11514/374) | Delete replaced Astro, Tailwind, daisyUI, parse5, Wrangler, legacy configuration and temporary coverage guard; keep-or-cut | S11 | medium |

Every slice requires `pnpm check`, `pnpm test` and `pnpm turbo run check test build` green on GitHub-hosted runners at its current head. No VPS build or test execution. S01 also measures compressed Worker size against the actual free limit before provisioning. A plan that requires new paid resources stops, with the measured amount, before any spend.

S03 is plan-only: inspect each adoption, update and retention action. Refuse replacements/deletes of storage or Access. Keep the old deployment callable for rollback. S08 must account for open watcher work in https://github.com/valentinyeo/yeoux-site/pull/25 before porting; do not resurrect an alert bug from an older snapshot.

## Drop and foreign-file ownership

rat-diff against the pinned template found one shared package, two version bumps, seven drops, 35 missing core packages, 25 optional cartridge packages, 12 missing layout entries and five foreign configuration/lock files. It found no Pages markers, self-hosted workflow, loose non-JS helper or CDN tag in the tracked source. These are source findings, not claims about uploaded documents or cloud resources.

- Astro and @astrojs/cloudflare: S01 creates the replacement; S07 ports screens; S12 deletes the runtime and astro.config.mjs.
- Tailwind, @tailwindcss/vite and daisyUI: S07 ports styling to StyleX and Foldkit; S12 removes packages and styles.
- parse5: S05 replaces shell manipulation using the platform or the template-pinned htmlparser2. S12 removes parse5.
- Wrangler, both wrangler.toml files and both npm locks: S03/S09 establish Alchemy and pnpm; S12 deletes old files only after live proof.
- yaml is a shared package. Keep only if a retained tool still needs it, at the template's exact pin. Bump workers-types and TypeScript to the template's exact pins.
- No new chart package, CDN, UI kit or alternative runtime. Existing uploaded documents remain data, as described above.
- Keep full-history secret scanning and foreign-account checks. Port their behaviour, not obsolete assertions demanding local deploys or self-hosted runners. Source files currently contradict those assertions in CLAUDE.md; replacement child law must say GitHub-hosted only.

## Preview and cutover proof

Capture a fresh live URL manifest immediately before parity. On 2026-11-13, authenticated reads returned HTTP 200 for /, /reports, /explorations and /dash. These are a baseline only. Save the live manifest, status, content-type and content hashes outside the worktree, without credentials. Fail on an empty manifest. Include every indexed report and exploration, every dashboard day, non-HTML assets and old admin links. Reconcile publications that arrive during the move before cutover.

Preview proof must cover:

1. All manifest URLs, metadata order, stable slugs, content types, sizes, private/no-store, charset fallback and large HTML streaming. Binary bytes match; HTML preserves report content and interactions despite the new shell.
2. Invalid slug, malformed metadata, absent object, unsupported method, unauthorized write and legitimate authorized upload/update/delete. Empty-body deletion remains protected. Use synthetic preview content, never delete a real document.
3. Dashboard catalog publish, stored reload, invalid catalog, decisions accept/reject/clear/used, reserve replacement, ordering, resetOrder, idempotent repeat and saved reload. Refused missing Access identity and still-allowed valid identity use the same changed boundary.
4. Home/core links, empty lists, menus, keyboard controls, phone layout, both themes, system preference, persisted preference, cross-tab sync and print. Use real accessible controls and Foldkit Scene/Story tests, not DOM template snapshots alone.
5. Watcher heartbeat auth, methods, production/drill IDs, silence threshold, rearm and alarm suppression through a fake clock and fake transports in GitHub CI. No real messages or emails from a preview or test. Do not silently change current alert timing while porting.

Deploy only from a green merged commit through the GitHub-hosted Alchemy path. Record stage, merge SHA, deployed Worker version and full-traffic activation. Prove unauthenticated traffic still reaches the Access login; authenticated live requests exercise the same entry points as preview. Publish desktop/phone captures for both themes and a concise QA report on the ticket. Do not declare live from a successful merge or deployment command alone.

Rollback: record the old site's active Worker version before cutover. For a routing switch, restore the prior route target without changing Access or R2. For in-place Worker adoption, roll back to that exact prior Worker version. Use the new stack's `pnpm deploy:rollback` only after its project-specific rollback receipts have been proven. Do not invent a Pages rollback: this site is already a Worker. Confirm the restored version serves existing content and protected writes. S12 deletes old source, never production content or the retained rollback version.

## Parent completion

YX:G1 is the pinned plan, complete inventory and twelve linked slice tickets above. Confirm the coverage guard in GitHub CI. YX:G2 needs current-head green GitHub evidence for the built rewrite, not this planning PR. YX:G3 needs the full non-empty preview manifest and interaction report. YX:G4 needs live version receipts and both themes. YX:G5 needs the shipped dependency/source audit after deletion. A plan-only PR, this guard, or a healthy old site is not completion.
