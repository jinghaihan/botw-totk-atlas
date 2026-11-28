import type { CatalogPoint, GameId } from '@/domain/game'

export function isExChest(game: GameId, point: Pick<CatalogPoint, 'category' | 'key'>) {
  // The DLC uses these EX chest actors, including the Travel Medallion's long chest.
  // https://objmap-legacy.zeldamods.org/
  return game === 'botw' && point.category === 'chest' && typeof point.key === 'string'
    && /^MainField_TBox_Field_Iron_NoReaction_Aoc_(?:long_)?\d+$/.test(point.key)
}
