# Map interface review — 2026-11-24

Reviewed against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), including layout, content hierarchy, keyboard operation, accessible names, localized text and mobile safe areas.

## Findings and changes

- `src/App.vue`: the previous sidebar, large heading, file metadata and character cards pushed the map below an administration-style layout. The map now fills the viewport. Navigation and profile tools float above it; inventory, collection totals and import records have separate journal views.
- `src/components/ExplorerPanel.vue`: the long toolbar and permanent results list competed with the map. Exploration categories and three useful shortcuts now live in one collapsible floating panel. Search opens the checklist. Mobile starts with the panel collapsed.
- `src/assets/slate-theme.css`: the first redesign's pale paper surfaces did not match the map or navigation. Floating panels, menus, dialogs and journal views now share a dark translucent slate palette, restrained gold borders and blue/green game accents.
- `src/components/PointDetail.vue`: the centered blocking dialog interrupted map exploration. Details now open alongside the map, using a nonmodal Reka Dialog, with a bottom sheet layout on mobile. Manual completion is directly available; secondary tracking options are collapsed. Custom marker deletion has confirmation.
- `src/components/WorldMap.vue`: dense symbols obscured terrain on small screens. Leaflet.markercluster now groups them and expands as the map zooms. Marker titles provide accessible names. Tile imagery, notes and completion semantics are preserved.
- `src/components/AtlasSelect.vue`: styling attributes were not reaching Reka's actual trigger. Explicit attribute forwarding fixes the profile selector's contrast and sizing.
- `src/App.vue`: navigation tabs now follow the URL's `view` query parameter. The map remains mounted while opening inventory/collection views, preserving the camera position.

## Verification

The user authorized screenshots in an isolated headless environment while keeping their browser unopened. Playwright uses a separate downloaded Chromium Headless Shell and an ephemeral context; it does not connect to a personal browser, user profile or existing tab.

Screenshots cover a 1512 × 982 desktop map, selected point details, and a 390 × 844 mobile map, with the real BOTW Normal Mode save imported read-only. Checks confirm full-viewport map dimensions, no horizontal overflow, a collapsed mobile panel and no runtime page errors. Browser-built message interpolation was checked independently of unit tests.

An axe WCAG 2 A/AA pass supplements the Vercel guideline review. Its initial missing marker-name finding was fixed; the exercised desktop map now reports zero WCAG 2 A/AA violations. Screenshot artifacts and machine results are kept outside the repository under the local BOTW workspace's `artifacts/wilds-atlas-redesign/` directory.

These checks verify the observed screens and interactions; they do not establish that every game-data entry or every browser/device has been audited.
