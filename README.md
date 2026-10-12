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

## TODO (not built yet)

- **Action queue** — after a production action, move on to the next one automatically (smelt until the ore runs out, then go back to mining), so offline hours are not wasted when materials run out.
- **Late-game gold sink** — everything in the shop costs about 1.86M while a full playthrough earns about 3.7M. Add something that keeps gold meaningful (combat gear, cosmetics, prestige).
