// Glue between the pure game logic and the browser: clock, storage, re-render.
import { useEffect, useState } from 'preact/hooks'
import { AUTOSAVE_MS, TICK_MS, WELCOME_MIN_MS } from './game/config'
import { deserialize, newGame, serialize } from './game/save'
import { advance, type Run } from './game/tick'
import type { GameState } from './game/types'

// ponytail: localStorage only; iOS can evict it, switch to Capacitor Preferences when going native
const KEY = 'idle-realm-save'

let state = load()
const listeners = new Set<() => void>()

/** What happened while the player was away: the state they left and what each action did. */
export interface Welcome {
  before: GameState
  elapsedMs: number
  runs: Run[]
}

export const notice: {
  stopped: Run | null // the last action that stopped by itself; cleared by the next thing the player does
  welcome: Welcome | null
} = { stopped: null, welcome: null }

function load(): GameState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
    if (raw) return deserialize(raw)
  } catch {
    // unreadable save: keep a copy so autosave does not destroy it, then start fresh
    try {
      if (raw) localStorage.setItem(`${KEY}-broken`, raw)
    } catch {
      /* storage unavailable */
    }
  }
  return newGame(Date.now())
}

export function save() {
  try {
    localStorage.setItem(KEY, serialize(state))
  } catch {
    /* storage full or blocked: keep playing in memory */
  }
}

function emit() {
  listeners.forEach((l) => l())
}

/** Apply a player action. */
export function update(fn: (s: GameState) => GameState) {
  notice.stopped = null
  state = fn(state)
  emit()
}

/** Swap in an imported save and persist it right away. */
export function replaceGame(next: GameState) {
  update(() => next)
  save()
}

export function dismissWelcome() {
  notice.welcome = null
  emit()
}

function tickNow() {
  // A hidden page does not tick: the first tick after coming back covers the whole absence,
  // exactly like reopening the app, so both get the same "welcome back".
  if (document.visibilityState === 'hidden') return
  const before = state
  const { elapsedMs, runs, state: next } = advance(state, Date.now())
  notice.stopped = runs.filter((run) => run.stopped).at(-1) ?? notice.stopped
  if (runs.length && elapsedMs >= WELCOME_MIN_MS) notice.welcome = { before, elapsedMs, runs }
  state = next
  emit()
}

export function useGame(): GameState {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  return state
}

export function startLoop() {
  tickNow() // catch up on offline time before the first render
  setInterval(tickNow, TICK_MS)
  setInterval(save, AUTOSAVE_MS)
  // mobile browsers kill background pages without warning: save the moment we are hidden
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? save() : tickNow()))
  addEventListener('pagehide', save)
}
