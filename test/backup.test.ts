import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, restoreBackup } from '@/storage/backup'
import { db, putAnnotation, saveProfile } from '@/storage/profiles'
import { snapshot } from './helpers/snapshot'

beforeEach(async () => {
  await db.transaction('rw', [db.profiles, db.annotations, db.imports, db.views, db.pins], async () => {
    for (const table of [db.profiles, db.annotations, db.imports, db.views, db.pins]) await table.clear()
  })
})
describe('portable backups', () => {
  it('restores independent copies and remaps custom point annotations', async () => {
    const original = await saveProfile(snapshot(), '我的周目')
    await db.pins.add({ id: 'custom:old', profileId: original.id, category: 'camp', name: '营地', at: [123, -456], layer: 'surface', rule: 'manual' })
    await putAnnotation({ profileId: original.id, pointId: 'custom:old', ignored: true, note: '稍后再打', status: 'incomplete', updatedAt: new Date().toISOString() })
    const backup = await exportBackup()
    const ids = await restoreBackup(backup)
    expect(ids[0]).not.toBe(original.id)
    expect(await db.profiles.count()).toBe(2)
    const restored = await db.pins.where('profileId').equals(ids[0]!).first()
    expect(restored?.id).not.toBe('custom:old')
    const note = await db.annotations.get([ids[0]!, restored!.id])
    expect(note?.note).toBe('稍后再打')
    expect(await db.imports.where('profileId').equals(ids[0]!).count()).toBe(1)
    expect(await db.profiles.get(original.id)).toEqual(original)
  })
  it('rejects invalid references before changing the database', async () => {
    await saveProfile(snapshot(), '保留这个')
    const backup = await exportBackup()
    backup.annotations.push({ profileId: 'missing', pointId: 'p', ignored: false, note: '', updatedAt: new Date().toISOString() })
    await expect(restoreBackup(backup)).rejects.toThrow()
    expect(await db.profiles.count()).toBe(1)
  })
  it('rolls back a restore transaction when duplicate annotation keys collide', async () => {
    const original = await saveProfile(snapshot(), '原始')
    await putAnnotation({ profileId: original.id, pointId: 'p', ignored: false, note: '', updatedAt: new Date().toISOString() })
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
