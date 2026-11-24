import { readFile, writeFile } from 'node:fs/promises'
import { Converter } from 'opencc-js'

// UI prose is authored in Simplified Chinese and English. Game names come from
// independent official CNzh/TWzh/USen records, never from character conversion.
const source = JSON.parse(await readFile(new URL('../i18n/source.json', import.meta.url), 'utf8'))
const traditional = Converter({ from: 'cn', to: 'twp' })
const overrides = { 旷野之息: '曠野之息', 王国之泪: '王國之淚', 生命上限: '生命上限', 呀哈哈: '克洛格', 材料: '材料', 左纳乌装置: '左納烏裝置' }
for (const locale of ['zh-CN', 'zh-TW', 'en-US']) {
  const messages = Object.fromEntries(Object.entries(source).map(([key, en]) => [key, locale === 'en-US' ? en : locale === 'zh-TW' ? overrides[key] ?? traditional(key) : key]))
  await writeFile(new URL(`../i18n/${locale}.json`, import.meta.url), `${JSON.stringify(messages, null, 2)}\n`)
}
