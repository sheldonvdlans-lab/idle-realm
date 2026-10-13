import { useEffect, useRef } from 'preact/hooks'
import { ACTIONS, OFFLINE_CAP_MS } from '../game/config'
import { formatDuration, formatNumber } from '../game/format'
import { levelForXp } from '../game/xp'
import { actionName, itemName, stopText, t } from '../i18n'
import { dismissWelcome, type Welcome } from '../store'
import { SKILL_ICON } from './icons'

export function WelcomeBack({ welcome: { before, elapsedMs, runs } }: { welcome: Welcome }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])

  const time = formatDuration(elapsedMs)
  // replay the runs in order so each one shows the levels it started and ended on
  const xp = { ...before.xp }
  const rows = runs.map((run) => {
    const def = ACTIONS[run.actionId]
    const from = levelForXp(xp[def.skill])
    xp[def.skill] += def.xp * run.actions
    return { ...run, def, from, to: levelForXp(xp[def.skill]) }
  })

  return (
    <dialog ref={ref} onClose={dismissWelcome}>
      <h2>👋 {t.ui.welcome}</h2>
      <p class="muted">{elapsedMs >= OFFLINE_CAP_MS ? t.ui.awayCapped(time) : t.ui.away(time)}</p>
      {rows.map(({ def, from, to, ...run }, i) => (
        <div key={i}>
          <p>
            {SKILL_ICON[def.skill]} {actionName(def)}
            {run.actions > 0 && ` × ${formatNumber(run.actions)}`}
            {run.stopped && <small class={run.stopped === 'done' ? 'muted' : 'warn'}> · {stopText(run)}</small>}
          </p>
          {run.actions > 0 && (
            <ul>
              <li>
                +{formatNumber(def.xp * run.actions)} {t.skills[def.skill]} {t.ui.xp}
                {to > from && (
                  <strong>
                    {' '}
                    · {t.ui.level} {from} → {to}
                  </strong>
                )}
              </li>
              {Object.entries(def.outputs).map(([id, n]) => (
                <li key={id}>
                  +{formatNumber(n * run.actions)} {itemName(id)}
                </li>
              ))}
              {Object.entries(def.inputs).map(([id, n]) => (
                <li key={id} class="muted">
                  −{formatNumber(n * run.actions)} {itemName(id)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <form method="dialog">
        <button class="btn">{t.ui.continue}</button>
      </form>
    </dialog>
  )
}
