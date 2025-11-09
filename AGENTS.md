# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: Static viewer/entry point for this repository.
- `data.json`, `large_data.json`: Primary datasets consumed by the page or tools.
- `README.md`: High-level overview and usage notes.
- `QWEN.md`, `info.txt`, `Prompts.txt`: Reference notes and prompts.
- If you add assets (images, scripts, styles), place them under `assets/` and reference via relative paths (e.g., `assets/styles.css`).

## Build, Test, and Development Commands
- Quick preview: Open `index.html` directly in a browser.
- Local server (Python): `python -m http.server 8080` (serve repo root, visit http://localhost:8080/).
- Local server (Node): `npx serve .` (or similar static server).
- JSON sanity check: `jq . data.json` and `jq . large_data.json` to validate syntax.
- Optional formatting: `npx prettier --write index.html` (and any added CSS/JS).

## Coding Style & Naming Conventions
- Indentation: 2 spaces for HTML/JSON.
- JSON: `snake_case` keys; arrays for collections; stable key order where practical.
- HTML: Prefer semantic tags, accessible attributes, and external assets; avoid inline scripts/styles.
- Filenames: lowercase with hyphens (e.g., `data-summary.json`, `site-style.css`).

## Testing Guidelines
- No formal test suite. Validate data with `jq` before committing.
- If changing data shape, document the schema in `README.md` and verify the page still renders as expected in a local preview.
- Optionally lint HTML with `npx htmlhint index.html` (if available).

## Commit & Pull Request Guidelines
- Use Conventional Commits where possible: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- Messages: imperative, concise; include scope if helpful (e.g., `feat(data): add new fields`).
- PRs: include purpose, summary of changes, linked issues, and notes/screenshots if `index.html` output changes. Call out any schema updates.

## Security & Data Tips
- Do not commit sensitive or personal data. Anonymize and aggregate where possible.
- Keep data files reasonable in size; prefer deltas or Git LFS for very large assets.
- Pin and verify any third-party scripts; avoid remote code where not necessary.

