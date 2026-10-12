# Idle Realm

A skilling idle game in its own fantasy world. Static site: no backend, no accounts, no API keys.

## Run

```bash
npm install
npm run dev      # dev server
npm test         # unit tests for the game logic
npm run build    # type-check + production build in dist/
```

## Layout

- `src/game/` — pure game logic, no DOM. `config.ts` holds all balance.
- `src/ui/` — Preact panels.
- `src/i18n/` — all UI text.
