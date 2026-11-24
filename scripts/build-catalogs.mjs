import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import murmur from 'murmurhash3js'

const totkGroups = JSON.parse(await readFile('src/games/totk/completion-flags.json', 'utf8'))
const mapLocations = new Set(totkGroups.LOCATIONS_VISITED)
const botwNames = JSON.parse(await readFile('public/labels/botw-en-US.json', 'utf8')).ids
const botwQuestIds = new Map(Object.entries(botwNames).filter(([id]) => id.startsWith('QL_')).map(([id, name]) => [name, id.slice(3)]))

const upstream = 'https://raw.githubusercontent.com/jv-prado/hyrule-tracker/master/'
const local = process.argv.indexOf('--source-dir')
const sourceDir = local >= 0 ? process.argv[local + 1] : undefined
await mkdir('public/catalogs', { recursive: true })
const manifest = []
for (const game of ['botw', 'totk']) {
  const path = `data/${game}-world.json`
  const url = upstream + path
  const text = sourceDir ? await readFile(resolve(sourceDir, `${game}-world.json`), 'utf8') : await (await fetch(url)).text()
  const source = JSON.parse(text)
  if (!Array.isArray(source))
    throw new Error(`Invalid upstream catalog: ${game}`)
  const shrines = new Map(source.filter(p => ['shrine', 'dlc-shrine'].includes(p.category)).map(p => [p.name, p.id]))
  const rows = []
  const regionNames = new Map(source.filter(p => p.category === 'tower').map(p => [p.id, p.name]))
  for (const original of source) {
    if (game === 'totk' && original.category === 'recipe')
      continue
    const p = { ...original }
    delete p.guide
    if (p.region)
      p.region = regionNames.get(p.region) ?? p.region
    if (p.edition === 'switch2')
      continue
    if (!p.id || !p.name || !p.category)
      throw new Error('Invalid point')
    if (p.category === 'dlc-shrine')
      p.category = 'shrine'
    p.rule = p.values ? 'enum' : 'boolean'
    if (p.key === undefined)
      p.rule = 'manual'
    if (game === 'botw') {
      if (!p.key && ['quest', 'shrine-quest', 'dlc-quest'].includes(p.category) && botwQuestIds.has(p.name)) {
        p.key = `${botwQuestIds.get(p.name)}_Finish`
        p.rule = 'boolean'
      }
      if (['hinox', 'talus', 'molduga'].includes(p.category) && typeof p.key === 'string')
        p.key = p.key.replace('MainField_Enemy_', 'MainField_IsDefeat_Enemy_')
      if (['location', 'stable', 'lab', 'tower', 'shop'].includes(p.category) && p.key)
        p.rule = 'positive'
      if (p.id === 'armor:Armor_168_Head')
        p.key = 'IsGet_Armor_184_Head'
      if (p.id === 'quest:GanonQuest') {
        p.key = 'Defeated_Enemy_GanonBeast_Num'
        p.rule = 'positive'
      }
      if (typeof p.key === 'string' && ['Location_AnoleTunnel', 'Location_BlindForest', 'Location_LakeFloria'].includes(p.key))
        p.rule = 'manual'
    }
    else {
      if (typeof p.key === 'string' && p.key.startsWith('guid:'))
        p.rule = 'guid'
      if (p.category === 'chest' && p.interior) {
        p.key = `IsTreasureBoxOpen.${String(p.key).replace('guid:', '')}`
        p.rule = 'boolean'
        if (shrines.has(p.detail))
          p.parentId = shrines.get(p.detail)
      }
      if (p.category === 'location' && (!p.key || !mapLocations.has(murmur.x86.hash32(String(p.key)) >>> 0)))
        p.rule = 'manual'
      if (p.category === 'shop' || p.id === 'stable:IsVisitLocation.HorseStableBranchOffice_BaseCamp')
        p.rule = 'manual'
      if (['lynel', 'gloom'].includes(p.category))
        p.rule = 'manual'
      if (p.category === 'armor') {
        if (/unused/i.test(p.name))
          continue
        if (typeof p.key === 'string')
          p.key = p.key.replace('Armor_1146_', 'Armor_046_').replace('Armor_168_Head', 'Armor_178_Head').replace('Armor_1152_Head', 'Armor_001_Head')
      }
      if (p.category === 'tablet') {
        p.key = 'Step_ZonauReliefSearch'
        p.values = ['Complete']
        p.rule = 'enum'
      }
      if (p.category === 'bargainer' && typeof p.key === 'string') {
        const match = p.key.match(/DemonStatue_(\d+)$/)
        p.key = match ? `HaveKnownDemonStatue_${match[1]}` : 'DemonStatue_CompleteTutorial'
      }
    }
    rows.push(p)
  }
  if (game === 'totk')
    rows.push(...JSON.parse(await readFile(new URL('./totk-supplements.json', import.meta.url), 'utf8')))
  if (new Set(rows.map(p => p.id)).size !== rows.length)
    throw new Error(`Duplicate IDs in ${game}`)
  await writeFile(`public/catalogs/${game}.json`, JSON.stringify(rows))
  manifest.push({ game, source: url, sha256: createHash('sha256').update(text).digest('hex'), points: rows.length, note: 'Normalized flag semantics and shrine/chest relationships. Catalog coverage differs from official map percentage.' })
  console.log(game, rows.length, 'points;', rows.filter(p => p.category === 'shrine').length, 'shrines')
}
await writeFile('public/catalogs/sources.json', JSON.stringify({ sourceLicense: 'MIT', upstream, catalogs: manifest }, null, 2))
