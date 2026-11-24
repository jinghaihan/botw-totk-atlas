# Wilds Atlas

A local-first exploration atlas for **Breath of the Wild** and **Tears of the Kingdom**, built from [jinghaihan/starter-vue](https://github.com/jinghaihan/starter-vue).

Import a save, keep separate profiles for each playthrough, and find what remains on a map or checklist. Saves are read in the browser and are never modified or uploaded.

## Features

- BOTW Normal / Master Mode and TOTK profiles, with separate notes, manual progress, ignored entries and filters.
- Direct folder selection, automatic game/mode detection from companion metadata, read-only import preview, profile updates, and history showing newly completed entries and regressions.
- Browse either game map before importing a save; unknown completion stays unknown.
- Leaflet maps for BOTW and TOTK's Sky, Surface and Depths; category, region, status and text filters.
- Separate shrine completion and chest tracking, including a **cleared shrines with unopened chests** filter.
- Collection checklists for shrines, treasure chests, quests and supported completion records.
- Manual camp markers, notes and overrides that survive subsequent save imports.
- Single-profile and workspace JSON backup; validated restore creates independent copies in a transaction.
- Simplified Chinese, Traditional Chinese and English interfaces, with official localized game names where available.
- Full-screen maps with charcoal and gold controls, built with Reka UI.

## Credits

- [jinghaihan/starter-vue](https://github.com/jinghaihan/starter-vue) — project template.
- [jv-prado/hyrule-tracker](https://github.com/jv-prado/hyrule-tracker) and [LucieTheFool/boomerang-tracker](https://github.com/LucieTheFool/boomerang-tracker) contributors — community map metadata, adapted under the MIT license.
- [ZeldaMods BOTW Object Map](https://objmap.zeldamods.org/) and [TOTK Object Map](https://objmap-totk.zeldamods.org/) — map imagery and game-data research.
- [marcrobledo/savegame-editors](https://github.com/marcrobledo/savegame-editors), MrCheeze and McSpazzy — save-format and completion-flag research.
- [sh0wer1ee/BotwText](https://github.com/sh0wer1ee/BotwText) and [sh0wer1ee/TotkText](https://github.com/sh0wer1ee/TotkText) — localized game-name indexes.

Game imagery and text belong to Nintendo. Third-party notices are preserved in [NOTICE](public/catalogs/NOTICE.txt); source manifests are included with the [catalogs](public/catalogs/sources.json) and [localized names](public/labels/sources.json).

## License

[MIT](./LICENSE.md) License © [jinghaihan](https://github.com/jinghaihan)
