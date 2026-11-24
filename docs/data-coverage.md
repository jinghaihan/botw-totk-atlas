# Data coverage

## Save evidence

| Area            | BOTW                                                                                    | TOTK                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Save input      | `game_data.sav`, interleaved hash/value records                                         | `progress.sav`, hash/value records and indirect arrays                                                                      |
| Modes           | Separate Normal / Master profiles, detected from companion `caption.sav` when available | Normal only                                                                                                                 |
| Shrines         | 136 clear flags, separate whole-shrine chest flags                                      | 152 clear states; 166 cataloged shrine chests use individual `IsTreasureBoxOpen` fields                                     |
| Koroks          | 900 puzzle records                                                                      | 800 hidden puzzles + 100 friend pairs; 900 map entries represent 1,000 seeds                                                |
| Outdoor chests  | Per-object hash flags                                                                   | 64-bit GUID membership, kept as decimal strings                                                                             |
| Interior chests | Whole-shrine flag; no inferred individual count                                         | Individual opening flags, not global GUID membership                                                                        |
| Progress        | Towers, bosses, compendium, acquisition flags and supported quest records               | Shrines, roots, bosses, caves, wells, signs, maps, wills, quests, recipes, fabrics, pristine weapon qualifications and more |

Readers reject invalid headers, missing required records and unsafe pointer ranges. They do not write saves. Format compatibility is checked from structure and required fields; a full released-version compatibility matrix has not been established. Real-file verification currently covers the user's two BOTW saves and one TOTK save. These fixtures are not distributed.

## Community map catalog

Base catalog: [jv-prado/hyrule-tracker](https://github.com/jv-prado/hyrule-tracker), MIT. Source hashes, counts and transformations are recorded in `public/catalogs/sources.json` and `scripts/build-catalogs.mjs`.

Important corrections include BOTW boss defeat prefixes, TOTK interior chest flags, shrine/chest parent relationships, armor aliases, unused location fields and post-ending quest rollback. Switch 2 voice entries are excluded from the BOTW catalog. TOTK recipes use 228 obtainable entries rather than unused cooking variants. Fabrics and pristine weapon qualifications have supplemental factual flag mappings.

A raw field existing in the save does not prove it is a valid completion criterion. Noncanonical TOTK locations, shop visits, unsupported tasks and respawning enemies remain manual/unknown where evidence is insufficient. Ancient tablets are marked complete together only when their quest is complete; partial individual tablet progress is unknown.

Some BOTW quests lack a reliable name/flag match and remain unknown. Collection denominators come from their own definitions; they must not be conflated with map percentages. Cave entrance counts differ from unique cave counts.

Camp markers cover only some enemy-chest locations. The catalog does not contain every monster camp. Blood-moon enemy state cannot establish a permanent clear history.

## Localized names

Short names are indexed from [BotwText](https://github.com/sh0wer1ee/BotwText) (1.6.0) and [TotkText](https://github.com/sh0wer1ee/TotkText) (1.2.1). Game text is originally © Nintendo. Only short name records are bundled, without dialogue or descriptions. Files and SHA-256 digests are listed in `public/labels/sources.json`.

The CNzh, TWzh and USen indexes contain 2,937 BOTW and 3,331 TOTK records each; JPja contains 2,936 BOTW and 3,331 TOTK names. The current source has no Korean game-text records, so the Korean interface uses English game names. The name index is broader than the set of catalog entries with a reliable identifier match. Some community place names, generic puzzles, new-version fabrics and reward labels have no matching localized name and retain their existing label or identifier.

The interface uses Vue I18n for Simplified Chinese, Traditional Chinese, Japanese, Korean and English, including browser-language detection, persisted language choice and locale-aware numbers/dates. Each UI pack is maintained independently. CJK font fallbacks cover Chinese, Japanese and Korean text in profile names.

## Map imagery and offline behavior

[ZeldaMods BOTW Object Map](https://objmap.zeldamods.org/) and [TOTK Object Map](https://objmap-totk.zeldamods.org/) provide external image tiles. World X/Z coordinates are transformed into Leaflet's simple CRS. TOTK has separate Sky, Surface and Depths tiles. Interior chest locations resolve through their shrine parent where known.

Tile services require network access. Tile failure shows an inline notice and leaves the checklist usable. Parsed saves, manual completion and view preferences use Dexie/IndexedDB on this browser; this version does not install a service worker or promise a cold-start offline application.

## Verification boundary

Command-line tests cover malformed inputs, 64-bit IDs, missing-vs-false flags, shrine/chest rules, manual overrides, profile isolation, backup validation and transaction rollback, coordinate transforms, and locale completeness. The three real saves were read without changing their hashes. Production output excludes private fixtures.

The user later authorized screenshots in an isolated headless environment while keeping their personal browser unopened. The redesigned map, point details and mobile layout were reviewed in Chromium Headless Shell, with a separate ephemeral context, overflow/runtime checks and an axe accessibility pass. See [UI review](ui-review.md). Broader browser/device and restart-persistence coverage remains limited.
