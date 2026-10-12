import { buyUpgrade } from '../game/bank'
import { BANK_UPGRADE, TOOL_UPGRADE, UPGRADES } from '../game/config'
import { formatNumber } from '../game/format'
import type { GameState, SkillId } from '../game/types'
import { t } from '../i18n'
import { update } from '../store'
import { GOLD, SKILL_ICON } from './icons'

export function ShopPanel({ state }: { state: GameState }) {
  return (
    <section>
      <h2>🛒 {t.ui.shop}</h2>
      <ul class="list">
        {Object.values(UPGRADES).map(({ id, costs }) => {
          const level = state.upgrades[id] ?? 0
          const cost = costs[level] // undefined once maxed
          const skill = id in SKILL_ICON ? (id as SkillId) : null
          return (
            <li key={id} class="card">
              <span class="icon">{skill ? SKILL_ICON[skill] : '🏦'}</span>
              <span class="body">
                <strong>{t.upgrades[id]}</strong>
                <small>
                  {skill
                    ? t.ui.toolUpgradeDesc(t.skills[skill], TOOL_UPGRADE.bonus * 100)
                    : t.ui.bankUpgradeDesc(BANK_UPGRADE.slots)}
                </small>
                <small>
                  {t.ui.level} {level} / {costs.length}
                </small>
              </span>
              <button class="btn" disabled={cost === undefined || state.gold < cost} onClick={() => update((s) => buyUpgrade(s, id))}>
                {cost === undefined ? t.ui.maxed : `${GOLD} ${formatNumber(cost)}`}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
