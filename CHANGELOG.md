# Changelog

All notable changes to this project will be documented in this file.

The format roughly follows Keep a Changelog principles.

## [Unreleased]
_Placeholder section for upcoming changes._

## [0.1.3] - 2025-10-03
_Placeholder section for upcoming changes._

## [0.1.2] - 2025-10-03
_Placeholder section for upcoming changes._

## [0.1.0] - 2025-10-03
Initial public release.

### Added
- Electron desktop client scaffold (Electron + Vite + React + Tailwind)
- Secure encrypted API key storage using Electron safeStorage
- Streaming chat with abort/cancel support
- Conversation persistence in IndexedDB (conversations & messages)
- Token estimation and trimming heuristics (windowing oldest messages)
- Conversation sidebar with per-conversation model lock
- Model listing + selection; image generation request support
- Retry mechanism for failed user messages
- Export / Import (JSON schema v1) with merge + validation
- Dark mode UI with markdown rendering (sanitized) & code blocks
- Immediate send on Enter, Shift+Enter for newline
- Packaging configuration (mac dmg/zip, win nsis, linux AppImage/deb)
- Governance: CI workflow (typecheck, lint, build), CodeQL, Dependabot
- Repository docs: README, Code of Conduct, Contributing, Security Policy
- Issue & PR templates, EditorConfig, ESLint flat config

### Removed
- Legacy SQLite layer (replaced by IndexedDB persistence)

### Security
- Sanitized markdown (rehype-sanitize + DOMPurify)
- Minimal IPC surface via preload bridge

[0.1.0]: https://github.com/AshkanHovold/openrouter-desktop/releases/tag/v0.1.0
