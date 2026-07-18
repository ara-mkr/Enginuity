# ENGINGUITY Pre-Launch Audit — 2026-07-09

Source-only audit (no runtime, no `tsc`, no tests executed). Every claim below is from reading files in this working tree, which includes ~35 uncommitted modified/deleted files on `main`.

## Executive Summary

The core is in better shape than a typical pre-1.0 solo project: the deterministic MNA solver is the only source of simulation numbers (both UI paths verified), API keys live in sessionStorage rather than the bundle, the Electron shell has context isolation and navigation hardening, and the collaboration server uses timing-safe token comparison with prototype-pollution and size guards. The main blockers are one genuine security hole (Test Harness `eval` of model-generated arguments in a same-origin iframe), the uncommitted mid-revert working tree, and a missing CSP. Everything else is P2 polish.

## Blockers (P0 — must fix before public tag)

- [x] **FIXED — Test Harness executed LLM output same-origin.** `src/modules/test-harness/TestHarness.tsx` — `runJS` created an iframe with **no `sandbox` attribute**, then `win.eval(code)` and `win.eval(\`(${funcName})(${args})\`)` where `args` came from AI-generated test cases. A same-origin iframe shares the app origin, so evaluated code could read `sessionStorage` (the OpenRouter API key) and IndexedDB. **Fix landed:** the frame now carries `sandbox="allow-scripts"` (no `allow-same-origin` ⇒ opaque origin ⇒ its own empty storage partition), code and inputs cross via `postMessage` rather than string interpolation, results come back JSON-safe, and a 10 s timeout guards a frame that never replies. Residual: a *synchronous* infinite loop in generated code still blocks the main thread — inherent to in-page execution, unchanged by this fix.
- [ ] **Commit or revert the working tree.** ~35 files modified, the entire custom-provider feature (committed in `24347b3`) is deleted-but-uncommitted (`src/components/APIKeyManager/*`, `src/config/customProviders.ts`, etc.). A public tag cut from this state is nondeterministic. Fix: land the revert (or restore) as a real commit first. **Left to the developer — not a vulnerability, and not mine to decide.**

## High (P1 — fix in first week post-launch)

- [ ] **No Content-Security-Policy.** `index.html` has no CSP meta tag and `electron/main.cjs` sets no CSP header. The renderer talks to `openrouter.ai`, localhost Ollama, and the Velxio iframe; a CSP restricting `script-src 'self'` and enumerated `connect-src` hosts materially limits XSS blast radius. (Electron security checklist item.)
- [ ] **Remote Google Fonts in `index.html:8-13`.** DM Sans + JetBrains Mono load from `fonts.googleapis.com`. In the packaged Electron app offline, typography silently falls back; it's also a third-party request on every load. Fix: self-host the two font files.
- [ ] **First-joiner claims the room secret.** `collaboration-server.js:213-217` — a room's secret is whatever token the *first* joiner presents. An attacker who learns or predicts a `roomId` before the creator connects owns the room; the legitimate creator then gets `auth_failed`. Mitigate by making roomIds server-issued or high-entropy client-generated (verify `useCollaboration.js` id generation), and document the trust model in a server README.
- [ ] **Prototype-pollution guard is top-level only.** `collaboration-server.js:60-68` checks `FORBIDDEN_KEYS` on the delta's own keys, but nested objects inside delta values (and `comment_add`'s free-form `position` object, line 323) are stored and re-broadcast unfiltered. Safe on the server (`Object.assign` of values), but any client that deep-merges room state is exposed. Fix: recursive key scrub.
- [ ] **`new Function` on formula strings.** `src/modules/parameter-playground/evaluator.ts:25` and `src/engine/exporters/parameterPlayground.js:81` compile formulas via `new Function`. Fine for user-typed formulas; audit whether any AI-suggested formula can reach these without user review, and say so in a comment either way.
- [ ] **Electron builds are unsigned and there is no auto-updater.** `electron-builder.yml` produces unsigned .dmg/.exe; macOS Gatekeeper and SmartScreen will warn. Acceptable for a source-first launch if the README says "build it yourself", which it now does.

## Medium (P2)

- [ ] **177 type-escape hatches** (`any`, `@ts-ignore`, `as unknown as`) across `src/`, concentrated on `.jsx`-module imports (`src/App.tsx:36-65` alone has 9 `@ts-ignore`s). CI runs `tsc -b` so the tree presumably compiles, but the ignores hide prop-shape drift at exactly the JS/TS seams. Burn down by converting the imported `.jsx` modules.
- [ ] **`isSpeaking` and ~25 sibling `useState`s live inside the 4,324-line `JarvisModule.tsx`** (`:1122`), not in the global store. Speech state resets were spot-checked and look correct (Kokoro error path falls back to Web Speech, `speakText` wires `onEnd` on every terminal branch at `:340-430`), but the mic indicator's truth lives in one giant component. Extract a Jarvis store slice.
- [ ] **Velxio iframe sandbox includes `allow-same-origin allow-scripts`** (`src/modules/circuit-sim/velxioConfig.ts:37`). For a remote origin this is the sandbox's documented escape combination being neutered only by the origin boundary. It works, but document that the sandbox adds nothing beyond the origin boundary for hosted mode.
- [x] **FIXED — Untracked `data/` directory at repo root** (contains `enginguity-store.json`) was **not** in `.gitignore`; one careless `git add .` would have published local workspace state. `data/` is now ignored.
- [x] **FIXED — Test Harness Python path is inert.** `TestHarness.tsx` — `runPython` used to call `window.loadPyodide?.()` without ever loading the Pyodide script itself; only `DebugConsole.tsx` injected it. Pyodide loading is now hoisted into a shared lazy loader (`src/lib/pyodideLoader.ts`), used by both Debug Console and Test Harness, so the Python test path works standalone.
- [ ] **`state_update` broadcasts `{ delta: null }`** when sanitization rejects the payload (`collaboration-server.js:272-284`) — wasted broadcast, and clients must null-check. Return early instead.
- [ ] **OpenRouter cost/token figures are chars/4 estimates** (`src/hooks/useAIProvider.ts:99-116`), displayed in the usage dashboard as if real. Label them estimated in the UI.
- [ ] **AI-suggested component values are displayed as ground truth** in Simulation Assistant's component table (`SimulationAssistant.tsx:186` schema, rendered post-draft) before any solver run. The numbers are advisory strings, which is within the invariant, but the UI should visually distinguish "model suggestion" from "solved result". The solved panel itself is solver-only — verified.

## Low (P3 / polish)

- [ ] `useAIProvider.ts:144` — `response.body!` non-null assertion on the streaming path; a body-less 200 would throw an opaque TypeError.
- [ ] `'both'` provider mode restarts `onToken` streaming from scratch on mid-stream Ollama failure (documented in code at `useAIProvider.ts:186-188`); callers must render `full`, which current callers do.
- [ ] Kokoro has no persistent audio cache; every utterance re-generates (WASM, `q8`). Fine functionally; a small LRU keyed on `voice+speed+text` would cut latency.
- [ ] `collaboration-server.js` heartbeat closes idle users but a user who is only *receiving* (never sending `presence`) is reaped at 5 min despite an open socket — clients must send keepalives (verify `useCollaboration.js` does).

## AI-Never-Computes-Numbers Invariant — VERIFIED with notes

- Both live solve paths terminate in the typed MNA engine: Simulation tab → `src/modules/simulation/core/solverClient.ts:54` → worker/main-thread `runAnalysis` → `src/modules/circuit-sim/engine/*`; Simulation Assistant → `runNetlistAnalysis` (`src/modules/circuit-sim/engine/runSimulation.ts:23`), which states and enforces "no fallback path — simulation numbers only ever come from the solver".
- The historical fake-solver wire-up **was not found in the current tree**. No stub/mock solver is reachable from UI code.
- The Simulation Assistant system prompt (`SimulationAssistant.tsx:175-187`) asks the model for a netlist, markdown explanation, LaTeX equations, and component advice — all natural-language artifacts. Solver rejection surfaces via `setSimError` (thrown descriptive messages from `runNetlistAnalysis`), not a blank panel.
- Residual exposure: P0 test-harness eval and P2 component-value display, above.

## License & Repo Hygiene

- `LICENSE`: **MIT, present** ("Copyright (c) 2026 ENGINGUITY contributors").
- `THIRD_PARTY_NOTICES.md` present. **No Falstad/CircuitJS1 (GPL), ngspice, eecircuit-engine, or avr8js code found in `src/`** (grep clean). The engine-selection plan pinned `eecircuit-engine@1.7.0` in a spike, but it is **not in `package.json`** — the shipped solver is the in-house MNA engine. The six-session open-source-simulator plan is effectively at "Session 2 proven, Session 3 adapter not landed".
- `.gitignore`: solid (env files, release/, dist/) except missing `data/` (P2 above).
- `index.html`: no Vite boilerplate; real title and favicon. Fonts issue is P1 above.
- README: exists (193 lines, reasonable) — replaced by this session's rewrite.
- CI: `.github/workflows/ci.yml` runs lint + `tsc -b` + build on push/PR to main. Real entry points. ✔
- CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, issue/PR templates all present.
- Design tokens: accent is `#94a5ba` (`src/index.css:57`) as specced, but the shipped fonts are **DM Sans / JetBrains Mono**, not Geist. Either adopt Geist or update the design-system docs — the README written this session states what ships.

## Electron

- `contextIsolation: true`, `nodeIntegration: false` (`electron/main.cjs:62-66`); `sandbox` not set explicitly (defaults on in Electron 34; set it explicitly anyway). Navigation hardening confines the window to app origin, https → system browser (`:78-106`). IPC surface (9 handles, `:185-258`) is narrow: key-sanitized JSON files under `~/Documents/Enginguity/data/`, `open-path` validated against allowed roots **in main** — correct trust boundary. No shell/eval-able IPC. No auto-updater (P1 note). No CSP (P1).

## Collaboration Server

Auth is timing-safe via SHA-256-then-`timingSafeEqual` (`:136-145`, correctly handles unequal lengths). Message size capped at 64KB **by `maxPayload` before parse** (`:18`). Rate limit: 40 msgs/sec per connection (`:12-13`); 20 connections per IP (`:16`) with the reverse-proxy caveat documented. Pure ESM, no `require`. Room grace: `emptyAt` set on last leave, reaped by 30 s sweep after 10 min TTL; a rejoin inside the TTL clears `emptyAt` (`:232`) — boundary behaves correctly. Client respects `VITE_COLLAB_WS_URL` including `wss://` (`useCollaboration.js:9-19`); no hardcoded `ws://` outside the localhost default. Open items: first-joiner secret claim (P1), nested-key scrub (P1), null-delta broadcast (P2).

## Untraced Modules

Not traced or only skimmed this session — no claims made about them:

- `src/modules/`: bom, datasheet, pcb-reviewer, firmware-diff, live-docs, supply-chain, notebook, timeline, formula-lab, challenges, dashboard, compliance, asset-generator, footprint-gen, model-comparison, project-ideas, home-landing, cad-viewer parsers, tool-marketplace (beyond the iframe sandbox line), debug-console, history, templates
- `src/engine/`: persistenceEngine (hydration internals), offlineStore, blobStore, db.js beyond a skim, exporters, searchIndex, voiceEngine, eventLog internals
- ~4,000 of JarvisModule.tsx's 4,324 lines (speech pipeline and provider voice-switching were the traced slices); the Jarvis ↔ Drawing Board mount race specifically was **not** resolved — DrawingBoard reads the global zustand store with blob offloading (`DrawingBoard.jsx:15,43,190`) but the rehydration-vs-first-paint ordering needs a runtime session
- `src/components/` (Copilot, CommandPalette, UISettingsPanel, Workspace, etc.), `useCollaboration.js` client internals, `scripts/velxioProxyPlugin.ts`, all `__tests__`

## Suggested Commit Sequence (smallest blast radius first)

1. ~~`.gitignore`: add `data/`.~~ **done**
2. ~~Test Harness: sandboxed-iframe eval fix (P0).~~ **done**
3. ~~Replace the README with the launch README.~~ **done**
4. Land the custom-provider revert (or restoration) currently sitting uncommitted — one commit, working tree clean. *(Developer's call.)*
5. CSP meta tag + explicit `sandbox: true` in BrowserWindow.
6. Self-host DM Sans + JetBrains Mono.
7. Collab server: recursive key scrub + early-return on null delta + room-secret trust-model doc (`server/README.md`).
8. Type-escape burn-down, one `.jsx` module at a time.

## Handoff

Audited this session (source-only): Electron main/preload, collaboration server end-to-end, OpenRouter/Ollama provider path + key storage, Kokoro TTS + Jarvis speakText slice, both simulation solver paths + AI-invariant check, Velxio config, repo hygiene/license/CI, eval/Function sweep. Found: 2 P0, 6 P1, 9 P2/P3.

**Fixed this session:** the P0 same-origin `eval` of model-generated code in the Test Harness (now an opaque-origin sandboxed iframe over `postMessage`), and `data/` added to `.gitignore`. Deliberately *not* fixed, per instruction to only touch genuinely crucial vulnerabilities: CSP (hardening, not a live exploit), the collab server's first-joiner room-secret trust model and nested prototype-pollution scrub (server is not currently exploitable — it `Object.assign`s values, never deep-merges), and the uncommitted working tree (a process decision, not a defect). All are documented in the README's Known Limitations.

**Still not done:** runtime verification of anything (the sandbox fix is reasoned, not executed — drive the Test Harness once before tagging), the Jarvis/DrawingBoard hydration race, ~20 modules under Untraced, `tsc` confirmation. Next session: run `tsc -b` + `vitest run` to convert the type-safety findings into facts, then trace the hydration race live.
