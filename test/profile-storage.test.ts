import type { CatalogPoint } from '@/domain/game'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRows } from '@/domain/exploration'
import { createProfile, db, deleteProfile, listAnnotations, listProfiles, putAnnotation, renameProfile, saveProfile } from '../src/storage/profiles'
import { snapshot } from './helpers/snapshot'

afterEach(async () => {
  await db.transaction('rw', [db.profiles, db.annotations, db.views], async () => {
    await db.profiles.clear()
    await db.annotations.clear()
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

    const catalog: CatalogPoint[] = [{ id: annotation.pointId, name: 'Chest', category: 'chest', key: 42 }]
    await saveProfile(snapshot(), profile.name, profile.id, 'master', catalog)
    expect(await listAnnotations(profile.id)).toEqual([{ ...annotation, completedAt: annotation.updatedAt }])
    expect(await db.profiles.get(profile.id)).toMatchObject({ mode: 'master', snapshot: expect.any(Object) })
  })

  it('replaces both readable manual states and preserves marks without save evidence', async () => {
    const catalog: CatalogPoint[] = [
      { id: 'korok:1', name: 'Korok', category: 'korok', key: 41 },
      { id: 'chest:1', alternateIds: ['chest:buried'], name: 'Chest', category: 'chest', key: 42 },
      { id: 'lynel:1', name: 'Lynel', category: 'lynel', rule: 'manual', key: 43 },
      { id: 'shrine:1', name: 'Shrine', category: 'shrine', key: 44 },
    ]
    const profile = await saveProfile(snapshot({ scalars: { 41: 0, 42: 1 } }), 'normal')
    for (const point of catalog)
      await putAnnotation({ profileId: profile.id, pointId: point.id, status: 'complete', updatedAt: profile.updatedAt })
    await putAnnotation({ profileId: profile.id, pointId: 'chest:buried', status: 'complete', updatedAt: profile.updatedAt })

    const later = snapshot({ scalars: { 41: 1, 42: 0, 43: 0 }, importedAt: '2026-01-02T00:00:00.000Z' })
    const updated = await saveProfile(later, profile.name, profile.id, 'normal', catalog)
    const annotations = await listAnnotations(profile.id)
    expect(annotations).toMatchObject([
      { pointId: 'lynel:1', completedAt: profile.updatedAt },
      { pointId: 'shrine:1', completedAt: profile.updatedAt },
    ])
    expect(resolveRows(updated.snapshot, catalog, annotations).map(row => row.status)).toEqual(['complete', 'incomplete', 'complete', 'complete'])
    expect(await db.profiles.get(profile.id)).not.toHaveProperty('completionTimes')
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
