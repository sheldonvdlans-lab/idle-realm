import { useEffect, useRef } from 'preact/hooks'
import { ACTIONS, OFFLINE_CAP_MS } from '../game/config'
import { formatDuration, formatNumber } from '../game/format'
import { levelForXp } from '../game/xp'
import { actionName, itemName, t } from '../i18n'
import { dismissWelcome, type Welcome } from '../store'
import { SKILL_ICON } from './icons'

export function WelcomeBack({ welcome: { before, elapsedMs, actions, stopped } }: { welcome: Welcome }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])

  const def = ACTIONS[before.active!.actionId]
  const xp = before.xp[def.skill]
  const [from, to] = [levelForXp(xp), levelForXp(xp + def.xp * actions)]
  const time = formatDuration(elapsedMs)

  return (
    <dialog ref={ref} onClose={dismissWelcome}>
      <h2>👋 {t.ui.welcome}</h2>
      <p class="muted">{elapsedMs >= OFFLINE_CAP_MS ? t.ui.awayCapped(time) : t.ui.away(time)}</p>
      <p>
        {SKILL_ICON[def.skill]} {actionName(def)} × {formatNumber(actions)}
      </p>
      <ul>
        <li>
          +{formatNumber(def.xp * actions)} {t.skills[def.skill]} {t.ui.xp}
          {to > from && (
            <strong>
              {' '}
              · {t.ui.level} {from} → {to}
            </strong>
          )}
        </li>
        {Object.entries(def.outputs).map(([id, n]) => (
          <li key={id}>
            +{formatNumber(n * actions)} {itemName(id)}
          </li>
        ))}
        {Object.entries(def.inputs).map(([id, n]) => (
          <li key={id} class="muted">
            −{formatNumber(n * actions)} {itemName(id)}
          </li>
        ))}
      </ul>
      {stopped && (
        <p class="warn">
          {t.ui.stopped}: {t.ui.blocked[stopped]}
        </p>
      )}
      <form method="dialog">
        <button class="btn">{t.ui.continue}</button>
      </form>
    </dialog>
  )
}
