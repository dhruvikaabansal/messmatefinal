# MessMate 🍽️

Find someone from your own college to share your next meal with — 1-on-1, or at an open group table.

A match lasts exactly one meal slot. Nothing carries over: when the slot's cut-off passes, everything dissolves and everyone is back in the deck for the next meal.

```
mmbackend/    Express + MongoDB API
mmfrontend/   React + Vite single-page app
```

---

## Running locally

**Backend**

```bash
cd mmbackend
cp .env.example .env      # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev               # http://localhost:5000
```

**Frontend**

```bash
cd mmfrontend
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev               # http://localhost:5173
```

**Tests**

```bash
cd mmbackend
npm run test:unit         # pure logic — slot maths, ranking engine. Fast, no DB.
npm test                  # full API journey against an in-memory MongoDB.
                          # Set MONGO_URI to run it against a scratch database instead.
                          # Five assertions cover concurrent likes and last-seat
                          # races; they are skipped automatically on backends
                          # that don't serialise single-document writes.
```

**Looking at the UI without a database**

```bash
cd mmfrontend
NODE_PATH=../mmbackend/node_modules node mock-server.cjs   # fake API on :5055
VITE_API_URL=http://localhost:5055/api npm run dev
```

---

## Deploying

The frontend is a static build; the backend is a normal long-running Node process (it runs a cleanup job on a timer, so it must not be deployed as serverless functions).

**Backend** — Render, Railway, Fly, or any Node host:

- Build: `npm install`
- Start: `npm start`
- Environment: everything in `mmbackend/.env.example`
- Health check: `GET /api/health`

**Frontend** — Vercel or Netlify:

- Root directory: `mmfrontend`
- Build: `npm run build`, output `dist`
- Environment: `VITE_API_URL=https://your-backend-host/api`
- `vercel.json` already handles SPA routing and cache headers.

After the frontend is live, set `FRONTEND_URL` on the backend to its origin. Vercel preview deployments (`*.vercel.app`) are allowed by CORS automatically.

**Photos.** Set the three `CLOUDINARY_*` variables. Without them the API falls back to writing files into `mmbackend/uploads/`, which almost every host wipes on redeploy — that is why existing profile photos vanish. With Cloudinary configured, uploads are stored off-box, cropped to a square with face-aware gravity, and served from a CDN.

---

## How it works

### Slots

A **slot** is one `(date, meal)` pair, written `2026-04-07_lunch`. Meals close at fixed IST hours:

| Meal | Closes |
|---|---|
| Breakfast | 10:00 |
| Lunch | 15:00 |
| Snacks | 18:00 |
| Dinner | 22:00 |

All slot maths lives in `mmbackend/utils/slotUtils.js` and is computed in Asia/Kolkata regardless of where the server runs.

### State

`UserSlotState` holds exactly one row per `(user, slot)` and is the only thing that decides what a user can do:

| State | Meaning |
|---|---|
| `idle` | browsing |
| `liked` | has sent invites, still browsing |
| `matched` | locked into a 1-on-1 meal |
| `in_community` | seated at a group table |

Every action re-reads state and refuses anything the state doesn't allow. Both `matched` and `in_community` are claimed with conditional writes, so two people acting in the same millisecond can't produce two matches, a half-match, or a fifth person at a four-seat table.

### One endpoint per screen

`GET /api/slot/status` returns everything any screen needs — state, the ranked feed, incoming invites, the active match or table, unread count, and the slot picker. The client renders from that one response, so no two screens can disagree about what's happening.

### The matching engine

`mmbackend/utils/matching.js`. Every signal is normalised to 0–1, then weighted:

| Signal | Weight | Notes |
|---|---|---|
| Interests | 0.30 | rarity-weighted — sharing "kathak" counts for far more than sharing "music" |
| Intent | 0.16 | someone here to network and someone here to date both have a bad lunch |
| Food | 0.10 | you're sharing a table |
| Age | 0.10 | gaussian falloff, never an exclusion |
| Personality | 0.08 | introvert + extrovert works; two deep introverts is a long forty minutes |
| Clubs | 0.08 | |
| Recently active | 0.08 | someone who opened the app five minutes ago will actually show up |

On top of the weighted score:

- **Reciprocity bonus** — someone who already invited you goes to the top, because liking back is an instant match.
- **Popularity damping** — profiles already drowning in invites are pushed down so attention spreads across the campus instead of piling onto three people.
- **Deterministic jitter** seeded on `(viewer, candidate, slot)` breaks ties, so the deck is stable when you refresh but different for each person.

Hard filters are deliberately few: same college, and **two-way** gender compatibility — a profile only appears if *both* people's filters are satisfied, so an invite is never structurally doomed. If that leaves too few people, the viewer's own filter is relaxed and the UI says so rather than showing an empty screen.

Every card carries plain-language reasons ("Both into filter coffee & anime", "Last seat left"), which is what turns a swipe deck into a recommendation.

### Expiry

`utils/cleanup.js` runs every five minutes: matches for closed slots are marked expired, tables are dissolved, unresolved invites are deleted, chat threads go with them, and everybody's state resets to `idle`. It works whether or not anyone has the app open.

---

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` | create a session |
| GET | `/api/auth/me` | who am I, and is my profile usable |
| GET | `/api/slot/status` | **everything for the current slot** |
| POST | `/api/slot/switch` | change meal/date in one call |
| GET/PUT | `/api/preferences` | matching preferences |
| GET/PUT | `/api/user/profile` | profile |
| POST | `/api/upload` | profile photo |
| POST | `/api/match/like` · `/skip` · `/undo` | deck actions |
| POST | `/api/match/ignore` · `/unmatch` · `/complete` | manage invites and matches |
| GET | `/api/match/list` · `/likes-received` | lists |
| GET | `/api/community` · `/:id` | browse tables |
| POST | `/api/community/create` · `/join` · `/leave` · `/dissolve` | manage tables |
| GET/POST | `/api/chat/:threadType/:threadId` | messages (`match` or `community`) |
| GET | `/api/chat/unread` | badge counts |
| GET | `/api/health` | uptime check |

---

## What changed in this rebuild

**Correctness**

- IST time was computed by adding the server's timezone offset on top of an already-absolute UTC epoch. On any non-UTC host every cut-off was wrong; the cleanup job additionally used UTC dates, so between midnight and 5:30 am it examined the wrong day.
- `unmatch`, `complete` and `ignore` never checked ownership — any signed-in user could dissolve any match or dismiss any invite by id. All three now verify the caller is a participant.
- Mutual likes created the match, then updated both users' state in two unguarded writes. Simultaneous likes could create duplicate matches or leave one side unmatched. Both sides are now claimed conditionally, with rollback.
- Nothing stopped two people taking the same last seat at a table. Capacity is now checked inside the write.
- `Preference` had no uniqueness constraint, so duplicate rows made settings appear to revert.
- Password hashes were selectable by default; they're now `select: false`.
- `chatController` imported a `Message` model that did not exist — the chat feature the UI advertised had never been built.

**The algorithm**

- What was called `cosineSimilarity` was Jaccard overlap on interests, blended with an age term. That was the entire ranking function, and `.filter(score > 0)` silently dropped people.
- Gender filtering was one-way, so you could see and invite people whose own filter excluded you. Those invites could never resolve.
- Registration created preferences with `groupSize: 3`, and `groupSize >= 3` completely disabled 1-on-1 matching — every new account's Discover page was locked before they ever opened it.
- Ranking now uses seven signals, spreads attention instead of concentrating it, guarantees a non-empty deck when anyone is available, and explains itself on every card.

**Flow and interface**

- Solo and group were separate modes behind a settings page, with dead-end lock screens between them. They're now one feed; the preference is a soft filter.
- Changing your meal took three page loads. It's now a sheet on the same screen.
- Profile completeness was re-derived in four files with four different rules, which is why people got bounced back to the profile page after filling it in. The server defines it once.
- `alert()` and `confirm()` are gone, replaced with toasts and a styled dialog.
- Avatars were fetched from a third-party service on every card; they're now drawn locally as inline SVG, so they never break and never leak who's on your screen.
- Added: chat for matches and tables, an inbox with unread badges, undo for accidental passes, skeleton loading, dark mode, and a design system in one stylesheet.
