# Security Policy

## Supported Versions

ENGINGUITY is currently pre-1.0 and evolving quickly. Security fixes are
applied to the latest release on `main` only.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub
issues.**

If you discover a security vulnerability in ENGINGUITY — including but not
limited to issues affecting local data storage (IndexedDB), the Electron
desktop app (e.g. IPC, `contextIsolation`, `nodeIntegration` misconfiguration),
the collaboration server, or handling of AI provider credentials
(OpenRouter/Ollama API keys) — please report it privately:

- **Email:** security@enginguity.dev
- Alternatively, use [GitHub's private vulnerability reporting](https://github.com/<your-org>/enginguity/security/advisories/new)
  for this repository.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept code, if applicable)
- The affected version/commit
- Any suggested mitigation, if you have one

### What to expect

- **Acknowledgment** within 3 business days.
- We'll work with you to understand and validate the issue, and keep you
  updated as we develop and test a fix.
- **Disclosure**: we ask that you give us a reasonable window to ship a fix
  before any public disclosure. We'll credit you in the release notes
  (unless you'd prefer to remain anonymous).

## Scope

In scope:

- The ENGINGUITY web app and Electron desktop app (this repository)
- The bundled collaboration server (`collaboration-server.js`)
- Build tooling and scripts shipped in this repo

Out of scope:

- Vulnerabilities in third-party dependencies (please report upstream, but
  feel free to flag them to us too — we'll track the update)
- Issues requiring physical access to a user's device
- Social engineering attacks

## Handling of API Keys / Credentials

ENGINGUITY connects to AI providers (OpenRouter for cloud inference, Ollama
for local inference). API keys are stored client-side. If you find a way
keys could leak (e.g. via logs, IPC, or network requests to unintended
hosts), please treat it as a security report per the process above.

Thank you for helping keep ENGINGUITY and its users safe.
