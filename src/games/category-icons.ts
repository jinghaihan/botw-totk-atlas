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

const landmarkIcons: Partial<Record<string, ExplorationIcon>> = {
  'temple:Wind_Relic': 'divine-bird',
  'temple:Fire_Relic': 'divine-lizard',
  'temple:Electric_Relic': 'divine-camel',
  'temple:SageOfWind': 'wind-temple',
  'temple:SageOfZora': 'water-temple',
  'temple:SageOfFire': 'fire-temple',
  'temple:SageOfSoul': 'spirit-temple',
  'lab:Location_AncientLabo': 'akkala-lab',
  'lab:IsVisitLocation.AncientLabo': 'akkala-lab',
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
  const landmark = Object.hasOwn(landmarkIcons, point.id) ? landmarkIcons[point.id] : undefined
  return landmark ?? categoryIconName(game, point.category)
}

export function pointIcon(game: GameId, point: Pick<CatalogPoint, 'id' | 'category'>) {
  return `i-hyrule:${pointIconName(game, point)}`
}
