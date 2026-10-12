import { useState } from 'preact/hooks'
import { sell } from '../game/bank'
import { ITEMS } from '../game/config'
import { formatNumber } from '../game/format'
import { bankSlots } from '../game/tick'
import type { GameState } from '../game/types'
import { itemName, t } from '../i18n'
import { update } from '../store'
import { GOLD, KIND_ICON } from './icons'

export function BankPanel({ state }: { state: GameState }) {
  const [selected, setSelected] = useState<string | null>(null) // tap an item first: no accidental sales
  const ids = Object.keys(state.bank)

  return (
    <section>
      <h2>
        🏦 {t.ui.bank}
        <span class="level">{t.ui.slots(ids.length, bankSlots(state))}</span>
      </h2>
      {ids.length === 0 && <p class="muted">{t.ui.bankEmpty}</p>}
      <ul class="list">
        {ids.map((id) => {
          const item = ITEMS[id]
          const count = state.bank[id]
          return (
            <li key={id}>
              <button class={`card${selected === id ? ' active' : ''}`} onClick={() => setSelected(selected === id ? null : id)}>
                <span class={`icon tier-${item.tier}`}>{KIND_ICON[item.kind]}</span>
                <span class="body">
                  <strong>{itemName(id)}</strong>
                  <small>
                    {GOLD} {formatNumber(item.sellPrice)} {t.ui.each}
                    {item.tool && ` · ${t.skills[item.tool.skill]} ${t.ui.toolBonus(Math.round(item.tool.speedBonus * 100))}`}
                  </small>
                </span>
                <span class="req">{formatNumber(count)}</span>
              </button>
              {selected === id && (
                <div class="row">
                  {[1, 10].map((n) => (
                    <button key={n} class="btn" disabled={count < n} onClick={() => update((s) => sell(s, id, n))}>
                      {t.ui.sell(n)}
                    </button>
                  ))}
                  <button class="btn" onClick={() => update((s) => sell(s, id, Infinity))}>
                    {t.ui.sellAll} · {GOLD} {formatNumber(count * item.sellPrice)}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
