# Record architecture decisions in docs/decisions

- Status: accepted
- Date: 2026-10-26
- Deciders: maintainers

Technical story: E22-S2-T1

## Context and Problem Statement

Jyotish results depend on conventions (ayanamsa, node type, geometric versus
apparent place, divisional-chart schemes) as much as on astronomy. Several
people and agents will change the engine. How do we record a choice so a later
change does not silently loosen a tolerance or swap a convention?

## Decision Drivers

- A tolerance or convention change must stay explainable months later.
- The log has to be reviewable in git, next to the code it governs.
- Records should be short enough that people actually write them.

## Considered Options

- Commit messages and pull-request text only.
- Markdown ADRs in `docs/decisions/`, MADR-style, with an index.
- A separate decision tracker outside the repository.

## Decision Outcome

Chosen option: "Markdown ADRs in `docs/decisions/`", because the reason and the
code then share one history. Use [0000-template.md](0000-template.md). Add a
row to [README.md](README.md). Supersede by a new numbered ADR rather than
rewriting an accepted outcome.

Write an ADR when a change picks a convention, changes a published tolerance,
adds a dependency with licence consequences, or settles a JHora behaviour that
the program itself does not document. Ordinary bug fixes do not need one.

### Consequences

- Good, because reviewers can require a link to the ADR when a golden
  tolerance moves.
- Bad, because the index is updated by hand and can drift if a record is added
  without a row.

## Pros and Cons of the Options

### Commit messages only

- Good, because there is nothing new to maintain.
- Bad, because the rationale is scattered and easy to miss when rebasing.

### Markdown ADRs in this directory

- Good, because each decision is a small, stable page with a status.
- Bad, because authors must remember to add the index row.

### External tracker

- Good, because it can carry discussion.
- Bad, because the repository would no longer be sufficient to explain itself.

## More Information

The clean-room constraint on what those records may quote is
[ADR 0002](0002-clean-room-policy.md).
