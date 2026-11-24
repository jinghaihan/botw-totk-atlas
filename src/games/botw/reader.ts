import type { GameSnapshot, InventoryItem } from '@/domain/game'
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
  const decoder = new TextDecoder('utf-8', { fatal: true })
  function string(p: number) {
    const bytes = new Uint8Array(64)
    if (p + 128 > buffer.byteLength)
      throw new Error('存档中的背包或马匹记录不完整。')
    for (let i = 0; i < 16; i++)
      bytes.set(new Uint8Array(buffer, p + i * 8, 4), i * 4)
    const end = bytes.indexOf(0)
    return decoder.decode(bytes.subarray(0, end < 0 ? bytes.length : end))
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

  const items: InventoryItem[] = []
  const itemBase = position('PorchItem')
  const quantityBase = position('PorchItem_Value1')
  const counts: Record<string, number> = { weapons: 0, bows: 0, shields: 0 }
  const modifierFields: Record<string, [number, number]> = {
    weapons: [0x57EE221D, 0xA6D926BC],
    bows: [0x0CBF052A, 0x1E3FD294],
    shields: [0xC5238D2B, 0x69F17E8A],
  }
  for (let i = 0; i < 420; i++) {
    const id = string(itemBase + i * 128)
    if (!id)
      continue
    const category = /^Weapon_(?:Sword|Lsword|Spear)_/.test(id) ? 'weapons' : id.startsWith('Weapon_Bow_') ? 'bows' : id.startsWith('Weapon_Shield_') ? 'shields' : id.startsWith('Armor_') ? 'armor' : /Arrow/.test(id) ? 'arrows' : /^(?:Item_|Animal_|BeeHome)/.test(id) ? 'materials' : 'other'
    const item: InventoryItem = { slot: i + 1, id, category, quantity: view.getUint32(quantityBase + i * 8, true) }
    const fields = modifierFields[category]
    if (fields) {
      const index = counts[category]!
      const a = offsets.get(fields[0])
      const b = offsets.get(fields[1])
      if (a === undefined || b === undefined)
        throw new Error('无法识别装备附加效果记录。')
      item.modifier = view.getUint32(a + index * 8, true)
      item.modifierValue = view.getUint32(b + index * 8, true)
      item.durability = item.quantity / 100
      counts[category] = index + 1
    }
    items.push(item)
  }

  const horses = Array.from({ length: 5 }, (_, i) => ({
    name: string(position('Horse_UserName') + i * 128),
    actor: string(position('Horse_ActorName') + i * 128),
    mane: string(position('Horse_ManeName') + i * 128),
  })).filter(horse => horse.actor)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  return {
    game: 'botw',
    filename,
    fingerprint,
    importedAt: new Date().toISOString(),
    size: buffer.byteLength,
    rupees: number('CurrentRupee'),
    mon: number('CurrentMamo'),
    hearts: number('MaxHartValue') / 4,
    stamina: view.getFloat32(position('StaminaMax'), true),
    progress,
    items,
    horses,
    scalars: Object.fromEntries(Array.from(offsets, ([key, pos]) => [String(key), view.getUint32(pos, true)])),
    guids: [],
    milestones: [
      { label: '剑之试炼', complete: number('100enemy_Finish') === 1 },
      { label: '英杰们的诗篇', complete: number('BalladOfHeroes_Finish') === 1 },
      { label: '大师摩托 Zero', complete: number('IsGet_Obj_Motorcycle') === 1 },
    ],
  }
}
