const monsters = new Set(['bubbul', 'hinox', 'talus', 'molduga', 'flux', 'frox', 'gleeok', 'lynel', 'rematch', 'gloom'])

const icons: Record<string, string> = {
  shrine: 'i-lucide:landmark',
  korok: 'i-lucide:leaf',
  chest: 'i-lucide:archive',
  tower: 'i-lucide:radio-tower',
  lightroot: 'i-lucide:sprout',
  cave: 'i-lucide:mountain',
  well: 'i-lucide:circle-dot',
  camp: 'i-lucide:tent',
}

export const categoryIconClasses = [...new Set([...Object.values(icons), 'i-lucide:skull', 'i-lucide:map-pin'])]

export function isMonsterCategory(category: string) {
  return monsters.has(category)
}

export function categoryIcon(category: string) {
  return isMonsterCategory(category) ? 'i-lucide:skull' : icons[category] ?? 'i-lucide:map-pin'
}
