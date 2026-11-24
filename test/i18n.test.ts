import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { i18n, resolveLocale, tr } from '@/modules/i18n'
import en from '../i18n/en-US.json'
import cn from '../i18n/zh-CN.json'
import tw from '../i18n/zh-TW.json'

describe('interface languages', () => {
  it('covers the same messages in Simplified Chinese, Traditional Chinese and English', () => {
    expect(Object.keys(tw)).toEqual(Object.keys(cn))
    expect(Object.keys(en)).toEqual(Object.keys(cn))
    const files = ['src/App.vue', ...readdirSync('src/components').filter(p => p.endsWith('.vue')).map(p => `src/components/${p}`)]
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\('([^']+)'/g)) {
        expect(Object.hasOwn(en, match[1]!), `${file}: ${match[1]}`).toBe(true)
      }
    }
  })
  it('changes prose and formats parameterized messages', () => {
    i18n.global.locale.value = 'en-US'
    expect(tr('神庙')).toBe('Shrines')
    expect(tr('{count} 项结果', { count: 3 })).toBe('3 results')
    i18n.global.locale.value = 'zh-TW'
    expect(tr('神庙')).toBe('神廟')
    expect(tr('导入存档')).toBe('匯入存檔')
  })
  it('maps browser locale variants to supported languages', () => {
    expect(resolveLocale('zh-Hant-HK')).toBe('zh-TW')
    expect(resolveLocale('zh-Hans')).toBe('zh-CN')
    expect(resolveLocale('en-GB')).toBe('en-US')
  })
})

describe('official localized names', () => {
  for (const game of ['botw', 'totk']) {
    it(`uses independent CNzh, TWzh and USen text for ${game}`, () => {
      const labels = ['zh-CN', 'zh-TW', 'en-US'].map(locale => JSON.parse(readFileSync(`public/labels/${game}-${locale}.json`, 'utf8')))
      expect(labels[0].ids.Weapon_Sword_070).toBe('大师之剑')
      expect(labels[1].ids.Weapon_Sword_070).toBe('大師之劍')
      expect(labels[2].ids.Weapon_Sword_070).toBe('Master Sword')
    })
  }
})
