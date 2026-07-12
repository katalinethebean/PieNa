# 段位榜 (Platform Leaderboard) — Design Spec

Date: 2026-07-03

## Summary

Add a new "段位榜" navbar tab showing five platform-wide, points-based rankings: 一辩榜, 二辩榜, 三辩榜, 四辩榜, 全能榜 (top 50 each). Points come from match participation, wins, and being marked 佳辩 (best debater) for a match. This requires: a schema change to record 佳辩 per debater slot, a UI change to let users mark 佳辩 when logging a match, and a server-side aggregation function to compute rankings across the whole platform.

## Background / current state

- `sessions` table (one row per recorded match, owned by `user_id`, RLS-restricted to the owner) has a `debaters text[]` column with exactly 4 slots. Each slot holds either `@username  Name（我）` / `@username  Name  (team)` for a registered user selected via autocomplete, or a freehand name if the person isn't registered.
- `RecordMatch.jsx` (manual entry) already presents these 4 slots as 一辩/二辩/三辩/四辩 for "our team."
- `Upload.jsx` (AI-analysis entry) currently presents a *different*, mismatched layout — a 2×2 grid labeled 正方一辩/二辩 and 反方一辩/二辩 — which does not match RecordMatch's meaning of the 4 slots. This is a bug relative to intent and will be fixed as part of this work: Upload.jsx will use the same "我方辩手：一辩/二辩/三辩/四辩" single-column layout as RecordMatch.jsx.
- There is no 佳辩/MVP concept, no points/score-for-ranking concept, and no leaderboard anywhere in the codebase today.
- Navbar (`client/src/components/Navbar.jsx`) has exactly two tabs: 发现 (`/discover`) and 关系网 (`/network`).

## Decisions (confirmed with user)

1. The 佳辩 star toggle is added to **both** RecordMatch.jsx and Upload.jsx debater sections (Upload.jsx's debater section is first corrected to match RecordMatch's 一辩/二辩/三辩/四辩 layout).
2. Because both forms will use the same 4-slot (一辩/二辩/三辩/四辩) shape after the fix, 三辩榜/四辩榜 are populated from both forms — no separate data-source restriction needed.
3. Points are only ever awarded to slots that resolve to a **registered user** (i.e. the slot text starts with `@username` and that username matches an existing profile). Freehand/unregistered names remain stored on the session record (unchanged) but never earn points or appear on any leaderboard.
4. 全能榜 ranks users by the **sum of their points across all 4 positions**.
5. Private (`is_public = false`) accounts still appear on the leaderboard (name, avatar, points, rank). Clicking through to their profile still applies the existing privacy rules in `get_profile_view` — the leaderboard itself does not leak any additional profile detail beyond name/avatar/points/rank, which are already exposed in `get_friend_network` today for friends and are not more sensitive than that.

## Data model changes

Add one column to `sessions`, migrated the same way other columns were added (idempotent `do $$ ... end $$` block in `server/setup.sql`):

```sql
alter table sessions add column if not exists mvp_flags boolean[] default '{}';
```

`mvp_flags` is a parallel array to `debaters`: `mvp_flags[i] = true` means the debater in `debaters[i]` was voted 佳辩 for that match. Multiple `true` entries are allowed (multi-select). Missing/short arrays are treated as `false` for any un-indexed slot (defensive handling in the aggregation function, since older rows won't have this column populated per-slot).

No new column is added for "points" — points are always computed on read (see below), so there is no denormalized value to keep in sync.

## Points calculation & leaderboard aggregation

New Postgres function, `get_leaderboards()`, `security definer` (same RLS-bypass pattern already used by `get_friend_network()` and `get_profile_view()`), added to `server/setup.sql`:

- Iterates every row in `sessions`, and within each row, every slot `i` in `0..3` (position = `i+1`, i.e. 1=一辩 … 4=四辩).
- For slot `i`: extract the leading `@(\S+)` token from `debaters[i]`. If it doesn't match that pattern, or no `profiles.username` matches it, skip (no points, not attributable to an account).
- Otherwise, award to `(profile_id, position)`:
  - `+100` for participating (row exists with this debater in this slot)
  - `+100` more if `sessions.won = true`
  - `+100` more if `mvp_flags[i] = true`
- Aggregate `sum(points)` grouped by `(profile_id, position)` for the four positional boards; 全能 is `sum(points)` grouped by `profile_id` across all positions.
- For each of the 5 boards, order by points desc (ties broken by `profile_id` for determinism), limit 50.
- Return shape: JSON object keyed by board (`"1"`,`"2"`,`"3"`,`"4"`,`"overall"`), each an array of `{ id, username, name, avatar_url, is_public, points }`.

`grant execute on function get_leaderboards() to authenticated;` — called directly from the client via `supabase.rpc('get_leaderboards')`, matching the existing pattern for `get_friend_network`.

## Frontend changes

### `Navbar.jsx`
Add a third entry to the `NAV` array: `{ to: '/leaderboard', label: '段位榜', icon: <...trophy/rank svg...> }`, positioned after 关系网.

### `App.jsx`
Add route: `/leaderboard` → new `Leaderboard.jsx` page.

### `Leaderboard.jsx` (new page)
- Segmented control with 5 options: 一辩榜 / 二辩榜 / 三辩榜 / 四辩榜 / 全能榜, styling consistent with existing `SideToggle`-style toggles used elsewhere.
- On mount (and on tab switch, cached client-side after first load), call `supabase.rpc('get_leaderboards')` once and hold all 5 boards in state; switching tabs just changes which array is rendered (no refetch per tab).
- Each board renders a ranked list (rank #, avatar circle or initial fallback, name, `@username`, points), capped at the 50 entries the RPC already returns.
- Clicking a row navigates to `/profile/:id`.
- Empty state ("暂无排名数据") if a board's array is empty.

### `RecordMatch.jsx`
- In the existing 我方辩手 block (the `['一辩','二辩','三辩','四辩'].map(...)` loop), add a star-shaped toggle button next to each `DebaterSearch` input.
- New form field `mvpFlags: [false, false, false, false]`, toggled independently per slot (multi-select, no cap).
- Star is disabled/hidden if that slot's debater field is empty (can't mark an empty slot as 佳辩).
- Include `mvp_flags: form.mvpFlags` in the insert payload.
- Reset `mvpFlags` alongside the rest of the form on "再记录一场."

### `Upload.jsx`
- **Fix**: replace the current 2×2 (`正方一辩/二辩`, `反方一辩/二辩`) debater grid with the same single-column 我方辩手：一辩/二辩/三辩/四辩 layout as `RecordMatch.jsx` (same labels, same order, same `DebaterSearch` usage).
- Add the same star-toggle UI and `mvpFlags` state/behavior as RecordMatch.jsx.
- Include `mvp_flags: form.mvpFlags` in the insert payload alongside the existing prototype-analysis fields.

## Out of scope

- No changes to how `won`/`score` is derived (unchanged).
- No retroactive backfill of `mvp_flags` for existing session rows (they simply default to `'{}'`, contributing 0 bonus 佳辩 points, but still counting participation/win points for any `@username`-tagged slots).
- No changes to the `role`/`format` selectors in Upload.jsx (unrelated to the debaters grid).
- No points/leaderboard caching or scheduled recomputation — `get_leaderboards()` computes fresh on every call. If this becomes a performance concern at scale, that's a future optimization, not part of this change.

## Testing plan

- Manual: record a match via both RecordMatch and Upload with a mix of `@registered` and freehand names, mark some 佳辩, verify points appear correctly for registered users only via the new leaderboard page.
- Manual: verify a private account's entry appears on the leaderboard but clicking through still respects existing profile privacy limits.
- Manual: verify star toggle is multi-select and clears/disables correctly when a debater slot is cleared.
