# Contributing to node-jhora

See [CONTRIBUTING.md](../../CONTRIBUTING.md) at the repository root for the full workflow (pnpm, turbo, changesets, clean-room rules).

## Documentation

Edit Markdown under `docs/` and package READMEs. The Starlight site copies sources at build time — do not duplicate guides under `apps/docs/src/content/` by hand.

Run before opening a PR:

```bash
pnpm run check:links
pnpm run docs:build
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm build
pnpm test
pnpm run api:check
```

## License

Contributions are accepted under the terms of the root [LICENSE](../../LICENSE). You must have rights to submit the work; commercial deployment of the engine requires a separate license from the owner.
