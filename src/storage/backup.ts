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
export const backupSchema = z.object({
  format: z.literal('wilds-atlas'),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.iso.datetime(),
  profiles: z.array(z.object({ id, name: z.string().min(1).max(80), game: z.enum(['botw', 'totk']), mode: z.enum(['normal', 'master', 'unknown']), updatedAt: z.iso.datetime(), snapshot })).max(100),
  annotations: z.array(z.object({ profileId: id, pointId: id, status: z.enum(['complete', 'incomplete', 'unknown']).optional(), ignored: z.boolean(), note: text, updatedAt: z.iso.datetime() })).max(100000),
  imports: z.array(z.object({ profileId: id, importedAt: z.iso.datetime(), filename: text, fingerprint: text, initial: z.boolean(), changes: z.array(change), regressions: z.array(change).optional() })).max(10000),
  views: z.array(z.object({ profileId: id, categories: z.array(id).nullable(), status: z.enum(['all', 'complete', 'incomplete', 'unknown', 'found-unfinished', 'shrine-chests']), layer: z.enum(['surface', 'sky', 'depths']), hideIgnored: z.boolean(), search: text, region: text.optional() })).max(100),
  pins: z.array(z.object({ id, profileId: id, category: z.literal('camp'), name: z.string().min(1).max(120), layer: z.enum(['surface', 'sky', 'depths']), at: z.tuple([finite.min(-6000).max(6000), finite.min(-5000).max(5000)]), rule: z.literal('manual') })).max(10000),
}).superRefine((backup, ctx) => {
  const ids = new Set(backup.profiles.map(p => p.id))
  if (ids.size !== backup.profiles.length)
    ctx.addIssue({ code: 'custom', message: '备份包含重复的 Profile。' })
  for (const p of backup.profiles) {
    if (p.game !== p.snapshot.game || (p.game === 'totk' && p.mode === 'master'))
      ctx.addIssue({ code: 'custom', message: 'Profile 的游戏类型不一致。' })
  }
  for (const entry of [...backup.annotations, ...backup.imports, ...backup.views, ...backup.pins]) {
    if (!ids.has(entry.profileId))
      ctx.addIssue({ code: 'custom', message: '备份包含没有对应 Profile 的记录。' })
  }
  const pins = new Set(backup.pins.map(p => p.id))
  if (pins.size !== backup.pins.length)
    ctx.addIssue({ code: 'custom', message: '备份包含重复标记。' })
})

export async function exportBackup(profileId?: string) {
  return db.transaction('r', [db.profiles, db.annotations, db.imports, db.views, db.pins], async () => ({
    format: 'wilds-atlas' as const,
    version: 2 as const,
    exportedAt: new Date().toISOString(),
    profiles: (profileId ? await db.profiles.where('id').equals(profileId).toArray() : await db.profiles.toArray()).map(profile => ({ ...profile, snapshot: collectionSnapshot(profile.snapshot) })),
    annotations: profileId ? await db.annotations.where('profileId').equals(profileId).toArray() : await db.annotations.toArray(),
    imports: profileId ? await db.imports.where('profileId').equals(profileId).toArray() : await db.imports.toArray(),
    views: profileId ? await db.views.where('profileId').equals(profileId).toArray() : await db.views.toArray(),
    pins: profileId ? await db.pins.where('profileId').equals(profileId).toArray() : await db.pins.toArray(),
  }))
}

export async function restoreBackup(input: unknown) {
  const backup = backupSchema.parse(input)
  const ids = new Map(backup.profiles.map(p => [p.id, crypto.randomUUID()]))
  const pins = new Map(backup.pins.map(p => [p.id, `custom:${crypto.randomUUID()}`]))
  await db.transaction('rw', [db.profiles, db.annotations, db.imports, db.views, db.pins], async () => {
    await db.profiles.bulkAdd(backup.profiles.map(p => ({ ...p, id: ids.get(p.id)!, name: `${p.name.slice(0, 74)} · 恢复` })))
    await db.annotations.bulkAdd(backup.annotations.map(a => ({ ...a, profileId: ids.get(a.profileId)!, pointId: pins.get(a.pointId) ?? a.pointId })))
    await db.imports.bulkAdd(backup.imports.map(r => ({ ...r, profileId: ids.get(r.profileId)! })))
    await db.views.bulkAdd(backup.views.map(v => ({ ...v, categories: backup.version === 1 && v.categories?.length === 0 ? null : v.categories, profileId: ids.get(v.profileId)! })))
    await db.pins.bulkAdd(backup.pins.map(p => ({ ...p, id: pins.get(p.id)!, profileId: ids.get(p.profileId)! })))
  })
  return [...ids.values()]
}
