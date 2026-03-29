# Loft

Shared movie/show watchlist with a café-inspired UI, optional accounts, friends, and a small API server so JSONBin keys can stay off the client.

## Features

- **Landing** (`/`) — product overview with “how it works” and architecture diagrams.
- **Watchlist room** (`/watch?room=…`) — shared JSONBin document, polling sync, OMDB search, TV episode modal.
- **Dark mode** — theme toggle (auto / light / dark), persisted in `localStorage`.
- **Where to watch** — **Watchmode** on the Loft server (`WATCHMODE_API_KEY`, free at [watchmode.com](https://api.watchmode.com/requestApiKey/)); optional **TMDB** fallback; **JustWatch** search link on every card.
- **Mark complete** — per title, stored in room state.
- **Accounts** — email + password signup/login via Loft API (`/api/auth/*`).
- **Friends** — send/accept requests by username (`/friends`).
- **Profiles** — public `/u/:username` with avatar URL, display name, and synced “shelf” from **Sync shelf** in the watchlist top bar.

## Tech stack

- React 19 + Vite + React Router
- Tailwind CSS v4 (`@theme` in `src/index.css`)
- OMDB (search + details + episodes)
- Watchmode + optional TMDB (streaming providers, server-side)
- JSONBin (room storage), proxied through Loft API in production-style setups
- Express API (`server/index.mjs`) + file-backed store (`server/data/loft-db.json`)

## Local development

1. `npm install`

2. **Frontend `.env`** (see `.env.example`):

   - `VITE_OMDB_KEY` (required)
   - Either run the API server **or** set `VITE_JSONBIN_KEY` for legacy direct browser access to JSONBin (not recommended for production).

3. **API server `.env`** at repo root (same folder as `package.json`):

   ```
   PORT=8787
   JSONBIN_KEY=your_master_key
   JWT_SECRET=long_random_string
   WATCHMODE_API_KEY=your_watchmode_key   # https://api.watchmode.com/requestApiKey/
   WATCH_REGION=US
   ```

   Streaming lookups run **only on the server** (no TMDB account required if you use Watchmode). Optional: `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` as a fallback when Watchmode returns nothing.

4. Run **both** (two terminals):

   - `npm run server`
   - `npm run dev` — Vite proxies `/api` → `http://localhost:8787`.

5. Open the app at the URL Vite prints (usually `http://localhost:5173`).

## Build & preview

- `npm run build`
- `npm run preview`

For production, deploy the static `dist/` behind a host that forwards `/api` to your Loft API, or set `VITE_API_URL` to your API origin at build time.

## JSONBin key in `.env`

If you use `VITE_JSONBIN_KEY`, escape `$` as `\$` in `.env` so Vite does not corrupt the value.
