---
'@node-jhora/core': minor
'@node-jhora/engine': minor
'@node-jhora/ephe': patch
---

Add browser and Web Worker builds: `@node-jhora/core/browser`, `@node-jhora/engine/browser` (plus `worker-entry` / `worker-api`), and a browser-safe `@node-jhora/ephe/constants.mjs`. Worker results use a lossless wire format (no float32 quantization) and match Node within 2e-8″ in Chromium, Firefox and WebKit.
