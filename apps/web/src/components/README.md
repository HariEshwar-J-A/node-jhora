# Web UI components

Monochrome (shadcn/zinc) building blocks for the in-browser chart app.

## Charts (`chart/`)

| Component          | Role                                                          |
| ------------------ | ------------------------------------------------------------- |
| `ChartView`        | Renders North, South, or East Indian layout from shared props |
| `NorthIndianChart` | Square + diamond + diagonals, 12 houses CCW from Lagna        |
| `SouthIndianChart` | Fixed 4×4 sign grid, empty centre meta, diagonal Lagna mark   |
| `EastIndianChart`  | Optional rectangular 12-house grid                            |
| `ChartToggle`      | North / South / East control (persist with `useChartStyle`)   |
| `VargaBoard`       | Varga picker + side-by-side divisional grid                   |

Use `useChartStyle()` for `localStorage` persistence across tabs.

## Data display (`ui/`)

| Component   | Role                                          |
| ----------- | --------------------------------------------- |
| `DataTable` | Typed columns for planets, dashas, KP, etc.   |
| `StatCard`  | Panchanga and matching score tiles            |
| `BarChart`  | Shadbala totals                               |
| `Timeline`  | Vimshottari tree with active period highlight |

## Results (`results/`)

Tab panels compose the above; no raw JSON in the app UI.
