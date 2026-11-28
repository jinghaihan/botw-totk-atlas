import type { CatalogPoint, GameId, GameMode } from '@/domain/game'
import type { MessageKey } from '@/modules/i18n'
import { z } from 'zod'
import { AppError } from '@/domain/errors'
import { tr } from '@/modules/i18n'
import { isExChest } from './chests'
import { readJsonResource } from './data-resource'

const point = z.object({
  id: z.string(),
  alternateIds: z.array(z.string()).optional(),
  alternateKeys: z.array(z.string()).optional(),
  mode: z.enum(['normal', 'master']).optional(),
  name: z.string(),
  category: z.string(),
  key: z.union([z.string(), z.number()]).optional(),
  layer: z.enum(['surface', 'sky', 'depths']).optional(),
  at: z.tuple([z.number(), z.number()]).optional(),
  rule: z.enum(['positive', 'boolean', 'guid', 'enum', 'manual']).optional(),
  values: z.array(z.string()).optional(),
  detail: z.string().optional(),
  interior: z.boolean().optional(),
  parentId: z.string().optional(),
  region: z.string().optional(),
})
const cache = new Map<GameId, Promise<CatalogPoint[]>>()

export function loadCatalog(game: GameId, mode: GameMode = 'unknown') {
  if (!cache.has(game)) {
    const request = readJsonResource(`catalogs/${game}.json`, 'error.catalog-load').then((data) => {
      const parsed = z.array(point).safeParse(data)
      if (!parsed.success)
        throw new AppError('error.catalog-load')
      return parsed.data as CatalogPoint[]
    }).catch((error) => {
      cache.delete(game)
      throw error
    })
    cache.set(game, request)
  }
  return cache.get(game)!.then(points => points.filter(point => !point.mode || point.mode === mode))
}

export const categoryDisplayOrder = [
  // Locations and facilities.
  'shrine',
  'tower',
  'lightroot',
  'cave',
  'well',
  'chasm',
  'location',
  'temple',
  'stable',
  'lab',
  'shop',
  'fairy',
  'bargainer',
  'dispenser',
  'blossom',
  // Monsters.
  'hinox',
  'talus',
  'molduga',
  'lynel',
  'frox',
  'flux',
  'gleeok',
  'gloom',
  'bubbul',
  'rematch',
  // Collectibles.
  'korok',
  'chest',
  'memory',
  'tear',
  'sage-will',
  'old-map',
  'schema',
  'yiga',
  'tablet',
  'addison',
  'voice',
  // Quests and challenges.
  'main-quest',
  'adventure',
  'quest',
  'shrine-quest',
  'dlc-quest',
  'minigame',
  // Completion records.
  'compendium',
  'armor',
  'recipe',
  'fabric',
  'weapon-unlock',
]

const categoryLabels: Partial<Record<string, MessageKey>> = {
  'shrine': 'category.shrine',
  'korok': 'category.korok',
  'chest': 'category.chest',
  'lightroot': 'category.lightroot',
  'cave': 'category.cave',
  'well': 'category.well',
  'chasm': 'category.chasm',
  'bubbul': 'category.bubbul',
  'hinox': 'category.hinox',
  'talus': 'category.talus',
  'molduga': 'category.molduga',
  'flux': 'category.flux',
  'frox': 'category.frox',
  'gleeok': 'category.gleeok',
  'lynel': 'category.lynel',
  'rematch': 'category.rematch',
  'location': 'category.location',
  'memory': 'category.memory',
  'tear': 'category.tear',
  'temple': 'category.temple',
  'sage-will': 'category.sage-will',
  'old-map': 'category.old-map',
  'schema': 'category.schema',
  'yiga': 'category.yiga',
  'addison': 'category.addison',
  'tablet': 'category.tablet',
  'stable': 'category.stable',
  'lab': 'category.lab',
  'fairy': 'category.fairy',
  'bargainer': 'category.bargainer',
  'dispenser': 'category.dispenser',
  'shop': 'category.shop',
  'main-quest': 'category.main-quest',
  'adventure': 'category.adventure',
  'shrine-quest': 'category.shrine-quest',
  'quest': 'category.quest',
  'dlc-quest': 'category.dlc-quest',
  'compendium': 'category.compendium',
  'armor': 'category.armor',
  'recipe': 'category.recipe',
  'fabric': 'category.fabric',
  'weapon-unlock': 'category.weapon-unlock',
  'minigame': 'category.minigame',
  'voice': 'category.voice',
  'gloom': 'category.gloom',
  'blossom': 'category.blossom',
}

export function categoryLabel(game: GameId, category: string) {
  if (category === 'tower')
    return tr(game === 'botw' ? 'category.sheikah-tower' : 'category.skyview-tower')
  const key = Object.hasOwn(categoryLabels, category) ? categoryLabels[category] : undefined
  return key ? tr(key) : category
}

export function pointCategoryLabel(game: GameId, point: CatalogPoint) {
  return isExChest(game, point) ? tr('category.ex-chest') : categoryLabel(game, point.category)
}

export const statusLabels = { complete: 'status.complete', incomplete: 'status.incomplete' } as const
