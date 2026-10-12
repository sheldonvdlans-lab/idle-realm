import { ITEMS, UPGRADES } from './config'
import type { GameState, ItemId } from './types'

/** Sell up to `count` of an item; selling more than you own sells what you have. */
export function sell(state: GameState, id: ItemId, count: number): GameState {
  const n = Math.min(Math.floor(count), state.bank[id] ?? 0)
  if (!(n > 0)) return state
  const { [id]: owned, ...bank } = state.bank
  if (owned > n) bank[id] = owned - n
  return { ...state, bank, gold: state.gold + n * ITEMS[id].sellPrice }
}

export function buyUpgrade(state: GameState, id: string): GameState {
  const level = state.upgrades[id] ?? 0
  const cost = UPGRADES[id]?.costs[level]
  if (cost === undefined || state.gold < cost) return state
  return { ...state, gold: state.gold - cost, upgrades: { ...state.upgrades, [id]: level + 1 } }
}
