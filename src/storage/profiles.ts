import type { EntityTable, Table } from 'dexie'
import type { CatalogPoint, GameId, GameMode, GameSnapshot, PointAnnotation } from '@/domain/game'
import { Dexie } from 'dexie'
import { createProgressReader } from '@/domain/completion'
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
export interface ProfileView {
  profileId: string
  categories: string[] | null
  status: 'all' | 'incomplete'
  layer: 'surface' | 'sky' | 'depths'
  search: string
}

export const db = new Dexie('wilds-atlas') as Dexie & {
  profiles: EntityTable<SaveProfile, 'id'>
  annotations: Table<PointAnnotation, [string, string]>
  views: EntityTable<ProfileView, 'profileId'>
}
db.version(1).stores({ profiles: '&id, name, game, updatedAt' })
db.version(2).stores({
  profiles: '&id, name, game, mode, updatedAt',
  annotations: '[profileId+pointId], profileId, pointId',
  imports: '++id, profileId, importedAt',
  views: '&profileId',
})

// Historical schema for existing IndexedDB databases.
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

export async function listProfiles() {
  const profiles = await db.profiles.orderBy('updatedAt').reverse().toArray()
  return profiles.map(profile => profile.snapshot ? { ...profile, snapshot: collectionSnapshot(profile.snapshot) } : profile)
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

export function saveProfile(snapshot: GameSnapshot, name: string, id?: string, mode: GameMode = 'unknown', updateCatalog?: CatalogPoint[]) {
  return db.transaction('rw', [db.profiles, db.annotations], async () => {
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
    if (existing && updateCatalog) {
      const points = new Map(updateCatalog.map(point => [point.id, point]))
      const { status } = createProgressReader(snapshot)
      await db.annotations.where('profileId').equals(existing.id).and(({ pointId }) => {
        const point = points.get(pointId)
        return point !== undefined && status(point) !== undefined
      }).delete()
    }
    const profile = {
      id: id ?? crypto.randomUUID(),
      name: normalizedName,
      game: snapshot.game,
      mode: snapshot.game === 'totk' ? 'normal' : mode === 'unknown' ? existing?.mode ?? 'unknown' : mode,
      updatedAt: new Date().toISOString(),
      snapshot: collectionSnapshot(snapshot),
    } satisfies SaveProfile
    await db.profiles.put(profile)
    return profile
  })
}

export async function renameProfile(id: string, name: string) {
  if (await db.profiles.update(id, { name: validateProfileName(name) }) === 0)
    throw new AppError('error.profile-missing')
}

export function deleteProfile(id: string) {
  const legacyImports = db.table('imports')
  return db.transaction('rw', [db.profiles, db.annotations, legacyImports, db.views], async () => {
    await db.annotations.where('profileId').equals(id).delete()
    await legacyImports.where('profileId').equals(id).delete()
    await db.views.delete(id)
    await db.profiles.delete(id)
  })
}

export function listAnnotations(profileId: string) {
  return db.annotations.where('profileId').equals(profileId).toArray()
}

export function putAnnotation(annotation: PointAnnotation) {
  return db.transaction('rw', db.profiles, db.annotations, async () => {
    if (!await db.profiles.get(annotation.profileId))
      throw new AppError('error.profile-missing')
    if (!annotation.status) {
      await db.annotations.delete([annotation.profileId, annotation.pointId])
      return
    }
    const record = {
      ...annotation,
      completedAt: annotation.status === 'complete' ? annotation.completedAt ?? annotation.updatedAt : undefined,
    }
    await db.annotations.put(record)
    return record
  })
}
