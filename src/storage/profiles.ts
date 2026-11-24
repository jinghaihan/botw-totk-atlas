import type { EntityTable, Table } from 'dexie'
import type { CatalogPoint, GameId, GameMode, GameSnapshot, PointAnnotation } from '@/domain/game'
import { Dexie } from 'dexie'
import { compareProgress } from '@/domain/completion'

export interface SaveProfile {
  id: string
  name: string
  game: GameId
  mode: GameMode
  updatedAt: string
  snapshot: GameSnapshot
}
export interface ImportRecord {
  id?: number
  profileId: string
  importedAt: string
  filename: string
  fingerprint: string
  initial: boolean
  changes: { id: string, name: string }[]
  regressions?: { id: string, name: string }[]
}
export interface ProfileView {
  profileId: string
  categories: string[]
  status: 'all' | 'incomplete' | 'complete' | 'unknown' | 'found-unfinished' | 'shrine-chests'
  layer: 'surface' | 'sky' | 'depths'
  hideIgnored: boolean
  search: string
  region?: string
}

export interface CustomPoint extends CatalogPoint {
  profileId: string
}

export const db = new Dexie('wilds-atlas') as Dexie & {
  profiles: EntityTable<SaveProfile, 'id'>
  annotations: Table<PointAnnotation, [string, string]>
  imports: EntityTable<ImportRecord, 'id'>
  views: EntityTable<ProfileView, 'profileId'>
  pins: EntityTable<CustomPoint, 'id'>
}
db.version(1).stores({ profiles: '&id, name, game, updatedAt' })
db.version(2).stores({
  profiles: '&id, name, game, mode, updatedAt',
  annotations: '[profileId+pointId], profileId, pointId',
  imports: '++id, profileId, importedAt',
  views: '&profileId',
})

db.version(3).stores({ pins: '&id, profileId' })

export function listProfiles() {
  return db.profiles.orderBy('updatedAt').reverse().toArray()
}

export async function saveProfile(snapshot: GameSnapshot, name: string, id?: string, mode: GameMode = 'normal', catalog: CatalogPoint[] = []) {
  const existing = id ? await db.profiles.get(id) : undefined
  if (id && !existing)
    throw new Error('目标 Profile 已不存在，请重新选择。')
  if (existing && existing.game !== snapshot.game)
    throw new Error('这份存档与目标 Profile 的游戏不同，请创建新的 Profile。')
  if (mode === 'master' && snapshot.game === 'totk')
    throw new Error('TOTK 没有大师模式。')
  const normalizedName = name.trim() || `${snapshot.game.toUpperCase()} · ${mode === 'master' ? '大师模式' : '普通模式'}`
  if (normalizedName.length > 80)
    throw new Error('Profile 名称最多 80 个字符。')
  const profile: SaveProfile = {
    id: id ?? crypto.randomUUID(),
    name: normalizedName,
    game: snapshot.game,
    mode: existing?.mode ?? mode,
    updatedAt: new Date().toISOString(),
    snapshot,
  }
  const changes = existing ? compareProgress(existing.snapshot, snapshot, catalog) : []
  const regressions = existing ? compareProgress(snapshot, existing.snapshot, catalog) : []
  await db.transaction('rw', db.profiles, db.imports, async () => {
    await db.profiles.put(profile)
    await db.imports.add({ profileId: profile.id, importedAt: profile.updatedAt, filename: snapshot.filename, fingerprint: snapshot.fingerprint, initial: !existing, changes, regressions })
  })
  return profile
}

export async function renameProfile(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80)
    throw new Error('请输入 1–80 个字符的名称。')
  if (await db.profiles.update(id, { name: trimmed }) === 0)
    throw new Error('Profile 已不存在。')
}

export function deleteProfile(id: string) {
  return db.transaction('rw', [db.profiles, db.annotations, db.imports, db.views, db.pins], async () => {
    await db.annotations.where('profileId').equals(id).delete()
    await db.imports.where('profileId').equals(id).delete()
    await db.views.delete(id)
    await db.pins.where('profileId').equals(id).delete()
    await db.profiles.delete(id)
  })
}

export function listAnnotations(profileId: string) {
  return db.annotations.where('profileId').equals(profileId).toArray()
}

export async function putAnnotation(annotation: PointAnnotation) {
  if (!await db.profiles.get(annotation.profileId))
    throw new Error('Profile 已不存在。')
  await db.annotations.put(annotation)
}

export function listImports(profileId: string) {
  return db.imports.where('profileId').equals(profileId).reverse().toArray()
}
