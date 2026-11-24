import type { CatalogPoint } from '@/domain/game'
import { afterEach, describe, expect, it } from 'vitest'
import { createProfile, db, deleteProfile, listAnnotations, listImports, listProfiles, putAnnotation, renameProfile, saveProfile } from '../src/storage/profiles'
import { snapshot } from './helpers/snapshot'

afterEach(async () => {
  await db.transaction('rw', [db.profiles, db.annotations, db.imports, db.views], async () => {
    await db.profiles.clear()
    await db.annotations.clear()
    await db.imports.clear()
    await db.views.clear()
  })
})

describe('profile isolation', () => {
  it('keeps same-game playthroughs and annotations independent', async () => {
    const normal = await saveProfile(snapshot(), 'normal')
    const master = await saveProfile(snapshot(), 'master', undefined, 'master')
    await putAnnotation({ profileId: normal.id, pointId: 'chest:1', status: 'complete', updatedAt: new Date().toISOString() })
    await renameProfile(master.id, 'renamed master')
    expect(await listAnnotations(master.id)).toEqual([])
    expect((await listProfiles()).find(p => p.id === normal.id)?.name).toBe('normal')
    await deleteProfile(normal.id)
    expect(await listAnnotations(normal.id)).toEqual([])
    expect((await listProfiles()).map(p => p.id)).toEqual([master.id])
  })
  it('keeps manual progress when adding the first game save', async () => {
    const profile = await createProfile('botw', '  Manual playthrough  ')
    const annotation = { profileId: profile.id, pointId: 'chest:1', status: 'complete' as const, updatedAt: profile.updatedAt }
    await putAnnotation(annotation)
    expect(profile.name).toBe('Manual playthrough')
    expect(profile.snapshot).toBeUndefined()
    expect(await listImports(profile.id)).toEqual([])

    await saveProfile(snapshot(), profile.name, profile.id, 'master')
    expect(await listAnnotations(profile.id)).toEqual([{ ...annotation, completedAt: annotation.updatedAt }])
    expect(await db.profiles.get(profile.id)).toMatchObject({ mode: 'master', snapshot: expect.any(Object) })
    expect(await listImports(profile.id)).toMatchObject([{ initial: true, changes: [], regressions: [] }])
  })

  it('uses the observed import time for each newly completed point', async () => {
    const catalog: CatalogPoint[] = [{ id: 'chest:1', name: 'Chest', category: 'chest', key: 'guid:1', rule: 'guid' }]
    const first = snapshot({ guids: ['1'] })
    const later = snapshot({ guids: ['1'], importedAt: '2026-01-02T00:00:00.000Z' })
    const profile = await saveProfile(first, 'normal', undefined, 'normal', catalog)
    expect(profile.completionTimes).toEqual({ 'chest:1': first.importedAt })
    expect((await saveProfile(later, profile.name, profile.id, 'normal', catalog)).completionTimes).toEqual(profile.completionTimes)
    expect((await saveProfile({ ...later, guids: [] }, profile.name, profile.id, 'normal', catalog)).completionTimes).toEqual({})
    expect((await saveProfile(later, profile.name, profile.id, 'normal', catalog)).completionTimes).toEqual({ 'chest:1': later.importedAt })
  })

  it('removes a manual completion timestamp when undoing the mark', async () => {
    const profile = await createProfile('botw', 'manual')
    const annotation = { profileId: profile.id, pointId: 'chest:1', updatedAt: profile.updatedAt }
    await putAnnotation({ ...annotation, status: 'complete' })
    expect(await listAnnotations(profile.id)).toMatchObject([{ completedAt: profile.updatedAt }])
    await putAnnotation(annotation)
    expect(await listAnnotations(profile.id)).toEqual([])
  })

  it('rejects a different game before overwriting a profile', async () => {
    const profile = await saveProfile(snapshot(), 'normal')
    await expect(saveProfile(snapshot({ game: 'totk' }), 'wrong', profile.id)).rejects.toThrow('error.import-game-mismatch')
    expect((await listProfiles())[0]?.snapshot?.game).toBe('botw')
  })
})
