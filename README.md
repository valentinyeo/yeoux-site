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

## Check and deploy

```bash
npm ci
npm run check
npm run build
yeo-key --env 'Hetzner Wrangler All Access' -- bash -c 'export CLOUDFLARE_API_TOKEN="$credential"; export CLOUDFLARE_ACCOUNT_ID=7865043d9ae730882b77f3d5d670c158; npm run deploy'
```

Deploy only to the Yeo UX account configured in `wrangler.toml`. The Worker serves both https://yeoux.net and the legacy admin redirects. Never deploy it to another account. Pages and indexes use `Cache-Control: private, no-store`; after deployment, purge the changed https://yeoux.net URLs through Cloudflare and verify with the Access service token.
