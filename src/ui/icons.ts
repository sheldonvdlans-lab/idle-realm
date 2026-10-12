import type { ItemKind, SkillId } from '../game/types'

export const SKILL_ICON: Record<SkillId, string> = {
  woodcutting: '🪓',
  mining: '⛏️',
  fishing: '🎣',
  smithing: '🔨',
  cooking: '🍳',
}

export const KIND_ICON: Record<ItemKind, string> = {
  log: '🪵',
  ore: '🪨',
  bar: '🧱',
  raw: '🐟',
  cooked: '🍲',
  axe: '🪓',
  pickaxe: '⛏️',
  hook: '🪝',
}
