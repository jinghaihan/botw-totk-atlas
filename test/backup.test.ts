import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, restoreBackup } from '@/storage/backup'
import { db, putAnnotation, saveProfile } from '@/storage/profiles'
import { snapshot } from './helpers/snapshot'

beforeEach(async () => {
  await db.transaction('rw', [db.profiles, db.annotations, db.imports, db.views], async () => {
    for (const table of [db.profiles, db.annotations, db.imports, db.views]) await table.clear()
  })
})
describe('portable backups', () => {
  it('preserves no-category selections and converts legacy all-category selections', async () => {
    const profile = await saveProfile(snapshot(), 'filters')
    await db.views.put({ profileId: profile.id, categories: [], status: 'all', layer: 'surface', search: '' })
    const backup = await exportBackup()
    const [emptyId] = await restoreBackup(backup)
    expect((await db.views.get(emptyId!))?.categories).toEqual([])
    const [legacyId] = await restoreBackup({ ...backup, version: 1, format: 'wilds-atlas' })
    expect((await db.views.get(legacyId!))?.categories).toBeNull()
    await db.views.update(profile.id, { categories: null })
    const [allId] = await restoreBackup(await exportBackup(profile.id))
    expect((await db.views.get(allId!))?.categories).toBeNull()
  })
  it('restores independent profiles without removed point options', async () => {
    const original = await saveProfile(snapshot(), '我的周目')
    await putAnnotation({ profileId: original.id, pointId: 'chest:1', note: '稍后再打', status: 'incomplete', updatedAt: new Date().toISOString() })
    const backup = await exportBackup()
    const legacy = {
      ...backup,
      pins: [{ id: 'custom:old', profileId: original.id }],
      annotations: [
        { ...backup.annotations[0], ignored: true },
        { ...backup.annotations[0], pointId: 'chest:2', status: 'unknown' },
        { ...backup.annotations[0], pointId: 'custom:old' },
      ],
    }
    const ids = await restoreBackup(legacy)
    expect(ids[0]).not.toBe(original.id)
    expect(await db.profiles.count()).toBe(2)
    expect(await db.annotations.get([ids[0]!, 'custom:old'])).toBeUndefined()
    const note = await db.annotations.get([ids[0]!, 'chest:1'])
    expect(note).toMatchObject({ note: '稍后再打', status: 'incomplete' })
    expect(note).not.toHaveProperty('ignored')
    expect((await db.annotations.get([ids[0]!, 'chest:2']))?.status).toBeUndefined()
    expect(await db.imports.where('profileId').equals(ids[0]!).count()).toBe(1)
    expect(await db.profiles.get(original.id)).toEqual(original)
  })
  it('rejects invalid references before changing the database', async () => {
    await saveProfile(snapshot(), '保留这个')
    const backup = await exportBackup()
    backup.annotations.push({ profileId: 'missing', pointId: 'p', note: '', updatedAt: new Date().toISOString() })
    await expect(restoreBackup(backup)).rejects.toThrow()
    expect(await db.profiles.count()).toBe(1)
  })
  it('rolls back a restore transaction when duplicate annotation keys collide', async () => {
    const original = await saveProfile(snapshot(), '原始')
    await putAnnotation({ profileId: original.id, pointId: 'p', note: '', updatedAt: new Date().toISOString() })
    const backup = await exportBackup()
    backup.annotations.push(backup.annotations[0]!)
    await expect(restoreBackup(backup)).rejects.toThrow()
    expect(await db.profiles.count()).toBe(1)
    expect(await db.annotations.count()).toBe(1)
  })
})

it('exports one profile without leaking another playthrough', async () => {
  const first = await saveProfile(snapshot(), 'first')
  await saveProfile(snapshot(), 'second')
  const backup = await exportBackup(first.id)
  expect(backup.profiles.map(p => p.id)).toEqual([first.id])
  expect(backup.imports.every(r => r.profileId === first.id)).toBe(true)
})

it('drops obsolete inventory and horse payloads when exporting older profiles', async () => {
  const profile = await saveProfile(snapshot(), 'legacy')
  const legacy = { ...profile.snapshot, items: [{ id: 'old-item' }], horses: [{ name: 'old-horse' }] }
  await db.profiles.put({ ...profile, snapshot: legacy })
  const backup = await exportBackup(profile.id)
  expect(backup.profiles[0]?.snapshot).not.toHaveProperty('items')
  expect(backup.profiles[0]?.snapshot).not.toHaveProperty('horses')
})
