import type { HeroPath } from '@/games/hero-path'
import { describe, expect, it } from 'vitest'
import { advanceHeroPath, crossedHeroPathDeath, crossedHeroPathWarp, heroPathFrame, indexHeroPath } from '@/domain/hero-path-playback'

const path: HeroPath = { segments: [
  { layer: 'surface', points: [[0, 0], [10, 20]], end: 'warp' },
  { layer: 'sky', points: [[1000, 2000], [1010, 2020]], end: 'death' },
  { layer: 'depths', points: [[100, 200], [100, 200], [110, 220]] },
] }

describe('hero’s Path replay', () => {
  const index = indexHeroPath(path)
  it('indexes all layers together, preserving stationary samples', () => {
    expect(index.length).toBe(6)
    expect(index.ranges.map(range => [range.start, range.end])).toEqual([[0, 1], [2, 3], [4, 6]])
    expect(heroPathFrame(index, 4.5)?.at).toEqual([100, 200])
  })
  it('interpolates movement within a segment and jumps across warps', () => {
    expect(heroPathFrame(index, 0.5)?.at).toEqual([5, 10])
    expect(heroPathFrame(index, 1.9)?.at).toEqual([10, 20])
    expect(heroPathFrame(index, 2)?.at).toEqual([1000, 2000])
    expect(heroPathFrame(index, 2)?.layer).toBe('sky')
  })
  it('marks a death only at its recorded position', () => {
    expect(heroPathFrame(index, 2.9)?.death).toBe(false)
    expect(heroPathFrame(index, 3)?.death).toBe(true)
    expect(heroPathFrame(index, 4)?.death).toBe(false)
  })
  it('finds a teleport in either direction without replaying one already crossed', () => {
    expect(index.warps).toEqual([{ from: 1, to: 2 }])
    expect(crossedHeroPathWarp(index, 0.5, 2.5)).toEqual({ from: 1, to: 2 })
    expect(crossedHeroPathWarp(index, 2.5, 0.5)).toEqual({ from: 2, to: 1 })
    expect(crossedHeroPathWarp(index, 1, 2.5)).toEqual({ from: 1, to: 2 })
    expect(crossedHeroPathWarp(index, 2, 1)).toEqual({ from: 2, to: 1 })
    expect(crossedHeroPathWarp(index, 2, 3)).toBeUndefined()
    expect(crossedHeroPathWarp(index, 1, 0)).toBeUndefined()
  })
  it('distinguishes ordinary layer changes from discontinuities and deaths', () => {
    const layers: HeroPath = { segments: [
      { layer: 'sky', points: [[0, 0], [1, 1]] },
      { layer: 'surface', points: [[2, 2], [3, 3]] },
      { layer: 'surface', points: [[2000, 2000]], end: 'death' },
      { layer: 'surface', points: [[4000, 4000]] },
    ] }
    expect(indexHeroPath(layers).warps).toEqual([{ from: 3, to: 4 }])
  })
  it('finds the first crossed death in either direction without replaying the current event', () => {
    const deaths = [10, 20, 30]
    expect(crossedHeroPathDeath(deaths, 5, 25)).toBe(10)
    expect(crossedHeroPathDeath(deaths, 10, 25)).toBe(20)
    expect(crossedHeroPathDeath(deaths, 25, 5)).toBe(20)
    expect(crossedHeroPathDeath(deaths, 20, 5)).toBe(10)
    expect(crossedHeroPathDeath(deaths, 30, 31)).toBeUndefined()
    expect(crossedHeroPathDeath([], 10, 20)).toBeUndefined()
  })
  it('clamps seeks and supports empty and single-point paths', () => {
    expect(heroPathFrame(index, -10)?.at).toEqual([0, 0])
    expect(heroPathFrame(index, 100)?.at).toEqual([110, 220])
    expect(heroPathFrame(indexHeroPath(), 0)).toBeUndefined()
    expect(heroPathFrame(indexHeroPath({ segments: [{ layer: 'sky', points: [[1, 2]] }] }), 0)?.at).toEqual([1, 2])
  })
  it('advances both ways, scales speed, stops at the ends and limits suspended-frame jumps', () => {
    expect(advanceHeroPath(20, 100, 100, 10, 1)).toBe(21)
    expect(advanceHeroPath(20, 100, 100, 10, -1)).toBe(19)
    expect(advanceHeroPath(20, 100, 100, 50, 1)).toBe(25)
    expect(advanceHeroPath(99, 100, 100, 50, 1)).toBe(100)
    expect(advanceHeroPath(1, 100, 100, 50, -1)).toBe(0)
    expect(advanceHeroPath(0, 100, 10000, 10, 1)).toBe(2.5)
  })
})
