import { ACTIONS, BANK_UPGRADE, ITEMS, MAX_SPEED_BONUS, OFFLINE_CAP_MS, QUEUE_MAX, START_BANK_SLOTS, TOOL_UPGRADE } from './config'
import type { ActionDef, GameState, SkillId } from './types'
import { levelForXp } from './xp'

export type Blocker = 'level' | 'inputs' | 'bankFull'

/** What one action did during a tick. */
export interface Run {
  actionId: string
  actions: number // completed runs; 0 with a `stopped` reason means it was skipped
  stopped: Blocker | null // set when the action could not start or continue
}

export interface TickResult {
  state: GameState
  runs: Run[] // in order: the active action first, then every queued action the tick reached
}

export const bankSlots = (state: GameState) => START_BANK_SLOTS + (state.upgrades.bank ?? 0) * BANK_UPGRADE.slots

/** Fraction of action time removed for a skill: shop upgrade plus the best smithed tool in the bank. */
export function speedBonus(state: GameState, skill: SkillId): number {
  let tool = 0
  for (const id in state.bank) {
    const def = ITEMS[id]?.tool
    if (def?.skill === skill) tool = Math.max(tool, def.speedBonus)
  }
  return Math.min(MAX_SPEED_BONUS, tool + (state.upgrades[skill] ?? 0) * TOOL_UPGRADE.bonus)
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

/** Gathering needs no materials, so once it runs nothing ever stops it. */
export const isGathering = (def: ActionDef) => Object.keys(def.inputs).length === 0

/** Begin the next queued action, or go idle when the queue is empty. */
function startNext(state: GameState): GameState {
  const [actionId, ...queue] = state.queue
  return { ...state, queue, active: actionId ? { actionId, progressMs: 0 } : null }
}

/** Start an action right now, replacing the current one. The queue stays. */
export function startAction(state: GameState, actionId: string): GameState {
  const def = ACTIONS[actionId]
  if (!def || blocker(state, def)) return state
  return { ...state, active: { actionId, progressMs: 0 } }
}

/** Stop everything: the current action and whatever was queued behind it. */
export const stopAction = (state: GameState): GameState => ({ ...state, active: null, queue: [] })

/** Why nothing more can be queued, or null. Nothing behind a gathering action would ever run. */
export function queueClosed(state: GameState): 'gathering' | 'full' | null {
  if (state.queue.some((id) => isGathering(ACTIONS[id]))) return 'gathering'
  return state.queue.length >= QUEUE_MAX ? 'full' : null
}

/** Add an action behind the current one. Materials are only checked when its turn comes. */
export function enqueue(state: GameState, actionId: string): GameState {
  const def = ACTIONS[actionId]
  if (!def || queueClosed(state) || levelForXp(state.xp[def.skill]) < def.level) return state
  const queued = { ...state, queue: [...state.queue, actionId] }
  return state.active ? queued : startNext(queued)
}

export const dequeue = (state: GameState, index: number): GameState => ({
  ...state,
  queue: state.queue.filter((_, i) => i !== index),
})

/** Drop the current action and begin the queue: the way out when the current action never ends. */
export const startQueue = (state: GameState): GameState => (state.queue.length ? startNext(state) : state)

/**
 * Run the active action for dtMs. Closed form: nothing that sets its duration can change while
 * it runs, so 100 ms and 12 h cost the same. When it has to stop, the queue takes over and the
 * time it did not use is handed back.
 */
function runActive(state: GameState, def: ActionDef, dtMs: number) {
  const blocked = blocker(state, def)
  if (blocked) return { state: startNext(state), actions: 0, stopped: blocked, leftMs: dtMs }

  const time = actionTimeMs(state, def)
  const total = state.active!.progressMs + dtMs
  let n = Math.floor(total / time)
  for (const id in def.inputs) n = Math.min(n, Math.floor(state.bank[id] / def.inputs[id]))
  if (n === 0) {
    return { state: { ...state, active: { actionId: def.id, progressMs: total } }, actions: 0, stopped: null, leftMs: 0 }
  }

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
  return stopped
    ? { state: startNext(next), actions: n, stopped, leftMs: total - n * time }
    : { state: next, actions: n, stopped, leftMs: 0 }
}

/** Advance the game by dtMs, walking through the queue as actions stop. */
export function tick(state: GameState, dtMs: number): TickResult {
  const runs: Run[] = []
  let leftMs = Math.max(0, dtMs) || 0
  // every pass either uses up the time or takes one action off the queue: at most 1 + QUEUE_MAX passes
  while (state.active) {
    const def = ACTIONS[state.active.actionId]
    if (!def) break
    const step = runActive(state, def, leftMs)
    if (step.actions || step.stopped) runs.push({ actionId: def.id, actions: step.actions, stopped: step.stopped })
    state = step.state
    leftMs = step.leftMs
    if (!step.stopped) break
  }
  return { state, runs }
}

/** Tick up to wall-clock `now`. Used for live play and offline catch-up alike. */
export function advance(state: GameState, now: number): TickResult & { elapsedMs: number } {
  // a clock set backwards gives 0, a long absence is capped
  const elapsedMs = Math.min(OFFLINE_CAP_MS, Math.max(0, now - state.lastSeen)) || 0
  const result = tick(state, elapsedMs)
  return { ...result, state: { ...result.state, lastSeen: now }, elapsedMs }
}
