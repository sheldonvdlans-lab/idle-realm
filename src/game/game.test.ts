import { describe, expect, it } from 'vitest'
import { buyUpgrade, sell } from './bank'
import { ACTIONS, ITEMS, OFFLINE_CAP_MS, START_BANK_SLOTS, UPGRADES } from './config'
import { formatDuration, formatNumber } from './format'
import { deserialize, exportSave, importSave, newGame, serialize } from './save'
import { actionTimeMs, advance, bankSlots, speedBonus, startAction, tick } from './tick'
import type { GameState } from './types'
import { levelForXp, xpForLevel } from './xp'

const game = (patch: Partial<GameState> = {}): GameState => ({ ...newGame(0), ...patch })
const chopping = (patch: Partial<GameState> = {}) => startAction(game(patch), 'chop_pine_log')

describe('xp', () => {
  it('matches the agreed curve', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(62)
    expect(xpForLevel(10)).toBe(2362)
    expect(xpForLevel(99)).toBe(2358860)
  })

  it('maps xp to levels at the boundaries', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(61)).toBe(1)
    expect(levelForXp(62)).toBe(2)
    expect(levelForXp(xpForLevel(50) - 1)).toBe(49)
    expect(levelForXp(xpForLevel(50))).toBe(50)
    expect(levelForXp(1e12)).toBe(99)
  })
})

describe('config', () => {
  it('only references items that exist', () => {
    for (const a of Object.values(ACTIONS)) {
      for (const id of [...Object.keys(a.inputs), ...Object.keys(a.outputs)]) expect(ITEMS[id], `${a.id} → ${id}`).toBeDefined()
    }
    expect(Object.keys(ACTIONS)).toHaveLength(7 * 8)
  })
})

describe('tick', () => {
  it('repeats the action and keeps the remainder', () => {
    const r = tick(chopping(), 10_000)
    expect(r.actions).toBe(3)
    expect(r.state.bank).toEqual({ pine_log: 3 })
    expect(r.state.xp.woodcutting).toBe(30)
    expect(r.state.active).toEqual({ actionId: 'chop_pine_log', progressMs: 1000 })
  })

  it('gives the same result in small steps as in one big step', () => {
    let small = chopping()
    for (let i = 0; i < 1000; i++) small = tick(small, 100).state
    expect(small).toEqual(tick(chopping(), 100_000).state)
  })

  it('does nothing without an active action, and ignores bad deltas', () => {
    expect(tick(game(), 60_000).state).toEqual(game())
    expect(tick(chopping(), -5000).state).toEqual(chopping())
    expect(tick(chopping(), NaN).state).toEqual(chopping())
  })

  it('refuses actions above the skill level', () => {
    expect(startAction(game(), 'chop_oak_log').active).toBeNull()
    expect(startAction(game({ xp: { ...game().xp, woodcutting: xpForLevel(10) } }), 'chop_oak_log').active).not.toBeNull()
  })

  it('consumes inputs and stops when they run out', () => {
    const start = startAction(game({ bank: { copper_ore: 5 } }), 'smelt_copper_bar')
    const r = tick(start, 60_000)
    expect(r.actions).toBe(2)
    expect(r.stopped).toBe('inputs')
    expect(r.state.bank).toEqual({ copper_ore: 1, copper_bar: 2 })
    expect(r.state.xp.smithing).toBe(40)
    expect(r.state.active).toBeNull()
  })

  it('cooking burns one log per three fish', () => {
    const start = startAction(game({ bank: { minnow_raw: 9, pine_log: 2 } }), 'cook_minnow_cooked')
    const r = tick(start, 60_000)
    expect(r.state.bank).toEqual({ minnow_raw: 3, minnow_cooked: 6 })
    expect(r.stopped).toBe('inputs')
  })

  it('will not start or continue when a new stack does not fit in the bank', () => {
    const bank = Object.fromEntries(Object.keys(ITEMS).filter((id) => id !== 'pine_log').slice(0, START_BANK_SLOTS).map((id) => [id, 1]))
    expect(startAction(game({ bank }), 'chop_pine_log').active).toBeNull()
    const r = tick(game({ bank, active: { actionId: 'chop_pine_log', progressMs: 0 } }), 60_000)
    expect(r.stopped).toBe('bankFull')
    expect(r.state.bank).toEqual(bank)
    // an existing stack can always grow
    const full = { ...Object.fromEntries(Object.entries(bank).slice(1)), pine_log: 1 }
    expect(tick(startAction(game({ bank: full }), 'chop_pine_log'), 3000).state.bank.pine_log).toBe(2)
  })

  it('speeds up gathering with the best smithed tool in the bank', () => {
    const state = game({ bank: { copper_axe: 1, iron_axe: 1, voidglass_pickaxe: 1 } })
    expect(actionTimeMs(state, ACTIONS.chop_pine_log)).toBeCloseTo(3000 * 0.94)
    expect(actionTimeMs(state, ACTIONS.mine_copper_ore)).toBeCloseTo(3000 * 0.75)
    expect(actionTimeMs(state, ACTIONS.catch_minnow_raw)).toBe(3000)
  })
})

describe('bank and shop', () => {
  it('prices follow tier × kind', () => {
    expect(ITEMS.pine_log.sellPrice).toBe(2)
    expect(ITEMS.copper_bar.sellPrice).toBe(6)
    expect(ITEMS.voidglass_axe.sellPrice).toBe(1100)
    expect(ITEMS.glimmerfin_cooked.sellPrice).toBe(110)
  })

  it('sells items for gold and frees the slot with the last one', () => {
    const s = sell(game({ bank: { copper_bar: 10 } }), 'copper_bar', 4)
    expect(s.bank).toEqual({ copper_bar: 6 })
    expect(s.gold).toBe(24)
    const all = sell(s, 'copper_bar', Infinity)
    expect(all.bank).toEqual({})
    expect(all.gold).toBe(60)
  })

  it('ignores impossible sales', () => {
    const s = game({ bank: { copper_bar: 10 } })
    for (const count of [0, -3, NaN, 0.5]) expect(sell(s, 'copper_bar', count)).toBe(s)
    expect(sell(s, 'pine_log', 1)).toBe(s)
  })

  it('buys upgrades level by level until maxed', () => {
    let s = game({ gold: 2499 })
    expect(buyUpgrade(s, 'woodcutting')).toBe(s)
    s = buyUpgrade(game({ gold: 300_000 }), 'woodcutting')
    expect(s.gold).toBe(297_500)
    s = buyUpgrade(buyUpgrade(s, 'woodcutting'), 'woodcutting')
    expect(s.upgrades.woodcutting).toBe(3)
    expect(s.gold).toBe(22_500)
    expect(buyUpgrade(s, 'woodcutting')).toBe(s)
    expect(buyUpgrade(s, 'nope')).toBe(s)
  })

  it('stacks the shop upgrade with the smithed tool, up to 40%', () => {
    const s = game({ upgrades: { woodcutting: 3 }, bank: { voidglass_axe: 1 } })
    expect(speedBonus(s, 'woodcutting')).toBeCloseTo(0.4)
    expect(speedBonus(s, 'mining')).toBe(0)
    expect(actionTimeMs(s, ACTIONS.chop_pine_log)).toBeCloseTo(1800)
  })

  it('bank upgrades add slots and double in cost', () => {
    expect(UPGRADES.bank.costs.slice(0, 3)).toEqual([500, 1000, 2000])
    expect(UPGRADES.bank.costs.at(-1)).toBe(512_000)
    expect(bankSlots(game())).toBe(12)
    expect(bankSlots(game({ upgrades: { bank: 11 } }))).toBe(Object.keys(ITEMS).length)
  })
})

describe('offline progress', () => {
  const HOUR = 3_600_000

  it('uses the same tick for the time away', () => {
    const r = advance(chopping(), 2 * HOUR)
    expect(r.elapsedMs).toBe(2 * HOUR)
    expect(r.actions).toBe(2400)
    expect(r.state.lastSeen).toBe(2 * HOUR)
  })

  it('caps the time away at 12 hours', () => {
    const r = advance(chopping(), 100 * HOUR)
    expect(r.elapsedMs).toBe(OFFLINE_CAP_MS)
    expect(r.actions).toBe(14_400)
  })

  it('gives nothing when the clock was set back', () => {
    const r = advance(chopping({ lastSeen: 10 * HOUR }), HOUR)
    expect(r.elapsedMs).toBe(0)
    expect(r.actions).toBe(0)
    expect(r.state.lastSeen).toBe(HOUR)
  })
})

describe('save', () => {
  const played = tick(chopping({ gold: 1234, lastSeen: 42, upgrades: { bank: 2, mining: 1 } }), 10_000).state

  it('round-trips through JSON and through the export string', () => {
    expect(deserialize(serialize(played))).toEqual(played)
    expect(importSave(`  ${exportSave(played)}\n`)).toEqual(played)
  })

  it('rejects things that are not saves', () => {
    for (const bad of ['', 'hello', 'null', '[]', '{}', '{"version":"1"}', '{"version":999}']) {
      expect(() => deserialize(bad), bad).toThrow()
    }
    expect(() => importSave('not base64 !!')).toThrow()
  })

  it('drops unknown or broken fields instead of trusting them', () => {
    const s = deserialize(
      JSON.stringify({
        version: 1,
        xp: { woodcutting: -5, mining: 'lots', fishing: 100 },
        bank: { pine_log: 2.9, nope: 5, constructor: 5, oak_log: -1, copper_ore: null },
        gold: 1e999,
        upgrades: { bank: 500, mining: -1, hax: 3 },
        active: { actionId: 'toString', progressMs: 5 },
        lastSeen: 'yesterday',
      }),
      777,
    )
    expect(s).toEqual({ ...newGame(777), xp: { ...newGame(0).xp, fishing: 100 }, bank: { pine_log: 2 }, upgrades: { bank: 11 } })
  })
})

describe('formatDuration', () => {
  it('shows the two largest units', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(200_000)).toBe('3m 20s')
    expect(formatDuration(8_100_000)).toBe('2h 15m')
    expect(formatDuration(OFFLINE_CAP_MS)).toBe('12h')
  })
})

describe('formatNumber', () => {
  it('abbreviates large numbers', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(1000)).toBe('1K')
    expect(formatNumber(1234)).toBe('1.2K')
    expect(formatNumber(999_999)).toBe('999.9K')
    expect(formatNumber(3_400_000)).toBe('3.4M')
    expect(formatNumber(2_500_000_000)).toBe('2.5B')
    expect(formatNumber(12.7)).toBe('12')
  })
})
