// Glue between the pure game logic and the browser: clock, storage, re-render.
import { useEffect, useState } from 'preact/hooks'
import { AUTOSAVE_MS, TICK_MS } from './game/config'
import { deserialize, newGame, serialize } from './game/save'
import { advance } from './game/tick'
import type { GameState } from './game/types'

const KEY = 'idle-realm-save'

let state = load()
const listeners = new Set<() => void>()

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

export function update(fn: (s: GameState) => GameState) {
  state = fn(state)
  listeners.forEach((l) => l())
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
  setInterval(() => update((s) => advance(s, Date.now()).state), TICK_MS)
  setInterval(save, AUTOSAVE_MS)
  // mobile browsers kill background pages without warning: save the moment we are hidden
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save())
  addEventListener('pagehide', save)
}
