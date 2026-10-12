import { t } from '../i18n'
import { useGame } from '../store'
import { BankPanel } from './BankPanel'
import { SkillPanel } from './SkillPanel'

export function App() {
  const state = useGame()
  return (
    <>
      <header>
        <h1>{t.title}</h1>
      </header>
      <main>
        <SkillPanel state={state} skill="woodcutting" />
        <BankPanel state={state} />
      </main>
    </>
  )
}
