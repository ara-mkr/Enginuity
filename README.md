# ENGINGUITY

An AI-powered engineering workspace — one app for CAD, circuits, firmware, BOM, and documentation, with a local-first infinite-canvas assistant at its core.

<!--
  Replace this with a real capture before publishing:
  ![ENGINGUITY demo](docs/hero.gif)
-->
`[ hero GIF placeholder — record a 15–30s walkthrough of Jarvis + one other module, save as docs/hero.gif ]`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What is this?

ENGINGUITY is a workspace for engineers that bundles the tools you'd otherwise juggle across a dozen tabs — CAD viewing, circuit simulation, PCB review, BOM sourcing, firmware diffing, documentation — into a single app, with AI woven into each one. It runs in the browser or as a desktop app (Electron), and works with either cloud models (via OpenRouter) or fully local models (via Ollama), so you can keep proprietary designs off the network entirely.

At the center is **Jarvis**, a voice-controlled infinite canvas for thinking out loud, sketching ideas, and pulling other modules into the same space.

## Quick start

```bash
git clone https://github.com/<your-org>/enginguity.git
cd enginguity
npm install
npm run dev
```

Open the printed local URL. No backend is required for the core app — AI features are inert until you connect a provider (see [AI providers](#ai-providers) below).

### Running as a desktop app

```bash
npm run electron:dev      # dev, with hot reload
npm run electron:build    # production build for your current OS
```

## Features

Modules are organized into a sidebar you customize — install what you need from the built-in set or the Tool Marketplace, hide the rest.

### Core
- **Jarvis** — voice-controlled infinite-canvas workspace; the AI-native home base for a project
- **Dashboard** — project status, recent activity, and key metrics
- **Version History** — snapshots and rollback across project state
- **Project Timeline** — chronological view of milestones and events
- **Debug Console** — internal logs, telemetry, and AI request inspection
- **Tool Marketplace** — browse, install, and share community tools (JSON manifests, sandboxed)

### Mechanical
- **CAD Viewer** — load and inspect 3D models (STL, STEP, and more) via Three.js
- **Parameters** — live-tweak design parameters and watch downstream effects propagate

### Electrical
- **Circuit Sim** — a JavaScript-native, SPICE-like schematic editor:
  - natural-language → AI-parsed netlist
  - MNA-based operating-point solver
  - analytical transient response (RC, RL, RLC)
  - AC frequency sweep / Bode plots
  - SVG schematic renderer with zoom/pan, plus AI circuit analysis and design review
- **PCB Reviewer** — AI critique of PCB layouts
- **Footprint Gen** — generate IPC-7351 PCB footprints with KiCad export
- **Datasheet** — extract structured, queryable knowledge cards from component datasheets

### Firmware
- **Firmware Diff** — compare firmware revisions semantically across HEX, BIN, ELF, and ZIP

### AI
- **Asset Gen** — generate images and diagrams from prompts
- **Simulation Assistant** — AI assistant for setting up engineering simulations
- **Project Ideas** — AI-generated project concepts and feasibility starting points
- **Model Compare** — run the same engineering prompt across multiple AI providers simultaneously, with side-by-side streaming responses, semantic diff highlighting, an AI meta-analysis panel, cost/token/latency estimates, and Markdown-exportable history
- **Formula Lab** — interactive engineering formula calculator with units
- **Challenges** — gamified engineering challenge mode

### Documentation
- **Notebook** — engineering lab notebook with timestamped entries
- **Templates** — reusable project and document templates
- **Live Docs** — live, data-bound project documentation
- **Drawing Board** — freehand sketching and annotation canvas

### Supply Chain
- **BOM Intel** — bill-of-materials management with AI sourcing intelligence
- **Supply Chain** — monitor BOMs for part availability, pricing, and lead-time changes

### Quality
- **Test Harness** — AI-generated tests for Python and JavaScript functions
- **Compliance** — identify required certifications, cost, and timeline for a product

### Collaboration
- **Collaborate** — multi-user presence and shared state over WebSockets *(see [scoping note](#collaboration-a-local-prototype) below)*

## AI providers

ENGINGUITY talks to two kinds of model providers, switchable per-session from the model picker.

### OpenRouter (cloud)

Gives you access to frontier models (Claude, GPT, Gemini, and more) through a single API key. Add your key from the in-app **API Key Manager** — it's stored locally, never sent anywhere except OpenRouter.

### Ollama (local)

Run models entirely on your own machine — free, private, offline, no API key.

1. [Install Ollama](https://ollama.com)
2. Pull a model:
   ```bash
   ollama pull qwen2.5:7b
   ```
3. Start Ollama (`ollama serve`, or it's already running if installed as a service) — ENGINGUITY auto-detects it at `http://localhost:11434`
4. Select **Local** in the model picker

Recommended models by use case:

| Use case | Model | Size | Min RAM |
|---|---|---|---|
| General engineering | `qwen2.5:7b` | 4.7GB | 8GB |
| Firmware / coding | `qwen2.5-coder:7b` | 4.7GB | 8GB |
| Reasoning-heavy analysis | `deepseek-r1:7b` | 4.7GB | 8GB |
| Low-RAM machines | `llama3.2:3b` | 2.0GB | 4GB |
| Best local quality (needs a GPU) | `qwen2.5:32b` | 19GB | 24GB |

Rough inference speed by hardware: Apple Silicon (M1–M4) and 8GB+ NVIDIA GPUs land around 20–80 tok/s; AMD GPUs around 15–40 tok/s; CPU-only is usable but slower at 3–10 tok/s.

If ENGINGUITY runs on a different port than Ollama's default, start Ollama with CORS opened up:

```sh
OLLAMA_ORIGINS="*" ollama serve       # macOS / Linux
set OLLAMA_ORIGINS=* && ollama serve  # Windows
```

When using Ollama, nothing leaves your machine — designs, BOM data, and notebook entries stay fully local.

## Collaboration

The **Collaborate** module is a lightweight real-time layer. `collaboration-server.js` (run with `npm run collab`) is a WebSocket server that broadcasts cursor position, shared parameter state, and pinned comments between clients in the same room, identified by a `?room=XXXX-XXXX&token=...` URL — the token is a per-room shared secret generated on the client and required by the server to join or rejoin that room, so a room can't be joined by guessing its (short, shareable) id alone. A standalone demo without a build step is available at `collab-standalone.html` after `npm run dev`.

The server also caps message size (64KB), room state size (2MB), users per room (50), and messages per second per connection, and rejects malformed or prototype-polluting payloads. Note that the room token lives in the shareable URL (`?room=...&token=...`) — treat that link like a password: anyone who has it can join, and it can end up in browser history or a proxy's access logs if shared over plain HTTP.

By default the server listens on plain `ws://localhost:3001`, which is fine for local/LAN use. For a public deployment, put it behind a reverse proxy that terminates TLS and exposes it as `wss://`, then point the client at it with an environment variable at build time:

```sh
VITE_COLLAB_WS_URL=wss://collab.example.com npm run build   # full URL override
# or, if you're only changing the port on the same host as the page:
VITE_COLLAB_WS_PORT=8443 npm run build
```

With neither variable set, the client falls back to `wss://<page host>:3001` on HTTPS pages (avoiding the mixed-content block) or `ws://localhost:3001` in local dev.

What it isn't: room state lives in memory only and is lost on server restart, and there's no conflict resolution beyond last-write-wins. It's suited to pairing on a local network, a trusted LAN, or a single-process deployment behind a TLS proxy — not a CRDT-backed, horizontally-scaled collaborative editor.

## Tech stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **State**: Zustand, persisted to localStorage (mirrored to disk in the desktop app); large binaries (photos, big SVGs, large sketchboards) offloaded to IndexedDB via `idb`
- **3D/CAD**: Three.js
- **Desktop**: Electron
- **AI**: OpenRouter (cloud) and Ollama (local), routed through a single provider abstraction

## Contributing

Issues and PRs are welcome. Please open an issue before large changes so we can align on scope.

## License

MIT — see [LICENSE](LICENSE).
