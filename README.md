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

`.github/workflows/pstack-verifier.yml` runs one `pstack-verifier` job on every pull request. It starts the base commit and the head commit locally with invented seed data, has an agent from another model family drive the features in `docs/feature-map.md` on both, and posts one verdict comment: PASS, PASS+NOTES or FAIL. The driver, the feature map and the tests live in `verifier/`, `docs/feature-map.md` and `test/pstack-verifier.test.mjs`. It needs the repo secret `CLAUDE_CODE_OAUTH_TOKEN`, plus the secret `PSTACK_DEEPSEEK_API_KEY` and variable `PSTACK_DEEPSEEK_BASE_URL` for the case where the author is Claude. It is not yet a required check.

## Check and deploy

Checks and deploys run only on GitHub-hosted runners, never on the VPS. Pull requests run the Tests, No code comments and Gitleaks workflows. After the PR merges, the Deploy workflow (`.github/workflows/deploy.yml`) runs `npm run ship` on `ubuntu-latest`: it checks HEAD equals `origin/main`, repeats the checks, builds and deploys only to the Yeo UX account configured in `wrangler.toml` with the `CLOUDFLARE_API_TOKEN` repo secret. Run outside GitHub Actions, `npm run ship` refuses. Redeploy main with `gh workflow run deploy.yml -R valentinyeo/yeoux-site`. The Worker serves both https://yeoux.net and the legacy admin redirects. Never deploy it to another account. Pages and indexes use `Cache-Control: private, no-store`; `npm run ship` does not purge caches; after deployment, purge the changed https://yeoux.net URLs through Cloudflare and verify with the Access service token.
