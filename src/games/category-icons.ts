import type { GameId } from '../domain/game'
import explorationIcons from '../assets/icons/hyrule.json'

type ExplorationIcon = keyof typeof explorationIcons.icons

const monsters = new Set(['bubbul', 'hinox', 'talus', 'molduga', 'flux', 'frox', 'gleeok', 'lynel', 'rematch', 'gloom'])

const categoryIcons: Partial<Record<string, ExplorationIcon>> = {
  'lightroot': 'lightroot',
  'cave': 'cave',
  'well': 'well',
  'chasm': 'chasm',
  'location': 'location',
  'temple': 'temple',
  'stable': 'stable',
  'lab': 'lab',
  'shop': 'shop',
  'fairy': 'fairy',
  'bargainer': 'bargainer',
  'dispenser': 'dispenser',
  'blossom': 'blossom',
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

export { explorationIcons }

export const categoryIconClasses = Object.keys(explorationIcons.icons).map(name => `i-hyrule:${name}`)

export function categoryIconName(game: GameId, category: string): ExplorationIcon {
  if (category === 'shrine')
    return game === 'botw' ? 'sheikah-shrine' : 'zonai-shrine'
  if (category === 'tower')
    return game === 'botw' ? 'sheikah-tower' : 'skyview-tower'
  if (monsters.has(category))
    return 'monster'
  const name = Object.hasOwn(categoryIcons, category) ? categoryIcons[category] : undefined
  return name ?? 'location'
}

export function categoryIcon(game: GameId, category: string) {
  return `i-hyrule:${categoryIconName(game, category)}`
}
