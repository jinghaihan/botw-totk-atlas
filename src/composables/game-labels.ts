import type { MaybeRefOrGetter } from 'vue'
import type { CatalogPoint, GameId } from '@/domain/game'
import { z } from 'zod'
import { readJsonResource } from '@/games/data-resource'
import { currentLocale, tr } from '@/modules/i18n'

const schema = z.object({ ids: z.record(z.string(), z.string()), english: z.record(z.string(), z.string()) })
type Labels = z.infer<typeof schema>
const chineseCatalogTerms = new Map([
  ['Korok', '克洛格'],
  ['Lynel', '莱尼尔'],
  ['Blue-Maned Lynel', '蓝鬃莱尼尔'],
  ['White-Maned Lynel', '白鬃莱尼尔'],
  ['Silver Lynel', '白银莱尼尔'],
  ['Hinox', '西诺克斯'],
  ['Stone Talus', '岩石巨人'],
  ['Molduga', '莫尔德拉吉克'],
  ['Flux Construct', '方块魔像'],
  ['Frox', '巨霸迦马'],
  ['Gleeok', '古栗欧克'],
  ['Old Map', '残旧的地图'],
  ['Zonai Device Dispenser', '左纳乌装置制造机'],
])
const cache = new Map<string, Promise<Labels>>()
export function loadGameLabels(game: GameId, locale: string) {
  // The current game-text source has no Korean records; use its English names.
  const key = `${game}-${locale === 'ko-KR' ? 'en-US' : locale}`
  if (!cache.has(key)) {
    const request = readJsonResource(`labels/${key}.json`, 'Game labels unavailable').then(data => schema.parse(data)).catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, request)
  }
  return cache.get(key)!
}
export function useGameLabels(game: MaybeRefOrGetter<GameId>) {
  const labels = shallowRef<Labels>({ ids: {}, english: {} })
  const unavailable = ref(false)
  let generation = 0
  watch(() => [toValue(game), currentLocale.value] as const, async ([gameId, locale]) => {
    const revision = ++generation
    labels.value = { ids: {}, english: {} }
    unavailable.value = false
    try {
      const data = await loadGameLabels(gameId, locale)
      if (revision === generation)
        labels.value = data
    }
    catch {
      if (revision === generation)
        unavailable.value = true
    }
  }, { immediate: true })
  const name = (id: string, fallback = id) => labels.value.ids[id] ?? labels.value.english[fallback] ?? fallback
  const text = (fallback: string) => labels.value.english[fallback] ?? fallback
  function localize(point: CatalogPoint): CatalogPoint {
    const id = point.id.split(':').slice(1).join(':')
    let title = name(id, point.name)
    if (title === point.name && currentLocale.value.startsWith('zh')) {
      // The community catalog appends its own identifiers to generic point names.
      const term = point.name.replace(/ [A-Z]*\d+$/, '')
      const sourceLabel = chineseCatalogTerms.get(term)
      if (sourceLabel)
        title = tr(sourceLabel) + point.name.slice(term.length)
    }
    return { ...point, name: title, aliases: [point.name], regionLabel: point.region ? text(point.region) : undefined, detail: point.detail ? text(point.detail) : undefined }
  }
  return { name, text, localize, unavailable }
}
