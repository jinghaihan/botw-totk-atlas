import type { CatalogPoint, GameId } from '../domain/game'
import explorationIcons from '../assets/icons/hyrule.json'

type ExplorationIcon = keyof typeof explorationIcons.icons

const categoryIcons: Partial<Record<string, ExplorationIcon>> = {
  'lightroot': 'lightroot',
  'cave': 'cave',
  'well': 'well',
  'chasm': 'chasm',
  'location': 'location',
  'stable': 'stable',
  'lab': 'lab',
  'shop': 'shop',
  'fairy': 'fairy',
  'bargainer': 'bargainer',
  'dispenser': 'dispenser',
  'blossom': 'blossom',
  'hinox': 'hinox',
  'talus': 'talus',
  'molduga': 'molduga',
  'lynel': 'lynel',
  'frox': 'frox',
  'flux': 'flux',
  'gleeok': 'gleeok',
  'gloom': 'gloom',
  'bubbul': 'bubbul',
  'rematch': 'rematch',
  'korok': 'korok',
  'chest': 'chest',
  'memory': 'memory',
  'tear': 'tear',
  'sage-will': 'sage-will',
  'old-map': 'old-map',
  'schema': 'schema-stone',
  'yiga': 'yiga-schematic',
  'tablet': 'stone-tablet',
  'addison': 'sign',
  'voice': 'voice-memory',
  'main-quest': 'main-quest',
  'adventure': 'adventure',
  'quest': 'side-quest',
  'shrine-quest': 'shrine-quest',
  'dlc-quest': 'dlc-quest',
  'minigame': 'minigame',
  'armor': 'armor',
}

const pointIcons: Partial<Record<string, ExplorationIcon>> = {
  'temple:Wind_Relic': 'divine-bird',
  'temple:Fire_Relic': 'divine-lizard',
  'temple:Electric_Relic': 'divine-camel',
  'temple:SageOfWind': 'wind-temple',
  'temple:SageOfZora': 'water-temple',
  'temple:SageOfFire': 'fire-temple',
  'temple:SageOfSoul': 'spirit-temple',
  'lab:Location_AncientLabo': 'akkala-lab',
  'lab:IsVisitLocation.AncientLabo': 'akkala-lab',
  'rematch:Zora': 'blight-water',
  'rematch:Rito': 'blight-wind',
  'rematch:Goron': 'blight-fire',
  'rematch:Gerudo': 'blight-thunder',
  'rematch:ab170b3c': 'colgera',
  'rematch:f86acd0': 'colgera',
  'rematch:e18248e8': 'colgera',
  'rematch:a0b5253d': 'gohma',
  'rematch:f2b13c3f': 'gohma',
  'rematch:ffb3f46b': 'gohma',
  'rematch:a6e5f8f9': 'queen-gibdo',
  'rematch:69a6fe': 'queen-gibdo',
  'rematch:e72eb42e': 'queen-gibdo',
  'rematch:8fd913f8': 'mucktorok',
  'rematch:bc9fde5a': 'mucktorok',
  'rematch:2730997d': 'mucktorok',
}

export { explorationIcons }

export const categoryIconClasses = Object.keys(explorationIcons.icons).map(name => `i-hyrule:${name}`)

function categoryIconName(game: GameId, category: string): ExplorationIcon {
  if (category === 'shrine')
    return game === 'botw' ? 'sheikah-shrine' : 'zonai-shrine'
  if (category === 'tower')
    return game === 'botw' ? 'sheikah-tower' : 'skyview-tower'
  if (category === 'temple')
    return game === 'botw' ? 'divine-elephant' : 'temple'
  const name = Object.hasOwn(categoryIcons, category) ? categoryIcons[category] : undefined
  return name ?? 'location'
}

export function categoryIcon(game: GameId, category: string) {
  return `i-hyrule:${categoryIconName(game, category)}`
}

export function pointIconName(game: GameId, point: Pick<CatalogPoint, 'id' | 'category'>): ExplorationIcon {
  const icon = Object.hasOwn(pointIcons, point.id) ? pointIcons[point.id] : undefined
  return icon ?? categoryIconName(game, point.category)
}

export function pointIcon(game: GameId, point: Pick<CatalogPoint, 'id' | 'category'>) {
  return `i-hyrule:${pointIconName(game, point)}`
}
