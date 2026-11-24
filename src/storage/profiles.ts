import type { EntityTable, Table } from 'dexie'
import type { CatalogPoint, GameId, GameMode, GameSnapshot, PointAnnotation } from '@/domain/game'
import { Dexie } from 'dexie'
import { compareProgress } from '@/domain/completion'
import { AppError } from '@/domain/errors'
import { collectionSnapshot } from '@/domain/game'

export interface SaveProfile {
  id: string
  name: string
  game: GameId
  mode: GameMode
  updatedAt: string
  snapshot?: GameSnapshot
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
  categories: string[] | null
  status: 'all' | 'incomplete' | 'complete' | 'found-unfinished' | 'shrine-chests'
  layer: 'surface' | 'sky' | 'depths'
  search: string
  region?: string
}

export const db = new Dexie('wilds-atlas') as Dexie & {
  profiles: EntityTable<SaveProfile, 'id'>
  annotations: Table<PointAnnotation, [string, string]>
  imports: EntityTable<ImportRecord, 'id'>
  views: EntityTable<ProfileView, 'profileId'>
}
db.version(1).stores({ profiles: '&id, name, game, updatedAt' })
db.version(2).stores({
  profiles: '&id, name, game, mode, updatedAt',
  annotations: '[profileId+pointId], profileId, pointId',
  imports: '++id, profileId, importedAt',
  views: '&profileId',
})

// Keep the old table definition so existing databases retain their stored data.
db.version(3).stores({ pins: '&id, profileId' })
db.version(4).stores({}).upgrade((transaction) => {
  return transaction.table('profiles').toCollection().modify((profile) => {
    profile.snapshot = collectionSnapshot(profile.snapshot)
  })
})
db.version(5).stores({}).upgrade((transaction) => {
  return transaction.table('views').toCollection().modify((view) => {
    if (view.categories?.length === 0)
      view.categories = null
  })
})

db.version(6).stores({}).upgrade(async (transaction) => {
  await transaction.table('annotations').toCollection().modify((annotation) => {
    delete annotation.ignored
    if (annotation.status === 'unknown')
      delete annotation.status
  })
  await transaction.table('views').toCollection().modify((view) => {
    delete view.hideIgnored
  })
})

export function listProfiles() {
  return db.profiles.orderBy('updatedAt').reverse().toArray()
}

function validateProfileName(name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80)
    throw new AppError('error.profile-invalid-name')
  return trimmed
}

export async function createProfile(game: GameId, name: string) {
  const profile: SaveProfile = {
    id: crypto.randomUUID(),
    name: validateProfileName(name),
    game,
    mode: game === 'totk' ? 'normal' : 'unknown',
    updatedAt: new Date().toISOString(),
  }
  await db.profiles.add(profile)
  return profile
}

export function saveProfile(snapshot: GameSnapshot, name: string, id?: string, mode: GameMode = 'unknown', catalog: CatalogPoint[] = []) {
  return db.transaction('rw', db.profiles, db.imports, async () => {
    const existing = id ? await db.profiles.get(id) : undefined
    if (id && !existing)
      throw new AppError('error.import-target-missing')
    if (existing && existing.game !== snapshot.game)
      throw new AppError('error.import-game-mismatch')
    if (mode === 'master' && snapshot.game === 'totk')
      throw new AppError('error.totk-master-mode')
    const normalizedName = name.trim() || `${snapshot.game.toUpperCase()} · ${mode === 'master' ? '大师模式' : mode === 'normal' ? '普通模式' : '存档'}`
    if (normalizedName.length > 80)
      throw new AppError('error.profile-name-too-long')
    const profile = {
      id: id ?? crypto.randomUUID(),
      name: normalizedName,
      game: snapshot.game,
      mode: snapshot.game === 'totk' ? 'normal' : mode === 'unknown' ? existing?.mode ?? 'unknown' : mode,
      updatedAt: new Date().toISOString(),
      snapshot: collectionSnapshot(snapshot),
    } satisfies SaveProfile
    const previous = existing?.snapshot
    const changes = previous ? compareProgress(previous, snapshot, catalog) : []
    const regressions = previous ? compareProgress(snapshot, previous, catalog) : []
    await db.profiles.put(profile)
    await db.imports.add({ profileId: profile.id, importedAt: profile.updatedAt, filename: snapshot.filename, fingerprint: snapshot.fingerprint, initial: !previous, changes, regressions })
    return profile
  })
}

export async function renameProfile(id: string, name: string) {
  if (await db.profiles.update(id, { name: validateProfileName(name) }) === 0)
    throw new AppError('error.profile-missing')
}

export function deleteProfile(id: string) {
  return db.transaction('rw', [db.profiles, db.annotations, db.imports, db.views], async () => {
    await db.annotations.where('profileId').equals(id).delete()
    await db.imports.where('profileId').equals(id).delete()
    await db.views.delete(id)
    await db.profiles.delete(id)
  })
}

export function listAnnotations(profileId: string) {
  return db.annotations.where('profileId').equals(profileId).toArray()
}

export async function putAnnotation(annotation: PointAnnotation) {
  if (!await db.profiles.get(annotation.profileId))
    throw new AppError('error.profile-missing')
  await db.annotations.put(annotation)
}

export function listImports(profileId: string) {
  return db.imports.where('profileId').equals(profileId).reverse().toArray()
}
