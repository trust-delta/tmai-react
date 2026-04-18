# tmai-react

React frontend for [tmai-core](https://github.com/trust-delta/tmai-core) — the standard WebUI implementation.

Connects to `tmai-core` via the HTTP + SSE contract defined in [tmai-api-spec](https://github.com/trust-delta/tmai-api-spec). Any UI that speaks the same contract can be used as a drop-in replacement; fork this repo or build your own.

## Stack

- React 19 + TypeScript
- Vite (build) + Biome (lint/format)
- Tailwind CSS v4 (no shadcn/ui)
- xterm.js (terminal emulation)
- @xyflow/react (graph views)

## Development

```bash
pnpm install        # or: npm install
pnpm dev            # vite dev server
pnpm build          # production bundle → dist/
pnpm lint           # biome check
pnpm test           # vitest
```

The dev server expects `tmai-core` to be reachable. Point it at a running `tmai-core` instance via environment variables (see `vite.config.ts`).

## Contract

This frontend consumes:

- **HTTP REST API** — endpoints defined in [tmai-api-spec/openapi.json](https://github.com/trust-delta/tmai-api-spec/blob/main/openapi.json)
- **SSE event stream** at `/api/events` — `CoreEvent` payloads (JSON Schema forthcoming)

Forward-compatibility rule: **unknown `CoreEvent` variants MUST be ignored** so newer `tmai-core` versions don't break older UI builds.

## Building alternative UIs

`tmai-react` is one of several possible UIs. The contract is intentionally UI-agnostic — use Vue, Svelte, Solid, or anything else that speaks HTTP + SSE. Fork this repo as a starting point, or begin from scratch against `tmai-api-spec`.

## Status

This repo was extracted from the original [tmai](https://github.com/trust-delta/tmai) monorepo on 2026-04-18 as part of the [hybrid private core split](https://github.com/trust-delta/tmai-core) reorganization.

## License

MIT — see [LICENSE](LICENSE).
