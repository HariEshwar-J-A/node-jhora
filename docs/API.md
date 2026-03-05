# Package: `@node-jhora/api`

The `@node-jhora/api` package provides a production-ready REST API server built on **Fastify** with **Zod** schema validation. It exposes all core Vedic astrology calculations through a clean JSON API.

---

## 🏗️ Architecture

- **Framework**: [Fastify](https://fastify.dev/) — high-performance Node.js web framework.
- **Validation**: [Zod](https://zod.dev/) type provider for compile-time safe schemas and runtime input validation.
- **Logging**: [Pino](https://getpino.io/) structured logging (pretty-print in development, JSON in production).
- **CORS**: Configurable via `CORS_ORIGIN` environment variable.
- **WASM Engine**: Singleton `EphemerisEngine` initialized once at server startup.

---

## 🚀 Quick Start

```bash
# From monorepo root
npm run build

# Start the API server
cd packages/api
npm run start
# → Listening on http://0.0.0.0:3000
```

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `NODE_ENV` | — | Set to `development` for pretty-printed logs |
| `CORS_ORIGIN` | `true` (all) | CORS allowed origins |

---

## 📡 API Endpoints

All calculation endpoints are prefixed with `/v1` and accept `POST` requests with JSON body.

### Health Check

```
GET /health
```

Returns server status.

---

### `POST /v1/chart` — Full Birth Chart

Calculates planetary positions, house cusps, and Panchanga in a single call.

**Request Body:**

```json
{
    "datetime": "2000-01-01T12:00:00Z",
    "latitude": 13.08,
    "longitude": 80.27,
    "ayanamsa": "Lahiri",
    "nodeType": "mean",
    "houseSystem": "WholeSign"
}
```

Alternatively, use a city name:

```json
{
    "datetime": "2000-01-01T12:00:00Z",
    "city": "Chennai"
}
```

**Response:**

```json
{
    "planets": [
        {
            "id": 0, "name": "Sun",
            "longitude": 255.23, "latitude": 0.0002,
            "speed": 1.019, "distance": 0.983,
            "declination": -23.03, "sign": 9, "degree": 15.23
        }
    ],
    "houses": {
        "system": "WholeSign",
        "ascendant": 280.5,
        "mc": 190.3,
        "cusps": [270, 300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240]
    },
    "panchanga": {
        "tithi": "Shukla Panchami",
        "nakshatra": "Mula",
        "yoga": "Priti",
        "karana": "Bava",
        "vara": "Saturday"
    },
    "meta": {
        "ayanamsaName": "Lahiri",
        "ayanamsaValue": 23.856,
        "nodeType": "mean",
        "julianDay": 2451545.0
    }
}
```

---

### `POST /v1/chart/vargas` — All 16 Divisional Charts

Returns planetary positions in all 16 standard Parashara Vargas.

**Request Body:** Same as `/v1/chart`.

**Response:**

```json
{
    "vargas": {
        "D1": [{ "planetId": 0, "planetName": "Sun", "sign": 9, "degree": 15.23, "longitude": 255.23 }],
        "D9": [{ "planetId": 0, "planetName": "Sun", "sign": 5, "degree": 17.1, "longitude": 137.1, "deity": "..." }],
        "D60": [...]
    }
}
```

**Divisions**: D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, D60.

---

### `POST /v1/panchanga` — Panchanga

Returns the five limbs of the Hindu calendar for a given date/time.

---

### `POST /v1/dasha` — Vimshottari Dasha

Returns the dasha periods (Maha → Antar → Pratyantar) for a given birth chart.

---

### `POST /v1/shadbala` — Shadbala Strengths

Returns the 6-fold planetary strength breakdown for all planets.

---

### `POST /v1/kp` — KP Sub-Lords

Returns Krishnamurti Paddhati sub-lord tables and ruling planets.

---

### `POST /v1/match` — Compatibility Matching

Performs Ashta Kuta or Dasha Kuta matching between two birth stars.

---

## 🔧 Input Schema

All birth-data endpoints share a common Zod schema (`BirthInputSchema`):

```typescript
// Accepted fields:
{
    datetime: string;       // ISO 8601 datetime string
    latitude?: number;      // -90 to 90
    longitude?: number;     // -180 to 180
    city?: string;          // Alternative to lat/lon (resolved via geocoder)
    ayanamsa?: string;      // 'Lahiri' | 'Raman' | 'KP' (default: 'Lahiri')
    nodeType?: string;      // 'mean' | 'true' (default: 'mean')
    houseSystem?: string;   // 'WholeSign' | 'Placidus' | 'Porphyry' (default: 'WholeSign')
}
```

If `city` is provided instead of `latitude`/`longitude`, the server resolves coordinates and timezone automatically using the `city-timezones` package.

---

## 🛡️ Error Handling

All errors are returned as structured JSON with appropriate HTTP status codes:

```json
{
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Invalid datetime format"
}
```

---

## 📦 Dependencies

| Package | Purpose |
| :--- | :--- |
| `fastify` | Web server framework |
| `fastify-type-provider-zod` | Zod schema integration |
| `@fastify/cors` | CORS support |
| `zod` | Input validation |
| `pino` | Structured logging |
| `city-timezones` | City-to-coordinates resolution |
| `luxon` | DateTime handling |
| `decimal.js` | Precision arithmetic |
