# Web UI languages

The demo site ships in English (`en`), Tamil (`ta`) and Hindi (`hi`).

## Behaviour

- **Every fresh load is English.** There is no `navigator.language` detection
  and nothing is stored in `localStorage` or `sessionStorage`.
- **`?lang=ta` / `?lang=hi`** in the page URL (before the `#/route` hash, e.g.
  `/astrology/?lang=ta#/app`) opens the site in that language, so a shared link
  keeps its language. Unknown values fall back to English.
- The switcher in the header updates that parameter with `history.replaceState`
  (and removes it for English). It sets `<html lang>` and the document title.
- Noto Sans Tamil / Noto Sans Devanagari (OFL-1.1, `@fontsource`) are fetched
  only after Tamil or Hindi is chosen.

## Files

| File            | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `locales/en.ts` | Source of truth for message keys (`MessageKey`).                         |
| `locales/ta.ts` | Tamil messages, typed as `Messages`, so a missing key fails `tsc`.       |
| `locales/hi.ts` | Hindi messages, same.                                                    |
| `terms.ts`      | Jyotisha terms (planets, signs, nakshatras, tithis, dashas, kutas, ...). |
| `astro.ts`      | Helpers that map engine values (English names / indices) to those terms. |
| `core.ts`       | `translate()` with English fallback for missing or empty entries.        |
| `index.tsx`     | `LanguageProvider`, `useI18n()` (`t`, `rich`, `num`), URL handling.      |
| `fonts.ts`      | Lazy font loading per language.                                          |

`tools/web-i18n.test.ts` checks that every locale has every key with the same
`{placeholders}` and that every term table is complete.

## Not translated

Documentation article bodies (API reference and code), GeoNames place names,
user-entered profile names, product and library names (node-jhora, DE440s,
KP, JSON, JHD/NJH), engine error messages passed through from the worker, and
Western house-system names without a common Tamil/Hindi equivalent.

Translations are a first draft and should be reviewed by native speakers.
