import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'dev',
      match: ['bumpp', 'pncat', 'simple-git-hooks', 'taze', 'typescript'],
      priority: 20,
    },
    {
      name: 'frontend',
      match: ['dexie', 'reka-ui', 'zod'],
    },
    {
      name: 'map',
      match: ['leaflet', 'leaflet.markercluster'],
      priority: 20,
    },
    {
      name: 'hash',
      match: ['crc-32', 'murmurhash3js'],
      priority: 20,
    },
    {
      name: 'test',
      match: ['fake-indexeddb'],
    },
  ]),
  postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',
})
