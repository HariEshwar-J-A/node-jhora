# Deno quickstart

Build with pnpm first (TypeScript project references). Import the built ESM bundle from the workspace (or from npm after publish):

```bash
pnpm install --frozen-lockfile
pnpm build
deno run --allow-read --allow-env tools/runtime-smoke-deno.mjs
```

For your own script, point Deno at `packages/core/dist/index.js` (or `npm:@node-jhora/core`) after `pnpm build`, with `--allow-read` for the ephemeris kernel path or bytes passed to `initialize({ kernel })`. Ephemeris data resolves via `npm:@node-jhora/ephe` or `NODE_JHORA_EPHE_PATH`.
