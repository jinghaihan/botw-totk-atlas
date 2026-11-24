import type { CatalogPoint } from '@/domain/game'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (game: string): CatalogPoint[] => JSON.parse(readFileSync(`public/catalogs/${game}.json`, 'utf8'))
describe('bundled catalogs', () => {
  for (const [game, total] of [['botw', 136], ['totk', 152]] as const) {
    it(`keeps unique IDs and the complete shrine catalog for ${game}`, () => {
      const points = read(game)
      expect(new Set(points.map(p => p.id)).size).toBe(points.length)
      expect(points.filter(p => p.category === 'shrine')).toHaveLength(total)
    })
  }
  it('links all 166 TOTK shrine chests to parents and individual save flags', () => {
    const points = read('totk')
    const shrines = new Set(points.filter(p => p.category === 'shrine').map(p => p.id))
    const chests = points.filter(p => p.category === 'chest' && p.parentId && shrines.has(p.parentId))
    expect(chests).toHaveLength(166)
    expect(chests.every(p => String(p.key).startsWith('IsTreasureBoxOpen.'))).toBe(true)
  })
  it('leaves unused location fields manual instead of declaring them missing', () => {
    expect(read('totk').find(p => p.key === 'IsVisitLocation.Circuit_Ichikara')?.rule).toBe('manual')
  })
})
