# 段位榜 (Platform Leaderboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "段位榜" navbar tab with 5 platform-wide, points-based debater rankings (一辩榜/二辩榜/三辩榜/四辩榜/全能榜, top 50 each), fed by a new 佳辩 (best-debater) star toggle added to the match-recording forms.

**Architecture:** One new `sessions.mvp_flags boolean[]` column plus one `security definer` Postgres function (`get_leaderboards()`) that aggregates points across all sessions server-side (bypassing RLS, same pattern as the existing `get_friend_network()`), called directly from the client via `supabase.rpc`. Two existing forms (RecordMatch.jsx, Upload.jsx) get a star-toggle UI added to their debater-slot rows; Upload.jsx's debater grid is also corrected to match RecordMatch's 4-slot 一辩/二辩/三辩/四辩 layout (it currently has an unrelated, incorrect 2×2 BP-style layout). One new page (Leaderboard.jsx) renders the 5 boards.

**Tech Stack:** React 19 + react-router-dom v7, Supabase (Postgres + PostgREST + `supabase-js`), framer-motion for existing UI motion, no CSS framework beyond inline styles + a shared `.glass-card` class.

## Global Constraints

- Full design spec: `docs/superpowers/specs/2026-07-03-leaderboard-design.md` — read it before starting if anything below is ambiguous.
- **No automated test framework exists in this repo** (no Jest/Vitest/pytest — confirmed via `client/package.json` and `server/package.json`, and no `*.test.*`/`*.spec.*` files anywhere). Verification in this plan is **manual**, via the Supabase SQL Editor (for DB changes) and the Vite dev server + browser preview (for UI changes). This matches the project's existing convention (`server/setup.sql` itself says "请在 Supabase SQL Editor 中运行此文件").
- Points formula (exact, from spec): per debater slot per match — `+100` for participating, `+100` more if that match was won, `+100` more if that slot is marked 佳辩. Only slots resolving to a registered user (`@username` prefix matching an existing `profiles.username`) earn points; freehand names earn nothing and never appear on any board.
- `profiles.username` is always stored lowercase (`client/src/pages/Login.jsx:109`: `username: form.username.toLowerCase()`), so matching must `lower()` the extracted `@handle` before comparing.
- 全能榜 = sum of a user's points across all 4 positions.
- Private (`is_public = false`) accounts still appear on the leaderboard.
- Preview/dev server is already configured at `.claude/launch.json` (name `"撇捺"`, runs `npm run dev` in `client/`, port 5173) — use `preview_start` with that name for all UI verification steps.
- Existing color palette to reuse (do not invent new colors): background `#2C3025` (nav/dark), text `#E8E4DC` / `#2C3025`, accents `#a4b9b5` / `#7d9b96` (teal), `#c07a3a` (gold/amber, already used for notification badges — reuse this for the 佳辩 star), `#9a8570` / `#c8b89a` (muted tan, labels/borders), `#5a8f7a` (success green), `#a03030` (error red).

---

### Task 1: Database schema — `mvp_flags` column + `get_leaderboards()` RPC

**Files:**
- Modify: `server/setup.sql`

**Interfaces:**
- Produces: a new nullable `sessions.mvp_flags boolean[]` column (default `'{}'`), and a Postgres function `get_leaderboards() returns jsonb`, callable via `supabase.rpc('get_leaderboards')` from the client, granted to the `authenticated` role. Return shape: `{ "1": [...], "2": [...], "3": [...], "4": [...], "overall": [...] }`, each array holding up to 50 objects `{ id, username, name, avatar_url, is_public, points }` ordered by `points desc`.

- [ ] **Step 1: Add the `mvp_flags` migration block**

Open `server/setup.sql`. Find the existing sessions-migration block (currently lines 53–71, the `do $$ ... end $$` block that adds `side`, `won`, `score`, `tournament`, `debaters` if missing). Immediately after its closing `end $$;` (and before the `-- 1b. username → email lookup function` comment), insert:

```sql
-- Migration: add mvp_flags to sessions (parallel array to debaters; marks 佳辩/best-debater per slot)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='mvp_flags') then
    alter table sessions add column mvp_flags boolean[] default '{}';
  end if;
end $$;
```

- [ ] **Step 2: Add `mvp_flags` to the `create table if not exists sessions` definition**

In the same file, find `create table if not exists sessions (` (around line 84). Add `mvp_flags` right after the `debaters` column line so fresh installs (not just migrations) get the column too:

```sql
  debaters text[] default '{}',
  mvp_flags boolean[] default '{}',
```

- [ ] **Step 3: Add the `get_leaderboards()` function**

Find `grant execute on function get_friend_network() to authenticated;` (near the end of the file, just before `notify pgrst, 'reload schema';`). Insert the new function and grant immediately after that grant line, before the final `notify`:

```sql
-- 12. get_leaderboards: 全平台段位榜（一辩/二辩/三辩/四辩 + 全能），仅统计 @已注册用户
-- 每场比赛：出场 +100，胜利 +100，佳辩（mvp_flags[i]）+100；未关联到注册账号的手打姓名不计分
create or replace function get_leaderboards()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with slot_points as (
    select
      p.id as profile_id,
      gs.i as position,
      100
        + case when s.won then 100 else 0 end
        + case when coalesce(s.mvp_flags[gs.i], false) then 100 else 0 end
        as points
    from sessions s
    cross join generate_series(1, 4) as gs(i)
    join profiles p
      on p.username = lower(substring(s.debaters[gs.i] from '^@(\S+)'))
    where s.debaters[gs.i] ~ '^@\S+'
  ),
  by_position as (
    select profile_id, position, sum(points)::int as points
    from slot_points
    group by profile_id, position
  ),
  overall as (
    select profile_id, sum(points)::int as points
    from slot_points
    group by profile_id
  ),
  top_position as (
    select *, row_number() over (partition by position order by points desc, profile_id) as rn
    from by_position
  ),
  top_overall as (
    select *, row_number() over (order by points desc, profile_id) as rn
    from overall
  )
  select jsonb_build_object(
    '1', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'username', pr.username, 'name', pr.name,
        'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', tp.points
      ) order by tp.points desc, pr.id)
      from top_position tp join profiles pr on pr.id = tp.profile_id
      where tp.position = 1 and tp.rn <= 50
    ), '[]'::jsonb),
    '2', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'username', pr.username, 'name', pr.name,
        'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', tp.points
      ) order by tp.points desc, pr.id)
      from top_position tp join profiles pr on pr.id = tp.profile_id
      where tp.position = 2 and tp.rn <= 50
    ), '[]'::jsonb),
    '3', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'username', pr.username, 'name', pr.name,
        'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', tp.points
      ) order by tp.points desc, pr.id)
      from top_position tp join profiles pr on pr.id = tp.profile_id
      where tp.position = 3 and tp.rn <= 50
    ), '[]'::jsonb),
    '4', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'username', pr.username, 'name', pr.name,
        'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', tp.points
      ) order by tp.points desc, pr.id)
      from top_position tp join profiles pr on pr.id = tp.profile_id
      where tp.position = 4 and tp.rn <= 50
    ), '[]'::jsonb),
    'overall', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'username', pr.username, 'name', pr.name,
        'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', to_.points
      ) order by to_.points desc, pr.id)
      from top_overall to_ join profiles pr on pr.id = to_.profile_id
      where to_.rn <= 50
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function get_leaderboards() to authenticated;
```

- [ ] **Step 4: Manually run the migration in Supabase (human action, not scriptable from here)**

This project has no migration runner — every change to `server/setup.sql` is applied by pasting the file into the Supabase project's SQL Editor and running it (see the file's own header comment). This step must be done by whoever has access to the Supabase dashboard for this project:

1. Open the Supabase project's SQL Editor.
2. Paste the full updated `server/setup.sql` and run it.
3. Confirm no errors were returned.

- [ ] **Step 5: Verify the function manually in the SQL Editor**

Run:

```sql
select get_leaderboards();
```

Expected: a single JSON value with exactly the keys `"1"`, `"2"`, `"3"`, `"4"`, `"overall"`. If no session yet has an `@username`-tagged debater, all five arrays will be `[]` — that's correct, not a bug. If any existing sessions already have `@username` debaters and `won = true`, you should see those users' ids/points show up (100 or 200 depending on win).

- [ ] **Step 6: Commit**

```bash
git add server/setup.sql
git commit -m "$(cat <<'EOF'
feat: add mvp_flags column and get_leaderboards RPC for 段位榜

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: RecordMatch.jsx — 佳辩 star toggle

**Files:**
- Modify: `client/src/pages/RecordMatch.jsx`

**Interfaces:**
- Consumes: `get_leaderboards()` is not called here; this task only needs to write `mvp_flags` (a `boolean[4]`) onto rows inserted into `sessions` via `supabase.from('sessions').insert(...)`, matching the column added in Task 1.
- Produces: nothing consumed by later tasks — this task is self-contained (Task 3 duplicates the same small `MvpStar` component independently, matching this codebase's existing convention of duplicating `DebaterSearch`/`SideToggle` per-file rather than sharing them).

- [ ] **Step 1: Add the `MvpStar` component**

In `client/src/pages/RecordMatch.jsx`, immediately after the `SideToggle` component definition (ends at line 143, right before `export default function RecordMatch() {`), insert:

```jsx
function MvpStar({ active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="佳辩"
      style={{
        flexShrink: 0, width: '36px', height: '36px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(192,122,58,0.12)' : 'transparent',
        border: `1px solid ${active ? 'rgba(192,122,58,0.5)' : 'rgba(200,184,154,0.5)'}`,
        borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1, transition: 'all 0.15s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#c07a3a' : 'none'} stroke={active ? '#c07a3a' : '#9a8570'} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8-5.1-4.7 6.9-.8z"/>
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Add `mvpFlags` to form state**

Replace:

```jsx
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tournament: '',
    motion: '',
    side: '正方',
    proScore: '',
    conScore: '',
    debaters: ['', '', '', ''],
  });
```

with:

```jsx
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tournament: '',
    motion: '',
    side: '正方',
    proScore: '',
    conScore: '',
    debaters: ['', '', '', ''],
    mvpFlags: [false, false, false, false],
  });
```

- [ ] **Step 3: Update `setDebater` to clear the star when a slot is cleared, and add `toggleMvp`**

Replace:

```jsx
  const setDebater = (i, v) => {
    const d = [...form.debaters]; d[i] = v; setForm(f => ({ ...f, debaters: d }));
  };
```

with:

```jsx
  const setDebater = (i, v) => {
    setForm(f => {
      const d = [...f.debaters]; d[i] = v;
      const mvpFlags = [...f.mvpFlags];
      if (!v) mvpFlags[i] = false;
      return { ...f, debaters: d, mvpFlags };
    });
  };

  const toggleMvp = (i) => {
    setForm(f => {
      const mvpFlags = [...f.mvpFlags]; mvpFlags[i] = !mvpFlags[i];
      return { ...f, mvpFlags };
    });
  };
```

- [ ] **Step 4: Include `mvp_flags` in the insert payload**

Replace:

```jsx
    const payload = {
      motion: form.motion,
      date: new Date(form.date).toISOString(),
      side: form.side,
      role: form.side === '正方' ? '正方' : '反方',
      won: won,
      score: hasScores ? `${form.proScore}-${form.conScore}` : null,
      tournament: form.tournament,
      debaters: form.debaters,
      avg_score: null,
```

with:

```jsx
    const payload = {
      motion: form.motion,
      date: new Date(form.date).toISOString(),
      side: form.side,
      role: form.side === '正方' ? '正方' : '反方',
      won: won,
      score: hasScores ? `${form.proScore}-${form.conScore}` : null,
      tournament: form.tournament,
      debaters: form.debaters,
      mvp_flags: form.mvpFlags,
      avg_score: null,
```

- [ ] **Step 5: Reset `mvpFlags` on "再记录一场"**

Replace:

```jsx
              onClick={() => { setSubmitted(false); setForm({ date: new Date().toISOString().slice(0, 10), tournament: '', motion: '', side: '正方', proScore: '', conScore: '', debaters: ['', '', '', ''] }); }}
```

with:

```jsx
              onClick={() => { setSubmitted(false); setForm({ date: new Date().toISOString().slice(0, 10), tournament: '', motion: '', side: '正方', proScore: '', conScore: '', debaters: ['', '', '', ''], mvpFlags: [false, false, false, false] }); }}
```

- [ ] **Step 6: Add the star button next to each debater slot**

Replace:

```jsx
            {/* Debaters — my team's 4 */}
            <div>
              <label style={labelStyle}>我方辩手（可输入姓名或 @ 搜索已注册用户）</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['一辩', '二辩', '三辩', '四辩'].map((pos, i) => (
                  <div key={i}>
                    <label style={{ ...labelStyle, fontSize: '9px', color: '#9a8570', marginBottom: '3px' }}>{pos}</label>
                    <DebaterSearch
                      value={form.debaters[i]}
                      onChange={v => setDebater(i, v)}
                      placeholder={pos}
                      selfUser={selfUser}
                    />
                  </div>
                ))}
              </div>
            </div>
```

with:

```jsx
            {/* Debaters — my team's 4 */}
            <div>
              <label style={labelStyle}>我方辩手（可输入姓名或 @ 搜索已注册用户，星标可多选标记本场佳辩）</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['一辩', '二辩', '三辩', '四辩'].map((pos, i) => (
                  <div key={i}>
                    <label style={{ ...labelStyle, fontSize: '9px', color: '#9a8570', marginBottom: '3px' }}>{pos}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <DebaterSearch
                          value={form.debaters[i]}
                          onChange={v => setDebater(i, v)}
                          placeholder={pos}
                          selfUser={selfUser}
                        />
                      </div>
                      <MvpStar
                        active={form.mvpFlags[i]}
                        disabled={!form.debaters[i]}
                        onClick={() => toggleMvp(i)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
```

- [ ] **Step 7: Manually verify in the browser**

1. Start the dev server via `preview_start` with name `"撇捺"`.
2. Navigate to `/record`.
3. Fill in the motion field (required), then in one of the 4 debater rows type a name — confirm the star button to its right goes from disabled/faded to clickable.
4. Click the star — confirm it fills gold (`#c07a3a`) and stays toggled. Click again — confirm it un-toggles.
5. Toggle stars on two different rows at once — confirm both stay active independently (multi-select works).
6. Clear the text in a starred row back to empty — confirm its star automatically resets to inactive and becomes disabled again.
7. Submit the form — check the network request (via `preview_network`) for the `sessions` insert POST and confirm the request body includes `mvp_flags` as a boolean array matching what was toggled (e.g. `[true, false, false, false]`).

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/RecordMatch.jsx
git commit -m "$(cat <<'EOF'
feat: add 佳辩 star toggle to RecordMatch debater slots

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Upload.jsx — fix debater layout to match RecordMatch + add 佳辩 star toggle

**Files:**
- Modify: `client/src/pages/Upload.jsx`

**Interfaces:**
- Consumes: none from other tasks.
- Produces: nothing consumed by later tasks (self-contained, same reasoning as Task 2).

- [ ] **Step 1: Add the `MvpStar` component**

In `client/src/pages/Upload.jsx`, immediately after the `SideToggle` component definition (ends at line 168, right before `export default function Upload() {`), insert the identical component used in Task 2:

```jsx
function MvpStar({ active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="佳辩"
      style={{
        flexShrink: 0, width: '36px', height: '36px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(192,122,58,0.12)' : 'transparent',
        border: `1px solid ${active ? 'rgba(192,122,58,0.5)' : 'rgba(200,184,154,0.5)'}`,
        borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1, transition: 'all 0.15s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#c07a3a' : 'none'} stroke={active ? '#c07a3a' : '#9a8570'} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8-5.1-4.7 6.9-.8z"/>
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Add `mvpFlags` to form state**

Replace:

```jsx
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tournament: '',
    motionText: '',
    side: '正方',
    proScore: '',
    conScore: '',
    debaters: ['', '', '', ''],
  });
```

with:

```jsx
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tournament: '',
    motionText: '',
    side: '正方',
    proScore: '',
    conScore: '',
    debaters: ['', '', '', ''],
    mvpFlags: [false, false, false, false],
  });
```

- [ ] **Step 3: Update `setDebater` to clear the star when a slot is cleared, and add `toggleMvp`**

Replace:

```jsx
  const setDebater = (i, v) => {
    const d = [...form.debaters]; d[i] = v; setForm(f => ({ ...f, debaters: d }));
  };
```

with:

```jsx
  const setDebater = (i, v) => {
    setForm(f => {
      const d = [...f.debaters]; d[i] = v;
      const mvpFlags = [...f.mvpFlags];
      if (!v) mvpFlags[i] = false;
      return { ...f, debaters: d, mvpFlags };
    });
  };

  const toggleMvp = (i) => {
    setForm(f => {
      const mvpFlags = [...f.mvpFlags]; mvpFlags[i] = !mvpFlags[i];
      return { ...f, mvpFlags };
    });
  };
```

- [ ] **Step 4: Include `mvp_flags` in the insert payload**

Replace:

```jsx
          const payload = {
            motion: form.motionText.trim() || '未填写辩题',
            date: new Date(form.date).toISOString(),
            format,
            role,
            side: form.side,
            won,
            score: hasScores ? `${form.proScore}-${form.conScore}` : null,
            tournament: form.tournament,
            debaters: form.debaters,
            avg_score: Math.round(avg * 10) / 10,
```

with:

```jsx
          const payload = {
            motion: form.motionText.trim() || '未填写辩题',
            date: new Date(form.date).toISOString(),
            format,
            role,
            side: form.side,
            won,
            score: hasScores ? `${form.proScore}-${form.conScore}` : null,
            tournament: form.tournament,
            debaters: form.debaters,
            mvp_flags: form.mvpFlags,
            avg_score: Math.round(avg * 10) / 10,
```

- [ ] **Step 5: Replace the mismatched 2×2 debater grid with the RecordMatch-style 4-slot layout + star buttons**

Replace the entire block (currently):

```jsx
            {/* Debaters */}
            <div>
              <label style={labelStyle}>上场辩手（可 @ 搜索已注册用户）</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '10px', color: '#5a8f7a', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '6px' }}>正方</p>
                  {[0, 1].map(i => (
                    <div key={i} style={{ marginBottom: i === 0 ? '8px' : 0 }}>
                      <label style={{ ...labelStyle, fontSize: '9px', color: '#9a8570', marginBottom: '3px' }}>{i === 0 ? '一辩' : '二辩'}</label>
                      <DebaterSearch value={form.debaters[i]} onChange={v => setDebater(i, v)} placeholder={`正方${i === 0 ? '一辩' : '二辩'}`} selfUser={selfUser} />
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: '10px', color: '#a03030', fontWeight: 700, letterSpacing: '0.06em', marginBottom: '6px' }}>反方</p>
                  {[2, 3].map((i, j) => (
                    <div key={i} style={{ marginBottom: j === 0 ? '8px' : 0 }}>
                      <label style={{ ...labelStyle, fontSize: '9px', color: '#9a8570', marginBottom: '3px' }}>{j === 0 ? '一辩' : '二辩'}</label>
                      <DebaterSearch value={form.debaters[i]} onChange={v => setDebater(i, v)} placeholder={`反方${j === 0 ? '一辩' : '二辩'}`} selfUser={selfUser} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
```

with:

```jsx
            {/* Debaters — my team's 4 */}
            <div>
              <label style={labelStyle}>我方辩手（可输入姓名或 @ 搜索已注册用户，星标可多选标记本场佳辩）</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['一辩', '二辩', '三辩', '四辩'].map((pos, i) => (
                  <div key={i}>
                    <label style={{ ...labelStyle, fontSize: '9px', color: '#9a8570', marginBottom: '3px' }}>{pos}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <DebaterSearch
                          value={form.debaters[i]}
                          onChange={v => setDebater(i, v)}
                          placeholder={pos}
                          selfUser={selfUser}
                        />
                      </div>
                      <MvpStar
                        active={form.mvpFlags[i]}
                        disabled={!form.debaters[i]}
                        onClick={() => toggleMvp(i)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
```

- [ ] **Step 6: Manually verify in the browser**

1. Ensure the dev server is running (`preview_start`, name `"撇捺"`; reuse if already started in Task 2).
2. Navigate to `/upload`.
3. Confirm the debater section now shows a single column of 4 rows labeled 一辩/二辩/三辩/四辩 (not the old 正方/反方 2×2 grid).
4. Repeat the same star-toggle checks as Task 2 Step 7 (enable-on-text, multi-select, auto-reset-on-clear).
5. Select a file (any small file), fill required fields, submit, and wait for the prototype analysis flow to finish. Use `preview_network` to confirm the `sessions` insert POST body includes `mvp_flags` matching what was toggled.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Upload.jsx
git commit -m "$(cat <<'EOF'
fix: correct Upload debater layout to match RecordMatch's 4-slot format, add 佳辩 star toggle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Leaderboard page + Navbar tab + route

**Files:**
- Create: `client/src/pages/Leaderboard.jsx`
- Modify: `client/src/components/Navbar.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: `supabase.rpc('get_leaderboards')` (Task 1) returning `{ "1": [...], "2": [...], "3": [...], "4": [...], "overall": [...] }`, each entry `{ id, username, name, avatar_url, is_public, points }`. Also consumes `supabase`/`isConfigured` from `../lib/supabase` (existing module, used the same way in every other page).
- Produces: route `/leaderboard`, rendered inside the existing `Layout` (Navbar + content), reachable from a new Navbar tab.

- [ ] **Step 1: Create the Leaderboard page**

Create `client/src/pages/Leaderboard.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';

const BOARDS = [
  { key: '1', label: '一辩榜' },
  { key: '2', label: '二辩榜' },
  { key: '3', label: '三辩榜' },
  { key: '4', label: '四辩榜' },
  { key: 'overall', label: '全能榜' },
];

export default function Leaderboard() {
  const [active, setActive] = useState('1');
  const [boards, setBoards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.rpc('get_leaderboards').then(({ data, error: rpcError }) => {
      if (rpcError) { setError('排行榜加载失败，请稍后重试'); setLoading(false); return; }
      setBoards(data || {});
      setLoading(false);
    });
  }, []);

  const rows = boards?.[active] || [];

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2C3025', marginBottom: '4px' }}>段位榜</h1>
        <p style={{ fontSize: '13px', color: '#9a8570' }}>全平台辩手积分排名 · 各榜前 50 名</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0', background: 'rgba(217,205,181,0.35)', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
        {BOARDS.map(b => (
          <button
            key={b.key}
            type="button"
            onClick={() => setActive(b.key)}
            style={{
              flex: '1 1 auto', padding: '9px 16px', fontSize: '13px',
              fontWeight: active === b.key ? 700 : 400,
              color: active === b.key ? '#2C3025' : '#9a8570',
              background: active === b.key ? 'rgba(255,255,255,0.85)' : 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em',
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '8px 0' }}>
        {loading ? (
          <p style={{ fontSize: '13px', color: '#9a8570', textAlign: 'center', padding: '32px 0' }}>加载中…</p>
        ) : error ? (
          <p style={{ fontSize: '13px', color: '#a03030', textAlign: 'center', padding: '32px 0' }}>{error}</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#9a8570', textAlign: 'center', padding: '32px 0' }}>暂无排名数据</p>
        ) : (
          rows.map((r, i) => (
            <Link key={r.id} to={`/profile/${r.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', borderBottom: i < rows.length - 1 ? '1px solid rgba(217,205,181,0.3)' : 'none' }}>
                <span style={{ width: '24px', fontSize: '14px', fontWeight: 700, color: i < 3 ? '#c07a3a' : '#9a8570', flexShrink: 0, textAlign: 'center' }}>
                  {i + 1}
                </span>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#7d9b96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C3025', fontSize: '13px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                  {r.avatar_url
                    ? <img src={r.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (r.name || '?').slice(0, 1)
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#2C3025', marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
                  <p style={{ fontSize: '11px', color: '#9a8570' }}>@{r.username}</p>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#5a8f7a', flexShrink: 0 }}>{r.points}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the Navbar tab**

In `client/src/components/Navbar.jsx`, the `NAV` array currently ends with the `/network` entry (closing at line 29 with `];` after it). Replace:

```jsx
  {
    to: '/network', label: '关系网', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="4.5" r="2" stroke="currentColor"/>
        <circle cx="4.5" cy="18" r="2" stroke="currentColor"/>
        <circle cx="19.5" cy="18" r="2" stroke="currentColor"/>
        <line x1="12" y1="6.5" x2="5.8" y2="16.2" stroke="currentColor"/>
        <line x1="12" y1="6.5" x2="18.2" y2="16.2" stroke="currentColor"/>
        <line x1="6.5" y1="18" x2="17.5" y2="18" stroke="currentColor"/>
      </svg>
    ),
  },
];
```

with:

```jsx
  {
    to: '/network', label: '关系网', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="4.5" r="2" stroke="currentColor"/>
        <circle cx="4.5" cy="18" r="2" stroke="currentColor"/>
        <circle cx="19.5" cy="18" r="2" stroke="currentColor"/>
        <line x1="12" y1="6.5" x2="5.8" y2="16.2" stroke="currentColor"/>
        <line x1="12" y1="6.5" x2="18.2" y2="16.2" stroke="currentColor"/>
        <line x1="6.5" y1="18" x2="17.5" y2="18" stroke="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/leaderboard', label: '段位榜', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10v5a5 5 0 01-10 0V4z" stroke="currentColor"/>
        <path d="M7 5H4a1 1 0 00-1 1c0 3 2 5 4 5M17 5h3a1 1 0 011 1c0 3-2 5-4 5" stroke="currentColor"/>
        <path d="M8 21h8M12 17v4" stroke="currentColor"/>
      </svg>
    ),
  },
];
```

- [ ] **Step 3: Add the route**

In `client/src/App.jsx`, add the import next to the other page imports:

```jsx
import RecordMatch from './pages/RecordMatch';
```

becomes:

```jsx
import RecordMatch from './pages/RecordMatch';
import Leaderboard from './pages/Leaderboard';
```

And add the route next to `/network`'s route. Replace:

```jsx
      <Route path="/network" element={<PrivateRoute><Layout><Network /></Layout></PrivateRoute>} />
```

with:

```jsx
      <Route path="/network" element={<PrivateRoute><Layout><Network /></Layout></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute><Layout><Leaderboard /></Layout></PrivateRoute>} />
```

- [ ] **Step 4: Manually verify in the browser**

1. Ensure the dev server is running (`preview_start`, name `"撇捺"`).
2. Take a `preview_snapshot` of the navbar — confirm a "段位榜" tab now appears after "关系网".
3. Click the "段位榜" tab (or navigate directly to `/leaderboard`) — confirm the URL changes to `/leaderboard` and the tab shows as active (underline).
4. Confirm the 5-way segmented control renders: 一辩榜/二辩榜/三辩榜/四辩榜/全能榜, with 一辩榜 active by default.
5. If Task 1's SQL migration has already been run against the connected Supabase project and at least one session exists with an `@username`-tagged, won, or 佳辩-marked debater: confirm real rows render with rank #, avatar/initial, name, `@username`, and points, and clicking a row navigates to `/profile/:id`. If the migration hasn't been run yet or there's no qualifying data, confirm the "暂无排名数据" empty state renders instead of an error or crash — check `preview_console_logs` for no unhandled errors either way.
6. Click through all 5 tabs — confirm each switches instantly (no refetch/flicker) since all boards are fetched once on mount.
7. Take a `preview_screenshot` of the final `/leaderboard` page.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Leaderboard.jsx client/src/components/Navbar.jsx client/src/App.jsx
git commit -m "$(cat <<'EOF'
feat: add 段位榜 leaderboard page, nav tab, and route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** navbar tab (Task 4) · 5 boards top-50 (Task 1 function + Task 4 rendering) · points formula 100/100/100 (Task 1 SQL) · star toggle multi-select in both forms (Tasks 2–3) · Upload.jsx layout fix (Task 3 Step 5) · registered-user-only scoring (Task 1 `join profiles` + regex filter) · private accounts still ranked (Task 1 selects `is_public` but never filters on it) · 全能榜 = sum across positions (Task 1 `overall` CTE). All spec sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO markers; every step has literal code or an exact manual action with an exact expected result.
- **Type consistency:** `mvpFlags` (client form state, camelCase) vs `mvp_flags` (DB column / payload key, snake_case) is intentional and consistent with how this codebase already handles every other field (e.g. `avg_score` vs no client equivalent, `is_public` vs `isPublic` in `UserContext.jsx`). `MvpStar`'s props (`active`, `disabled`, `onClick`) are identical across Tasks 2 and 3.
