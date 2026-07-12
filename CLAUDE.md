# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"撇捺“ (Pie Na) — a Chinese competitive-debate practice and social platform. Users upload recordings of debate rounds, get AI transcription + scoring, track match history, and interact socially (friends, messaging, leaderboards, recruiting). UI copy, DB comments, and commit messages are primarily in Chinese.

Two-package monorepo, no shared root package.json:
- `client/` — React 19 + Vite 8 + Tailwind v4 SPA
- `server/` — Express API, talks to Supabase (Postgres + Auth + Storage) and external AI APIs

## Commands

Run from within each package directory (`client/` or `server/`) — there is no root-level script runner.

```
# client
npm run dev       # vite dev server, default port 5173 (proxies /api -> localhost:3001)
npm run build     # vite build
npm run lint      # oxlint
npm run preview

# server
npm start         # node index.js
npm run dev       # node --watch index.js, default port 3001 (PORT env var)
```

There is no test suite in either package currently.

The `.claude/launch.json` runs `npm run dev -- --port 5183 --strictPort` for the client — this is the port future sessions should expect the dev server on when using the Claude Code launch integration, rather than the vite default 5173.

Database schema/migrations live in `server/setup.sql`, applied manually by pasting into the Supabase SQL Editor (no migration tool). It's written idempotently (`create table if not exists`, `do $$ ... if not exists ... alter table$$` blocks) so it's safe to re-run in full after adding a new migration block at the end.

## Architecture

**Auth & authorization boundary.** Supabase Auth issues a JWT to the client (`client/src/lib/supabase.js`, anon key). The client sends it as `Authorization: Bearer <token>` to the Express server. `server/middleware/auth.js` validates the token against Supabase and attaches `req.user`. All route handlers then use a `SUPABASE_SERVICE_ROLE_KEY` admin client to hit Postgres directly, manually scoping queries to `req.user.id` — RLS policies in `setup.sql` are a second line of defense for direct client->Supabase reads (e.g. `Profile.jsx` reads via RPC), not the only one.

**Two data-access paths coexist**: some pages call the Express API (`/api/...`, see `server/routes/*.js`), others call Supabase directly from the client (`supabase.from(...)` or `.rpc(...)`) using RLS + SECURITY DEFINER functions defined in `setup.sql` (e.g. `get_profile_view`, `get_friend_network`, `get_leaderboards`, `get_people_suggestions`, `accept_match_invite`, `get_email_by_username`). When changing profile/social/leaderboard behavior, check `setup.sql` for a SECURITY DEFINER function first — a lot of business logic (privacy rules, scoring, ranking) lives in Postgres functions, not JS.

**Mock mode.** If `OPENROUTER_API_KEY` is unset, `server/routes/review.js` returns a canned analysis result (`MOCK_RESULT`) instead of calling OpenRouter. `GET /api/health` reports `mockMode`. Useful for local dev without burning API credits.

**AI usage**: the only AI provider is OpenRouter, used by `server/routes/review.js` (`MODELS` array, primary DeepSeek v3.2 with free-tier fallbacks) with speaker-isolation regex logic (`CHAIR_TRANSITION_RE`, `FREE_DEBATE_RE`, `makeSpeakerPrefixRE`) to parse multi-speaker transcripts by role/side. (An older Whisper+Claude upload pipeline was removed in July 2026; the only remaining Express routes are `/api/profile` and `/api/review`.)

Note the scoring rubric changed over time: `sessions` table has both an older, now-unused 6-column set (`argument_score`, `delivery_score`, `rebuttal_score`, `structure_score`, `evidence_score`, `fluency_score`, written by the removed upload pipeline) and the current rubric (`logic_score`, `argumentation_score`, `teamwork_score`, used by review.js / accept_match_invite). Existing rows may only have the old columns populated — check which rubric a session has when reading scores.

**Client state layering** (`client/src/contexts/`): `AuthContext` (Supabase session/user) wraps `UserContext` (own profile/sessions/credits, reset on logout), plus `FriendContext``and `MatchInviteContext` and `ChatContext` for social features. `isConfigured` in `lib/supabase.js` gates whether auth is enforced at all — routes render unauthenticated if Supabase env vars are absent, useful for UI-only work.

**Routing** (`client/src/App.jsx`): all routes are private except `/login`; canonical paths are `/discover`, `/network`, `/leaderboard`, `/chat(/:id)`, `/me`, `/profile/:id`, `/report/:id`, `/review`, `/upload`, `/record` — several older paths (`/search`, `/dashboard`, `/profile`, `/explore`) are kept as redirect-only routes for back-compat, don't resurrect logic there.

**Social/privacy model**: `profiles.is_public` plus `friend_requests` (status: pending/accepted/declined) drives visibility everywhere — profile fields, session history, messaging eligibility, recruit post visibility. `get_profile_view(p_id)` is the canonical "view someone else's profile respecting privacy" entry point (full data for self/friends/public, name+team+bio+avatar only for private strangers). Messaging additionally allows public accounts to receive DMs from anyone (see `messages` RLS in setup.sql); the `revoke update / grant update (read_at)` trick after the messages table prevents a receiver from rewriting message content when marking read.

**段位榜 (leaderboard)** scoring: `get_leaderboards()` computes points per debate position (一/二/三/四辩) plus an overall board, purely from `sessions.debaters` (parsed via `@username` regex against `profiles.username`) and `sessions.mvp_flags` — it does not use the upload.js scoring rubric at all. Only sessions with an `@username`-tagged debater in that slot count.

## In-flight work

`.superpowers/sdd/progress.md` and `docs/superpowers/` track a spec-driven-development workflow (plans + specs + task briefs/reports + branch diffs) used for recent features (leaderboard, friend chat). Check `docs/superpowers/specs/` for the latest design docs before extending friend-chat or leaderboard features — `2026-07-04-friend-chat-design.md` describes work that may still be in progress (`Chat.jsx`, `ChatContext.jsx`, `MatchInviteContext.jsx`, `server/routes/review.js` are currently untracked/uncommitted in git).
