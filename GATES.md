# YESI-1 go-live gates

Scope: provision the authorized Yeo UX credentials, protect and deploy yeoux.net, copy (never delete) legacy R2 content, prove all seven live gates, and merge fixes through a checked PR on ceo/YESI-1. No Hypertask writes.

Account: `7865043d9ae730882b77f3d5d670c158` only. Credentials stay in memory except owner-private 1Password templates removed in finally. Vault: Yeo UX Agents. Items: Yeoux Site Share (SHARE_TOKEN), Yeoux Site Access Gates (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET). Read each key at most once; stop/back off on rate limiting. Delete the new Access token if its vault save fails.

Prior attempt: PR https://github.com/valentinyeo/yeoux-site/pull/1 merged. Its credential blockers are superseded by Valentin’s authorization recorded 2026-10-18. Previous measurements are not current proof.

- [ ] G1: Every legacy admin URL redirects 301 to a live migrated page
  CHECK: node tools/gates.mjs g1
  EXPECT: G1 PASS
  EVIDENCE: pending
- [ ] G2: Independently listed old, new, and index item counts agree
  CHECK: node tools/gates.mjs g2
  EXPECT: G2 PASS
  EVIDENCE: pending
- [ ] G3: Logged-out browsers reach Zero Trust login while the saved service token is admitted
  CHECK: node tools/gates.mjs g3
  EXPECT: G3 PASS
  EVIDENCE: pending
- [ ] G4: Real yeoshare upload appears first on explorations within one minute
  CHECK: node tools/gates.mjs g4
  EXPECT: G4 PASS
  EVIDENCE: pending
- [ ] G5: Repository isolation and local secret scan pass, with successful secret-scan CI on the final revision
  CHECK: node tools/no-hypertask.mjs && gitleaks detect --no-banner --source . --redact && gh run view "$(gh run list --commit "$(git rev-parse HEAD)" --workflow Gitleaks --json databaseId,status,conclusion --jq '.[0] | select(.status == "completed" and .conclusion == "success") | .databaseId')" --json conclusion,headSha,jobs --jq 'select(.conclusion == "success" and any(.jobs[]; .name == "secret-scan" and .conclusion == "success")) | "G5 PASS secret-scan " + .headSha'
  EXPECT: G5 PASS
  EVIDENCE: pending
- [ ] G6: yeoshare reads credentials through yeo-key, with no config credential file
  CHECK: node --test test/yeoshare.test.mjs && printf 'G6 PASS yeoshare credential handling tests\n'
  EXPECT: G6 PASS
  EVIDENCE: pending
- [ ] G7: Both publishing references honestly direct Yeo UX explorations to the live exploration URL
  CHECK: python3 -c "from pathlib import Path; paths=[Path.home()/'.claude/reference/hosting.md',Path.home()/'.claude/skills/doc-artifacts/SKILL.md']; ok=all('https://yeoux.net/explorations' in p.read_text() for p in paths); print(('PASS' if ok else 'FAIL')+' G7: both references name https://yeoux.net/explorations'); raise SystemExit(0 if ok else 1)"
  EXPECT: PASS G7:
  EVIDENCE: pending

## Operational proof required before completion

- Credential provisioning: PASS; both named items saved and field values verified from create responses (no extra reads); temporary templates removed. SHARE_TOKEN sent to wrangler secret put on stdin; Worker creation and secret upload succeeded.
- Access policies: PASS API verification; apex application created with the existing Valentin-only allow policy, and the new service token admitted by Service Auth on apex and admin. No bypass policies. Live protection check pending.
- R2 dry run then copy-only apply; verify source unchanged: pending.
- Full checks and production build: pending.
- Checked PR, non-admin merge, deployment of merged revision: pending.
- Exact final output lines for G1–G7: pending.

# Gates: yeoshare delete support

Scope: authenticated page deletion through Worker and CLI, tested and deployed only to the Yeo UX account, with throwaway and requested-page live proof, version notes, commit and push. The YESI-1 evidence above is preserved historical work, not part of this deletion verification.

- [x] D0: Deletion acceptance checks are well formed
  CHECK: node /home/valentin/.agents/skills/unlazy/scripts/gate-lint.mjs GATES.md
  EXPECT: LINT OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=69f81179f3934636347ff01de4824d2a1f500f2d29238b9fd688f82f77d1c57b; exit=0; EXPECT=matched; output-sha256=9d07ce9d51f0f70cfa984c95875d41843ef88e4157145ede1a5f2113cf7b4b76; output-bytes=268; shell=/bin/sh; cwd=/home/valentin/projects/yeoux-site; path=695691a31144/31 entries
- [x] D1: Worker and CLI deletion regressions, repository checks and production build pass
  CHECK: npm run check && npm run build
  EXPECT: Complete!
  EVIDENCE: automatic-evidence=v1; definition-sha256=538be70debda2adb75675c4663b3b2082e93f7832b9dc047a9db61e449d397e8; exit=0; EXPECT=matched; output-sha256=b35bb12f8b0b550f88fafc5c24506e462ad731b70923f3bd1945dbb01a6874a4; output-bytes=9414; shell=/bin/sh; cwd=/home/valentin/projects/yeoux-site; path=695691a31144/31 entries
- [x] D2: Worker deployed to the Yeo UX account and documented cache purge completed
  EVIDENCE: npm run deploy succeeded using yeo-key; account 7865043d9ae730882b77f3d5d670c158; Worker version 9bf24a14-34ba-4885-bf35-24461eb0c837; both documented routes active. Targeted Cloudflare purge b1bebf5ed4655299f7cd826299957bef succeeded for six yeoux.net URLs after independently checking zone ownership. Post-purge live fixture and requested-page checks passed.
- [x] D3: Live exploration and report fixtures are deleted and absent from their indexes after successful upload, auth controls and repeated-delete checks
  CHECK: node .unlazy/yeoshare-delete/live.mjs --fixtures
  EXPECT: DELETE FIXTURES PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=40d18c5a8a9e77f985255ee272694add02cad9dc41c36e22d433f4d8eb773c5f; exit=0; EXPECT=matched; output-sha256=a81ca1c3c4034105a9b8936bec298b348e93f4ec6bd7a57d751055e017ef3e14; output-bytes=207; shell=/bin/sh; cwd=/home/valentin/projects/yeoux-site; path=695691a31144/31 entries
- [x] D4: Requested suggestions page is missing and absent from the live explorations index after deletion
  CHECK: node .unlazy/yeoshare-delete/live.mjs --requested
  EXPECT: DELETE REQUESTED PASS
  EVIDENCE: automatic-evidence=v1; definition-sha256=fa04d373e37720c10451fa77c1172e41267597c53c65ac0a2c50d567d69706c7; exit=0; EXPECT=matched; output-sha256=a7211359acb56690f28f366f5eddf63246aeab73bcba8ffb0143d9b57c6f472a; output-bytes=106; shell=/bin/sh; cwd=/home/valentin/projects/yeoux-site; path=695691a31144/31 entries
- [x] D5: Version, changelog, help and credential-safe changes reviewed and committed; remote matches the pushed commit
  EVIDENCE: Reviewed 0.1.1 in package.json and lockfile, CHANGELOG.md, help, auth and URL restrictions. Code commit 2b92fa3040eb738250ee4410333e7e3601c121af pushed to origin/main; git ls-remote matched HEAD. Both Tests run 39128351908 and Gitleaks run 39128351940 passed. Pre-commit scans passed after removing a literal fake credential-shaped test URL. Prior unrelated GATES.md edits remain unstaged and preserved.


## Deletion live proof

- Local checks: all 40 tests pass, comment and account-isolation checks pass, production build succeeds. Package and lockfile are 0.1.1; CHANGELOG.md and CLI help document deletion.
- Exploration fixture: https://yeoux.net/explorations/99641573-explorations-delete-proof.html was uploaded with the real CLI, returned 200 and appeared in its index, then was deleted using its local file path.
- Report fixture: https://yeoux.net/reports/060d6319-reports-delete-proof.html was uploaded with the real CLI, returned 200 and appeared in its index, then was deleted using its URL.
- Both fixtures now return 404 and are absent from their respective indexes. Before deletion the same absence verifier rejected each live page. Missing and wrong bearer tokens returned 401 and preserved the pages; no Access token returned the Cloudflare login redirect. Repeated CLI deletion exited 1 and reported HTTP 404.
- https://yeoux.net/explorations/9a1870da-suggestions.html returned 200 and was present in explorations before the authorized real CLI deletion. It now returns 404 and is absent from that index.
- Live operational commands and non-secret records are retained locally in .unlazy/yeoshare-delete/. No keys were printed or stored there. Credentials were read through yeo-key only.
- The YESI-1 ledger above remains historical. Its full-migration item-count and redirect assumptions intentionally no longer hold after an authorized page deletion. The current deletion acceptance gates are D0 through D5.
