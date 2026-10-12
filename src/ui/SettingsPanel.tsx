import { useState } from 'preact/hooks'
import { exportSave, importSave, newGame } from '../game/save'
import type { GameState } from '../game/types'
import { t } from '../i18n'
import { replaceGame } from '../store'

export function SettingsPanel({ state }: { state: GameState }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [typed, setTyped] = useState<string | null>(null) // null: reset not started

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

  const doReset = () => {
    replaceGame(newGame(Date.now()))
    setTyped(null)
    setMessage({ text: t.ui.resetDone, ok: true }) // the old save code stays in the box
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

      <h2>🗑️ {t.ui.reset}</h2>
      {typed === null ? (
        <button
          class="btn danger"
          onClick={() => {
            doExport() // step 1: put a way back in the box (and on the clipboard) before anything is deleted
            setTyped('')
          }}
        >
          {t.ui.resetStart}
        </button>
      ) : (
        <>
          <p class="warn">{t.ui.resetWarning}</p>
          <input
            value={typed}
            placeholder={t.ui.resetPrompt(t.ui.resetWord)}
            aria-label={t.ui.resetPrompt(t.ui.resetWord)}
            autocapitalize="characters"
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => setTyped(e.currentTarget.value)}
          />
          <div class="row">
            <button class="btn" onClick={() => setTyped(null)}>
              {t.ui.cancel}
            </button>
            <button class="btn danger" disabled={typed.trim() !== t.ui.resetWord} onClick={doReset}>
              {t.ui.resetConfirm}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
