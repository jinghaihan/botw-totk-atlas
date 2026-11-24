import type { UserModule } from '@/types'
import { createI18n } from 'vue-i18n'
import en from '../../i18n/en-US.json'
import cn from '../../i18n/zh-CN.json'
import tw from '../../i18n/zh-TW.json'

export const availableLocales = ['zh-CN', 'zh-TW', 'en-US'] as const
export type AtlasLocale = typeof availableLocales[number]
export function resolveLocale(locale: string): AtlasLocale {
  if (/^zh-(?:TW|HK|MO|Hant)/i.test(locale))
    return 'zh-TW'
  if (/^zh/i.test(locale))
    return 'zh-CN'
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
  // Source-text keys are flat, including file names containing dots.
  messageResolver: (messages, path) => (messages as Record<string, string>)[path] ?? null,
  messages: { 'zh-CN': cn, 'zh-TW': tw, 'en-US': en },
})
export function tr(key: string, values: Record<string, string | number> = {}) {
  return i18n.global.t(key, values)
}
export const currentLocale = i18n.global.locale
export function loadLanguageAsync(lang: string) {
  const locale = resolveLocale(lang)
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined')
    document.documentElement.lang = locale
  try {
    localStorage.setItem('wilds-atlas:language', locale)
  }
  catch { /* Preferences still work for the current session. */ }
  return Promise.resolve(locale)
}
export const install: UserModule = ({ app }) => {
  app.use(i18n)
  if (typeof document !== 'undefined')
    document.documentElement.lang = initial
}
