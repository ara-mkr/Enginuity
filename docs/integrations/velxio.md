# Velxio Circuit Simulator Integration

Enginguity's Circuit Simulator route (`/circuit-sim`) hosts Velxio as the simulator experience. Enginguity does not vendor Velxio source, implement a circuit engine, or pass Enginguity auth/session data into the iframe.

## Local Development

Easiest path — one command starts both Velxio and Enginguity together, and stops both on Ctrl+C:

```bash
npm run dev:all
```

(`npm run dev:all:down` tears down the Velxio container afterward if it's still running.)

Or run them separately: start Velxio as a container first,

```bash
docker compose -f docker-compose.velxio.yml up -d
```

Velxio will be available at:

```text
http://localhost:3080
```

Then start Enginguity:

```bash
npm run dev
```

Open Enginguity and choose Tools / Circuit Simulator. In Vite dev, Enginguity defaults to `http://localhost:3080` when `VITE_VELXIO_URL` is not set.

Velxio intentionally keeps its own origin/port rather than being reverse-proxied onto Enginguity's — see Security Notes below.

### No Docker? The dev proxy fallback

If nothing answers on port 3080 (for example, Docker is not installed), plain `npm run dev` still gives you a working simulator: the Vite plugin `scripts/velxioProxyPlugin.ts` starts a loopback-only reverse proxy at `http://127.0.0.1:3081` that forwards to the hosted `https://velxio.dev` and strips its `X-Frame-Options`/`frame-ancestors` headers so the iframe embed works. The Circuit Simulator tries the Docker service first and falls back to the proxy; the status badge reads `Hosted (dev proxy)` when the fallback is active.

Notes on the dev proxy:

- Dev-only. It never runs in production builds, `vite preview`, or Electron builds — those still require `VITE_VELXIO_URL` (or the opt-in hosted fallback).
- Simulation traffic goes to the public velxio.dev instance while it is active.
- Disable it with `VITE_VELXIO_DEV_PROXY=false`, or move it with `VITE_VELXIO_DEV_PROXY_PORT`.
- A running Docker Velxio always wins the source order, and the proxy leaves its port alone if something else already holds it.

To run Velxio without compose:

```bash
docker run -d \
  --name enginguity-velxio \
  -p 3080:80 \
  -v velxio-data:/app/data \
  -v velxio-arduino-libs:/root/.arduino15 \
  -v velxio-arduino-user-libs:/root/Arduino \
  -v velxio-ccache:/var/cache/ccache \
  -v velxio-build:/var/lib/velxio-build \
  ghcr.io/davidmonterocrespo24/velxio:master
```

## Configuration

Use Vite-exposed environment variables for browser-safe integration settings:

```bash
VITE_VELXIO_URL=http://localhost:3080
VITE_VELXIO_ALLOW_HOSTED_FALLBACK=false
VITE_VELXIO_HOSTED_URL=https://velxio.dev
VITE_VELXIO_EMBED_MODE=iframe
VITE_VELXIO_HEALTHCHECK_PATH=/
VITE_VELXIO_ENABLE_NEW_TAB_FALLBACK=true
```

Optional iframe controls:

```bash
VITE_VELXIO_IFRAME_SANDBOX="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals allow-pointer-lock"
VITE_VELXIO_IFRAME_ALLOW="clipboard-read; clipboard-write; fullscreen"
```

Do not put credentials, tokens, or Enginguity session data in the Velxio URL. The URL is rendered in the UI and is used directly by the browser iframe.

## Availability Behavior

The app has no server/API layer, so the route uses a client-side reachability check plus iframe load timeout instead of a server-side `/api/integrations/velxio/health` endpoint.

Behavior:

- If Velxio is reachable, the iframe loads the selected Velxio URL.
- If the self-hosted URL is unavailable and hosted fallback is enabled, Enginguity tries `VITE_VELXIO_HOSTED_URL`.
- If no source is configured or reachable, the page shows a setup/unavailable state with retry and open-in-new-tab actions.
- Local dev defaults to `http://localhost:3080`; production builds should set `VITE_VELXIO_URL`.

## Security Notes

The iframe uses a sandbox scoped for Velxio's browser simulator:

```text
allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals allow-pointer-lock
```

`allow-same-origin` is included because Velxio needs its own browser origin for storage, WebAssembly, Monaco, downloads, and related simulator behavior. Prefer a distinct Velxio origin such as `http://localhost:3080` or `https://velxio.example.com` instead of a same-origin app path unless a reverse-proxy integration has been reviewed.

The iframe uses `referrerPolicy="no-referrer"` and does not receive Enginguity auth tokens. No `postMessage` bridge is currently implemented.

For HTTPS Enginguity deployments, serve Velxio over HTTPS as well. Browsers may block an HTTP Velxio iframe on an HTTPS Enginguity page except for loopback development.

If Enginguity later adds CSP headers, update only the frame policy needed for the configured Velxio origin, for example `frame-src https://velxio.example.com`.

## Legal / Attribution

Velxio is licensed under GNU AGPLv3, with a commercial license option from the upstream author. Enginguity currently integrates Velxio as a separately hosted service/container and does not distribute Velxio source or assets.

TODO/legal: Confirm AGPLv3/commercial-license compliance before production release if Enginguity is closed-source or proprietary.

See `THIRD_PARTY_NOTICES.md` for the attribution entry.

## Manual Verification

1. Run `docker compose -f docker-compose.velxio.yml up -d`.
2. Run `npm run dev`.
3. Open the Circuit Simulator tab.
4. Confirm the page says `Powered by Velxio` and embeds the Velxio simulator.
5. Use `Open in new tab` and confirm it opens the configured Velxio URL.
6. Stop Velxio with `docker compose -f docker-compose.velxio.yml stop velxio`.
7. Refresh the Circuit Simulator tab.
8. Confirm Enginguity shows the unavailable state instead of a blank iframe.
9. Restart Velxio with `docker compose -f docker-compose.velxio.yml up -d`.
10. Click Retry and confirm the simulator loads again.
