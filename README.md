# yeoux-site

The yeoux.net hub: explorations and reports for Yeo UX projects, behind Zero Trust.

## Publish and delete

```bash
yeoshare page.html
yeoshare --delete page.html
yeoshare --delete https://yeoux.net/explorations/12345678-page.html
yeoshare --report --delete report.html
```

File deletion resolves the same real path and slug as upload, so the local file must still exist. A URL selects its own section. Both operations read the upload key and Cloudflare Access service token through `yeo-key`. Successful deletion prints `deleted <url>` and removes the page from its index. Missing pages return 404.

## Pull request verifier

`.github/workflows/pstack-verifier.yml` runs one `pstack-verifier` job on every pull request. It starts the base commit and the head commit locally with invented seed data, has DeepSeek drive the features in `docs/feature-map.md` on both, and posts one verdict comment: PASS, PASS+NOTES or FAIL. The driver, the feature map and the tests live in `verifier/`, `docs/feature-map.md` and `test/pstack-verifier.test.mjs`. It needs the repo secret `OPENCODE_API_KEY` and nothing else: no Claude login is needed for a run. It is not yet a required check.

The two apps never run from the runner's checkout or the runner's home: one step copies each checkout and the verifier scripts to `/srv/pstackapp`, hands them to the unix user `pstackapp`, and proves that user can read them. That user cannot enter `/home/runner`, which is how the first real run lost both apps. When an app does not start, the verdict comment carries the last 20 lines of its install, build and start logs, with every token value replaced by `[redacted]` by `verifier/failure-log.mjs`, so the next failure explains itself in the comment. The comment is posted with `gh pr comment --repo`, because the job runs outside a checkout.

The verifier family is chosen by one function, `verifierFamilyFor` in `verifier/verify.mjs`. The owner decided on 2026-11-15 that DeepSeek verifies every pull request, whoever wrote it: `author-model: claude`, `openai`, `grok` or `deepseek`, and a missing line, all get DeepSeek. Any other value fails closed with reason `unknown_author_model`. When the author is DeepSeek, the verdict comment says in one plain line that the author and the verifier share a family. The Claude agent path stays in the code for a future table, but nothing in this workflow routes to it, so the agent step installs only Pi. The DeepSeek verifier runs through the Pi coding agent and nothing else: the agent step installs `@earendil-works/pi-coding-agent` at a pinned exact version and runs `pi -p --provider opencode-go --model deepseek-v4.1-flash` with the prompt on standard input, so the provider and the model are the two constants `DEEPSEEK_PROVIDER` and `DEEPSEEK_MODEL`. Never a Pro model. Pi gets `--tools read,bash`, no extensions, skills, prompt templates, context files or MCP, its own session directory, and a `PATH` holding only `node` and `pi`, so it can reach the drive tool and the two checkouts and nothing else. That path is unproven until one real run passes on a pull request.

## Check and deploy

Checks and deploys run only on GitHub-hosted runners, never on the VPS. Pull requests run the Tests, No code comments and Gitleaks workflows. After the PR merges, the Deploy workflow (`.github/workflows/deploy.yml`) runs `npm run ship` on `ubuntu-latest`: it checks HEAD equals `origin/main`, repeats the checks, builds and deploys only to the Yeo UX account configured in `wrangler.toml` with the `CLOUDFLARE_API_TOKEN` repo secret. Run outside GitHub Actions, `npm run ship` refuses. Redeploy main with `gh workflow run deploy.yml -R valentinyeo/yeoux-site`. The Worker serves both https://yeoux.net and the legacy admin redirects. Never deploy it to another account. Pages and indexes use `Cache-Control: private, no-store`; `npm run ship` does not purge caches; after deployment, purge the changed https://yeoux.net URLs through Cloudflare and verify with the Access service token.
