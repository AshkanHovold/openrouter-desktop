<div align="center">
	<h1>OpenRouter Desktop</h1>
	<p><strong>Electron + Vite + React + Tailwind</strong><br/>A secure, local, multi-conversation desktop client for the <a href="https://openrouter.ai/" target="_blank" rel="noreferrer">OpenRouter</a> API.</p>
	<p>
		<a href="#features">Features</a> ·
		<a href="#getting-started">Getting Started</a> ·
		<a href="#development">Development</a> ·
		<a href="#packaging--releases">Packaging</a> ·
		<a href="#security">Security</a> ·
		<a href="#contributing">Contributing</a>
	</p>
</div>

---

## Features
| Area | Highlights |
|------|------------|
| Chat | Streaming responses (SSE) with cancel, auto‑scroll, retry on failure |
| Conversations | Multiple threads stored locally (IndexedDB); per-conversation model lock; deletion |
| Token Management | Heuristic token estimation & window trimming with usage/trim indicator |
| UI/UX | Dark mode, model badge, immediate send on Enter (Shift+Enter newline), settings menu, secure API key gate |
| Images | Text‑to‑image generation (JSON or HTML fallback parsing) |
| Security | Encrypted API key at rest with OS `safeStorage`; never sent to any server except OpenRouter |
| Resilience | Abortable streaming, retry failed user message, IndexedDB open retry logic |

Planned / In Progress:
- Export & import conversations (JSON schema)
- Release binaries for macOS / Windows / Linux
- Conversation search & filtering
- Better model metadata (context length, pricing display)

## Architecture Overview
Electron main is kept intentionally lean (window creation, theme toggle, encrypted key persistence, streaming & image IPC). All conversation state & history lives in the renderer (IndexedDB via `idb`). Communication crosses the sandbox only through the hardened `preload` bridge (contextIsolation enabled).

```
┌──────────┐        IPC (invoke/on)        ┌──────────────┐
│ Renderer │  <--------------------------> │   Main       │
│ React    │  stream events, key ops,     │ Electron     │
│ + idb    │  models list, image gen      │ safeStorage  │
└──────────┘                               └──────────────┘
```

## Data & Storage
| Item | Location | Notes |
|------|----------|-------|
| API Key (encrypted) | `app.getPath('userData')/api_key.enc` | OS encryption via `safeStorage` when available |
| Conversations | IndexedDB (`openrouter_client`) | `conversations` + `messages` stores |
| Theme | Native theme toggled / DOM `class=dark` | Persist handled by OS theme memory |

## Token Trimming
Messages are windowed just before sending: oldest messages are dropped until the estimated token total (heuristic) drops below the per-request cap. If still too large, only the newest user message is sent.

## Keyboard Shortcuts
| Action | Keys |
|--------|------|
| Send message | Enter |
| New line | Shift+Enter |
| Cancel streaming | Click Cancel button |

## Getting Started
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install
npm run dev
```
Open the Electron window, enter your OpenRouter API key (format `sk-or-...`), then start chatting.

## Development
| Script | Description |
|--------|-------------|
| `npm run dev` | Concurrent Vite (renderer) + Electron (watch) |
| `npm run build` | Production build (renderer + main) |
| `npm run dist` | Build app & create installer for current platform |
| `npm run dist:all` | Cross‑platform artifacts (mac, win, linux) from host (mac host required for mac codesign/notarize) |
| `npm run release` | Build + create & publish GitHub release (configure tokens) |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint over `src` |

## Packaging & Releases
Packaging uses `electron-builder` with config in `electron-builder.yml`.

Artifacts produced:
- macOS: `.dmg` & `.zip`
- Windows: NSIS installer `.exe`
- Linux: `.AppImage` and `.deb`

Adjust the GitHub `publish` owner/repo fields, then run:
```bash
npm run dist        # local artifacts only
npm run release     # build + publish (requires GH_TOKEN in env)
```

Environment variables for publishing:
```bash
export GH_TOKEN=ghp_your_personal_access_token
```

## Security
| Concern | Mitigation |
|---------|------------|
| API key leakage | Stored encrypted (if `safeStorage`) and never logged. Only sent to OpenRouter endpoints. |
| XSS in assistant output | Markdown sanitized via `rehype-sanitize` + `dompurify`. |
| IPC surface | Narrow, explicit handlers; no `remote` module. |
| Conversation persistence | Local only (IndexedDB). No cloud sync. |

Potential future hardening:
- Content-Security-Policy for production (inline scripts blocked)
- Signature / notarization setup for macOS & Windows code signing

## Contributing
1. Fork & clone
2. Create a feature branch
3. Add tests or minimal reproduction where applicable
4. Ensure `npm run typecheck && npm run lint` pass
5. Open a PR with a clear description & screenshots (if UI)

## Roadmap (Short Term)
- [ ] JSON export/import of conversations
- [ ] Release pipeline automation via GitHub Actions
- [ ] Model metadata (context length & pricing tooltip)
- [ ] Optional more accurate tokenizer plug-in

## Troubleshooting
| Issue | Fix |
|-------|-----|
| Vite port already in use | Close prior dev instance; port is pinned (strictPort). |
| IndexedDB LOCK errors | Ensure only one Electron instance; app retries automatically. |
| Streaming stalls | Check network / API key validity; retry message button appears on failure. |

## Attribution
All OpenRouter calls include `HTTP-Referer` & `X-Title` headers for leaderboard attribution. Update them in `src/main/main.ts` to match your fork.

## License
MIT © Contributors

---

> DISCLAIMER: This is a community desktop client for OpenRouter. Always review code paths that handle secrets before using in sensitive environments.
