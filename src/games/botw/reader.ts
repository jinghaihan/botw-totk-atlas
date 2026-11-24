import type { GameSnapshot } from '@/domain/game'
import * as CRC32 from 'crc-32'
import flags from './completion-flags.json'

export type BotwSnapshot = GameSnapshot

export async function readBotwSave(buffer: ArrayBuffer, filename: string): Promise<BotwSnapshot> {
  const view = new DataView(buffer)
  if (view.byteLength < 100_000 || view.byteLength > 4_000_000 || view.getUint32(4, true) !== 0xFFFFFFFF)
    throw new Error('请选择 BOTW 的 game_data.sav。')

  const offsets = new Map<number, number>()
  for (let p = 12; p + 8 <= view.byteLength; p += 8) {
    const key = view.getUint32(p, true)
    if (!offsets.has(key))
      offsets.set(key, p + 4)
  }
  const hash = (name: string) => CRC32.str(name) >>> 0
  const position = (name: string) => {
    const p = offsets.get(hash(name))
    if (p === undefined)
      throw new Error(`无法识别这份存档：缺少 ${name}。`)
    return p
  }
  const number = (name: string) => view.getUint32(position(name), true)
  const value = (key: number) => {
    const p = offsets.get(key)
    return p === undefined ? undefined : view.getUint32(p, true)
  }
  const progress = Object.entries(flags).map(([id, keys]) => {
    if (keys.some(key => value(key) === undefined))
      throw new Error('当前存档的收集标记不完整，请检查文件版本。')
    const labels: Record<string, string> = { koroks: '呀哈哈', hinoxes: '西诺克斯', taluses: '岩石巨人', moldugas: '莫尔德拉吉克', compendium: '图鉴登记记录' }
    return { id, label: labels[id]!, done: keys.filter(key => value(key) === 1).length, total: keys.length }
  })
  for (const [id, label, prefix] of [['shrines', '神庙通关', 'Clear_Dungeon'], ['shrine-chests', '宝箱全部领取的神庙', 'CompleteTreasure_Dungeon']]) {
    const keys = Array.from({ length: 136 }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`)
    progress.unshift({ id: id!, label: label!, done: keys.filter(key => number(key) === 1).length, total: keys.length })
  }

  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  return {
    game: 'botw',
    filename,
    fingerprint,
    importedAt: new Date().toISOString(),
    size: buffer.byteLength,
    progress,
    scalars: Object.fromEntries(Array.from(offsets, ([key, pos]) => [String(key), view.getUint32(pos, true)])),
    guids: [],
    milestones: [
      { label: '剑之试炼', complete: number('100enemy_Finish') === 1 },
      { label: '英杰们的诗篇', complete: number('BalladOfHeroes_Finish') === 1 },
      { label: '大师摩托 Zero', complete: number('IsGet_Obj_Motorcycle') === 1 },
    ],
  }
}
