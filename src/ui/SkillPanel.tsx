import { useState } from 'preact/hooks'
import { ACTIONS, GOAL_MAX, GOAL_PRESETS, ITEMS, MAX_LEVEL } from '../game/config'
import { formatNumber } from '../game/format'
import { actionTimeMs, blocker, enqueue, isGathering, queueClosed, speedBonus, startAction, stopAction, validGoal } from '../game/tick'
import type { ActionDef, GameState, SkillId } from '../game/types'
import { levelForXp, xpForLevel } from '../game/xp'
import { actionName, itemName, t } from '../i18n'
import { update } from '../store'
import { KIND_ICON, SKILL_ICON } from './icons'

export const Bar = ({ value }: { value: number }) => (
  <div class="bar">
    <div style={{ width: `${Math.min(1, value) * 100}%` }} />
  </div>
)

export function SkillPanel({ state, skill }: { state: GameState; skill: SkillId }) {
  const xp = state.xp[skill]
  const level = levelForXp(xp)
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)
  const maxed = level >= MAX_LEVEL
  const bonus = Math.round(speedBonus(state, skill) * 100)
  const closed = queueClosed(state)
  const defs = Object.values(ACTIONS).filter((a) => a.skill === skill)

  // The goal applies to the next action started or queued from this panel. Gathering only.
  const [preset, setPreset] = useState<number | undefined>() // undefined = ∞
  const [custom, setCustom] = useState<string | null>(null) // text of the custom field; null = a preset is chosen
  const goal = custom === null ? preset : validGoal(Number(custom))
  const ready = custom === null || goal !== undefined // a half-typed custom goal must not start as ∞

  return (
    <section>
      <h2>
        {SKILL_ICON[skill]} {t.skills[skill]}
        <span class="level">
          {t.ui.level} {level}
        </span>
      </h2>
      <Bar value={maxed ? 1 : (xp - from) / (to - from)} />
      <p class="muted">
        {maxed ? t.ui.maxLevel : `${formatNumber(xp - from)} / ${formatNumber(to - from)} ${t.ui.xp}`}
        {bonus > 0 && ` · ${t.ui.toolBonus(bonus)}`}
      </p>
      {closed && <p class={closed === 'gathering' ? 'warn' : 'muted'}>{t.ui.queueClosed[closed]}</p>}
      {isGathering(defs[0]) && (
        <div class="goal" role="group" aria-label={t.ui.goal}>
          <small>{t.ui.goal}</small>
          {[undefined, ...GOAL_PRESETS].map((g) => {
            const on = custom === null && preset === g
            return (
              <button
                key={g ?? 0}
                class={`chip${on ? ' on' : ''}`}
                aria-pressed={on}
                aria-label={g ? undefined : t.ui.noGoal}
                onClick={() => {
                  setPreset(g)
                  setCustom(null)
                }}
              >
                {g ?? '∞'}
              </button>
            )
          })}
          <button class={`chip${custom !== null ? ' on' : ''}`} aria-pressed={custom !== null} onClick={() => setCustom(custom ?? '')}>
            {t.ui.custom}
          </button>
          {custom !== null && (
            <input
              type="number"
              inputmode="numeric"
              min={1}
              max={GOAL_MAX}
              value={custom}
              placeholder={t.ui.customGoal}
              aria-label={t.ui.customGoal}
              onInput={(e) => setCustom(e.currentTarget.value)}
            />
          )}
        </div>
      )}
      <ul class="list">
        {defs.map((a) => (
          <ActionCard key={a.id} state={state} def={a} goal={goal} ready={ready} />
        ))}
      </ul>
    </section>
  )
}

function ActionCard({ state, def, goal, ready }: { state: GameState; def: ActionDef; goal?: number; ready: boolean }) {
  const active = state.active?.actionId === def.id
  const blocked = blocker(state, def)
  const time = actionTimeMs(state, def)
  const inputs = Object.entries(def.inputs)
  const closed = queueClosed(state)

  return (
    <li class="action">
      <button
        class={`card${active ? ' active' : ''}`}
        disabled={!active && (!!blocked || !ready)}
        onClick={() => update((s) => (active ? stopAction(s) : startAction(s, def.id, goal)))}
      >
        <span class={`icon tier-${def.tier}`}>{KIND_ICON[ITEMS[Object.keys(def.outputs)[0]].kind]}</span>
        <span class="body">
          <strong>{actionName(def)}</strong>
          {blocked === 'level' ? (
            <small>{t.ui.unlocksAt(def.level)}</small>
          ) : (
            <small>
              {(time / 1000).toFixed(1)}s · {formatNumber(def.xp)} {t.ui.xp}
            </small>
          )}
          {blocked !== 'level' && inputs.length > 0 && (
            <small class={blocked === 'inputs' ? 'warn' : ''}>
              {t.ui.uses}: {inputs.map(([id, n]) => `${n}× ${itemName(id)} (${formatNumber(state.bank[id] ?? 0)})`).join(', ')}
            </small>
          )}
          {blocked === 'bankFull' && <small class="warn">{t.ui.blocked.bankFull}</small>}
        </span>
        <span class="req">
          {t.ui.lv} {def.level}
        </span>
        {active && <Bar value={state.active!.progressMs / time} />}
      </button>
      <button
        class="btn"
        disabled={blocked === 'level' || !!closed || !ready}
        title={closed ? t.ui.queueClosed[closed] : t.ui.addToQueue}
        aria-label={`${t.ui.addToQueue}: ${actionName(def)}`}
        onClick={() => update((s) => enqueue(s, def.id, goal))}
      >
        +
      </button>
    </li>
  )
}
