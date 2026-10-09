# mesh-portal

Unified read view for the mesh: sessions, nodes, findings, certs — one
glance, zero new authority. Vite + React + TS, GitHub Pages friendly.

## Model (from receipts-ocr, verified portable)

- `src/config.ts`: backend origins derived from `window.location.hostname`
  (Pages → loopback fail-fast + onboarding; localhost → loopback ports;
  LAN/mesh → same host). No config, works everywhere.
- Health probes poll `/api/rev` per backend (10s, quiet 60s backoff when
  absent — browsers log every failed fetch, so frequency is the only
  console-spam lever). Advanced views mount only when healthy.
- No secrets in the bundle: read APIs only, no Basic auth, no tokens.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite -> dist/
npm run preview  # serve dist on :4173
npm test         # playwright vs preview (backend-absent assertions)
```

## Backend contract (mesh-api.py + dashboard read APIs)

- `GET /api/rev` → any 2xx JSON (health).
- `GET /api/mesh` → `{available, nodes, peers, findings}` (503-style
  `{available:false}` when the node has no inventory).
- Dashboard `:5099` read APIs as listed in `docs/ANYWHERE.md`.
