import { ITEMS } from '../game/config'
import { formatNumber } from '../game/format'
import { bankSlots } from '../game/tick'
import type { GameState } from '../game/types'
import { itemName, t } from '../i18n'
import { KIND_ICON } from './icons'

export function BankPanel({ state }: { state: GameState }) {
  const ids = Object.keys(state.bank)
  return (
    <section>
      <h2>
        🏦 {t.ui.bank}
        <span class="level">{t.ui.slots(ids.length, bankSlots(state))}</span>
      </h2>
      {ids.length === 0 && <p class="muted">{t.ui.bankEmpty}</p>}
      <ul class="list">
        {ids.map((id) => (
          <li key={id} class="card">
            <span class={`icon tier-${ITEMS[id].tier}`}>{KIND_ICON[ITEMS[id].kind]}</span>
            <span class="body">
              <strong>{itemName(id)}</strong>
            </span>
            <span class="req">{formatNumber(state.bank[id])}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
