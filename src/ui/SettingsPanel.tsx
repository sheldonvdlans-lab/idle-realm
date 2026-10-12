import { useState } from 'preact/hooks'
import { exportSave, importSave } from '../game/save'
import type { GameState } from '../game/types'
import { t } from '../i18n'
import { replaceGame } from '../store'

export function SettingsPanel({ state }: { state: GameState }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const doExport = async () => {
    const exported = exportSave(state)
    setCode(exported)
    try {
      await navigator.clipboard.writeText(exported)
      setMessage({ text: t.ui.exported, ok: true })
    } catch {
      setMessage({ text: t.ui.exportedManual, ok: true }) // no clipboard access: the code is in the box
    }
  }

  const doImport = () => {
    let imported: GameState
    try {
      imported = importSave(code)
    } catch {
      return setMessage({ text: t.ui.importFailed, ok: false })
    }
    if (!confirm(t.ui.importConfirm)) return
    replaceGame(imported)
    setCode('')
    setMessage({ text: t.ui.imported, ok: true })
  }

  return (
    <section>
      <h2>⚙️ {t.ui.settings}</h2>
      <p class="muted">{t.ui.saveHelp}</p>
      <textarea
        rows={6}
        value={code}
        placeholder={t.ui.savePlaceholder}
        aria-label={t.ui.savePlaceholder}
        spellcheck={false}
        onInput={(e) => setCode(e.currentTarget.value)}
      />
      <div class="row">
        <button class="btn" onClick={doExport}>
          {t.ui.exportSave}
        </button>
        <button class="btn" disabled={!code.trim()} onClick={doImport}>
          {t.ui.importSave}
        </button>
      </div>
      {message && (
        <p class={message.ok ? 'muted' : 'warn'} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}
