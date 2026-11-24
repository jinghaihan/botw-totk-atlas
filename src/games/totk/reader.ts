import type { GameSnapshot } from '@/domain/game'
import murmur from 'murmurhash3js'
import { AppError } from '@/domain/errors'
import { progressLabels } from '@/domain/game'
import groups from './completion-flags.json'

const hash = (name: string) => murmur.x86.hash32(name) >>> 0

export async function readTotkSave(buffer: ArrayBuffer, filename: string): Promise<GameSnapshot> {
  const view = new DataView(buffer)
  if (buffer.byteLength < 100_000 || buffer.byteLength > 8_000_000 || view.getUint32(0, true) !== 0x01020304)
    throw new AppError('error.select-totk-save')

  const offsets = new Map<number, number>()
  const guids = new Set<string>()
  let foundMetadata = false
  for (let p = 0x28; p + 8 <= view.byteLength; p += 8) {
    const key = view.getUint32(p, true)
    if (key === 0xA3DB7114) {
      foundMetadata = true
      const base = view.getUint32(p + 4, true)
      if (base < p + 8 || base + 8 > buffer.byteLength)
        throw new AppError('error.totk-invalid-data-boundary')
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
        throw new AppError('error.totk-incomplete-guids')
      break
    }
    // Zero hashes delimit value-type sections in the native save table.
    if (key === 0)
      continue
    if (offsets.has(key))
      throw new AppError('error.totk-duplicate-fields')
    offsets.set(key, p + 4)
  }
  if (!foundMetadata)
    throw new AppError('error.totk-missing-data-boundary')
  const pos = (name: string) => {
    const p = offsets.get(hash(name))
    if (p === undefined)
      throw new AppError('error.totk-missing-field', { name })
    return p
  }
  const u = (name: string) => view.getUint32(pos(name), true)
  const scalar = (key: number) => {
    const p = offsets.get(key)
    return p === undefined ? undefined : view.getUint32(p, true)
  }
  const definitions = [
    ['SHRINES_STATUS', '神庙通关', 'Clear'],
    ['LIGHTROOTS_STATUS', '破魔之根', 'Open'],
    ['KOROKS_HIDDEN', progressLabels.KOROKS_HIDDEN, ''],
    ['KOROKS_CARRY', progressLabels.KOROKS_CARRY, 'Clear'],
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
    ['TREASURE_MAPS_FOUND', progressLabels.TREASURE_MAPS_FOUND, ''],
    ['ADDISON_COMPLETED', '广告牌', ''],
  ]
  const progress = definitions.map(([id, label, expected]) => {
    const keys = (groups as unknown as Record<string, (number | string)[]>)[id!]
    if (!keys)
      throw new AppError('error.missing-progress-group', { id: id! })
    if (keys.some(key => typeof key === 'number' && scalar(key) === undefined))
      throw new AppError('error.save-incomplete-progress')
    return { id: id!, label: label!, total: keys.length, done: keys.filter(key => typeof key === 'string' ? guids.has(BigInt(key).toString()) : scalar(key) === (expected ? hash(expected) : 1)).length }
  })
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return {
    game: 'totk',
    filename,
    fingerprint: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''),
    importedAt: new Date().toISOString(),
    size: buffer.byteLength,
    progress,
    milestones: [{ label: '通关记录', complete: u('IsGameClear') === 1 }],
    scalars: Object.fromEntries(Array.from(offsets, ([key, p]) => [String(key), view.getUint32(p, true)])),
    guids: [...guids],
  }
}
