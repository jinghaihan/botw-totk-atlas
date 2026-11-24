import type { CatalogPoint } from '@/domain/game'
import { describe, expect, it } from 'vitest'
import { createProgressReader } from '@/domain/completion'
import { mapToWorld, worldToMap } from '@/domain/coordinates'
import { filterRows, resolveRows } from '@/domain/exploration'
import { snapshot } from './helpers/snapshot'

const view = { categories: [] as string[], status: 'all' as const, layer: 'surface' as const, hideIgnored: true, search: '' }
describe('exploration filters', () => {
  it('keeps a manual override distinct from automatic evidence', () => {
    const save = snapshot()
    const point: CatalogPoint = { id: 'p', name: '点位', category: 'camp', key: 'flag' }
    save.scalars[String(createProgressReader(save).hash('flag'))] = 1
    const rows = resolveRows(save, [point], [{ profileId: 'a', pointId: 'p', status: 'incomplete', ignored: false, note: '路线 A', updatedAt: new Date().toISOString() }])
    expect(rows[0]).toMatchObject({ automatic: 'complete', status: 'incomplete' })
    expect(filterRows(rows, { ...view, search: '路线 A', status: 'incomplete' })).toHaveLength(1)
  })
  it('finds cleared shrines with unclaimed chests without treating unknown as missing', () => {
    const save = snapshot()
    const reader = createProgressReader(save)
    save.scalars[String(reader.hash('Clear_Dungeon000'))] = 1
    save.scalars[String(reader.hash('CompleteTreasure_Dungeon000'))] = 0
    save.scalars[String(reader.hash('Clear_Dungeon001'))] = 1
    const points: CatalogPoint[] = [0, 1].map(i => ({ id: `shrine:${i}`, name: '神庙', category: 'shrine', key: `Clear_Dungeon00${i}` }))
    const filtered = filterRows(resolveRows(save, points, []), { ...view, status: 'shrine-chests' })
    expect(filtered.map(r => r.point.id)).toEqual(['shrine:0'])
  })
  it('excludes interior and other-layer points from the map but preserves them in the list', () => {
    const points: CatalogPoint[] = [{ id: 'a', name: 'a', category: 'chest', at: [0, 0], layer: 'depths' }, { id: 'b', name: 'b', category: 'chest', at: [0, 0], interior: true }]
    const rows = resolveRows(snapshot(), points, [])
    expect(filterRows(rows, view)).toHaveLength(2)
    expect(filterRows(rows, view, true)).toHaveLength(0)
  })
  it('round trips world X/Z coordinates without mirroring the map', () => {
    expect(worldToMap([123, -456])).toEqual([456, 123])
    expect(mapToWorld(...worldToMap([123, -456]))).toEqual([123, -456])
  })
})

it('leaves all completion evidence unknown when browsing without a save', () => {
  const points: CatalogPoint[] = [{ id: 'chest:1', name: 'Chest', category: 'chest', key: 'guid:123', rule: 'guid' }]
  expect(resolveRows(undefined, points, [])).toEqual([{ point: points[0], automatic: 'unknown', status: 'unknown', found: false }])
})
