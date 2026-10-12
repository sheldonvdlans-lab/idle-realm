import { useState } from 'preact/hooks'
import { ACTIONS, SKILLS } from '../game/config'
import { actionTimeMs, stopAction } from '../game/tick'
import type { GameState, SkillId } from '../game/types'
import { levelForXp } from '../game/xp'
import { formatNumber } from '../game/format'
import { actionName, t } from '../i18n'
import { notice, update, useGame } from '../store'
import { BankPanel } from './BankPanel'
import { GOLD, SKILL_ICON } from './icons'
import { ShopPanel } from './ShopPanel'
import { Bar, SkillPanel } from './SkillPanel'

const TABS = { skills: '⚒️', bank: '🏦', shop: '🛒' } as const
type Tab = keyof typeof TABS

export function App() {
  const state = useGame()
  const [tab, setTab] = useState<Tab>('skills')
  const [skill, setSkill] = useState<SkillId>('woodcutting')
  const busy = state.active && ACTIONS[state.active.actionId].skill

  return (
    <>
      <header>
        <div class="top">
          <h1>{t.title}</h1>
          <span class="gold">
            {GOLD} {formatNumber(state.gold)}
          </span>
        </div>
        <Now state={state} />
      </header>
      <main>
        {tab === 'skills' && (
          <>
            <nav class="skills">
              {SKILLS.map((id) => (
                <button key={id} class={`${id === skill ? 'on' : ''}${id === busy ? ' busy' : ''}`} onClick={() => setSkill(id)}>
                  <span>{SKILL_ICON[id]}</span>
                  <small>
                    {t.ui.lv} {levelForXp(state.xp[id])}
                  </small>
                </button>
              ))}
            </nav>
            <SkillPanel state={state} skill={skill} />
          </>
        )}
        {tab === 'bank' && <BankPanel state={state} />}
        {tab === 'shop' && <ShopPanel state={state} />}
      </main>
      <nav class="tabs">
        {(Object.keys(TABS) as Tab[]).map((id) => (
          <button key={id} class={id === tab ? 'on' : ''} onClick={() => setTab(id)}>
            <span>{TABS[id]}</span>
            <small>{t.ui.tabs[id]}</small>
          </button>
        ))}
      </nav>
    </>
  )
}

/** What is running right now, visible from every tab. */
function Now({ state }: { state: GameState }) {
  const def = state.active && ACTIONS[state.active.actionId]
  if (!state.active || !def) {
    return (
      <div class={`now ${notice.stopped ? 'warn' : 'muted'}`}>
        {notice.stopped ? `${t.ui.stopped}: ${t.ui.blocked[notice.stopped]}` : t.ui.idle}
      </div>
    )
  }
  return (
    <div class="now">
      <span>
        {SKILL_ICON[def.skill]} {actionName(def)}
      </span>
      <button class="btn" onClick={() => update(stopAction)}>
        {t.ui.stop}
      </button>
      <Bar value={state.active.progressMs / actionTimeMs(state, def)} />
    </div>
  )
}
