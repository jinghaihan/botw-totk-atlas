# Wilds Atlas

A local-first exploration atlas for **Breath of the Wild** and **Tears of the Kingdom**, built from [jinghaihan/starter-vue](https://github.com/jinghaihan/starter-vue).

Import a save, keep separate profiles for each playthrough, and find what remains on a map or checklist. Saves are read in the browser and are never modified or uploaded.

## Features

- BOTW Normal / Master Mode and TOTK profiles, with separate notes, manual progress, ignored entries and filters.
- Read-only import preview, profile updates, and history showing newly completed entries and regressions.
- Leaflet maps for BOTW and TOTK's Sky, Surface and Depths; category, region, status and text filters.
- Separate shrine completion and chest tracking, including a **cleared shrines with unopened chests** filter.
- Collection checklists, inventory values, equipment modifiers and registered horses.
- Manual camp markers, notes and overrides that survive subsequent save imports.
- Single-profile and workspace JSON backup; validated restore creates independent copies in a transaction.
- Simplified Chinese, Traditional Chinese and English interfaces, with official localized game names where available.
- BOTW blue and TOTK green interfaces, using Reka UI for selects, dialogs, tabs, popovers and pagination.

## Development

Use Node.js 22.12+ and pnpm 11.9.0.

```sh
pnpm install
pnpm dev
```

```sh
pnpm lint
pnpm typecheck
pnpm exec vitest run
pnpm build
```

Parsing, completion rules, profile isolation, backup rollback and language coverage have command-line checks. Real saves are private local fixtures excluded from Git and production builds. The map, point details and mobile layout have also been checked in an isolated headless screenshot pass; see [UI review](docs/ui-review.md). Broader browser/device testing remains separate.

The production output is a static SPA in `dist/`. Serve it over HTTPS (or localhost for development). Online map imagery is fetched from ZeldaMods; local progress remains available through the checklist if imagery fails. This is not an offline tile cache or a hosted service yet.

## Data and limitations

See [data coverage](docs/data-coverage.md) for sources, save semantics and supported scope. The catalog is not an authoritative count of every game object, and its totals differ from the games' official map percentages. Unsupported records remain **unknown** rather than being counted as missing.

Map and game-text source manifests are shipped in `public/catalogs/` and `public/labels/`. No ROM, extracted textures or private saves are bundled. Nintendo retains rights in game imagery and text; third-party metadata credits are in [NOTICE](public/catalogs/NOTICE.txt).

To refresh metadata:

```sh
python3 scripts/build-game-labels.py
node scripts/build-catalogs.mjs
node scripts/build-ui-locales.mjs
```

UI translations are maintained in `i18n/source.json`; the other locale files are generated. OpenCC generates the Traditional Chinese UI draft with explicit terminology overrides. Official CNzh and TWzh game names come from independent game-text records, not character conversion. Missing game translations fall back to the catalog name or item ID. User names and notes are kept verbatim.

## Project notes

- [Development milestones](docs/development-plan.md)
- [Visual direction](docs/visual-direction.md)

All development commits are currently local. Nothing has been pushed or published.
