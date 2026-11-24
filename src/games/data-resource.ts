import type { ErrorMessageKey } from '@/domain/errors'
import { AppError } from '@/domain/errors'

export function dataUrl(path: string, base = import.meta.env.BASE_URL, page = globalThis.location?.href ?? 'http://localhost/') {
  const publicBase = base.includes('__dynamic_base__') ? './' : base
  return new URL(path, new URL(publicBase, page)).href
}

export async function readJsonResource(path: string, key: ErrorMessageKey): Promise<unknown> {
  try {
    const response = await fetch(dataUrl(path))
    if (!response.ok)
      throw new AppError(key)
    const text = await response.text()
    if (text.trimStart().startsWith('<'))
      throw new AppError(key)
    return JSON.parse(text)
  }
  catch {
    throw new AppError(key)
  }
}
