// Game data stores X/Z; the in-game map displays the second coordinate with opposite sign.
export function worldToMap(at: readonly [number, number]): [number, number] {
  return [-at[1], at[0]]
}
export function mapToWorld(lat: number, lng: number): [number, number] {
  return [Math.round(lng), Math.round(-lat)]
}
export function coordinateLabel(at: readonly [number, number]) {
  return `${Math.round(at[0])}, ${Math.round(-at[1])}`
}
export function tileUrl(game: 'botw' | 'totk', layer: 'surface' | 'sky' | 'depths') {
  return game === 'botw'
    ? 'https://objmap.zeldamods.org/game_files/maptex/{z}/{x}/{y}.png'
    : `https://objmap-totk.zeldamods.org/game_files/map/${{ surface: 'Ground', sky: 'Sky', depths: 'Depths' }[layer]}/maptex/{z}/{x}/{y}.webp`
}
