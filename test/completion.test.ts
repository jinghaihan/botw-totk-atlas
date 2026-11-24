import type { CatalogPoint } from '../src/domain/game'
import { describe, expect, it } from 'vitest'
import { createProgressReader } from '../src/domain/completion'
import { snapshot } from './helpers/snapshot'

describe('completion evidence', () => {
  it('distinguishes an absent record from an explicit incomplete record', () => {
    const reader = createProgressReader(snapshot({ scalars: { 42: 0 } }))
    expect(reader.status({ id: 'a', name: 'a', category: 'chest', key: 42, rule: 'boolean' })).toBe('incomplete')
    expect(reader.status({ id: 'b', name: 'b', category: 'chest', key: 43, rule: 'boolean' })).toBe('unknown')
  })
  it('preserves 64-bit treasure IDs without floating point conversion', () => {
    const reader = createProgressReader(snapshot({ game: 'totk', guids: ['17027564096477698406'] }))
    expect(reader.status({ id: 'a', name: 'a', category: 'chest', key: 'guid:17027564096477698406', rule: 'guid' })).toBe('complete')
  })
  it('keeps BOTW shrine completion separate from its all-chests flag', () => {
    const state = snapshot()
    const reader = createProgressReader(state)
    state.scalars[String(reader.hash('Clear_Dungeon000'))] = 1
    state.scalars[String(reader.hash('CompleteTreasure_Dungeon000'))] = 0
    const shrine: CatalogPoint = { id: 'shrine:0', name: 'test', category: 'shrine', key: 'Clear_Dungeon000', rule: 'boolean' }
    expect(reader.status(shrine)).toBe('complete')
    expect(reader.shrineChests(shrine, []).complete).toBe(false)
    expect(reader.shrineChests(shrine, []).total).toBeNull()
  })
  it('aggregates TOTK child chests using their own opening records', () => {
    const reader = createProgressReader(snapshot({ game: 'totk', scalars: { 42: 1, 43: 0 } }))
    const shrine: CatalogPoint = { id: 'shrine:0', name: 'test', category: 'shrine' }
    const chests: CatalogPoint[] = [42, 43].map(key => ({ id: String(key), name: 'chest', category: 'chest', parentId: shrine.id, key, rule: 'boolean' }))
    expect(reader.shrineChests(shrine, chests)).toMatchObject({ total: 2, opened: 1, complete: false })
  })
})
