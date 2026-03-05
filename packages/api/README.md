# @node-jhora/api

Production-ready REST API server for the Node-Jhora Vedic astrology engine. Built on **Fastify** with **Zod** schema validation, exposing all core calculations through a clean JSON API.

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/API.md)

## Installation

```bash
npm install @node-jhora/api
```

## Quick Start

```bash
# Build and start
npm run build
npm run start
# → Listening on http://0.0.0.0:3000
```

```bash
# Example request
curl -X POST http://localhost:3000/v1/chart \
  -H "Content-Type: application/json" \
  -d '{"datetime": "2000-01-01T12:00:00Z", "latitude": 13.08, "longitude": 80.27}'
```

## API Endpoints

| Method | Path | Description |
| :---: | :--- | :--- |
| `GET` | `/health` | Server health check |
| `POST` | `/v1/chart` | Full birth chart (planets, houses, panchanga) |
| `POST` | `/v1/chart/vargas` | All 16 divisional charts |
| `POST` | `/v1/panchanga` | Panchanga (5 limbs) |
| `POST` | `/v1/dasha` | Vimshottari Dasha periods |
| `POST` | `/v1/shadbala` | 6-fold planetary strengths |
| `POST` | `/v1/kp` | KP sub-lords and ruling planets |
| `POST` | `/v1/match` | Marriage compatibility matching |

## Features

| Feature | Description |
| :--- | :--- |
| **Fastify** | High-performance web server |
| **Zod Validation** | Compile-time safe schemas + runtime validation |
| **City Resolution** | Pass `city` name instead of lat/lon — auto-resolves coordinates |
| **Pino Logging** | Structured JSON logs (pretty-print in development) |
| **CORS** | Configurable via `CORS_ORIGIN` environment variable |
| **WASM Singleton** | Engine initialized once at startup for fast responses |

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Log level |
| `NODE_ENV` | — | `development` for pretty logs |
| `CORS_ORIGIN` | `true` | CORS allowed origins |

## Dependencies

Fastify, Zod, Pino, `@fastify/cors`, `city-timezones`, Luxon, `Decimal.js`, plus all `@node-jhora/*` packages.

## License

Source Available — Commercial License Required. See [LICENSE](../../LICENSE).
