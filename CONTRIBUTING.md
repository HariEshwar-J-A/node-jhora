# Contributing

Changes land on `main` through a pull request. Do not push commits to `main`.

One backlog task (or one sub-task) per pull request. Keep refactors separate from behavior changes. Aim for about 400 changed lines or fewer, excluding fixtures, goldens, and snapshots. Split anything larger along sub-tasks.

## Branches

Name branches `<type>/<ISSUE-ID>-<slug>`.

`type` is one of `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`. `ISSUE-ID` is the backlog ID. Example: `feat/E3-S1-T2-sunrise-solver`.

## Pull requests

Title format: `type(scope): summary [ID]`

Example: `chore(repo): PR template, issue templates and CODEOWNERS [E1-S5-T2]`

Use `.github/pull_request_template.md`. Put the GitHub issue in `Closes #<n>` and the backlog ID on that same line.

Squash merge. The squash commit title is the pull request title. Keep `main` linear: required checks green, and the branch up to date before merge.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): summary
```

Types match the branch types above. A breaking change uses `type(scope)!: summary`.

## Issues

Use the forms in `.github/ISSUE_TEMPLATE/` for an epic, story, task, or bug. Each form asks for context, goal, acceptance criteria, files likely touched, test requirements, dependencies, and size.

## Package manager

pnpm workspaces. The globs live in `pnpm-workspace.yaml`: `packages/*` and `apps/*`. `apps/` may be absent; the glob stays so a later app is picked up without another install-config change. pnpm is pinned with the `packageManager` field. Corepack (shipped with Node) installs that exact version:

```bash
corepack enable
corepack prepare --activate
pnpm install --frozen-lockfile
```

pnpm 12 needs a recent Corepack. The Corepack 0.34 bundled with Node 22.21 downloads pnpm 12.15.0 but cannot start it (`Cannot find module …/bin/pnpm.cjs`). Corepack 0.36 works. Update it with `npm install -g corepack@latest`, then run the commands above.

Packages in this repo depend on each other with `workspace:*`. Publish with pnpm; it rewrites that protocol to a version.

## Versioning and releases

Published packages under `packages/*` use [Changesets](https://github.com/changesets/changesets) with **independent** semver (`@node-jhora/testkit` and `apps/docs` are private and ignored). When a pull request changes a published package, add a changeset:

```bash
pnpm changeset
```

CI runs `pnpm changeset status --since=origin/main` on pull requests and fails if a published package changed without a changeset. Add the `no-changeset` label when the change does not need a release (for example docs-only or internal refactors with no publish impact).

Releases are triggered manually from the **Release** workflow (dry-run by default). npm publish stays off until an owner runs the workflow with `dry_run: false` and `publish: true` and configures the `NPM_TOKEN` repository secret.

`de440s.bsp` is not committed. `@node-jhora/ephe`'s `postinstall` runs `download.mjs`, and the root `postinstall` runs the same script so a workspace install still fetches the kernel when pnpm skips a dependency's lifecycle scripts. The script pins the kernel's SHA-256. NAIF publishes the MD5 of those bytes as `3917ee56769db332790c751e2168843d` in `aa_checksums.txt`. When `packages/ephe/de440s.bsp` already has the pinned SHA-256, the download is skipped. Cache that path in CI with the SHA-256 as the key.

pnpm 12 will not finish an install while a dependency's lifecycle script is neither approved nor denied (`ERR_PNPM_IGNORED_BUILDS`). Decisions are `allowBuilds` in `pnpm-workspace.yaml`. The linker stays isolated; there is no `.npmrc` hoist.

## Continuous integration (lean vs full)

Pull requests and pushes to `main` run **lean CI** on a single Ubuntu runner (Node 22): `format`, `lint`, `typecheck`, `build`, `unit`, and the `@node-jhora/web` smoke test (`apps/web/tests/e2e/smoke.spec.ts`). Those jobs run in parallel.

**Full CI** adds the Windows / Node 20 matrix, golden tests, docs build, API report check, bench regression, pack/JSR dry-run (`.github/workflows/pack.yml`), Bun/Deno runtime smokes, and the runtime licence scan. Enable full CI any of these ways:

- Add the **`full-ci`** label to the pull request
- Set repository variable **`FULL_CI`** to `true` (Settings → Secrets and variables → Actions → Variables)
- Run the **CI** workflow manually (**Actions → CI → Run workflow**) with **Run full matrix and extended checks** checked

CodeQL runs on pushes to `main` and on a weekly schedule, not on every pull request. The **Release** workflow still runs all publish gates before npm/JSR upload.

Update branch protection required checks to match lean job names (`format`, `lint`, `typecheck`, `build`, `unit`, `web`). Remove retired matrix job names (`install`, `golden`, `docs`, `api-report`, `web-e2e`, and per-OS duplicates) if they are still listed.

## Checks

From the repository root, after the Corepack commands above:

```bash
pnpm install --frozen-lockfile
pnpm build && pnpm typecheck && pnpm test
pnpm lint
pnpm run format:check
pnpm run check:links
pnpm run check:clean-room
pnpm run check:licenses
pnpm run api:check
pnpm run validate-github-templates
```

[Turborepo](https://turbo.build/) orchestrates `build`, `typecheck`, `lint`, `test`, and `generate` (`turbo.json`). Root scripts call `turbo run …`; local task output is cached under `.turbo/` (gitignored). A second `pnpm test` with no file changes should be a full cache hit. Regenerate goldens with `pnpm generate` only when you intend to refresh `@node-jhora/testkit` outputs.

`pnpm run api:check` and `pnpm run api:report` run a full package `build` first so `dist/**` and `tsconfig.tsbuildinfo` match the sources before api-extractor runs. If `api:check` complains about `positionMode` or `ChartKindSchema` key order only, run `pnpm exec turbo run build --force --filter=./packages/*` (stale `dist/` with current `etc/` — not a real API change).

Paste the build and test summary into the pull request until CI is required.

## Clean-room

JHora numeric output may be used as a test oracle. Do not copy JHora code, help text, icons, fonts, or other assets into this repository.
