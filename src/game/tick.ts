import { ACTIONS, ITEMS, MAX_SPEED_BONUS, OFFLINE_CAP_MS, START_BANK_SLOTS } from './config'
import type { ActionDef, GameState, SkillId } from './types'
import { levelForXp } from './xp'

export type Blocker = 'level' | 'inputs' | 'bankFull'

export interface TickResult {
  state: GameState
  actions: number // completed runs of the action that was active when the tick started
  stopped: Blocker | null // set when the action could not continue
}

export const bankSlots = (_state: GameState) => START_BANK_SLOTS

/** Fraction of action time removed for a skill: best smithed tool in the bank. */
export function speedBonus(state: GameState, skill: SkillId): number {
  let tool = 0
  for (const id in state.bank) {
    const def = ITEMS[id]?.tool
    if (def?.skill === skill) tool = Math.max(tool, def.speedBonus)
  }
  return Math.min(MAX_SPEED_BONUS, tool)
}

export const actionTimeMs = (state: GameState, def: ActionDef) => def.timeMs * (1 - speedBonus(state, def.skill))

/** Why `def` cannot run right now, or null if it can. */
export function blocker(state: GameState, def: ActionDef): Blocker | null {
  if (levelForXp(state.xp[def.skill]) < def.level) return 'level'
  for (const id in def.inputs) if ((state.bank[id] ?? 0) < def.inputs[id]) return 'inputs'
  // ponytail: ignores slots freed by using up the last of an input; simulate the bank if that ever annoys
  const newStacks = Object.keys(def.outputs).filter((id) => !(id in state.bank)).length
  if (newStacks && Object.keys(state.bank).length + newStacks > bankSlots(state)) return 'bankFull'
  return null
}

export function startAction(state: GameState, actionId: string): GameState {
  const def = ACTIONS[actionId]
  if (!def || blocker(state, def)) return state
  return { ...state, active: { actionId, progressMs: 0 } }
}

export const stopAction = (state: GameState): GameState => ({ ...state, active: null })

/**
 * Advance the game by dtMs. Closed form: nothing that sets the action's duration can change
 * while it runs, so 100 ms and 12 h cost the same and give the same result.
 */
export function tick(state: GameState, dtMs: number): TickResult {
  const def = state.active && ACTIONS[state.active.actionId]
  if (!state.active || !def) return { state, actions: 0, stopped: null }

  const blocked = blocker(state, def)
  if (blocked) return { state: stopAction(state), actions: 0, stopped: blocked }

  const time = actionTimeMs(state, def)
  const total = state.active.progressMs + (Math.max(0, dtMs) || 0)
  let n = Math.floor(total / time)
  for (const id in def.inputs) n = Math.min(n, Math.floor(state.bank[id] / def.inputs[id]))
  if (n === 0) return { state: { ...state, active: { ...state.active, progressMs: total } }, actions: 0, stopped: null }

  const bank = { ...state.bank }
  for (const id in def.inputs) {
    bank[id] -= def.inputs[id] * n
    if (bank[id] <= 0) delete bank[id]
  }
  for (const id in def.outputs) bank[id] = (bank[id] ?? 0) + def.outputs[id] * n

  const next: GameState = {
    ...state,
    bank,
    xp: { ...state.xp, [def.skill]: state.xp[def.skill] + def.xp * n },
    active: { actionId: def.id, progressMs: total - n * time },
  }
  const stopped = blocker(next, def)
  return { state: stopped ? stopAction(next) : next, actions: n, stopped }
}

/** Tick up to wall-clock `now`. Used for live play and offline catch-up alike. */
export function advance(state: GameState, now: number): TickResult & { elapsedMs: number } {
  // a clock set backwards gives 0, a long absence is capped
  const elapsedMs = Math.min(OFFLINE_CAP_MS, Math.max(0, now - state.lastSeen)) || 0
  const result = tick(state, elapsedMs)
  return { ...result, state: { ...result.state, lastSeen: now }, elapsedMs }
}
