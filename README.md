# Wilds Atlas

旷野图志 — a browser-based exploration and collection tracker for **Breath of the Wild** and **Tears of the Kingdom**.

The project is currently at the scaffold and planning stage. Planned features include independent profiles, local save-file analysis, an interactive map, shrine chest tracking, manual notes, and portable progress backups.

## Development

```sh
pnpm install
pnpm dev
```

```sh
pnpm lint
pnpm typecheck
pnpm build
```

Built from [jinghaihan/starter-vue](https://github.com/jinghaihan/starter-vue), revision `994fca49565540dc10d69e58a1c84c79f6373809`.

## Project decisions

- One Vue application with separate BOTW and TOTK game adapters.
- A single-page interface using Vue composables. Vue Router and Pinia are currently unnecessary.
- Planned persistence: Dexie over IndexedDB; simple display preferences use VueUse local storage utilities.
- Planned mapping: stable Leaflet, with game-specific catalogs and coordinate transforms.
- Save files are parsed locally. Progress and manual annotations belong to a selected profile.

See the [development plan](docs/development-plan.md) and [visual direction](docs/visual-direction.md).

## License

[MIT](./LICENSE.md) © [jinghaihan](https://github.com/jinghaihan).

Third-party code, datasets, maps, fonts, and icons retain their respective licenses and attribution requirements. Source provenance will be recorded as each game catalog is integrated.
