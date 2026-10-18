# Changelog

## 0.1.1

- Add authenticated DELETE for exploration and report pages, with 404 for missing pages.
- Add `yeoshare --delete <file-or-url>` to remove published pages and their index entries. Use `--report` for a local report file; URLs select their own section.
- Test file and URL resolution, deletion authentication, requests, missing pages and index removal.
