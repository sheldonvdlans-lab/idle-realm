import { ACTIONS, ITEMS, QUEUE_MAX, SKILLS, UPGRADES } from './config'
import { validGoal } from './tick'
import type { GameState, QueuedAction } from './types'

export const SAVE_VERSION = 3

/** One step per old version: MIGRATIONS[n] turns a version n save into version n + 1. */
const MIGRATIONS: Record<number, (raw: any) => any> = {
  1: (raw) => ({ ...raw, version: 2, queue: [] }), // v2 added the action queue
  // v3 added goals: queue entries went from action ids to { actionId, left? }
  2: (raw) => ({ ...raw, version: 3, queue: (Array.isArray(raw.queue) ? raw.queue : []).map((actionId: unknown) => ({ actionId })) }),
}

export function newGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    xp: { woodcutting: 0, mining: 0, fishing: 0, smithing: 0, cooking: 0 },
    bank: {},
    gold: 0,
    upgrades: {},
    active: null,
    queue: [],
    lastSeen: now,
  }
}

/** A known action with a sane goal, or null. */
function queuedAction(raw: any): QueuedAction | null {
  if (typeof raw?.actionId !== 'string' || !Object.hasOwn(ACTIONS, raw.actionId)) return null
  const left = validGoal(raw.left)
  return left ? { actionId: raw.actionId, left } : { actionId: raw.actionId }
}

const amount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

export const serialize = (state: GameState) => JSON.stringify(state)

/** Parse a save. Throws on anything that is not a save; unknown or broken fields fall back to defaults. */
export function deserialize(text: string, now = Date.now()): GameState {
  let raw = JSON.parse(text)
  if (typeof raw !== 'object' || raw === null || !Number.isInteger(raw.version) || raw.version < 1) {
    throw new Error('Not a save')
  }
  if (raw.version > SAVE_VERSION) throw new Error('Save is from a newer version of the game')
  while (raw.version < SAVE_VERSION) raw = MIGRATIONS[raw.version](raw)

  const state = newGame(now)
  for (const skill of SKILLS) state.xp[skill] = amount(raw.xp?.[skill])
  for (const [id, count] of Object.entries(raw.bank ?? {})) {
    if (Object.hasOwn(ITEMS, id) && amount(count) >= 1) state.bank[id] = Math.floor(amount(count))
  }
  state.gold = Math.floor(amount(raw.gold))
  for (const { id, costs } of Object.values(UPGRADES)) {
    const level = Math.min(costs.length, Math.floor(amount(raw.upgrades?.[id])))
    if (level) state.upgrades[id] = level
  }
  const active = queuedAction(raw.active)
  if (active) state.active = { ...active, progressMs: amount(raw.active.progressMs) }
  if (Array.isArray(raw.queue)) {
    state.queue = raw.queue.map(queuedAction).filter((a: QueuedAction | null) => a !== null).slice(0, QUEUE_MAX)
  }
  if (Number.isFinite(raw.lastSeen)) state.lastSeen = raw.lastSeen
  return state
}

export const exportSave = (state: GameState) => btoa(serialize(state))
export const importSave = (text: string, now = Date.now()) => deserialize(atob(text.trim()), now)
