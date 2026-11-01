# React-based UI app under apps/

- Status: proposed
- Date: 2026-10-26
- Deciders: maintainers

Technical story: E22-S2-T1 (records the roadmap choice; the app is not
scaffolded yet)

## Context and Problem Statement

The engine has no product UI. The roadmap calls for a desktop-style Jyotish
workspace (charts, tables, dashas, transits) that can also run as a PWA.
Which client stack, and where does it live in the monorepo?

## Decision Drivers

- The engine already runs in the browser, so a server renderer buys little.
- One bundle should feed both the PWA and a later Tauri shell.
- UI code must stay original under the clean-room policy
  ([ADR 0002](0002-clean-room-policy.md)).
- Libraries stay publishable without pulling a web app into their dependency
  graph.

## Considered Options

- No first-party UI; publish libraries and the HTTP API only.
- React 19 + TypeScript + Vite as a single-page app in `apps/`.
- Next.js in `apps/` for a server-rendered site.

## Decision Outcome

Chosen option: "React 19 + TypeScript + Vite in `apps/`", because the client
can call the engine directly and the same bundle can be wrapped later. This
record is **proposed** until the UI epic scaffolds the app (roadmap E15). It
does not add `apps/` in the E22-S2-T1 change.

Intended shape, to be confirmed when the app lands:

- `apps/web` for the React SPA. A docs site, if any, is a separate app.
- Chart drawing lives in a framework-agnostic package of our own SVG, not in
  copied artwork.
- Components, labels, and glyphs are written for this project.

### Consequences

- Good, because the UI can share types with the engine and stay client-side.
- Good, because `apps/` is outside the publish path of `packages/*`.
- Bad, because accepting this record still leaves routing, design-system, and
  desktop-shell choices to later ADRs (E15–E19). Those are not decided here.

## Pros and Cons of the Options

### Libraries and API only

- Good, because there is no front-end surface to keep original.
- Bad, because the roadmap's workspace workflows would have no home.

### React SPA in `apps/`

- Good, because it matches a client-side engine and a later Tauri shell.
- Bad, because a public marketing site would want a different app later.

### Next.js

- Good, because server rendering helps a public content site.
- Bad, because the workspace itself is an authenticated, client-side tool and
  would carry the server framework for no calculation benefit.

## More Information

Clean-room constraints on art and wording: [docs/guides/clean-room.md](../guides/clean-room.md).
Scaffolding is a separate change; do not treat this ADR as permission to copy
layout assets from JHora.
