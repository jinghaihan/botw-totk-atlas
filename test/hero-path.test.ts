import { describe, expect, it } from 'vitest'
import { readBotwHeroPath, readTotkHeroPath } from '@/games/hero-path'

function botwPoint(x: number, z: number, flags = 0x10) {
  return ((x < 0 ? 8192 - x : x) << 13) | (z < 0 ? 4096 - z : z) | (flags << 27)
}
function botwBlock(records: number[][], time: number, little = true) {
  const buffer = new ArrayBuffer(65536)
  const view = new DataView(buffer)
  view.setUint8(2, records.length - 1)
  view.setUint16(4, records.at(-1)!.length, little)
  view.setUint32(8, 17, little)
  for (const [index, words] of records.entries()) {
    const offset = 64 + index * 1216
    view.setUint32(offset + 4, time + index, little)
    for (const [position, word] of words.entries())
      view.setUint32(offset + 16 + position * 4, word, little)
  }
  return buffer
}
function totkPoint(x: number, z: number, layer = 1, flags = 0) {
  return (Math.abs(x) << 6) | (x < 0 ? 0x20 : 0) | (Math.abs(z) << 20) | (z < 0 ? 0x80000 : 0) | (layer << 3) | flags
}
function totkFile(words: number[]) {
  const buffer = new ArrayBuffer(364 + words.length * 4)
  const view = new DataView(buffer)
  view.setUint32(0, 0x01020304, true)
  view.setUint32(76, words.length, true)
  for (const [index, word] of words.entries())
    view.setUint32(364 + index * 4, word, true)
  return buffer
}

describe('bOTW Hero’s Path', () => {
  it('keeps stationary samples, isolated event points and death markers for replay', () => {
    const path = readBotwHeroPath([botwBlock([[botwPoint(1, 2), botwPoint(1, 2), botwPoint(2, 3, 0x14), botwPoint(10, 20, 0x12)]], 1)])
    expect(path.segments).toEqual([
      { layer: 'surface', points: [[1, 2], [1, 2], [2, 3]], end: 'death' },
      { layer: 'surface', points: [[10, 20]], end: 'warp' },
    ])
  })
  it.each([true, false])('reads full preceding records and only the used part of the last record (little endian: %s)', (little) => {
    const full = Array.from({ length: 300 }, (_, index) => botwPoint(-300 + index, -50))
    const path = readBotwHeroPath([botwBlock([full, [botwPoint(0, -50), botwPoint(1, -50)]], 100, little)])
    expect(path.segments).toHaveLength(1)
    expect(path.segments[0]?.points).toHaveLength(302)
    expect(path.segments[0]?.points[0]).toEqual([-300, -50])
    expect(path.segments[0]?.points.at(-1)).toEqual([1, -50])
  })
  it('orders reused blocks by recorded time and breaks after warps and deaths', () => {
    const earlier = botwBlock([[botwPoint(10, 20), botwPoint(11, 20, 0x12)]], 1)
    const later = botwBlock([[botwPoint(30, 40), botwPoint(31, 40, 0x14), botwPoint(50, 60), botwPoint(51, 60)]], 100)
    expect(readBotwHeroPath([later, earlier]).segments.map(segment => segment.points))
      .toEqual([[[10, 20], [11, 20]], [[30, 40], [31, 40]], [[50, 60], [51, 60]]])
  })
  it('does not join through interiors, reloads, or large jumps', () => {
    const words = [botwPoint(10, 20), botwPoint(11, 20), botwPoint(1, 1, 0), botwPoint(12, 20), botwPoint(13, 20), botwPoint(14, 20, 0x11), botwPoint(15, 20), botwPoint(4000, 20), botwPoint(4001, 20)]
    expect(readBotwHeroPath([botwBlock([words], 1)]).segments.map(segment => segment.points))
      .toEqual([[[10, 20], [11, 20]], [[12, 20], [13, 20]], [[14, 20], [15, 20]], [[4000, 20], [4001, 20]]])
  })
  it('ignores empty allocated blocks and rejects truncated or invalid blocks', () => {
    expect(readBotwHeroPath([new ArrayBuffer(65536)]).segments).toEqual([])
    expect(() => readBotwHeroPath([new ArrayBuffer(200)])).toThrow('error.hero-path-invalid')
    const buffer = botwBlock([[botwPoint(10, 20)]], 1)
    new DataView(buffer).setUint8(2, 48)
    expect(() => readBotwHeroPath([buffer])).toThrow('error.hero-path-invalid')
  })
})

describe('tOTK Hero’s Path', () => {
  it('converts signs to world X/Z and splits paths at layer transitions', () => {
    const path = readTotkHeroPath(totkFile([
      totkPoint(-5000, -3000, 0),
      totkPoint(-5001, -3001, 0),
      totkPoint(-5001, -3001, 1),
      totkPoint(-5002, -3002, 1),
      totkPoint(1, 2, 2),
      totkPoint(2, 3, 2),
    ]))
    expect(path.segments).toEqual([
      { layer: 'sky', points: [[-5000, -3000], [-5001, -3001]] },
      { layer: 'surface', points: [[-5001, -3001], [-5002, -3002]] },
      { layer: 'depths', points: [[1, 2], [2, 3]] },
    ])
  })
  it('breaks after warp and death events and skips unknown layers', () => {
    const path = readTotkHeroPath(totkFile([
      totkPoint(10, 20),
      totkPoint(11, 20, 1, 4),
      totkPoint(30, 40),
      totkPoint(31, 40, 1, 2),
      totkPoint(50, 60),
      totkPoint(51, 60),
      totkPoint(52, 60, 3),
      totkPoint(53, 60),
      totkPoint(54, 60),
    ]))
    expect(path.segments.map(segment => segment.points)).toEqual([
      [[10, 20], [11, 20]],
      [[30, 40], [31, 40]],
      [[50, 60], [51, 60]],
      [[53, 60], [54, 60]],
    ])
  })
  it('uses the recorded count, ignoring unused capacity', () => {
    const buffer = totkFile([totkPoint(1, 1), totkPoint(2, 2), totkPoint(3, 3)])
    new DataView(buffer).setUint32(76, 2, true)
    expect(readTotkHeroPath(buffer).segments[0]?.points).toEqual([[1, 1], [2, 2]])
  })
  it('rejects invalid headers and counts that exceed the file', () => {
    expect(() => readTotkHeroPath(new ArrayBuffer(364))).toThrow('error.hero-path-invalid')
    const buffer = totkFile([])
    new DataView(buffer).setUint32(76, 1, true)
    expect(() => readTotkHeroPath(buffer)).toThrow('error.hero-path-invalid')
  })
})
