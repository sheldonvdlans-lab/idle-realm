import { ACTIONS, ITEMS, MAX_LEVEL } from '../game/config'
import { formatNumber } from '../game/format'
import { actionTimeMs, blocker, enqueue, queueClosed, speedBonus, startAction, stopAction } from '../game/tick'
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
      <ul class="list">
        {Object.values(ACTIONS)
          .filter((a) => a.skill === skill)
          .map((a) => (
            <ActionCard key={a.id} state={state} def={a} />
          ))}
      </ul>
    </section>
  )
}

function ActionCard({ state, def }: { state: GameState; def: ActionDef }) {
  const active = state.active?.actionId === def.id
  const blocked = blocker(state, def)
  const time = actionTimeMs(state, def)
  const inputs = Object.entries(def.inputs)
  const closed = queueClosed(state)

  return (
    <li class="action">
      <button
        class={`card${active ? ' active' : ''}`}
        disabled={!active && !!blocked}
        onClick={() => update((s) => (active ? stopAction(s) : startAction(s, def.id)))}
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
        disabled={blocked === 'level' || !!closed}
        title={closed ? t.ui.queueClosed[closed] : t.ui.addToQueue}
        aria-label={`${t.ui.addToQueue}: ${actionName(def)}`}
        onClick={() => update((s) => enqueue(s, def.id))}
      >
        +
      </button>
    </li>
  )
}
