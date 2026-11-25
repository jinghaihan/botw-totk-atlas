import type { CatalogPoint } from '@/domain/game'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalogPointName } from '@/composables/game-labels'
import { AppError } from '@/domain/errors'
import { i18n, resolveLocale, tr } from '@/modules/i18n'
import en from '../i18n/en-US.json'
import ja from '../i18n/ja-JP.json'
import ko from '../i18n/ko-KR.json'
import cn from '../i18n/zh-CN.json'
import tw from '../i18n/zh-TW.json'

describe('interface languages', () => {
  it('covers the same messages in Simplified/Traditional Chinese, Japanese, Korean and English', () => {
    const parameters = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
    const signatures = (messages: Record<string, Record<string, string>>) => Object.entries(messages)
      .flatMap(([group, values]) => Object.entries(values).map(([key, value]) => [`${group}.${key}`, parameters(value)]))
    const expected = signatures(cn)
    expect(expected.every(([key]) => typeof key === 'string' && /^[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))).toBe(true)
    for (const pack of [en, tw, ja, ko])
      expect(signatures(pack)).toEqual(expected)
  })
  it('changes prose and formats parameterized messages', () => {
    i18n.global.locale.value = 'en-US'
    expect(tr('category.shrine')).toBe('Shrines')
    expect(tr('import.save-count', { count: 3 })).toBe('Import 3 saves')
    const error = new AppError('error.totk-missing-field', { name: 'IsGameClear' })
    expect(tr(error.key, error.values)).toBe('This TOTK save is missing IsGameClear.')
    expect(tr('error.totk-duplicate-fields')).toBe('Duplicate fields in the TOTK save. Check its format.')
    i18n.global.locale.value = 'zh-TW'
    expect(tr('category.shrine')).toBe('神廟')
    expect(tr('import.save')).toBe('匯入存檔')
    i18n.global.locale.value = 'ja-JP'
    expect(tr('category.shrine')).toBe('祠')
    i18n.global.locale.value = 'ko-KR'
    expect(tr('category.shrine')).toBe('사당')
  })
  it('maps browser locale variants to supported languages', () => {
    expect(resolveLocale('zh-Hant-HK')).toBe('zh-TW')
    expect(resolveLocale('zh-Hans')).toBe('zh-CN')
    expect(resolveLocale('en-GB')).toBe('en-US')
    expect(resolveLocale('ja')).toBe('ja-JP')
    expect(resolveLocale('ja-JP')).toBe('ja-JP')
    expect(resolveLocale('ko')).toBe('ko-KR')
    expect(resolveLocale('ko-KR')).toBe('ko-KR')
  })
})

describe('official localized names', () => {
  it('uses the boss, temple and full quest titles for catalog IDs shared with other text', () => {
    const botw = JSON.parse(readFileSync('public/catalogs/botw.json', 'utf8')) as CatalogPoint[]
    const totk = JSON.parse(readFileSync('public/catalogs/totk.json', 'utf8')) as CatalogPoint[]
    const botwLabels = JSON.parse(readFileSync('public/labels/botw-zh-CN.json', 'utf8'))
    const totkLabels = JSON.parse(readFileSync('public/labels/totk-zh-CN.json', 'utf8'))
    expect(botw.filter(point => point.category === 'rematch').map(point => catalogPointName('botw', point, botwLabels)))
      .toEqual(['水咒盖侬', '风咒盖侬', '火咒盖侬', '雷咒盖侬'])
    expect(totk.filter(point => point.category === 'temple').map(point => catalogPointName('totk', point, totkLabels)))
      .toEqual(['风之神殿', '水之神殿', '火之神殿', '雷之神殿', '魂之神殿'])
    const race = totk.find(point => point.id === 'quest:Circuit_Ichikara')!
    expect(catalogPointName('totk', race, totkLabels)).toBe('征服一始拉力赛')
  })

  for (const game of ['botw', 'totk']) {
    it(`uses independent CNzh, TWzh and USen text for ${game}`, () => {
      const labels = ['zh-CN', 'zh-TW', 'en-US'].map(locale => JSON.parse(readFileSync(`public/labels/${game}-${locale}.json`, 'utf8')))
      expect(labels[0].ids.Weapon_Sword_070).toBe('大师之剑')
      expect(labels[1].ids.Weapon_Sword_070).toBe('大師之劍')
      expect(labels[2].ids.Weapon_Sword_070).toBe('Master Sword')
      const japanese = JSON.parse(readFileSync(`public/labels/${game}-ja-JP.json`, 'utf8'))
      expect(japanese.ids.Weapon_Sword_070).toBe('マスターソード')
    })
  }
})
