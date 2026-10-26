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

## Checks

From the repository root:

```bash
npm install
npm run build && npm test
node scripts/validate-github-templates.mjs
```

Paste the build and test summary into the pull request until CI is required.

## Clean-room

JHora numeric output may be used as a test oracle. Do not copy JHora code, help text, icons, fonts, or other assets into this repository.
