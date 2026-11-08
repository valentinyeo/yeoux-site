# Changelog

## 0.1.4

- Deploys run on GitHub-hosted runners: the Deploy workflow runs `npm run ship` on every push to main; locally `npm run ship` refuses.

## 0.1.3

- AI Movers day board shows twenty candidates with source labels, hook headlines, and drag order.
- Reject swaps the next reserve onto the board so the sheet stays full while aiming for fifteen keeps.
- Catalog stores shown stories plus reserves and skips prior-day entities on reseeds.

## 0.1.2

- Add `npm run ship` to check a clean origin/main, deploy only to Yeo UX with the commit message, and verify the live Zero Trust redirect.
- Test the ship command offline and keep CLAUDE.md commands, paths and length checked.
- Document the single ship command and the separate post-deploy cache purge.

## 0.1.1

- Add authenticated DELETE for exploration and report pages, with 404 for missing pages.
- Add `yeoshare --delete <file-or-url>` to remove published pages and their index entries. Use `--report` for a local report file; URLs select their own section.
- Test file and URL resolution, deletion authentication, requests, missing pages and index removal.
