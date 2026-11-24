# Map interface review — 2026-11-24

Reviewed against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), including layout, content hierarchy, keyboard operation, accessible names, localized text and mobile safe areas.

## Findings and changes

- `src/app.vue`: the previous sidebar, large heading, file metadata and character cards pushed the map below an administration-style layout. The map now fills the viewport. Navigation and profile tools float above it; collection totals have a separate collection view. A pencil beside the active profile opens its rename form.
- `src/components/explorer-panel.vue`: exploration categories and filters live in one narrow collapsible panel. Categories are grouped by purpose and include only located points. Category selection and search keep the current tab; the checklist is opened explicitly. Mobile starts with the panel collapsed.
- `src/assets/slate-theme.css`: the first redesign's pale paper surfaces did not match the map or navigation. Floating panels, menus, dialogs and journal views now share a dark translucent slate palette, restrained gold borders and black-and-gold highlights.
- `src/components/point-detail.vue`: the centered blocking dialog interrupted map exploration. Details now open alongside the map, using a nonmodal Reka Dialog, with a bottom sheet layout on mobile. Manual completion is directly available; secondary tracking options are collapsed.
- `src/components/world-map.vue`: dense symbols obscured terrain on small screens. Leaflet.markercluster now groups them and expands as the map zooms. Marker titles provide accessible names. Tile imagery, notes and completion semantics are preserved.
- `src/components/atlas-select.vue`: styling attributes were not reaching Reka's actual trigger. Explicit attribute forwarding fixes the profile selector's contrast and sizing.
- `src/app.vue`: navigation tabs now follow the URL's `view` query parameter. The map remains mounted while opening the collection view, preserving the camera position.

## Verification

The user authorized screenshots in an isolated headless environment while keeping their browser unopened. Playwright uses a separate downloaded Chromium Headless Shell and an ephemeral context; it does not connect to a personal browser, user profile or existing tab.

Screenshots cover a 1512 × 982 desktop map, selected point details, and a 390 × 844 mobile map, with the real BOTW Normal Mode save imported read-only. Checks confirm full-viewport map dimensions, no horizontal overflow, a collapsed mobile panel and no runtime page errors. Browser-built message interpolation was checked independently of unit tests.

An axe WCAG 2 A/AA pass supplements the Vercel guideline review. Its initial missing marker-name finding was fixed; the exercised desktop map now reports zero WCAG 2 A/AA violations. Screenshot artifacts and machine results are kept outside the repository under the local BOTW workspace's `artifacts/wilds-atlas-redesign/` directory.

These checks verify the observed screens and interactions; they do not establish that every game-data entry or every browser/device has been audited.

## Scope and flow corrections

The welcome page and pre-file import dialog were removed. First visits go directly to a browsable map. The import action opens the folder picker immediately. Companion BOTW caption metadata identifies Normal/Master Mode, slots are grouped by game/mode, and the newest save in each group is selected. The mode dropdown was removed. Repetitive journey shortcut cards were replaced by the existing explicit filters.

Inventory, equipment and stable screens and their readers, snapshot fields and backup fields were removed. Database version 4 strips obsolete snapshot properties from existing profiles. Game item names remain only as map reward and collection labels. Panel surfaces are neutral charcoal; the Vue template favicons and runtime icon link were replaced with the atlas mark. Public JSON requests resolve relative to the deployment base and report a readable failure if a server returns an HTML fallback.

Forced `pncat migrate -f` leaves the manifests and lockfile unchanged. Custom rules extend the defaults without repeating the built-in `types` rule. Dependency catalogs separate runtime mapping libraries (`map`) and save hashing utilities (`hash`), with type packages retained in `types`. UI locale files are maintained independently; OpenCC and its generation script were removed.

The final folder-import pass uses production output at `/atlas/` in an isolated Chromium context. It detects BOTW Normal, BOTW Master and TOTK profiles from one folder, opens the native picker directly, and reports no runtime errors, horizontal overflow or axe WCAG 2 A/AA violations on the exercised desktop screen. Current screenshots and results are under `artifacts/wilds-atlas-direct/` outside this repository.
