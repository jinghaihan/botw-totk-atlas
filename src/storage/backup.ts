import type { ProfileView } from './profiles'
import { z } from 'zod'
import { collectionSnapshot } from '@/domain/game'
import { db } from './profiles'

const id = z.string().min(1).max(200)
const text = z.string().max(4000)
const finite = z.number().finite()
const snapshot = z.object({
  game: z.enum(['botw', 'totk']),
  filename: text,
  fingerprint: z.string().regex(/^[a-f\d]{64}$/),
  importedAt: z.iso.datetime(),
  size: finite.nonnegative(),
  progress: z.array(z.object({ id, label: text, done: finite, total: finite })),
  milestones: z.array(z.object({ label: text, complete: z.boolean() })),
  scalars: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(0xFFFFFFFF)),
  guids: z.array(z.string().regex(/^\d+$/)).max(20000),
})
const change = z.object({ id, name: text })
const heroPath = z.object({
  segments: z.array(z.object({
    layer: z.enum(['surface', 'sky', 'depths']),
    points: z.array(z.tuple([finite.min(-8192).max(8192), finite.min(-8192).max(8192)])).max(500000),
    end: z.enum(['warp', 'death']).optional(),
  })).max(100000),
}).superRefine((path, ctx) => {
  if (path.segments.reduce((count, segment) => count + segment.points.length, 0) > 500000)
    ctx.addIssue({ code: 'custom', message: 'Too many Hero’s Path points.' })
})
export const backupSchema = z.object({
  format: z.enum(['zelda-notes', 'wilds-atlas']),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: z.iso.datetime(),
  profiles: z.array(z.object({ id, name: z.string().min(1).max(80), game: z.enum(['botw', 'totk']), mode: z.enum(['normal', 'master', 'unknown']), updatedAt: z.iso.datetime(), snapshot: snapshot.optional(), heroPath: heroPath.optional() })).max(100),
  annotations: z.array(z.object({ profileId: id, pointId: id, status: z.enum(['complete', 'incomplete', 'unknown']).optional().transform(status => status === 'unknown' ? undefined : status), updatedAt: z.iso.datetime(), completedAt: z.iso.datetime().optional() })).max(100000),
  imports: z.array(z.object({ profileId: id, importedAt: z.iso.datetime(), filename: text, fingerprint: text, initial: z.boolean(), changes: z.array(change), regressions: z.array(change).optional() })).max(10000),
  views: z.array(z.object({ profileId: id, categories: z.array(id).nullable(), status: z.enum(['all', 'complete', 'incomplete', 'unknown', 'found-unfinished', 'shrine-chests']).transform((status): ProfileView['status'] => status === 'all' ? 'all' : 'incomplete'), layer: z.enum(['surface', 'sky', 'depths']), search: text, heroPathVisible: z.boolean().optional() })).max(100),
}).superRefine((backup, ctx) => {
  const ids = new Set(backup.profiles.map(p => p.id))
  if (ids.size !== backup.profiles.length)
    ctx.addIssue({ code: 'custom', message: '备份包含重复的 Profile。' })
  for (const p of backup.profiles) {
    if ((p.snapshot ? p.game !== p.snapshot.game : backup.version < 3) || (p.game === 'totk' && p.mode === 'master'))
      ctx.addIssue({ code: 'custom', message: 'Profile 的游戏类型不一致。' })
  }
  for (const entry of [...backup.annotations, ...backup.imports, ...backup.views]) {
    if (!ids.has(entry.profileId))
      ctx.addIssue({ code: 'custom', message: '备份包含没有对应 Profile 的记录。' })
  }
})

export async function exportBackup(profileId?: string) {
  return db.transaction('r', [db.profiles, db.annotations, db.views], async () => {
    const profiles = (profileId ? await db.profiles.where('id').equals(profileId).toArray() : await db.profiles.toArray()).map(profile => ({ ...profile, snapshot: profile.snapshot && collectionSnapshot(profile.snapshot) }))
    return {
      format: 'zelda-notes' as const,
      version: profiles.some(profile => !profile.snapshot) ? 3 as const : 2 as const,
      exportedAt: new Date().toISOString(),
      profiles,
      annotations: (profileId ? await db.annotations.where('profileId').equals(profileId).toArray() : await db.annotations.toArray()).filter(a => a.status && !a.pointId.startsWith('custom:')).map(({ profileId, pointId, status, updatedAt, completedAt }) => ({ profileId, pointId, status, updatedAt, completedAt: status === 'complete' ? completedAt ?? updatedAt : undefined })),
      imports: [], // Reserved in the portable backup format.
      views: profileId ? await db.views.where('profileId').equals(profileId).toArray() : await db.views.toArray(),
    }
  })
}

export async function restoreBackup(input: unknown) {
  const backup = backupSchema.parse(input)
  const ids = new Map(backup.profiles.map(p => [p.id, crypto.randomUUID()]))
  await db.transaction('rw', [db.profiles, db.annotations, db.views], async () => {
    await db.profiles.bulkAdd(backup.profiles.map(p => ({
      ...p,
      id: ids.get(p.id)!,
      name: `${p.name.slice(0, 74)} · 恢复`,
      snapshot: p.snapshot && collectionSnapshot(p.snapshot),
    })))
    await db.annotations.bulkAdd(backup.annotations.filter(a => a.status && !a.pointId.startsWith('custom:')).map(a => ({ ...a, profileId: ids.get(a.profileId)!, completedAt: a.status === 'complete' ? a.completedAt ?? a.updatedAt : undefined })))
    await db.views.bulkAdd(backup.views.map(v => ({ ...v, categories: backup.version === 1 && v.categories?.length === 0 ? null : v.categories, profileId: ids.get(v.profileId)! })))
  })
  return [...ids.values()]
}

export async function downloadBackup(profileId?: string) {
  const backup = await exportBackup(profileId)
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `zelda-notes-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
