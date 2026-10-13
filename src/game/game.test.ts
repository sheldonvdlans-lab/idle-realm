import { describe, expect, it } from 'vitest'
import { buyUpgrade, sell } from './bank'
import { ACTIONS, ITEMS, OFFLINE_CAP_MS, START_BANK_SLOTS, UPGRADES } from './config'
import { formatDuration, formatNumber } from './format'
import { deserialize, exportSave, importSave, newGame, serialize } from './save'
import { actionTimeMs, advance, bankSlots, dequeue, enqueue, queueClosed, speedBonus, startAction, startQueue, stopAction, tick } from './tick'
import { GOAL_MAX } from './config'
import type { GameState } from './types'
import { levelForXp, xpForLevel } from './xp'

const game = (patch: Partial<GameState> = {}): GameState => ({ ...newGame(0), ...patch })
const chopping = (patch: Partial<GameState> = {}) => startAction(game(patch), 'chop_pine_log')
const HOUR = 3_600_000
const queueIds = (s: GameState) => s.queue.map((q) => q.actionId)

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
    expect(r.runs).toEqual([{ actionId: 'chop_pine_log', actions: 3, stopped: null }])
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
    expect(r.runs).toEqual([{ actionId: 'smelt_copper_bar', actions: 2, stopped: 'inputs' }])
    expect(r.state.bank).toEqual({ copper_ore: 1, copper_bar: 2 })
    expect(r.state.xp.smithing).toBe(40)
    expect(r.state.active).toBeNull()
  })

  it('cooking burns one log per three fish', () => {
    const start = startAction(game({ bank: { minnow_raw: 9, pine_log: 2 } }), 'cook_minnow_cooked')
    const r = tick(start, 60_000)
    expect(r.state.bank).toEqual({ minnow_raw: 3, minnow_cooked: 6 })
    expect(r.runs[0].stopped).toBe('inputs')
  })

  it('will not start or continue when a new stack does not fit in the bank', () => {
    const bank = Object.fromEntries(Object.keys(ITEMS).filter((id) => id !== 'pine_log').slice(0, START_BANK_SLOTS).map((id) => [id, 1]))
    expect(startAction(game({ bank }), 'chop_pine_log').active).toBeNull()
    const r = tick(game({ bank, active: { actionId: 'chop_pine_log', progressMs: 0 } }), 60_000)
    expect(r.runs).toEqual([{ actionId: 'chop_pine_log', actions: 0, stopped: 'bankFull' }])
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
  it('uses the same tick for the time away', () => {
    const r = advance(chopping(), 2 * HOUR)
    expect(r.elapsedMs).toBe(2 * HOUR)
    expect(r.runs[0].actions).toBe(2400)
    expect(r.state.lastSeen).toBe(2 * HOUR)
  })

  it('caps the time away at 12 hours', () => {
    const r = advance(chopping(), 100 * HOUR)
    expect(r.elapsedMs).toBe(OFFLINE_CAP_MS)
    expect(r.runs[0].actions).toBe(14_400)
  })

  it('gives nothing when the clock was set back', () => {
    const r = advance(chopping({ lastSeen: 10 * HOUR }), HOUR)
    expect(r.elapsedMs).toBe(0)
    expect(r.runs).toEqual([])
    expect(r.state.lastSeen).toBe(HOUR)
  })
})

describe('queue', () => {
  const smelting = (ore: number) => startAction(game({ bank: { copper_ore: ore } }), 'smelt_copper_bar')
  const queued = (s: GameState, ...ids: string[]) => ids.reduce((acc, id) => enqueue(acc, id), s)

  it('starts the next action when the current one runs out, in live ticks', () => {
    let s = queued(smelting(4), 'mine_copper_ore') // 6 s of smelting, then mining
    for (let i = 0; i < 150; i++) s = tick(s, 100).state
    expect(s.bank).toEqual({ copper_bar: 2, copper_ore: 3 })
    expect(s.xp).toMatchObject({ smithing: 40, mining: 30 })
    expect(s.active).toEqual({ actionId: 'mine_copper_ore', progressMs: 0 })
    expect(s.queue).toEqual([])
  })

  // 100 ore → 50 bars (150 s) → 10 pickaxes (150 s) → mine for the rest, 3% faster with the new pickaxe
  const chain = () => queued(smelting(100), 'forge_copper_pickaxe', 'mine_copper_ore')

  it('walks several queued actions in one offline tick', () => {
    const r = advance(chain(), 2 * HOUR)
    expect(r.runs).toEqual([
      { actionId: 'smelt_copper_bar', actions: 50, stopped: 'inputs' },
      { actionId: 'forge_copper_pickaxe', actions: 10, stopped: 'inputs' },
      { actionId: 'mine_copper_ore', actions: 2371, stopped: null },
    ])
    expect(Math.floor((2 * HOUR - 300_000) / (3000 * 0.97))).toBe(2371)
    expect(r.state.bank).toEqual({ copper_pickaxe: 10, copper_ore: 2371 })
    expect(r.state.xp).toMatchObject({ smithing: 1500, mining: 23_710 })
    expect(r.state.active?.actionId).toBe('mine_copper_ore')
    expect(r.state.queue).toEqual([])
  })

  it('spends at most 12 hours across the whole queue', () => {
    const r = advance(chain(), 100 * HOUR)
    const mining = r.runs[2].actions * actionTimeMs(r.state, ACTIONS.mine_copper_ore) + r.state.active!.progressMs
    expect(150_000 + 150_000 + mining).toBeCloseTo(OFFLINE_CAP_MS)
  })

  it('gives the same result in small steps as in one big step, across handovers', () => {
    const start = queued(smelting(20), 'forge_copper_axe', 'mine_copper_ore')
    let small = start
    for (let i = 0; i < 1000; i++) small = tick(small, 100).state
    expect(small).toEqual(tick(start, 100_000).state)
    expect(small.bank).toEqual({ copper_axe: 2, copper_ore: 13 })
  })

  it('skips a queued action that cannot run, reports why, and carries on', () => {
    const r = tick(queued(smelting(4), 'forge_copper_axe', 'mine_copper_ore'), 12_000) // 2 bars: no axe
    expect(r.runs).toEqual([
      { actionId: 'smelt_copper_bar', actions: 2, stopped: 'inputs' },
      { actionId: 'forge_copper_axe', actions: 0, stopped: 'inputs' },
      { actionId: 'mine_copper_ore', actions: 2, stopped: null },
    ])
  })

  it('goes idle when the queue is used up', () => {
    const r = tick(queued(smelting(4), 'forge_copper_axe'), HOUR)
    expect(r.state.active).toBeNull()
    expect(r.state.bank).toEqual({ copper_bar: 2 })
  })

  it('holds at most three actions, and nothing behind a gathering action', () => {
    let s = queued(smelting(4), 'forge_copper_axe', 'forge_copper_hook', 'forge_copper_pickaxe', 'smelt_copper_bar')
    expect(queueIds(s)).toEqual(['forge_copper_axe', 'forge_copper_hook', 'forge_copper_pickaxe'])
    expect(queueClosed(s)).toBe('full')
    s = enqueue(dequeue(dequeue(s, 0), 0), 'mine_copper_ore')
    expect(queueIds(s)).toEqual(['forge_copper_pickaxe', 'mine_copper_ore'])
    expect(queueClosed(s)).toBe('gathering')
    expect(enqueue(s, 'smelt_copper_bar')).toBe(s)
  })

  it('only queues unlocked, existing actions', () => {
    expect(enqueue(smelting(4), 'smelt_iron_bar').queue).toEqual([])
    expect(enqueue(smelting(4), 'nope').queue).toEqual([])
  })

  it('stop clears the queue, and queueing while idle starts at once', () => {
    expect(stopAction(queued(smelting(4), 'mine_copper_ore'))).toMatchObject({ active: null, queue: [] })
    expect(enqueue(game(), 'chop_pine_log')).toMatchObject({ active: { actionId: 'chop_pine_log' }, queue: [] })
  })

  it('"start queue now" swaps a never-ending action for the queue', () => {
    const mining = startAction(game({ bank: { copper_ore: 4 } }), 'mine_copper_ore')
    const s = startQueue(queued(mining, 'smelt_copper_bar', 'mine_copper_ore'))
    expect(s.active).toEqual({ actionId: 'smelt_copper_bar', progressMs: 0 })
    expect(s.queue).toEqual([{ actionId: 'mine_copper_ore' }])
    expect(startQueue(mining)).toBe(mining)
  })
})

describe('goals', () => {
  it('counts down, stops at the goal and hands over to the queue, in live ticks', () => {
    let s = enqueue(startAction(game(), 'mine_copper_ore', 3), 'chop_pine_log')
    for (let i = 0; i < 35; i++) s = tick(s, 100).state
    expect(s.active).toEqual({ actionId: 'mine_copper_ore', left: 2, progressMs: 500 })
    for (let i = 0; i < 85; i++) s = tick(s, 100).state // 12 s in total: 9 s mining, 3 s chopping
    expect(s.bank).toEqual({ copper_ore: 3, pine_log: 1 })
    expect(s.active).toEqual({ actionId: 'chop_pine_log', progressMs: 0 })
  })

  it('goes idle at the goal when nothing is queued, for production too', () => {
    const mined = tick(startAction(game(), 'mine_copper_ore', 5), HOUR)
    expect(mined.runs).toEqual([{ actionId: 'mine_copper_ore', actions: 5, stopped: 'done' }])
    expect(mined.state.active).toBeNull()
    const smelted = tick(startAction(game({ bank: { copper_ore: 10 } }), 'smelt_copper_bar', 2), HOUR)
    expect(smelted.runs).toEqual([{ actionId: 'smelt_copper_bar', actions: 2, stopped: 'done' }])
    expect(smelted.state.bank).toEqual({ copper_ore: 6, copper_bar: 2 })
  })

  // mine 100 (300 s) → smelt them (150 s) → mine without a goal for the rest
  const chain = (goal: number) =>
    enqueue(enqueue(startAction(game(), 'mine_copper_ore', goal), 'smelt_copper_bar'), 'mine_copper_ore')

  it('runs a gathering goal in the middle of an offline chain', () => {
    const r = advance(chain(100), 2 * HOUR)
    expect(r.runs).toEqual([
      { actionId: 'mine_copper_ore', actions: 100, stopped: 'done' },
      { actionId: 'smelt_copper_bar', actions: 50, stopped: 'inputs' },
      { actionId: 'mine_copper_ore', actions: 2250, stopped: null },
    ])
    expect(r.state.bank).toEqual({ copper_bar: 50, copper_ore: 2250 })
    expect(r.state.active).toEqual({ actionId: 'mine_copper_ore', progressMs: 0 })
  })

  it('gives the same result in small steps as in one big step, across a goal', () => {
    const start = chain(20) // 60 s mining, 30 s smelting, 10 s mining
    let small = start
    for (let i = 0; i < 1000; i++) small = tick(small, 100).state
    expect(small).toEqual(tick(start, 100_000).state)
    expect(small.bank).toEqual({ copper_bar: 10, copper_ore: 3 })
    expect(small.active).toEqual({ actionId: 'mine_copper_ore', progressMs: 1000 })
  })

  it('lets actions queue behind gathering with a goal, not behind gathering without one', () => {
    const smelting = startAction(game({ bank: { copper_ore: 4 } }), 'smelt_copper_bar')
    const withGoal = enqueue(smelting, 'mine_copper_ore', 500)
    expect(withGoal.queue).toEqual([{ actionId: 'mine_copper_ore', left: 500 }])
    expect(queueClosed(withGoal)).toBeNull()
    expect(queueIds(enqueue(withGoal, 'smelt_copper_bar'))).toEqual(['mine_copper_ore', 'smelt_copper_bar'])
    const endless = enqueue(withGoal, 'chop_pine_log')
    expect(queueClosed(endless)).toBe('gathering')
    expect(enqueue(endless, 'smelt_copper_bar')).toBe(endless)
  })

  it('treats a goal that is not a positive whole number as no goal', () => {
    for (const bad of [0, -5, 2.5, NaN, Infinity]) {
      expect(startAction(game(), 'chop_pine_log', bad).active).toEqual({ actionId: 'chop_pine_log', progressMs: 0 })
    }
    expect(startAction(game(), 'chop_pine_log', 1e12).active?.left).toBe(GOAL_MAX)
  })
})

describe('save', () => {
  const played = tick(chopping({ gold: 1234, lastSeen: 42, upgrades: { bank: 2, mining: 1 } }), 10_000).state

  it('round-trips through JSON and through the export string', () => {
    expect(deserialize(serialize(played))).toEqual(played)
    expect(importSave(`  ${exportSave(played)}\n`)).toEqual(played)
  })

  it('migrates a version 1 save, through version 2, to an empty queue', () => {
    const v1 =
      '{"version":1,"xp":{"woodcutting":20,"mining":0,"fishing":0,"smithing":0,"cooking":0},"bank":{"pine_log":2},"gold":5,' +
      '"upgrades":{"bank":1},"active":{"actionId":"chop_pine_log","progressMs":1101},"lastSeen":42}'
    expect(deserialize(v1)).toEqual({
      version: 3,
      xp: { woodcutting: 20, mining: 0, fishing: 0, smithing: 0, cooking: 0 },
      bank: { pine_log: 2 },
      gold: 5,
      upgrades: { bank: 1 },
      active: { actionId: 'chop_pine_log', progressMs: 1101 },
      queue: [],
      lastSeen: 42,
    })
    // a queue field on a v1 save is not ours: the migration resets it
    expect(deserialize(v1.replace('"gold":5', '"gold":5,"queue":["mine_copper_ore"]')).queue).toEqual([])
  })

  it('migrates a version 2 save: queued action ids become entries without a goal', () => {
    const v2 =
      '{"version":2,"xp":{"woodcutting":0,"mining":30,"fishing":0,"smithing":0,"cooking":0},"bank":{"copper_ore":9},"gold":0,' +
      '"upgrades":{},"active":{"actionId":"smelt_copper_bar","progressMs":700},"queue":["forge_copper_axe","mine_copper_ore"],"lastSeen":42}'
    const s = deserialize(v2)
    expect(s.version).toBe(3)
    expect(s.active).toEqual({ actionId: 'smelt_copper_bar', progressMs: 700 })
    expect(s.queue).toEqual([{ actionId: 'forge_copper_axe' }, { actionId: 'mine_copper_ore' }])
    expect(s.bank).toEqual({ copper_ore: 9 })
  })

  it('keeps a queue with goals through a round trip', () => {
    const withQueue = enqueue(enqueue(startAction(played, 'chop_pine_log', 50), 'mine_copper_ore', 500), 'smelt_copper_bar')
    expect(withQueue.active?.left).toBe(50)
    expect(importSave(exportSave(withQueue))).toEqual(withQueue)
  })

  it('drops junk from the queue and from goals', () => {
    const junk = {
      ...played,
      active: { actionId: 'chop_pine_log', progressMs: 5, left: 0 },
      queue: [
        { actionId: 'mine_copper_ore', left: -3 },
        { actionId: 'nope', left: 5 },
        'smelt_copper_bar',
        null,
        { actionId: 'constructor' },
        { actionId: 'chop_pine_log', left: 'many' },
        { actionId: 'chop_pine_log', left: 5, extra: true },
        { actionId: 'chop_pine_log' },
      ],
    }
    const s = deserialize(JSON.stringify(junk))
    expect(s.active).toEqual({ actionId: 'chop_pine_log', progressMs: 5 })
    expect(s.queue).toEqual([{ actionId: 'mine_copper_ore' }, { actionId: 'chop_pine_log' }, { actionId: 'chop_pine_log', left: 5 }])
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
