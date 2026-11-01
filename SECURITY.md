# Security policy

## Supported versions

Security fixes are applied to the latest release on the `main` branch. Older tags are not maintained unless you have a support agreement with the owner.

## Reporting a vulnerability

Email the repository owner (see GitHub profile **HariEshwar-J-A**) with:

- Description and impact
- Steps to reproduce
- Affected package versions and commit SHA

Do **not** open public issues for undisclosed security problems.

## Dependency policy

Production packages must not ship AGPL/GPL dependencies. CI runs `pnpm run check:licenses` (`tools/check-runtime-licenses.mjs`).

## Clean room

Do not submit proprietary ephemeris source, binaries, or decompiled assets. See [docs/guides/clean-room.md](./docs/guides/clean-room.md).
