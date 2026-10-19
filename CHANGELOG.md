# Changelog

## 0.1.2

- Add `npm run ship` to check a clean origin/main, deploy only to Yeo UX with the commit message, and verify the live Zero Trust redirect.
- Test the ship command offline and keep CLAUDE.md commands, paths and length checked.
- Document the single ship command and the separate post-deploy cache purge.

## 0.1.1

- Add authenticated DELETE for exploration and report pages, with 404 for missing pages.
- Add `yeoshare --delete <file-or-url>` to remove published pages and their index entries. Use `--report` for a local report file; URLs select their own section.
- Test file and URL resolution, deletion authentication, requests, missing pages and index removal.
