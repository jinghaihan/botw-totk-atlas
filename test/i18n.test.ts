import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { i18n, resolveLocale, tr } from '@/modules/i18n'
import en from '../i18n/en-US.json'
import ja from '../i18n/ja-JP.json'
import ko from '../i18n/ko-KR.json'
import cn from '../i18n/zh-CN.json'
import tw from '../i18n/zh-TW.json'

describe('interface languages', () => {
  it('covers the same messages in Simplified/Traditional Chinese, Japanese, Korean and English', () => {
    expect(Object.keys(tw)).toEqual(Object.keys(cn))
    expect(Object.keys(en)).toEqual(Object.keys(cn))
    expect(Object.keys(ja)).toEqual(Object.keys(cn))
    expect(Object.keys(ko)).toEqual(Object.keys(cn))
    for (const pack of [en, tw, ja, ko]) {
      for (const key of Object.keys(cn)) {
        const parameters = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
        expect(parameters(pack[key as keyof typeof pack]), key).toEqual(parameters(cn[key as keyof typeof cn]))
      }
    }
    const files = ['src/app.vue', ...readdirSync('src/components').filter(p => p.endsWith('.vue')).map(p => `src/components/${p}`)]
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\('([^']+)'/g)) {
        expect(Object.hasOwn(en, match[1]!), `${file}: ${match[1]}`).toBe(true)
      }
    }
  })
  it('changes prose and formats parameterized messages', () => {
    i18n.global.locale.value = 'en-US'
    expect(tr('神庙')).toBe('Shrines')
    expect(tr('{count} 个地点', { count: 3 })).toBe('3 places')
    i18n.global.locale.value = 'zh-TW'
    expect(tr('神庙')).toBe('神廟')
    expect(tr('导入存档')).toBe('匯入存檔')
    i18n.global.locale.value = 'ja-JP'
    expect(tr('神庙')).toBe('祠')
    i18n.global.locale.value = 'ko-KR'
    expect(tr('神庙')).toBe('사당')
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
