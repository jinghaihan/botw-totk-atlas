import type { HeroPath, HeroPathSegment } from '@/games/hero-path'

export interface HeroPathRange {
  segment: HeroPathSegment
  start: number
  end: number
}
export interface HeroPathWarp {
  from: number
  to: number
}
export interface HeroPathWarpAnimation extends HeroPathWarp {
  phase: 'out' | 'in'
  progress: number
}

export function indexHeroPath(path?: HeroPath) {
  let count = 0
  const ranges: HeroPathRange[] = []
  for (const segment of path?.segments ?? []) {
    if (!segment.points.length)
      continue
    ranges.push({ segment, start: count, end: count + segment.points.length - 1 })
    count += segment.points.length
  }
  const warps: HeroPathWarp[] = []
  for (let i = 1; i < ranges.length; i++) {
    const previous = ranges[i - 1]
    const next = ranges[i]
    const from = previous.segment.points.at(-1)!
    const to = next.segment.points[0]
    if (previous.segment.end === 'warp' || (previous.segment.end !== 'death' && Math.hypot(from[0] - to[0], from[1] - to[1]) > 500))
      warps.push({ from: previous.end, to: next.start })
  }
  return { ranges, warps, length: Math.max(0, count - 1) }
}
export type HeroPathIndex = ReturnType<typeof indexHeroPath>

export function heroPathFrame(index: HeroPathIndex, position: number) {
  if (!index.ranges.length)
    return
  const cursor = Math.max(0, Math.min(index.length, position))
  let low = 0
  let high = index.ranges.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (index.ranges[middle].start <= cursor)
      low = middle
    else high = middle - 1
  }
  const range = index.ranges[low]
  const pointIndex = Math.min(range.segment.points.length - 1, Math.floor(cursor - range.start))
  const point = range.segment.points[pointIndex]
  const next = range.segment.points[pointIndex + 1] ?? point
  const fraction = Math.min(1, cursor - range.start - pointIndex)
  const at: [number, number] = [point[0] + (next[0] - point[0]) * fraction, point[1] + (next[1] - point[1]) * fraction]
  return {
    at,
    layer: range.segment.layer,
    death: pointIndex === range.segment.points.length - 1 && range.segment.end === 'death',
    angle: Math.atan2(next[1] - point[1], next[0] - point[0]) + Math.PI / 2,
  }
}

export function advanceHeroPath(position: number, length: number, elapsed: number, rate: number, direction: 1 | -1) {
  return Math.max(0, Math.min(length, position + Math.max(0, Math.min(elapsed, 250)) * rate * direction / 1000))
}

export function crossedHeroPathDeath(deaths: number[], from: number, to: number) {
  let low = 0
  let high = deaths.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (deaths[middle] <= from)
      low = middle + 1
    else high = middle
  }
  if (to > from)
    return deaths[low] <= to ? deaths[low] : undefined
  const previous = deaths[low - 1] === from ? low - 2 : low - 1
  return deaths[previous] >= to ? deaths[previous] : undefined
}

export function crossedHeroPathWarp(index: HeroPathIndex, from: number, to: number): HeroPathWarp | undefined {
  const forward = to > from
  let low = 0
  let high = index.warps.length
  const threshold = (warp: HeroPathWarp) => forward ? warp.to : warp.from
  while (low < high) {
    const middle = (low + high) >>> 1
    if (threshold(index.warps[middle]) <= from)
      low = middle + 1
    else high = middle
  }
  if (forward) {
    const warp = index.warps[low]
    return warp && warp.to <= to ? warp : undefined
  }
  const previous = index.warps[low - 1]
  const warp = previous?.from === from ? index.warps[low - 2] : previous
  return warp && warp.from >= to ? { from: warp.to, to: warp.from } : undefined
}
