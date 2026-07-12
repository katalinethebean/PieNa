# Debug task list

Grouped by subsystem so each cluster can be fixed in one pass without re-reading the whole repo. File:line refs are current as of this write-up — re-check if the file has changed since.

## Cluster A — Match invite copies AI analysis it shouldn't (#1, #2)

`accept_match_invite(p_invite_id)` in `server/setup.sql` (search for that function name) copies the sender's full row — including `logic_score`, `rebuttal_score`, `argumentation_score`, `delivery_score`, `teamwork_score`, `evidence_score`, `avg_score`, `feedback`, `transcript` — into the receiver's `sessions` table. That's why B sees "wrong" analysis: it's A's per-speech AI scoring, copied verbatim onto B's record.

Fix direction: change the `insert into sessions (...)` in that function to leave all score/feedback/transcript/justification columns null for the receiver's copy, so it lands as a plain non-AI match (same as a manually-recorded one).

How "non-AI" is already detected client-side: `client/src/pages/Report.jsx` line ~122, `const hasAnalysis = Number.isFinite(s.avg_score);` — a null `avg_score` already renders the no-analysis layout. So #1 mostly needs the SQL fn fixed; no new client flag needed.

For #2 (add "upload recording → AI analysis" to a non-AI record): `Report.jsx`'s `!hasAnalysis` branch (right after the `hasAnalysis ? (...) : ( ... )` block, further down in the file) is where the button should go. It should reuse the existing upload+analyze flow already built in `client/src/pages/Upload.jsx` (posts to `/api/upload`, server/routes/upload.js), but needs to target an *existing* session id instead of creating a new one — `server/routes/upload.js` currently always does a fresh `insert` into `sessions`; needs a variant (or a param) that does an `update ... where id = :sessionId` instead when called from an existing non-AI match.

## Cluster B — Friend match stats (#3)

`get_friend_network()` in `server/setup.sql` currently returns `shared_sessions` per friend but not their own 场次 (match count) or 胜率 (win rate). Extend the jsonb_build_object in that function with something like total match count and `count(won=true)/count(*)` for each friend (join `sessions` on `p.id = s.user_id`), then surface the two new fields in `client/src/pages/Network.jsx` (currently reads `p.shared_sessions` around line 129-130 — add the two new fields alongside).

## Cluster C — Recruit post archive/delete doesn't update public list instantly (#4)

`client/src/pages/Discover.jsx` has two separate components with independent state that don't talk to each other:
- `MyRecruits` (~line 298): `toggleArchive`/`deletePost` (~lines 316-328) already update its own local `posts` state instantly.
- `TeammatesTab` (~line 642): the public-facing list, fetches via `loadPosts` (~line 654) filtered on `archived = false`, re-runs only when its `refreshKey` prop changes.

Both are rendered from a parent with `recruitRefreshKey` state (see lines ~785 and ~820 where each is instantiated with `refreshKey={recruitRefreshKey}`). `MyRecruits`'s archive/delete handlers never bump `recruitRefreshKey`, so `TeammatesTab` only refreshes on next full navigation.

Fix: pass a callback down to `MyRecruits` (e.g. `onChange`) that increments `recruitRefreshKey` in the parent whenever `toggleArchive`/`deletePost` runs — or simpler, since `TeammatesTab` already just filters on `archived`/existence, do an optimistic local removal in `TeammatesTab` too via a shared post-removed callback instead of a full refetch.

## Cluster D — Radar chart (#5, #9)

Two radar implementations exist — confirm which is actually live before editing:
- `client/src/components/RadarChart.jsx` — chart.js version, **old 6-key rubric** (argument/delivery/rebuttal/structure/evidence/fluency). A repo-wide grep found no imports of this file — likely dead code. Verify before touching it.
- `client/src/pages/Report.jsx` (~line 119 `radarData`, ~lines 246-253 `<RadarChart>`/`<PolarRadiusAxis>`) — recharts version, **new rubric** (logic/rebuttal/argumentation/delivery/teamwork/evidence), this is what actually renders on the match report page. `PolarRadiusAxis` currently has `domain={[0, 10]}` and `tick={false}` with no explicit `tickCount` — this is the one to check for #9's uneven grid spacing (recharts auto-generates "nice" ticks by default; may need explicit `ticks={[0,2,4,6,8,10]}`).

For #5 (ignore 0-score dimensions in the average, don't treat as a real 0): the *per-session average* is computed in two places depending on flow —
- `server/routes/upload.js` line ~104: `(scores.argument + ... ) / 6` (old rubric, upload flow) — needs the fix so any dimension equal to 0 is excluded from both sum and divisor.
- The *profile-level* average across all sessions is separate: `client/src/contexts/UserContext.jsx` line ~90, `analyzedSessions.reduce((sum, s) => sum + s.avg_score, 0) / analyzedSessions.length` and `server/routes/upload.js` line ~168 `newAvg` — these average `avg_score` per session, not per-dimension, so probably out of scope for #5 unless the request also means "don't count a session with all-zero scores."
- Could not find where the *new*-rubric (`logic_score` etc.) per-session `avg_score` gets computed/written client- or server-side — grepped `review.js`, `Review.jsx`, `RecordMatch.jsx` with no hits (RecordMatch just sets `avg_score: null` for manual entries). Locate this before assuming upload.js is the only place to fix.

## Cluster E — Notifications (#6, #7)

Both in `client/src/components/Navbar.jsx`:
- #6: line ~297, `<span ...>👍</span>` → swap for a heart icon (there's already an SVG heart icon pattern used elsewhere in the file for consistency, e.g. the 佳辩 star SVG in Report.jsx as a style reference).
- #7: the notification bell currently only marks `type = 'recruit_like'` as read (line ~75) when opened, and fetches `.eq('read', false).limit(20)` (lines ~58-64) — meaning read notifications just disappear from view since the query excludes them. Need: (a) mark-all-as-read-on-open should apply to all notification types opened, not just `recruit_like` — confirm this is intentional scope-limiting or a bug; (b) don't delete/hard-exclude on read — instead drop the `.eq('read', false)` filter and instead order by `created_at desc` with `.limit(10)` so the most recent 10 stay visible (read or not), and only actually delete rows older than the most recent 10 if you want DB cleanup (not strictly required by the ask).

## Cluster F — Login/username (#8, #11, #12)

All in `client/src/pages/Login.jsx` plus `get_email_by_username` in `server/setup.sql`:
- #8 (username login still failing): login-by-username path is lines ~40-45, calls `.rpc('get_email_by_username', { p_username: form.loginUsername.toLowerCase() })`, then presumably does a follow-up `signInWithPassword` using the returned email — read the rest of that function (lines 45-60ish) to see how the returned email is used and where it could be failing (e.g. RPC returning null because `get_email_by_username` in setup.sql does `where email = lower(p_username)` matching wrong column, or the migration adding this RPC was never re-run in Supabase — check `.superpowers`/git history, this RPC was touched in commit `f3f0639 fix: use RPC function for username login to bypass RLS`, so this may be a re-run-migration issue rather than a code bug — confirm setup.sql has been pasted into Supabase SQL editor since last schema change, per CLAUDE.md's note that migrations are manual).
- #11 (add a settings UI to change username): no existing settings screen was located for this in the explored files — check `client/src/pages/Profile.jsx` for the existing self-profile edit form (used for name/school/bio etc.) and add a username field there, reusing the same validation regex used at signup (`Login.jsx` line ~66, `/^[a-zA-Z0-9_]+$/`) plus the same duplicate-check pattern at `Login.jsx` lines ~79-87 before the `update`.
- #12 (enforce username uniqueness, reject duplicate signups): `profiles.username` already has a DB-level `unique` constraint (`server/setup.sql`, `profiles` table def: `username text unique`). Client-side, `Login.jsx` lines ~79-87 does a pre-check (`select id from profiles where username = ...`) before calling `signUp`, and shows `'该用户名已被使用，请换一个'` on conflict. This looks like it should already work — reproduce the exact failure mode first (race condition between two simultaneous signups? case-sensitivity mismatch since `.toLowerCase()` is applied but is username stored/compared consistently everywhere, e.g. in the settings-change flow added for #11? or is the DB unique constraint actually present — confirm by re-running `setup.sql` since it's applied manually and this constraint could predate a table recreation). Don't assume it's broken until you've reproduced it.

## Cluster G — Copy change: 真实姓名/全名 → 昵称 (#10)

All known occurrences (repo-wide grep for `真实姓名|全名`):
- `client/src/components/OnboardingModal.jsx` line 150 (label `中文全名`), line 151 (placeholder `请输入你的真实姓名`)
- `client/src/pages/Login.jsx` line 64 (error message `请输入你的中文全名`), line 240 (label `中文全名`), line 241 (placeholder `请输入真实姓名`)

Re-grep after editing in case other pages have their own copies of this label (e.g. Profile edit form) that use different wording not caught by this exact string match — search for `姓名` broadly, not just `真实姓名|全名`, to be safe.
