import type { CatalogPoint } from '@/domain/game'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createProgressReader } from '@/domain/completion'
import { loadCatalog } from '@/games/catalog'
import { snapshot } from './helpers/snapshot'

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
  it('counts conditional BOTW Lynel actors as one encounter at each site', () => {
    const lynels = read('botw').filter(point => point.category === 'lynel')
    expect(lynels).toHaveLength(23)
    expect(lynels.filter(point => point.at?.[0] === -1146.1 && point.at[1] === 1276.3)).toHaveLength(1)
    expect(lynels.filter(point => point.at && point.at[0] > 3800 && point.at[0] < 3900 && point.at[1] > -650 && point.at[1] < -550)).toHaveLength(1)
    expect(lynels.find(point => point.id === 'lynel:4200912374')?.alternateIds).toEqual(['lynel:237760997', 'lynel:1544805954', 'lynel:1578404536'])
    expect(lynels.find(point => point.id === 'lynel:1396251553')?.alternateIds).toEqual(['lynel:2291678401'])
  })
  it('loads the Great Plateau Lynel only for Master Mode', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(read('botw'))))
    try {
      const normal = await loadCatalog('botw', 'normal')
      const master = await loadCatalog('botw', 'master')
      const unspecified = await loadCatalog('botw')
      expect(normal.filter(point => point.category === 'lynel')).toHaveLength(22)
      expect(master.filter(point => point.category === 'lynel')).toHaveLength(23)
      expect(unspecified.filter(point => point.category === 'lynel')).toHaveLength(22)
      expect(normal.some(point => point.id === 'lynel:1288562591')).toBe(false)
      expect(master.find(point => point.id === 'lynel:1288562591')?.mode).toBe('master')
    }
    finally {
      request.mockRestore()
    }
  })
  it('keeps the five separate TOTK Floating Coliseum Lynels', () => {
    const lynels = read('totk').filter(point => point.category === 'lynel')
    expect(lynels).toHaveLength(34)
    expect(lynels.filter(point => point.layer === 'surface')).toHaveLength(15)
    expect(lynels.filter(point => point.layer === 'depths')).toHaveLength(19)
    expect(lynels.filter(point => point.layer === 'depths' && point.at && Math.hypot(point.at[0] + 1150, point.at[1] - 1275) < 100)).toHaveLength(5)
  })
  it('merges the Rito Village chest variants and reads either opening record', () => {
    const chests = read('totk').filter(point => point.category === 'chest' && point.alternateKeys?.length)
    expect(chests).toHaveLength(3)
    for (const chest of chests) {
      for (const key of [String(chest.key), ...chest.alternateKeys!]) {
        const reader = createProgressReader(snapshot({ game: 'totk', guids: [key.replace('guid:', '')] }))
        expect(reader.status(chest)).toBe('complete')
      }
      expect(createProgressReader(snapshot({ game: 'totk' })).status(chest)).toBe('incomplete')
    }
  })
  it('excludes unopenable chest models and preserves vertically separated chests', () => {
    const chests = read('totk').filter(point => point.category === 'chest')
    expect(chests).toHaveLength(1567)
    expect(chests.some(point => point.id === 'chest:5045140926541448911')).toBe(false)
    expect(chests.some(point => point.id === 'chest:16602421995595943199')).toBe(false)
    expect(chests.filter(point => point.at?.[0] === -230 && point.at[1] === -787)).toHaveLength(2)
  })
})
