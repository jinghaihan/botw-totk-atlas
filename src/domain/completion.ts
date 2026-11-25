import type { CatalogPoint, GameSnapshot, PointStatus } from './game'
import * as CRC32 from 'crc-32'
import murmur from 'murmurhash3js'

export function createProgressReader(snapshot: GameSnapshot) {
  const guids = new Set(snapshot.guids ?? [])
  const cache = new Map<string, number>()
  const hash = (name: string) => {
    if (!cache.has(name))
      cache.set(name, snapshot.game === 'botw' ? CRC32.str(name) >>> 0 : murmur.x86.hash32(name) >>> 0)
    return cache.get(name)!
  }
  const value = (key: string | number) => snapshot.scalars?.[String(typeof key === 'number' ? key : hash(key))]
  function status(point: CatalogPoint): PointStatus | undefined {
    if (point.rule === 'manual' || point.key === undefined)
      return undefined
    if (snapshot.game === 'totk' && ['quest:DefeatGanondorf', 'quest:MainChallenge'].includes(point.id) && value('IsGameClear') === 1)
      return 'complete'
    if (point.rule === 'guid') {
      if (!snapshot.guids)
        return undefined
      return [String(point.key), ...point.alternateKeys ?? []].some(key => guids.has(key.replace('guid:', ''))) ? 'complete' : 'incomplete'
    }
    const actual = value(point.key)
    if (actual === undefined)
      return undefined
    if (snapshot.game === 'totk' && point.category === 'tablet' && actual !== hash('Complete'))
      return undefined
    if (point.values?.length)
      return point.values.some(expected => hash(expected) === actual) ? 'complete' : 'incomplete'
    if (point.rule === 'positive')
      return actual > 0 ? 'complete' : 'incomplete'
    return actual === 1 ? 'complete' : actual === 0 ? 'incomplete' : undefined
  }
  function shrineChests(shrine: CatalogPoint, catalog: CatalogPoint[]) {
    const children = catalog.filter(p => p.category === 'chest' && p.parentId === shrine.id)
    if (snapshot.game === 'botw') {
      const dungeon = String(shrine.key).match(/Dungeon\d+/)?.[0]
      const complete = dungeon ? value(`CompleteTreasure_${dungeon}`) : undefined
      return { total: null, opened: null, complete: complete === undefined ? undefined : complete === 1 }
    }
    if (!children.length)
      return { total: null, opened: null, complete: undefined }
    const states = children.map(status)
    return { total: children.length, opened: states.filter(s => s === 'complete').length, complete: states.includes(undefined) ? undefined : states.every(s => s === 'complete') }
  }
  return { hash, status, shrineChests }
}
