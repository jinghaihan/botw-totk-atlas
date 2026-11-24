import { afterEach, describe, expect, it, vi } from 'vitest'
import { dataUrl, readJsonResource } from '@/games/data-resource'

afterEach(() => vi.unstubAllGlobals())
describe('public map data requests', () => {
  it('resolves relative assets beneath a deployed subdirectory', () => {
    expect(dataUrl('catalogs/botw.json', './', 'https://example.com/atlas/')).toBe('https://example.com/atlas/catalogs/botw.json')
    expect(dataUrl('catalogs/totk.json', '/__dynamic_base__/', 'https://example.com/atlas/index.html')).toBe('https://example.com/atlas/catalogs/totk.json')
  })
  it('reports a readable loading error when the SPA fallback returns HTML with status 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><html></html>', { status: 200 })))
    await expect(readJsonResource('catalogs/botw.json', 'error.catalog-load')).rejects.toThrow('error.catalog-load')
  })
  it('preserves JSON data without leaking native parser errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('[{"id":"shrine:0"}]')).mockResolvedValueOnce(new Response('{broken')))
    await expect(readJsonResource('catalogs/botw.json', 'error.catalog-load')).resolves.toEqual([{ id: 'shrine:0' }])
    await expect(readJsonResource('catalogs/botw.json', 'error.catalog-load')).rejects.toThrow('error.catalog-load')
  })
})
