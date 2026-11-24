import type { GameSnapshot } from '../../src/domain/game'

export function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    game: 'botw',
    filename: 'fixture.sav',
    fingerprint: '0'.repeat(64),
    importedAt: '2026-01-01T00:00:00.000Z',
    size: 100000,
    rupees: 0,
    mon: 0,
    hearts: 3,
    stamina: 1000,
    progress: [],
    milestones: [],
    items: [],
    horses: [],
    scalars: {},
    guids: [],
    ...overrides,
  }
}
