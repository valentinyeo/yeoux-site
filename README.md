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

`.github/workflows/pstack-verifier.yml` runs one `pstack-verifier` job on every pull request. It starts the base commit and the head commit locally with invented seed data, has an agent from another model family drive the features in `docs/feature-map.md` on both, and posts one verdict comment: PASS, PASS+NOTES or FAIL. The driver, the feature map and the tests live in `verifier/`, `docs/feature-map.md` and `test/pstack-verifier.test.mjs`. It needs the repo secret `CLAUDE_CODE_OAUTH_TOKEN` for the Claude verifier, and the secret `PSTACK_DEEPSEEK_API_KEY` plus variable `PSTACK_DEEPSEEK_BASE_URL` for the DeepSeek verifier. It is not yet a required check.

The verifier family is chosen by one function, `verifierFamilyFor` in `verifier/verify.mjs`. DeepSeek is the default: an `author-model: claude`, `openai` or `grok` pull request is verified by DeepSeek. Claude verifies only when the author is DeepSeek (`author-model: deepseek`). A missing line is treated as a DeepSeek author, because our workers are DeepSeek, so Claude verifies. The verifier is never the author's own family. Any other value fails closed with reason `unknown_author_model`. The DeepSeek verifier runs the same CLI against `https://api.deepseek.com/anthropic` with `DEEPSEEK_MODEL`, which is `deepseek-flash`, the DeepSeek-V4.1-Flash model named in https://api-docs.deepseek.com/quick_start/pricing. That path is unproven until one real run passes on a pull request.

## Check and deploy

Checks and deploys run only on GitHub-hosted runners, never on the VPS. Pull requests run the Tests, No code comments and Gitleaks workflows. After the PR merges, the Deploy workflow (`.github/workflows/deploy.yml`) runs `npm run ship` on `ubuntu-latest`: it checks HEAD equals `origin/main`, repeats the checks, builds and deploys only to the Yeo UX account configured in `wrangler.toml` with the `CLOUDFLARE_API_TOKEN` repo secret. Run outside GitHub Actions, `npm run ship` refuses. Redeploy main with `gh workflow run deploy.yml -R valentinyeo/yeoux-site`. The Worker serves both https://yeoux.net and the legacy admin redirects. Never deploy it to another account. Pages and indexes use `Cache-Control: private, no-store`; `npm run ship` does not purge caches; after deployment, purge the changed https://yeoux.net URLs through Cloudflare and verify with the Access service token.
