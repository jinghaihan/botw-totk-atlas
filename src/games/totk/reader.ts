import type { GameSnapshot, InventoryItem } from '@/domain/game'
import murmur from 'murmurhash3js'
import groups from './completion-flags.json'

const hash = (name: string) => murmur.x86.hash32(name) >>> 0

export async function readTotkSave(buffer: ArrayBuffer, filename: string): Promise<GameSnapshot> {
  const view = new DataView(buffer)
  if (buffer.byteLength < 100_000 || buffer.byteLength > 8_000_000 || view.getUint32(0, true) !== 0x01020304)
    throw new Error('请选择 TOTK 的 progress.sav。')

  const offsets = new Map<number, number>()
  const guids = new Set<string>()
  let foundMetadata = false
  for (let p = 0x28; p + 8 <= view.byteLength; p += 8) {
    const key = view.getUint32(p, true)
    if (key === 0xA3DB7114) {
      foundMetadata = true
      const base = view.getUint32(p + 4, true)
      if (base < p + 8 || base + 8 > buffer.byteLength)
        throw new Error('TOTK 存档的数据边界无效。')
      let terminated = false
      for (let q = base; q + 8 <= view.byteLength; q += 8) {
        const id = view.getBigUint64(q, true)
        if (id === 0n) {
          terminated = true
          break
        }
        guids.add(id.toString())
      }
      if (!terminated)
        throw new Error('TOTK 存档的收集记录不完整。')
      break
    }
    // Zero hashes delimit value-type sections in the native save table.
    if (key === 0)
      continue
    if (offsets.has(key))
      throw new Error('TOTK 存档包含重复字段，请确认格式。')
    offsets.set(key, p + 4)
  }
  if (!foundMetadata)
    throw new Error('无法找到 TOTK 存档数据边界。')
  const pos = (name: string) => {
    const p = offsets.get(hash(name))
    if (p === undefined)
      throw new Error(`当前存档缺少 ${name}。`)
    return p
  }
  const u = (name: string) => view.getUint32(pos(name), true)
  const f = (name: string) => view.getFloat32(pos(name), true)
  const scalar = (key: number) => {
    const p = offsets.get(key)
    return p === undefined ? undefined : view.getUint32(p, true)
  }
  const array = (name: string, stride: number) => {
    const base = u(name)
    if (base + 4 > buffer.byteLength)
      throw new Error('存档中的数组位置无效。')
    const count = view.getUint32(base, true)
    if (count > 3000 || base + 4 + count * stride > buffer.byteLength)
      throw new Error('存档中的数组长度无效。')
    return { base: base + 4, count }
  }
  const utf8 = new TextDecoder('utf-8', { fatal: true })
  function strings(name: string, wide = false) {
    const stride = wide ? 32 : 64
    const a = array(name, stride)
    const decoder = wide ? new TextDecoder('utf-16le', { fatal: true }) : utf8
    return Array.from({ length: a.count }, (_, i) => {
      const bytes = new Uint8Array(buffer, a.base + i * stride, stride)
      let end = stride
      for (let j = 0; j < stride; j += wide ? 2 : 1) {
        if (bytes[j] === 0 && (!wide || bytes[j + 1] === 0)) {
          end = j
          break
        }
      }
      return decoder.decode(bytes.subarray(0, end))
    })
  }
  const numbers = (name: string) => {
    const a = array(name, 4)
    return Array.from({ length: a.count }, (_, i) => view.getInt32(a.base + i * 4, true))
  }
  const items: InventoryItem[] = []
  const pouches = [
    ['Weapon', 'weapons', 'Life'],
    ['Bow', 'bows', 'Life'],
    ['Shield', 'shields', 'Life'],
    ['Armor', 'armor', ''],
    ['Arrow', 'arrows', 'StockNum'],
    ['Material', 'materials', 'StockNum'],
    ['Food', 'food', 'StockNum'],
    ['SpecialParts', 'devices', 'StockNum'],
    ['KeyItem', 'other', 'StockNum'],
  ]
  for (const [pouch, category, quantity] of pouches) {
    const prefix = `Pouch.${pouch}.Content`
    const ids = strings(`${prefix}.Name`)
    const quantities = quantity ? numbers(`${prefix}.${quantity}`) : []
    const equipment = ['weapons', 'bows', 'shields'].includes(category!)
    const effects = equipment ? numbers(`${prefix}.Effect.Type`) : []
    const values = equipment ? numbers(`${prefix}.Effect.Value`) : []
    const fuses = pouch === 'Weapon' || pouch === 'Shield' ? strings(`${prefix}.Combined.Name`) : []
    for (let i = 0; i < ids.length; i++) {
      if (!ids[i])
        continue
      items.push({ slot: i + 1, id: ids[i]!, category: category!, quantity: equipment ? 1 : quantities[i] ?? 1, ...(equipment ? { durability: quantities[i], modifier: effects[i]! >>> 0, modifierValue: values[i] } : {}), ...(fuses[i] ? { fuseId: fuses[i] } : {}) })
    }
  }
  const horseActors = strings('OwnedHorseList.ActorName')
  const horseNames = strings('OwnedHorseList.Name', true)
  const horseManes = numbers('OwnedHorseList.Mane')
  const maneNames = ['Horse_Link_Mane', ...Array.from({ length: 13 }, (_, i) => `Horse_Link_Mane_${String(i + 1).padStart(2, '0')}`), 'Horse_Link_Mane_00L', 'Horse_Link_Mane_01L']
  const horses = horseActors.flatMap((actor, i) => actor ? [{ actor, name: horseNames[i] ?? '', mane: maneNames.find(name => hash(name) === (horseManes[i]! >>> 0)) ?? '默认鬃毛' }] : [])
  const definitions = [
    ['SHRINES_STATUS', '神庙通关', 'Clear'],
    ['LIGHTROOTS_STATUS', '破魔之根', 'Open'],
    ['KOROKS_HIDDEN', '呀哈哈 · 普通谜题', ''],
    ['KOROKS_CARRY', '呀哈哈 · 运送朋友', 'Clear'],
    ['BUBBULS_DEFEATED', '魔犹伊', ''],
    ['LOCATION_CAVES_VISITED', '洞窟', ''],
    ['LOCATION_WELLS_VISITED', '井', ''],
    ['LOCATIONS_VISITED', '地图探索地点', ''],
    ['BOSSES_HINOXES_DEFEATED', '西诺克斯', ''],
    ['BOSSES_TALUSES_DEFEATED', '岩石巨人', ''],
    ['BOSSES_MOLDUGAS_DEFEATED', '莫尔德拉吉克', ''],
    ['BOSSES_FLUX_CONSTRUCT_DEFEATED', '方块魔像', ''],
    ['BOSSES_FROXS_DEFEATED', '巨霸迦马', ''],
    ['BOSSES_GLEEOKS_DEFEATED', '古栗欧克', ''],
    ['BOSSES_REMATCH_DEFEATED', '地底神殿 Boss 重战', ''],
    ['SAGE_WILLS_FOUND', '贤者的遗志', ''],
    ['TREASURE_MAPS_FOUND', '古旧地图', ''],
    ['ADDISON_COMPLETED', '广告牌', ''],
  ]
  const progress = definitions.map(([id, label, expected]) => {
    const keys = (groups as unknown as Record<string, (number | string)[]>)[id!]
    if (!keys)
      throw new Error(`收集目录缺少 ${id}。`)
    return { id: id!, label: label!, total: keys.length, done: keys.filter(key => typeof key === 'string' ? guids.has(BigInt(key).toString()) : scalar(key) === (expected ? hash(expected) : 1)).length }
  })
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return {
    game: 'totk',
    filename,
    fingerprint: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''),
    importedAt: new Date().toISOString(),
    size: buffer.byteLength,
    rupees: u('PlayerStatus.CurrentRupee'),
    mon: items.find(i => i.id === 'MinusRupee')?.quantity ?? 0,
    hearts: u('PlayerStatus.MaxLife') / 4,
    stamina: f('PlayerStatus.MaxStamina'),
    energy: f('PlayerStatus.MaxEnergy'),
    progress,
    items,
    horses,
    milestones: [{ label: '通关记录', complete: u('IsGameClear') === 1 }],
    scalars: Object.fromEntries(Array.from(offsets, ([key, p]) => [String(key), view.getUint32(p, true)])),
    guids: [...guids],
  }
}
