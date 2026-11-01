# node-jhora documentation

Canonical prose lives under this directory and is synced into the [Starlight site](../apps/docs) at build time (`pnpm run docs:build`).

## Layout

| Path                                   | Contents                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| [getting-started/](./getting-started/) | Install and first chart (Node, Bun, Deno, edge, browser)                                  |
| [guides/](./guides/)                   | Deep dives: core engine, API usage, server deployment, data, goldens, CSV import, lint, … |
| [reference/](./reference/)             | Pointers to generated API reference (TypeDoc + `etc/*.api.md`)                            |
| [accuracy.md](./accuracy.md)           | Measured floors vs JPL Horizons / IERS (from golden tests)                                |
| [architecture.md](./architecture.md)   | Monorepo packages, engine stack, CI                                                       |
| [performance.md](./performance.md)     | Bench harness, baselines, worker throughput                                               |
| [decisions/](./decisions/)             | Architecture decision records (ADR 0001–0033)                                             |

## Clean room

Product docs describe algorithms and **reference oracles** (fixtures, Horizons, black-box exports). They do not cite proprietary desktop source code. See [guides/clean-room.md](./guides/clean-room.md).

## License

Source in this repository is **source-available** under the root [LICENSE](../LICENSE). Production use requires a commercial license from the owner; see package READMEs.
