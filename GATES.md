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
