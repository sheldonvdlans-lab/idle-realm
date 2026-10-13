import { useState } from 'preact/hooks'
import { ACTIONS, SKILLS } from '../game/config'
import { actionTimeMs, dequeue, neverEnds, startQueue, stopAction } from '../game/tick'
import type { GameState, SkillId } from '../game/types'
import { levelForXp } from '../game/xp'
import { formatNumber } from '../game/format'
import { actionName, stopText, t } from '../i18n'
import { notice, update, useGame } from '../store'
import { BankPanel } from './BankPanel'
import { GOLD, SKILL_ICON } from './icons'
import { SettingsPanel } from './SettingsPanel'
import { ShopPanel } from './ShopPanel'
import { WelcomeBack } from './WelcomeBack'
import { Bar, SkillPanel } from './SkillPanel'

const TABS = { skills: '⚒️', bank: '🏦', shop: '🛒', settings: '⚙️' } as const
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
            <SkillPanel key={skill} state={state} skill={skill} />
          </>
        )}
        {tab === 'bank' && <BankPanel state={state} />}
        {tab === 'shop' && <ShopPanel state={state} />}
        {tab === 'settings' && <SettingsPanel state={state} />}
      </main>
      {notice.welcome && <WelcomeBack welcome={notice.welcome} />}
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
  const stopped = notice.stopped
  return (
    <div class="now">
      {state.active && def ? (
        <>
          <span>
            {SKILL_ICON[def.skill]} {actionName(def)}
            {state.active.left && <small class="muted"> · {t.ui.left(formatNumber(state.active.left))}</small>}
          </span>
          <button class="btn" onClick={() => update(stopAction)}>
            {t.ui.stop}
          </button>
          <Bar value={state.active.progressMs / actionTimeMs(state, def)} />
        </>
      ) : (
        <span class="muted">{t.ui.idle}</span>
      )}
      {stopped && (
        <small class={stopped.stopped === 'done' ? 'muted' : 'warn'}>
          {actionName(ACTIONS[stopped.actionId])} · {stopText(stopped)}
        </small>
      )}
      {state.queue.length > 0 && (
        <div class="queue">
          <small>{t.ui.queue}</small>
          {state.queue.map(({ actionId, left }, i) => (
            <button
              key={i}
              class="chip"
              aria-label={`${t.ui.removeFromQueue}: ${actionName(ACTIONS[actionId])}`}
              onClick={() => update((s) => dequeue(s, i))}
            >
              {SKILL_ICON[ACTIONS[actionId].skill]} {actionName(ACTIONS[actionId])}
              {left && ` ×${formatNumber(left)}`} ✕
            </button>
          ))}
        </div>
      )}
      {state.active && neverEnds(state.active) && state.queue.length > 0 && (
        <div class="queue">
          <small class="warn">⚠️ {t.ui.queueStuck}</small>
          <button class="btn" onClick={() => update(startQueue)}>
            {t.ui.startQueue}
          </button>
        </div>
      )}
    </div>
  )
}
