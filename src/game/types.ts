export type SkillId = 'woodcutting' | 'mining' | 'fishing' | 'smithing' | 'cooking'
export type ItemId = string
export type ItemKind = 'log' | 'ore' | 'bar' | 'raw' | 'cooked' | 'axe' | 'pickaxe' | 'hook'
export type Verb = 'chop' | 'mine' | 'catch' | 'smelt' | 'forge' | 'cook'

export interface ItemDef {
  id: ItemId
  kind: ItemKind
  mat: string // material key, translated in i18n
  tier: number
  sellPrice: number
  tool?: { skill: SkillId; speedBonus: number }
}

export interface ActionDef {
  id: string
  skill: SkillId
  verb: Verb
  mat: string
  tier: number
  level: number // skill level needed to start
  timeMs: number
  xp: number
  inputs: Record<ItemId, number>
  outputs: Record<ItemId, number>
}

export interface UpgradeDef {
  id: string
  costs: number[] // cost of each level; length is the max level
}

/** An action to run, optionally with a goal. */
export interface QueuedAction {
  actionId: string
  left?: number // runs still to do; absent = keep going until something stops it
}

export interface GameState {
  version: number
  xp: Record<SkillId, number> // levels are derived from xp, never stored
  bank: Record<ItemId, number> // only items with count > 0
  gold: number
  upgrades: Record<string, number> // upgrade id → level bought
  active: (QueuedAction & { progressMs: number }) | null
  queue: QueuedAction[] // start, in order, when the active action stops
  lastSeen: number // epoch ms of the last tick, drives offline progress
}
