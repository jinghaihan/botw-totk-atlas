import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, restoreBackup } from '@/storage/backup'
import { createProfile, db, listAnnotations, listProfiles, putAnnotation, saveProfile } from '@/storage/profiles'
import { snapshot } from './helpers/snapshot'

beforeEach(async () => {
  await db.transaction('rw', [db.profiles, db.annotations, db.views], async () => {
    for (const table of [db.profiles, db.annotations, db.views]) await table.clear()
  })
})
describe('portable backups', () => {
  it('round-trips Hero’s Path and replaces it when a different save is imported', async () => {
    const path = { segments: [{ layer: 'surface' as const, points: [[1, 2], [3, 4]] as [number, number][] }] }
    const profile = await saveProfile(snapshot(), 'path', undefined, 'normal', undefined, path)
    await db.views.put({ profileId: profile.id, categories: [], status: 'incomplete', layer: 'surface', search: '', heroPathVisible: true })
    const [restoredId] = await restoreBackup(JSON.parse(JSON.stringify(await exportBackup(profile.id))))
    expect((await db.profiles.get(restoredId!))?.heroPath).toEqual(path)
    expect((await db.views.get(restoredId!))?.heroPathVisible).toBe(true)
    await saveProfile(snapshot(), 'new save', profile.id, 'normal')
    expect((await db.profiles.get(profile.id))?.heroPath).toBeUndefined()
  })
  it('normalizes duplicated TOTK location flags in existing profiles and backups', async () => {
    const profile = await saveProfile(snapshot({ game: 'totk' }), 'TOTK')
    const legacy = {
      ...profile,
      snapshot: snapshot({
        game: 'totk',
        progress: [{ id: 'LOCATIONS_VISITED', label: 'Visited locations', done: 2, total: 362 }],
        scalars: { 3937767332: 1 },
      }),
    }
    await db.profiles.put(legacy)
    expect((await listProfiles())[0]?.snapshot?.progress).toMatchObject([{ done: 1, total: 360 }])
    const backup = await exportBackup(profile.id)
    expect(backup.profiles[0]?.snapshot?.progress).toMatchObject([{ done: 1, total: 360 }])
    const [restoredId] = await restoreBackup({ ...backup, profiles: [legacy] })
    expect((await db.profiles.get(restoredId!))?.snapshot?.progress).toMatchObject([{ done: 1, total: 360 }])
  })

  it('round-trips a manual profile and its completions without a game save', async () => {
    const profile = await createProfile('totk', 'Manual playthrough')
    await putAnnotation({ profileId: profile.id, pointId: 'chest:1', status: 'complete', updatedAt: profile.updatedAt })
    const backup = await exportBackup(profile.id)
    expect(backup.version).toBe(3)
    const [restoredId] = await restoreBackup(JSON.parse(JSON.stringify(backup)))
    expect(await db.profiles.get(restoredId!)).toMatchObject({ game: 'totk', mode: 'normal' })
    expect((await db.profiles.get(restoredId!))?.snapshot).toBeUndefined()
    expect(await listAnnotations(restoredId!)).toMatchObject([{ pointId: 'chest:1', status: 'complete', completedAt: profile.updatedAt }])
    expect(backup.imports).toEqual([])
  })

  it('preserves no-category selections and converts legacy all-category selections', async () => {
    const profile = await saveProfile(snapshot(), 'filters')
    await db.views.put({ profileId: profile.id, categories: [], status: 'all', layer: 'surface', search: '' })
    const backup = await exportBackup()
    const [emptyId] = await restoreBackup(backup)
    expect((await db.views.get(emptyId!))?.categories).toEqual([])
    const [legacyId] = await restoreBackup({ ...backup, version: 1, format: 'wilds-atlas', views: backup.views.map(view => ({ ...view, region: 'Central Tower' })) })
    const legacyView = await db.views.get(legacyId!)
    expect(legacyView?.categories).toBeNull()
    expect(legacyView).not.toHaveProperty('region')
    await db.views.update(profile.id, { categories: null })
    const [allId] = await restoreBackup(await exportBackup(profile.id))
    expect((await db.views.get(allId!))?.categories).toBeNull()
  })
  it('restores independent profiles without removed point options', async () => {
    const original = await saveProfile(snapshot(), '我的周目')
    await putAnnotation({ profileId: original.id, pointId: 'chest:1', status: 'incomplete', updatedAt: new Date().toISOString() })
    const backup = await exportBackup()
    const legacy = {
      ...backup,
      imports: [{ profileId: original.id, importedAt: original.updatedAt, filename: 'game_data.sav', fingerprint: original.snapshot?.fingerprint, initial: true, changes: [] }],
      views: [{ profileId: original.id, categories: ['chest'], status: 'shrine-chests', layer: 'surface', search: '' }],
      pins: [{ id: 'custom:old', profileId: original.id }],
      annotations: [
        { ...backup.annotations[0], ignored: true, note: '旧备注' },
        { ...backup.annotations[0], pointId: 'chest:2', status: 'unknown' },
        { ...backup.annotations[0], pointId: 'custom:old' },
      ],
    }
    const ids = await restoreBackup(legacy)
    expect(ids[0]).not.toBe(original.id)
    expect(await db.profiles.count()).toBe(2)
    expect(await db.annotations.get([ids[0]!, 'custom:old'])).toBeUndefined()
    const annotation = await db.annotations.get([ids[0]!, 'chest:1'])
    expect(annotation).toMatchObject({ status: 'incomplete' })
    expect(annotation).not.toHaveProperty('note')
    expect(annotation).not.toHaveProperty('ignored')
    expect(await db.annotations.get([ids[0]!, 'chest:2'])).toBeUndefined()
    expect(await db.views.get(ids[0]!)).toMatchObject({ categories: ['chest'], status: 'incomplete' })
    expect((await exportBackup(ids[0]!)).imports).toEqual([])
    expect(await db.profiles.get(original.id)).toEqual(original)
  })
  it('rejects invalid references before changing the database', async () => {
    await saveProfile(snapshot(), '保留这个')
    const backup = await exportBackup()
    backup.annotations.push({ profileId: 'missing', pointId: 'p', status: 'complete', updatedAt: new Date().toISOString(), completedAt: undefined })
    await expect(restoreBackup(backup)).rejects.toThrow()
    expect(await db.profiles.count()).toBe(1)
  })
  it('rolls back a restore transaction when duplicate annotation keys collide', async () => {
    const original = await saveProfile(snapshot(), '原始')
    await putAnnotation({ profileId: original.id, pointId: 'p', status: 'complete', updatedAt: new Date().toISOString() })
    const backup = await exportBackup()
    backup.annotations.push(backup.annotations[0]!)
    await expect(restoreBackup(backup)).rejects.toThrow()
    expect(await db.profiles.count()).toBe(1)
    expect(await db.annotations.count()).toBe(1)
  })
})

it('exports one profile without leaking another playthrough', async () => {
  const first = await saveProfile(snapshot(), 'first')
  const second = await saveProfile(snapshot(), 'second')
  await putAnnotation({ profileId: second.id, pointId: 'chest:1', status: 'complete', updatedAt: second.updatedAt })
  const backup = await exportBackup(first.id)
  expect(backup.profiles.map(p => p.id)).toEqual([first.id])
  expect(backup.annotations).toEqual([])
})

it('drops obsolete inventory and horse payloads when exporting older profiles', async () => {
  const profile = await saveProfile(snapshot(), 'legacy')
  const legacy = { ...profile.snapshot, items: [{ id: 'old-item' }], horses: [{ name: 'old-horse' }] }
  await db.profiles.put({ ...profile, snapshot: legacy })
  const backup = await exportBackup(profile.id)
  expect(backup.profiles[0]?.snapshot).not.toHaveProperty('items')
  expect(backup.profiles[0]?.snapshot).not.toHaveProperty('horses')
})
