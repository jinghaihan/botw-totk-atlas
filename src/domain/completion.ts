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
  function status(point: CatalogPoint): PointStatus {
    if (point.rule === 'manual' || point.key === undefined)
      return 'unknown'
    if (snapshot.game === 'totk' && ['quest:DefeatGanondorf', 'quest:MainChallenge'].includes(point.id) && value('IsGameClear') === 1)
      return 'complete'
    if (point.rule === 'guid') {
      if (!snapshot.guids)
        return 'unknown'
      return guids.has(String(point.key).replace('guid:', '')) ? 'complete' : 'incomplete'
    }
    const actual = value(point.key)
    if (actual === undefined)
      return 'unknown'
    if (point.values?.length)
      return point.values.some(expected => hash(expected) === actual) ? 'complete' : 'incomplete'
    if (point.rule === 'positive')
      return actual > 0 ? 'complete' : 'incomplete'
    return actual === 1 ? 'complete' : actual === 0 ? 'incomplete' : 'unknown'
  }
  function found(point: CatalogPoint) {
    return status(point) === 'complete' || (!!point.found && (value(point.found) ?? 0) > 0)
  }
  function shrineChests(shrine: CatalogPoint, catalog: CatalogPoint[]) {
    const children = catalog.filter(p => p.category === 'chest' && p.parentId === shrine.id)
    if (snapshot.game === 'botw') {
      const dungeon = String(shrine.key).match(/Dungeon\d+/)?.[0]
      const complete = dungeon ? value(`CompleteTreasure_${dungeon}`) : undefined
      return { children, total: null, opened: null, complete: complete === undefined ? undefined : complete === 1 }
    }
    if (!children.length)
      return { children, total: null, opened: null, complete: undefined }
    const states = children.map(status)
    return { children, total: children.length, opened: states.filter(s => s === 'complete').length, complete: states.includes('unknown') ? undefined : states.every(s => s === 'complete') }
  }
  return { hash, value, status, found, shrineChests }
}

export function compareProgress(previous: GameSnapshot | undefined, next: GameSnapshot, points: CatalogPoint[]) {
  const after = createProgressReader(next)
  const before = previous ? createProgressReader(previous) : undefined
  return points.filter(p => after.status(p) === 'complete' && before?.status(p) !== 'complete').map(p => ({ id: p.id, name: p.name }))
}
