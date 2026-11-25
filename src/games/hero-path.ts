import type { MapLayer } from '@/domain/game'
import { AppError } from '@/domain/errors'

export interface HeroPathSegment {
  layer: MapLayer
  points: [number, number][]
  end?: 'warp' | 'death'
}
export interface HeroPath {
  segments: HeroPathSegment[]
}

// Coordinates use the same X/Z convention as catalog points. Event markers split
// the line so warps, deaths and time spent inside shrines never cross the map.
function pathBuilder() {
  const segments: HeroPathSegment[] = []
  let current: HeroPathSegment | undefined
  return {
    break(event?: HeroPathSegment['end']) {
      if (current && event)
        current.end = event
      current = undefined
    },
    add(x: number, z: number, layer: MapLayer) {
      const previous = current?.points.at(-1)
      if (!current || current.layer !== layer || (previous && Math.hypot(x - previous[0], z - previous[1]) > 500)) {
        current = { layer, points: [] }
        segments.push(current)
      }
      current.points.push([x, z])
    },
    finish(): HeroPath { return { segments } },
  }
}

// BOTW layout research: https://gist.github.com/zephenryus/e46c797ccecf6134d4245bb9f2e5e2a5
export function readBotwHeroPath(buffers: ArrayBuffer[]): HeroPath {
  if (buffers.length > 30)
    throw new AppError('error.hero-path-invalid')
  const records: { time: number, words: number[] }[] = []
  for (const buffer of buffers) {
    const view = new DataView(buffer)
    if (view.byteLength !== 65536)
      throw new AppError('error.hero-path-invalid')
    if (new Uint8Array(buffer).every(byte => byte === 0))
      continue
    const little = view.getUint16(4, true) <= 300 && view.getUint32(8, true) < 0x10000
    const lastRecord = view.getUint8(2)
    const lastCount = view.getUint16(4, little)
    if (lastRecord >= 48 || lastCount > 300)
      throw new AppError('error.hero-path-invalid')
    for (let record = 0; record <= lastRecord; record++) {
      const offset = 64 + record * 1216
      const count = record === lastRecord ? lastCount : 300
      const words = Array.from({ length: count }, (_, index) => view.getUint32(offset + 16 + index * 4, little))
      records.push({ time: view.getUint32(offset + 4, little), words })
    }
  }
  // Blocks are reused after the history fills up; filenames are not chronological.
  records.sort((a, b) => a.time - b.time)
  const path = pathBuilder()
  for (const { words } of records) {
    for (const word of words) {
      const flags = word >>> 27
      if (!(flags & 0x10) || flags === 0x1F) {
        path.break()
        continue
      }
      const rawX = (word >>> 13) & 0x3FFF
      const rawZ = word & 0x1FFF
      const x = rawX >= 8192 ? 8192 - rawX : rawX
      const z = rawZ >= 4096 ? 4096 - rawZ : rawZ
      if (flags & 1)
        path.break('warp')
      path.add(x, z, 'surface')
      if (flags & 6)
        path.break(flags & 4 ? 'death' : 'warp')
    }
  }
  return path.finish()
}

// TOTK layout research: https://www.taricorp.net/2023/totk-footprints/
export function readTotkHeroPath(buffer: ArrayBuffer): HeroPath {
  const view = new DataView(buffer)
  if (view.byteLength < 364 || view.getUint32(0, true) !== 0x01020304)
    throw new AppError('error.hero-path-invalid')
  const count = view.getUint32(76, true)
  if (count > 153600 || 364 + count * 4 > view.byteLength)
    throw new AppError('error.hero-path-invalid')
  const layers = ['sky', 'surface', 'depths'] as const
  const path = pathBuilder()
  for (let index = 0; index < count; index++) {
    const word = view.getUint32(364 + index * 4, true)
    const layer = layers[(word >>> 3) & 3]
    if (!layer) {
      path.break()
      continue
    }
    const x = ((word >>> 6) & 0x1FFF) * (word & 0x20 ? -1 : 1)
    const z = (word >>> 20) * (word & 0x80000 ? -1 : 1)
    path.add(x, z, layer)
    if (word & 6)
      path.break(word & 2 ? 'death' : 'warp')
  }
  return path.finish()
}
