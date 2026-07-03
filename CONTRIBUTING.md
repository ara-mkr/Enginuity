# Contributing to ENGINGUITY

Thanks for your interest in contributing! ENGINGUITY is an AI-powered
engineering workspace built with React, Vite, and TypeScript, and we welcome
contributions of all sizes — from typo fixes to new modules.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Git

### Setup

```bash
git clone https://github.com/<your-org>/enginguity.git
cd enginguity
npm install
npm run dev
```

The app runs at `http://localhost:5173`. For the desktop (Electron) build:

```bash
npm run electron:dev
```

### Project structure

- `src/` — application source (~33 feature modules)
- `electron/` — Electron main process
- `public/` — static assets
- `scripts/` — build/dev tooling

If you're new to the codebase, start by reading the module you intend to
touch rather than the whole tree — most features are self-contained under
`src/`.

## Development Workflow

1. **Fork** the repo and create a branch off `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. **Make your changes.** Keep commits focused and scoped to one logical
   change.
3. **Run checks locally** before opening a PR:
   ```bash
   npm run lint       # ESLint
   npm run build       # tsc -b + vite build (typecheck + build)
   npm run test:run     # Vitest
   ```
4. **Open a pull request** against `main` using the PR template. Link any
   related issue.

All of the above also run in CI on every PR — a green local run means a
green CI run.

## Commit Messages

Use clear, imperative commit messages (e.g. `Fix Jarvis canvas stale
closure`, not `fixed bug`). If your change is user-facing, explain the *why*
in the body, not just the *what*.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR. Large, unrelated changes are
  hard to review and slow to merge.
- Include screenshots or a short clip for UI changes.
- Update relevant documentation if behavior changes.
- Make sure `npm run lint`, `npm run build`, and `npm run test:run` all pass.
- Be responsive to review feedback — a PR that goes stale for weeks may be
  closed and can always be reopened later.

## Design System (Polaris)

ENGINGUITY uses an internal design system called **Polaris**: a near-black
dark palette with a steel-blue accent (`#94a5ba`), Geist/Geist Mono
typography, and a minimal aesthetic (no glow effects, no colored status
badges). If you're contributing UI, please match existing components rather
than introducing new visual patterns — check `src/` for existing examples
before adding custom styling.

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.yml) when
filing issues. Include:

- Steps to reproduce
- Expected vs. actual behavior
- Environment (browser or Electron version, OS)
- Console errors, if any

## Suggesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.yml).
Explain the problem you're trying to solve, not just the solution — it helps
us evaluate fit with the project's direction.

## Security Issues

Please **do not** open a public issue for security vulnerabilities. See
[SECURITY.md](SECURITY.md) for how to report them responsibly.

## License

By contributing, you agree that your contributions will be licensed under
the project's [MIT License](LICENSE).
