import type { CatalogPoint } from '@/domain/game'
import { describe, expect, it } from 'vitest'
import { createProgressReader } from '@/domain/completion'
import { mapToWorld, worldToMap } from '@/domain/coordinates'
import { filterRows, resolveRows } from '@/domain/exploration'
import { snapshot } from './helpers/snapshot'

const view = { categories: null, status: 'all' as const, layer: 'surface' as const, search: '' }
describe('exploration filters', () => {
  it('distinguishes all categories, a subset and no categories', () => {
    const rows = resolveRows(undefined, [{ id: 'a', name: 'a', category: 'shrine', at: [0, 0] }, { id: 'b', name: 'b', category: 'chest', at: [1, 1] }], [])
    expect(filterRows(rows, view)).toHaveLength(2)
    expect(filterRows(rows, { ...view, categories: ['chest'] }).map(row => row.point.id)).toEqual(['b'])
    expect(filterRows(rows, { ...view, categories: [] })).toHaveLength(0)
  })
  it('keeps a manual override distinct from automatic evidence', () => {
    const save = snapshot()
    const point: CatalogPoint = { id: 'p', name: '点位', category: 'chest', at: [0, 0], key: 'flag' }
    save.scalars[String(createProgressReader(save).hash('flag'))] = 1
    const rows = resolveRows(save, [point], [{ profileId: 'a', pointId: 'p', status: 'incomplete', updatedAt: new Date().toISOString() }])
    expect(rows[0]).toMatchObject({ automatic: 'complete', status: 'incomplete' })
    expect(filterRows(rows, { ...view, status: 'incomplete' })).toHaveLength(1)
  })
  it('shows manually tracked points until marked complete', () => {
    const lynel: CatalogPoint = { id: 'lynel:1', name: 'Lynel', category: 'lynel', at: [0, 0], rule: 'manual' }
    const shop: CatalogPoint = { id: 'shop:1', name: 'Shop', category: 'shop', at: [0, 0], rule: 'manual' }
    const unfinished = { ...view, status: 'incomplete' as const }
    const save = snapshot()
    const rows = resolveRows(save, [lynel, shop], [])
    expect(filterRows(rows, unfinished)).toMatchObject([{ point: lynel, status: 'incomplete' }, { point: shop, status: 'incomplete' }])
    const marked = resolveRows(save, [lynel, shop], [{ profileId: 'a', pointId: lynel.id, status: 'complete', updatedAt: new Date().toISOString() }])
    expect(filterRows(marked, unfinished)).toMatchObject([{ point: shop, status: 'incomplete' }])
  })
  it('only returns exterior points from the selected layer', () => {
    const points: CatalogPoint[] = [
      { id: 'a', name: 'Depths chest', category: 'chest', at: [0, 0], layer: 'depths' },
      { id: 'b', name: 'Interior chest', category: 'chest', at: [0, 0], interior: true },
      { id: 'c', name: 'Surface chest', category: 'chest', at: [0, 0] },
    ]
    const rows = resolveRows(snapshot(), points, [])
    expect(filterRows(rows, view).map(row => row.point.id)).toEqual(['c'])
    expect(filterRows(rows, { ...view, layer: 'depths' }).map(row => row.point.id)).toEqual(['a'])
    expect(rows).toHaveLength(3)
  })
  it('round trips world X/Z coordinates without mirroring the map', () => {
    expect(worldToMap([123, -456])).toEqual([456, 123])
    expect(mapToWorld(...worldToMap([123, -456]))).toEqual([123, -456])
  })
})

it('shows points as unfinished when browsing without a save', () => {
  const points: CatalogPoint[] = [{ id: 'chest:1', name: 'Chest', category: 'chest', key: 'guid:123', rule: 'guid' }]
  expect(resolveRows(undefined, points, [])).toEqual([{ point: points[0], status: 'incomplete' }])
})
