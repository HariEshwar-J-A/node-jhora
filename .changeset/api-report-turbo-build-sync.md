---
---

Fix Turbo build cache outputs (`tsconfig.tsbuildinfo`) and run a forced package build before CI `api:check`, so api-extractor is not compared against stale `dist/` declaration files.
