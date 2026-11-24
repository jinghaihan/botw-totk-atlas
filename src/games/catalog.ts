import type { CatalogPoint, GameId } from '@/domain/game'
import { z } from 'zod'
import { readJsonResource } from './data-resource'

const point = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  key: z.union([z.string(), z.number()]).optional(),
  layer: z.enum(['surface', 'sky', 'depths']).optional(),
  at: z.tuple([z.number(), z.number()]).optional(),
  rule: z.enum(['positive', 'boolean', 'guid', 'enum', 'manual']).optional(),
  values: z.array(z.string()).optional(),
  found: z.string().optional(),
  detail: z.string().optional(),
  interior: z.boolean().optional(),
  parentId: z.string().optional(),
  relatedChestId: z.string().optional(),
  region: z.string().optional(),
})
const cache = new Map<GameId, Promise<CatalogPoint[]>>()

export function loadCatalog(game: GameId) {
  if (!cache.has(game)) {
    const request = readJsonResource(`catalogs/${game}.json`, '地图数据加载失败，请刷新页面后重试。').then((data) => {
      const parsed = z.array(point).safeParse(data)
      if (!parsed.success)
        throw new Error('地图数据加载失败，请刷新页面后重试。')
      return parsed.data as CatalogPoint[]
    }).catch((error) => {
      cache.delete(game)
      throw error
    })
    cache.set(game, request)
  }
  return cache.get(game)!
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
  // Monsters and camps.
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
  'camp',
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

const categoryLabels: Record<string, string> = {
  'shrine': '神庙',
  'korok': '克洛格',
  'chest': '宝箱',
  'lightroot': '破魔之根',
  'cave': '洞窟入口',
  'well': '井',
  'chasm': '深穴',
  'bubbul': '魔犹伊',
  'hinox': '西诺克斯',
  'talus': '岩石巨人',
  'molduga': '莫尔德拉吉克',
  'flux': '方块魔像',
  'frox': '巨霸迦马',
  'gleeok': '古栗欧克',
  'lynel': '莱尼尔',
  'rematch': 'Boss 重战',
  'camp': '怪物营地 · 宝箱点位',
  'location': '探索地点',
  'memory': '回忆',
  'tear': '龙之泪',
  'temple': '神兽 / 神殿',
  'sage-will': '贤者的遗志',
  'old-map': '残旧的地图',
  'schema': '设计图石板',
  'yiga': '依盖队设计图',
  'addison': '广告牌',
  'tablet': '古代石碑',
  'stable': '驿站',
  'lab': '研究所',
  'fairy': '大妖精',
  'bargainer': '魔人像',
  'dispenser': '左纳乌装置制造机',
  'shop': '商店',
  'main-quest': '主剧情挑战',
  'adventure': '情节挑战',
  'shrine-quest': '神庙挑战',
  'quest': '迷你挑战',
  'dlc-quest': 'DLC 挑战',
  'compendium': '海拉鲁图鉴',
  'armor': '服装获取记录',
  'recipe': '食谱',
  'fabric': '滑翔帆布料',
  'weapon-unlock': '无腐朽武器解锁',
  'minigame': '小游戏',
  'voice': '语音回忆',
  'gloom': '瘴气之手',
  'blossom': '樱花树',
}

export function categoryLabel(game: GameId, category: string) {
  if (category === 'tower')
    return game === 'botw' ? '希卡塔' : '鸟望台'
  return categoryLabels[category] ?? category
}

export const statusLabels = { complete: '已完成', incomplete: '未完成' }
