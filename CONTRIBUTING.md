# Contributing Guide

Thanks for your interest in contributing! This project aims to be a high-quality, secure, and user-friendly OpenRouter desktop client. Below is everything you need to get started quickly and confidently.

## Table of Contents
- [Core Principles](#core-principles)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Available Scripts](#available-scripts)
- [Development Workflow](#development-workflow)
- [Branching & Commit Conventions](#branching--commit-conventions)
- [Adding Features](#adding-features)
- [UI & Styling Guidelines](#ui--styling-guidelines)
- [Data & Persistence Rules](#data--persistence-rules)
- [Security Expectations](#security-expectations)
- [Export / Import Schema](#export--import-schema)
- [Testing Expectations](#testing-expectations)
- [Performance Considerations](#performance-considerations)
- [Opening a Pull Request](#opening-a-pull-request)
- [Issue Reporting](#issue-reporting)
- [Release Process](#release-process)
- [License Notes](#license-notes)

## Core Principles
- Minimal, secure IPC surface (principle of least privilege).
- No plaintext storage of API keys (always encrypted via `safeStorage`).
- Fast launch and responsive streaming UX.
- Deterministic and reversible data transformations (especially export/import).
- Dark-mode first, accessible contrast and keyboard navigation.
- Small, composable React components with clear responsibilities.

## Project Structure
```
/ (root)
  electron-builder.yml       # Packaging targets
  src/
    main/                    # Electron main process (IPC, windows, encryption)
    preload/                 # Secure bridge (contextIsolation)
    renderer/                # React + Vite application
      components/            # UI pieces
      storage/               # IndexedDB logic (idb)
      hooks/                 # Custom React hooks
  scripts/                   # Build helpers for Electron parts
  .github/                   # Workflows & templates (governance)
```

## Prerequisites
- Node.js 18+ (CI uses Node 20)
- macOS/Linux/Windows
- A valid OpenRouter API key

## Setup & Installation
```
npm ci
npm run dev
```
Two processes start: Vite dev server (renderer) and Electron.

If Electron does not auto-reload on main/preload changes, restart `npm run dev` (esbuild watcher occasionally needs a restart).

## Available Scripts
- `npm run dev` – Start Vite + Electron in watch mode
- `npm run typecheck` – Run TypeScript project-wide checks
- `npm run lint` – ESLint and formatting validation
- `npm run build` – Production build for renderer + compile main/preload
- `npm run dist` – Build distributables for current platform
- `npm run dist:all` – Cross-platform build (requires appropriate host tooling / sign tools)

## Development Workflow
1. Create a feature/fix branch from `main`.
2. Make focused commits (logical units).
3. Ensure `typecheck`, `lint`, and `build` pass locally.
4. Test export/import if schema touched.
5. Open PR with clear description (problem, solution, trade-offs).

## Branching & Commit Conventions
Branch naming suggestions:
- `feat/<short-kebab-description>`
- `fix/<issue-number>-<short-desc>`
- `chore/<scope>`
- `docs/<topic>`

Commit style (no strict enforcement, but encouraged):
```
feat(chat): add optimistic user message rendering
fix(storage): handle IndexedDB open blocked error
```

## Adding Features
When adding IPC:
- Define channel in `main` and expose minimal function in `preload`.
- Do NOT expose Node APIs directly to renderer.
- Validate all inputs (types, bounds) and sanitize external content.

When adding renderer components:
- Keep side-effects isolated (fetching, streaming) in hooks or thin controllers.
- Avoid deep prop drilling—prefer context providers when truly shared.

## UI & Styling Guidelines
- Tailwind for layout + spacing; keep custom CSS minimal.
- Use semantic HTML where possible.
- Preserve dark theme contrast (test with system light mode toggle if extending).

## Data & Persistence Rules
- Conversations and messages persist in IndexedDB (`openrouter_client` DB).
- Never mutate stored objects in-place after retrieval; clone then update.
- Message trimming is heuristic—keep logic pure and idempotent.
- Schema for export/import is versioned (`version: 1`). Increment if breaking.

## Security Expectations
- API key: only ever available decrypted in main memory during active operations.
- Sanitize all markdown (never trust model output).
- Abort streaming promptly on user cancellation.
- Do not introduce dynamic `eval` or remote code loading.

## Export / Import Schema
Current (v1):
```
{
  "version": 1,
  "exportedAt": "ISO-8601",
  "conversations": [ { id, title, model, createdAt, updatedAt } ],
  "messages": [ { id, conversationId, role, content, createdAt, tokens? } ]
}
```
If you add fields:
- Non-breaking optional: keep `version:1`.
- Breaking changes: bump to `2`, write migration in `importData()`.

## Testing Expectations
Automated tests are not yet extensive—PRs adding tests are welcome.
At minimum manually verify:
- Send message (success & network failure path)
- Abort streaming
- Export then import into a fresh profile (rename DB or run in temp profile)
- Model selection persists per conversation

## Performance Considerations
- Keep main thread light—stream parsing should be incremental.
- Avoid large synchronous loops in render pass.
- Debounce expensive derived calculations.

## Opening a Pull Request
Checklist:
- [ ] CI passes (lint, typecheck, build)
- [ ] No unused debug logs left
- [ ] Export/import unaffected or migration added
- [ ] Security-sensitive changes documented
- [ ] Screenshots/GIFs for UI changes

## Issue Reporting
For bugs include:
- Environment (OS, Node, App version)
- Steps to reproduce
- Expected vs actual
- Logs (console & any error dialogs)

## Release Process
1. Ensure CHANGELOG (if added later) or PR titles capture changes.
2. Run `npm run dist` (or CI workflow if added).
3. Draft GitHub Release with notes + attach artifacts (or enable auto-publish).

## License Notes
By contributing you agree your contributions fall under the same license as the project.

---
Thanks for making this project better! 🚀
