import type { UserModule } from '@/types'
import { createI18n } from 'vue-i18n'
import en from '../../i18n/en-US.json'
import ja from '../../i18n/ja-JP.json'
import ko from '../../i18n/ko-KR.json'
import cn from '../../i18n/zh-CN.json'
import tw from '../../i18n/zh-TW.json'

const messages = { 'zh-CN': cn, 'zh-TW': tw, 'ja-JP': ja, 'ko-KR': ko, 'en-US': en }
export type AtlasLocale = keyof typeof messages
type Messages = typeof cn
export type MessageKey = { [Group in keyof Messages]: `${Group}.${keyof Messages[Group] & string}` }[keyof Messages]
export function resolveLocale(locale: string): AtlasLocale {
  if (/^zh-(?:TW|HK|MO|Hant)/i.test(locale))
    return 'zh-TW'
  if (/^zh/i.test(locale))
    return 'zh-CN'
  if (/^ja(?:-|$)/i.test(locale))
    return 'ja-JP'
  if (/^ko(?:-|$)/i.test(locale))
    return 'ko-KR'
  return 'en-US'
}
let initial: AtlasLocale = 'zh-CN'
if (typeof window !== 'undefined') {
  try {
    initial = resolveLocale(localStorage.getItem('wilds-atlas:language') ?? navigator.language)
  }
  catch {
    initial = resolveLocale(navigator.language)
  }
}
export const i18n = createI18n({
  legacy: false,
  locale: initial,
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages,
})
export function tr(key: MessageKey, values: Record<string, string | number> = {}) {
  return i18n.global.t(key, values)
}
export const currentLocale = i18n.global.locale
export function setLocale(lang: string) {
  const locale = resolveLocale(lang)
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined')
    document.documentElement.lang = locale
  try {
    localStorage.setItem('wilds-atlas:language', locale)
  }
  catch { /* Preferences still work for the current session. */ }
}
export const install: UserModule = ({ app }) => {
  app.use(i18n)
  if (typeof document !== 'undefined')
    document.documentElement.lang = initial
}
