import { ACTIONS, ITEMS, SKILLS, UPGRADES } from './config'
import type { GameState } from './types'

export const SAVE_VERSION = 1

export function newGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    xp: { woodcutting: 0, mining: 0, fishing: 0, smithing: 0, cooking: 0 },
    bank: {},
    gold: 0,
    upgrades: {},
    active: null,
    lastSeen: now,
  }
}

const amount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

export const serialize = (state: GameState) => JSON.stringify(state)

/** Parse a save. Throws on anything that is not a save; unknown or broken fields fall back to defaults. */
export function deserialize(text: string, now = Date.now()): GameState {
  const raw = JSON.parse(text)
  if (typeof raw !== 'object' || raw === null || !Number.isInteger(raw.version) || raw.version < 1) {
    throw new Error('Not a save')
  }
  if (raw.version > SAVE_VERSION) throw new Error('Save is from a newer version of the game')
  // migrations go here, oldest first: if (raw.version === 1) raw = v1toV2(raw)

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
  const actionId = raw.active?.actionId
  if (typeof actionId === 'string' && Object.hasOwn(ACTIONS, actionId)) {
    state.active = { actionId, progressMs: amount(raw.active.progressMs) }
  }
  if (Number.isFinite(raw.lastSeen)) state.lastSeen = raw.lastSeen
  return state
}

export const exportSave = (state: GameState) => btoa(serialize(state))
export const importSave = (text: string, now = Date.now()) => deserialize(atob(text.trim()), now)
