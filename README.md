# Loft

Shared movie/show watchlist with a café-inspired UI, optional accounts, friends, and a small API server so JSONBin keys can stay off the client.

## Features

- **Landing** (`/`) — product overview with “how it works” and architecture diagrams.
- **Watchlist room** (`/watch?room=…`) — persisted on the **Loft server** (`server/data/rooms.json`) by default, or **JSONBin** if you set `JSONBIN_KEY`; polling sync, OMDB search, TV episode modal, **title suggestions** via **TMDB** (if configured) or **OMDB search** from your shelf genres/keywords (no TMDB account), per-title **reviews** (signed-in), **members** list, and **share by @handle** for room owners (local rooms).
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
- Room state: local file (`server/data/rooms.json`) or optional JSONBin
- Express API (`server/index.mjs`) + file-backed auth store (`server/data/loft-db.json`)

## Local development

1. `npm install`

2. **Frontend `.env`** (see `.env.example`):

   - `VITE_OMDB_KEY` (required)
   - Either run the API server **or** set `VITE_JSONBIN_KEY` for legacy direct browser access to JSONBin (not recommended for production).

3. **API server `.env`** at repo root (same folder as `package.json`):

   ```
   PORT=8787
   JWT_SECRET=long_random_string
   WATCHMODE_API_KEY=your_watchmode_key   # optional; https://api.watchmode.com/requestApiKey/
   WATCH_REGION=US
   ```

   **Rooms:** If you omit `JSONBIN_KEY`, watchlists are stored on disk at `server/data/rooms.json` (back up that file when you deploy). Set `JSONBIN_KEY` to use JSONBin in the cloud instead; set `ROOM_STORAGE=local` to keep disk storage even when `JSONBIN_KEY` is present.

   Streaming runs on the server only. Optional TMDB: `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` when Watchmode returns nothing, and for **richer title suggestions** on the watch room (local disk rooms only). If TMDB is unset, suggestions use **OMDB** (`OMDB_API_KEY` or the same `VITE_OMDB_KEY` the client uses).

4. Run **both** (two terminals):

   - `npm run server`
   - `npm run dev` — Vite proxies `/api` → `http://localhost:8787`.

5. Open the app at the URL Vite prints (usually `http://localhost:5173`).

## Build & preview

- `npm run build`
- `npm run preview`

For production, deploy the static `dist/` behind a host that forwards `/api` to your Loft API, or set `VITE_API_URL` to your API origin at build time.

## Production deployment (free tier: Vercel + API host)

Split the **static UI** and the **Express API** into two deployments. The browser talks to the API using `VITE_API_URL` (baked in at **build** time).

### Frontend (Vercel)

1. Import this repo in [Vercel](https://vercel.com). It should detect **Vite** (`npm run build`, output `dist/`).
2. **Environment variables** (Production — and Preview if you want previews to work):

   | Variable | Purpose |
   |----------|---------|
   | `VITE_API_URL` | Public API origin, **no** trailing slash (e.g. `https://loft-api.onrender.com`) |
   | `VITE_OMDB_KEY` | OMDB key for search/details in the browser (required for watchlist search) |
   | `VITE_JUSTWATCH_REGION` | Optional; default `us` |

3. **SPA routing:** [`vercel.json`](vercel.json) rewrites client routes (`/watch`, `/u/…`, etc.) to `index.html` so React Router works. Static assets under `dist/assets/` are still served as files.

4. After your API URL is stable, set `VITE_API_URL` and **redeploy** the frontend so the new value is included in the bundle.

### API (Render or similar)

1. Create a **Web Service** from the same repo (root directory = project root).
2. **Build command:** `npm install`  
   **Start command:** `node server/index.mjs`  
   Render sets `PORT` automatically; the server already reads `process.env.PORT`.
3. **Health check:** `GET /api/health` returns `{ ok: true }` (used by [`render.yaml`](render.yaml) if you use a Render Blueprint).
4. **Environment variables** (set in the host dashboard — never commit secrets):

   | Variable | Purpose |
   |----------|---------|
   | `JWT_SECRET` | Long random string (required for auth) |
   | `JSONBIN_KEY` | **Strongly recommended on free hosts** — rooms persist in JSONBin instead of only ephemeral disk |
   | `OMDB_API_KEY` or `VITE_OMDB_KEY` | Server-side OMDB + room suggestions without TMDB |
   | `WATCHMODE_API_KEY`, `WATCH_REGION` | Optional streaming |
   | `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` | Optional TMDB streaming + richer suggestions |
   | `ROOM_STORAGE` | `local` forces disk rooms even if `JSONBIN_KEY` is set; omit to use JSONBin when key is present |

5. Optional: connect the repo and use [`render.yaml`](render.yaml) as a blueprint, then add the secret env vars in the Render dashboard.

6. **CORS:** the API uses open `cors()` today so any origin can call it. For a single known frontend, you can later restrict `origin` to your Vercel URL.

### Free tier and persistence (important)

Free Node hosts usually use an **ephemeral filesystem**. Anything under `server/data/` (`loft-db.json`, `rooms.json`, uploaded avatars) can be **lost** on redeploy or when the instance sleeps.

- **Rooms:** set **`JSONBIN_KEY`** on the API so watchlists live in JSONBin (already supported by the server).
- **Accounts, profile shelf, avatars:** still file-backed unless you run the API on a **VM with a real disk** (e.g. Oracle Cloud Always Free) or migrate storage later.
- Use a strong **`JWT_SECRET`** in production; treat free-tier data as non-durable unless you use JSONBin + a persistent host for auth files.

## JSONBin key in `.env`

If you use `VITE_JSONBIN_KEY`, escape `$` as `\$` in `.env` so Vite does not corrupt the value.
