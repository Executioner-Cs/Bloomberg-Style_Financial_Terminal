# ADR-004: Local Development TLS with @vitejs/plugin-basic-ssl

**Status:** Accepted  
**Date:** 2026-04-15  
**Author:** Mayank Khandelwal

---

## Context

Production traffic is TLS-terminated at the Nginx edge (enforced by
`Strict-Transport-Security` headers per CLAUDE.md Part XIII). The local
development server (Vite on port 5173) was running plain HTTP, creating a
protocol mismatch: code written against HTTPS browser APIs (Secure cookies,
`navigator.credentials`, WebAuthn) would behave differently in dev than in
production.

Three options were considered:

### Option 1: `@vitejs/plugin-basic-ssl` (chosen)

Vite generates an ephemeral self-signed certificate in `node_modules` at startup.
No files to gitignore, no external tooling, works immediately after `pnpm install`.

- **Pro:** Zero setup friction, no binary dependencies, cert is ephemeral (no stale cert risk)
- **Con:** Browser shows "Not Secure" / certificate warning on first visit; developer
  must click "Accept" once per browser profile. Cert is not trusted by the system CA store.

### Option 2: `mkcert`

External CLI tool that creates a locally-trusted CA and installs it in the system
keystore. Browser shows no warnings after one-time setup.

- **Pro:** Clean browser UX, trusted cert, works across all localhost services
- **Con:** Requires installing an external binary (`mkcert`) not managed by `pnpm`;
  CA installation requires elevated privileges; adds an undocumented manual step that
  breaks `pnpm install && pnpm dev` as a single on-boarding path.

### Option 3: Manual self-signed certs

Developer generates cert/key via `openssl`, stores files locally, wires paths via env vars.

- **Pro:** Full control over cert lifetime and subject
- **Con:** Cert files must be gitignored (security) but paths must be documented;
  requires `openssl` on PATH; stale certs silently expire and break dev; highest friction.

---

## Decision

Use `@vitejs/plugin-basic-ssl` for local dev TLS.

Vite terminates TLS. The browser connects to `https://localhost:5173`. Vite's dev
server proxy forwards API calls to `http://localhost:8000` and WebSocket connections
to `ws://localhost:3001` — these are server-side proxy legs that the browser never
sees, so they remain HTTP/WS and require no cert changes on FastAPI or the WS gateway.

The only services that need CORS origin updates are those whose `Allow-Origin` response
headers must match `https://localhost:5173` (the origin the browser sends).

---

## Consequences

**Positive:**

- Dev environment matches production protocol (HTTPS)
- Mixed-content browser warnings eliminated
- Secure cookie attributes (`SameSite=Strict`, `Secure`) behave correctly in dev
- Single command on-boarding preserved: `pnpm install && pnpm dev`

**Negative / Mitigations:**

- Browser shows cert warning on first visit → developer clicks "Accept once". This is
  a one-time action per browser profile, documented in the project README.
- Certificate is ephemeral — regenerated each `pnpm install`. This is intentional;
  it prevents stale cert issues.

**Upgrade path:** If the cert warning becomes a friction point, migrate to `mkcert`.
Steps: install `mkcert`, run `mkcert -install && mkcert localhost`, set `SSL_CERT_FILE`
and `SSL_KEY_FILE` env vars, switch `vite.config.ts` `server.https` to read those files.
The CORS, `.env.example`, and proxy config changes in this ADR carry forward unchanged.

---

## Docker Internal Traffic

Container-to-container calls (`http://api:8000`, `redis://redis:6379`) are not affected.
Docker bridge networks are isolated; traffic never leaves the host and carries no
browser origin context. TLS on internal Docker traffic would add cert management
overhead with zero security benefit in the local dev threat model.
