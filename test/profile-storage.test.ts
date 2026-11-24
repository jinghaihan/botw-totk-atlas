import { afterEach, describe, expect, it } from 'vitest'
import { db, deleteProfile, listAnnotations, listProfiles, putAnnotation, renameProfile, saveProfile } from '../src/storage/profiles'
import { snapshot } from './helpers/snapshot'
import 'fake-indexeddb/auto'

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
    await putAnnotation({ profileId: normal.id, pointId: 'chest:1', note: 'normal only', ignored: false, updatedAt: new Date().toISOString() })
    await renameProfile(master.id, 'renamed master')
    expect(await listAnnotations(master.id)).toEqual([])
    expect((await listProfiles()).find(p => p.id === normal.id)?.name).toBe('normal')
    await deleteProfile(normal.id)
    expect(await listAnnotations(normal.id)).toEqual([])
    expect((await listProfiles()).map(p => p.id)).toEqual([master.id])
  })
  it('rejects a different game before overwriting a profile', async () => {
    const profile = await saveProfile(snapshot(), 'normal')
    await expect(saveProfile(snapshot({ game: 'totk' }), 'wrong', profile.id)).rejects.toThrow('游戏不同')
    expect((await listProfiles())[0]?.snapshot.game).toBe('botw')
  })
})
