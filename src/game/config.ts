// All balance lives in this file: XP curve, tiers, recipes, prices, shop, caps.
import type { ActionDef, ItemDef, ItemKind, SkillId, UpgradeDef, Verb } from './types'

// ---- XP curve: total xp for level L = floor(cubic·(L−1)³ + linear·(L−1)) ----
export const MAX_LEVEL = 99
export const XP_CURVE = { cubic: 2.5, linear: 60 }

// ---- Tiers, shared by every skill ----
export const TIER_LEVEL = [1, 10, 20, 35, 50, 65, 80]
export const TIER_TIME_MS = [3000, 4000, 5000, 6000, 7000, 8000, 10000]
export const TIER_XP = [10, 18, 30, 48, 72, 104, 160]
export const TIER_TOOL_BONUS = [0.03, 0.06, 0.09, 0.13, 0.17, 0.21, 0.25] // smithed tools

export const WOODS = ['pine', 'oak', 'birch', 'elm', 'cedar', 'ebony', 'starwood']
export const METALS = ['copper', 'iron', 'silver', 'cobalt', 'emberite', 'skysteel', 'voidglass']
export const FISH = ['minnow', 'perch', 'trout', 'pike', 'catfish', 'sturgeon', 'glimmerfin']

// ---- Production recipes: input counts, and multipliers on the tier's time/xp ----
export const SMELT = { ore: 2, time: 1, xp: 2 } // 2 ore → 1 bar
export const FORGE = { bars: 5, time: 5, xp: 5 } // 5 bars → 1 tool
export const COOK = { fish: 3, logs: 1, time: 2, xp: 3 } // 3 fish + 1 log of the same tier → 3 cooked

// ---- Economy: sell price = tier price × kind value, so an hour of play earns the same gold on any route ----
export const TIER_PRICE = [2, 4, 7, 12, 20, 32, 55]
export const KIND_VALUE: Record<ItemKind, number> = { log: 1, ore: 1, raw: 1, cooked: 2, bar: 3, axe: 20, pickaxe: 20, hook: 20 }

// ---- Shop ----
export const TOOL_UPGRADE = { bonus: 0.05, costs: [2500, 25_000, 250_000] } // per gathering skill
export const BANK_UPGRADE = { slots: 4, baseCost: 500, costGrowth: 2, levels: 11 } // 12 → 56 slots: everything fits

// ---- Caps and timers ----
export const MAX_SPEED_BONUS = 0.4
export const START_BANK_SLOTS = 12
export const QUEUE_MAX = 3
export const GOAL_PRESETS = [100, 500, 1000] // "do this many, then move on"
export const GOAL_MAX = 1_000_000
export const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000
export const WELCOME_MIN_MS = 60_000 // shorter absences get no "welcome back"
export const AUTOSAVE_MS = 10_000
export const TICK_MS = 100

// ---- Generated tables ----
export const SKILLS: SkillId[] = ['woodcutting', 'mining', 'fishing', 'smithing', 'cooking']
export const TOOL_SKILL = { axe: 'woodcutting', pickaxe: 'mining', hook: 'fishing' } as const

/** Tool upgrades share their id with the skill they speed up. */
export const UPGRADES: Record<string, UpgradeDef> = {
  woodcutting: { id: 'woodcutting', costs: TOOL_UPGRADE.costs },
  mining: { id: 'mining', costs: TOOL_UPGRADE.costs },
  fishing: { id: 'fishing', costs: TOOL_UPGRADE.costs },
  bank: {
    id: 'bank',
    costs: Array.from({ length: BANK_UPGRADE.levels }, (_, n) => BANK_UPGRADE.baseCost * BANK_UPGRADE.costGrowth ** n),
  },
}

export const ITEMS: Record<string, ItemDef> = {}
export const ACTIONS: Record<string, ActionDef> = {}

TIER_LEVEL.forEach((level, tier) => {
  const item = (kind: ItemKind, mat: string) => {
    const id = `${mat}_${kind}`
    const skill = TOOL_SKILL[kind as keyof typeof TOOL_SKILL]
    const sellPrice = TIER_PRICE[tier] * KIND_VALUE[kind]
    ITEMS[id] = { id, kind, mat, tier, sellPrice, ...(skill && { tool: { skill, speedBonus: TIER_TOOL_BONUS[tier] } }) }
    return id
  }
  const action = (
    skill: SkillId,
    verb: Verb,
    mat: string,
    mult: { time: number; xp: number },
    inputs: Record<string, number>,
    outputs: Record<string, number>,
  ) => {
    const id = `${verb}_${Object.keys(outputs)[0]}`
    const timeMs = TIER_TIME_MS[tier] * mult.time
    ACTIONS[id] = { id, skill, verb, mat, tier, level, timeMs, xp: TIER_XP[tier] * mult.xp, inputs, outputs }
  }
  const gather = { time: 1, xp: 1 }
  const [wood, metal, fish] = [WOODS[tier], METALS[tier], FISH[tier]]

  const log = item('log', wood)
  const ore = item('ore', metal)
  const raw = item('raw', fish)
  const bar = item('bar', metal)
  const cooked = item('cooked', fish)

  action('woodcutting', 'chop', wood, gather, {}, { [log]: 1 })
  action('mining', 'mine', metal, gather, {}, { [ore]: 1 })
  action('fishing', 'catch', fish, gather, {}, { [raw]: 1 })
  action('smithing', 'smelt', metal, SMELT, { [ore]: SMELT.ore }, { [bar]: 1 })
  for (const kind of ['axe', 'pickaxe', 'hook'] as const) {
    action('smithing', 'forge', metal, FORGE, { [bar]: FORGE.bars }, { [item(kind, metal)]: 1 })
  }
  action('cooking', 'cook', fish, COOK, { [raw]: COOK.fish, [log]: COOK.logs }, { [cooked]: COOK.fish })
})
