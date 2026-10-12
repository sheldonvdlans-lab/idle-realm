# Idle Realm

A skilling idle game in its own fantasy world. Static site: no backend, no accounts, no API keys.

## Run

```bash
npm install
npm run dev      # dev server
npm test         # unit tests for the game logic
npm run build    # type-check + production build in dist/
```

`dist/` is a plain static site with relative paths, so it can be served from any folder (GitHub Pages) or wrapped with Capacitor (`webDir: dist`). It installs as a PWA and plays offline after the first visit.

## Layout

- `src/game/` — pure game logic, no DOM. `config.ts` holds all balance.
- `src/ui/` — Preact panels.
- `src/i18n/` — all UI text. `en.ts` is the only language; a translation is a copy of it, switched in `index.ts`.
- `src/store.ts` — game loop, autosave, offline catch-up.
- `public/` — app icons (placeholders rendered from an emoji).

## TODO (not built yet)

- **Action queue** — after a production action, move on to the next one automatically (smelt until the ore runs out, then go back to mining), so offline hours are not wasted when materials run out.
- **Native storage** — saves live in `localStorage`, which iOS may clear for apps that go unused. Move to Capacitor Preferences when wrapping for the stores.
- **Late-game gold sink** — everything in the shop costs about 1.86M while a full playthrough earns about 3.7M. Add something that keeps gold meaningful (combat gear, cosmetics, prestige).
