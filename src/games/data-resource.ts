export function dataUrl(path: string, base = import.meta.env.BASE_URL, page = globalThis.location?.href ?? 'http://localhost/') {
  const publicBase = base.includes('__dynamic_base__') ? './' : base
  return new URL(path, new URL(publicBase, page)).href
}

export async function readJsonResource(path: string, message: string): Promise<unknown> {
  try {
    const response = await fetch(dataUrl(path))
    if (!response.ok)
      throw new Error(message)
    const text = await response.text()
    if (text.trimStart().startsWith('<'))
      throw new Error(message)
    return JSON.parse(text)
  }
  catch {
    throw new Error(message)
  }
}
