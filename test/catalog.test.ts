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
  it('uses the actual BOTW quest completion flags when they differ from text IDs', () => {
    const flags = {
      'quest:tools-of-the-trade': 'GerudoMiniJewel_Finished',
      'quest:the-sheep-rustlers': 'HatenoMini_GoatThief_Finished',
      'quest:xenoblade-chronicles-2': 'bf2_collabo_Finish',
      'shrine-quest:the-perfect-drink': 'Gerudo_CarryIce_Finished',
      'shrine-quest:secret-of-the-cedars': 'HatenoMini_ThreeTree_Finished',
      'shrine-quest:a-landscape-of-a-stable': 'MtMotelMini_Landscape_Finished',
      'shrine-quest:the-ancient-rito-song': 'RitoSongMystery_Finished',
    }
    const quests = read('botw').filter(point => point.rule === 'boolean' && Object.hasOwn(flags, point.id))
    expect(Object.fromEntries(quests.map(point => [point.id, point.key]))).toEqual(flags)
  })
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
