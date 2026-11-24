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
    expect(await listAnnotations(profile.id)).toEqual([annotation])
    expect(await db.profiles.get(profile.id)).toMatchObject({ mode: 'master', snapshot: expect.any(Object) })
    expect(await listImports(profile.id)).toMatchObject([{ initial: true, changes: [], regressions: [] }])
  })

  it('rejects a different game before overwriting a profile', async () => {
    const profile = await saveProfile(snapshot(), 'normal')
    await expect(saveProfile(snapshot({ game: 'totk' }), 'wrong', profile.id)).rejects.toThrow('游戏不同')
    expect((await listProfiles())[0]?.snapshot?.game).toBe('botw')
  })
})
