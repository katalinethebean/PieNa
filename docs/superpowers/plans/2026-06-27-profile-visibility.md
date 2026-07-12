# Profile Visibility & WeChat Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `user_wechat` to the user profile and enforce the spec's 3-scenario field-level visibility rules (public vs private account × stranger vs friend).

**Architecture:** All visibility logic lives in `Profile.jsx` using two derived booleans — `isFriend` (from FriendContext) and `profile.is_public` — to gate which fields render. A new `abbreviateName` utility converts a Chinese name to pinyin initials (e.g. 小明 → xm) for the private-profile public view. WeChat is stored in Supabase `profiles.user_wechat` and surfaced through UserContext.

**Tech Stack:** React 18, Supabase JS client, `pinyin-pro` (pinyin initials), existing FriendContext / UserContext / Profile.jsx

## Global Constraints

- Never show `credits_left` on the profile page — internal field only
- `user_wechat` is shown **only to friends**, regardless of public/private account setting
- Private account shown to non-friend: abbreviated Chinese name only (pinyin initials, lowercase), team, avatar, bio — nothing else
- Public account shown to non-friend: everything **except** WeChat
- Any account shown to a **friend**: everything including WeChat
- Do not rename existing DB column `credits` — the spec calls it `credits_left` conceptually but the codebase uses `credits`; keep consistent with codebase

---

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `server/setup.sql` | Modify | Add `user_wechat` column migration |
| `client/src/lib/utils.js` | Modify | Add `abbreviateName(chineseName)` util |
| `client/src/contexts/UserContext.jsx` | Modify | Expose `wechat` / `setWechat` |
| `client/src/pages/Profile.jsx` | Modify | Visibility gating per 3-scenario spec, WeChat display, edit field |

---

## Task 1: DB — Add `user_wechat` column

**Files:**
- Modify: `server/setup.sql`

**Interfaces:**
- Produces: `profiles.user_wechat text` column available in Supabase

- [ ] **Step 1: Add migration block to setup.sql**

Open `server/setup.sql` and append inside the existing `DO $$ ... $$` migration block (after the `avatar_url` check):

```sql
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_wechat') THEN
    ALTER TABLE profiles ADD COLUMN user_wechat text default '';
  END IF;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste and run only this snippet:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='user_wechat') THEN
    ALTER TABLE profiles ADD COLUMN user_wechat text default '';
  END IF;
END $$;
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify in Supabase Table Editor**

Open Table Editor → profiles → confirm `user_wechat` column exists with type `text`.

---

## Task 2: Utility — Chinese name abbreviation

**Files:**
- Modify: `client/src/lib/utils.js`

**Interfaces:**
- Produces: `abbreviateName(name: string): string` — takes a Chinese name, returns lowercase pinyin initials (e.g. `"小明"` → `"xm"`, `"李华"` → `"lh"`)

- [ ] **Step 1: Install pinyin-pro**

```bash
cd client && npm install pinyin-pro
```

Expected: `pinyin-pro` appears in `client/package.json` dependencies.

- [ ] **Step 2: Add `abbreviateName` to utils.js**

Open `client/src/lib/utils.js` and add at the bottom:

```js
import { pinyin } from 'pinyin-pro';

export function abbreviateName(chineseName) {
  if (!chineseName) return '?';
  return pinyin(chineseName, { pattern: 'initial', toneType: 'none', separator: '' }).toLowerCase();
}
```

- [ ] **Step 3: Manual smoke test in browser console**

Start the dev server (`cd client && npm run dev`), open browser console, and run:

```js
import('/src/lib/utils.js').then(m => console.log(m.abbreviateName('小明')));
// Expected output: "xm"
```

---

## Task 3: UserContext — expose `wechat` field

**Files:**
- Modify: `client/src/contexts/UserContext.jsx`

**Interfaces:**
- Consumes: `profiles.user_wechat` from Supabase
- Produces: `user.wechat` (string), `user.setWechat` (setter) available to all consumers

- [ ] **Step 1: Add wechat state**

In `UserContext.jsx`, add after the `const [credits, setCredits] = useState(3);` line:

```js
const [wechat, setWechat] = useState('');
```

- [ ] **Step 2: Reset wechat on logout**

Inside the `if (!authUser)` block (around line 27), add:

```js
setWechat('');
```

- [ ] **Step 3: Load wechat from profile**

Inside `loadProfile()`, after `setCredits(data.credits ?? 3);`, add:

```js
setWechat(data.user_wechat ?? '');
```

- [ ] **Step 4: Expose in context value**

In the `<UserContext.Provider value={{...}}>` block, add:

```js
wechat, setWechat,
```

- [ ] **Step 5: Save wechat when profile is updated (in Profile.jsx saveEditing)**

This is handled in Task 4. No additional changes here.

---

## Task 4: Profile.jsx — visibility rules + WeChat field

**Files:**
- Modify: `client/src/pages/Profile.jsx`

**Interfaces:**
- Consumes: `user.wechat`, `user.setWechat` from UserContext
- Consumes: `abbreviateName` from `../lib/utils`
- Consumes: `isFriend` derived from `friends.includes(id)` (already in FriendContext)

**Visibility matrix to implement:**

| Viewer | Public account | Private account |
|--------|---------------|-----------------|
| Stranger (not friend) | Full name ✓, team ✓, avatar ✓, bio ✓, friend count ✓, sessions ✓, win rate ✓, score ✓, match history ✓, radar ✓ — **WeChat ✗** | Abbreviated name ✓, team ✓, avatar ✓, bio ✓ — **everything else ✗** |
| Friend | Everything including WeChat ✓ | Everything including WeChat ✓ |

- [ ] **Step 1: Add imports**

At the top of `Profile.jsx`, add `abbreviateName` to the utils import:

```js
import { formatChineseDate, abbreviateName } from '../lib/utils';
```

- [ ] **Step 2: Add draft wechat state and wire into edit flow**

After `const [draftIsPublic, setDraftIsPublic] = useState(false);`, add:

```js
const [draftWechat, setDraftWechat] = useState('');
```

In `startEditing()`, add:

```js
setDraftWechat(user.wechat);
```

In `saveEditing()`, add:

```js
user.setWechat(draftWechat);
if (isConfigured && user.id) {
  supabase.from('profiles').update({ user_wechat: draftWechat }).eq('id', user.id);
}
```

- [ ] **Step 3: Derive visibility booleans**

After `const isSelf = self || !id;`, add:

```js
const isFriendOfProfile = !isSelf && friends.includes(id);
const canSeePrivateDetails = isSelf || isFriendOfProfile;
// For non-self public profiles: stranger sees most things, friend sees WeChat too
// For non-self private profiles: stranger sees abbreviated name/team/avatar/bio only
const isPrivateStranger = !isSelf && !isFriendOfProfile && profile?.is_public === false;
```

- [ ] **Step 4: Replace the existing private gate**

Find the current privacy gate block (around line 165):

```js
const isPrivate = !isSelf && profile.is_public === false && !friends.includes(id);
if (isPrivate) return ( ... );
```

**Delete it entirely.** The new `isPrivateStranger` boolean (set in Step 3) gates individual fields inline instead of blocking the whole page.

- [ ] **Step 5: Render abbreviated name for private strangers**

In the profile display section (the `h1` with `profile.name`, around line 321), replace:

```jsx
<h1 style={{ fontSize: '22px', fontWeight: 700, color: '#2C3025', marginBottom: '4px' }}>{profile.name}</h1>
```

with:

```jsx
<h1 style={{ fontSize: '22px', fontWeight: 700, color: '#2C3025', marginBottom: '4px' }}>
  {isPrivateStranger ? abbreviateName(profile.name) : profile.name}
</h1>
```

- [ ] **Step 6: Gate stats row (friend count / sessions / win rate / score)**

Find the stats row div (the one containing `{friendCount} 好友` and `{sessions.length} 场次`). Wrap it:

```jsx
{!isPrivateStranger && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
    <span style={{ fontSize: '12px', color: '#a4b9b5', letterSpacing: '0.04em' }}>@{profile.username}</span>
    <span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px' }}>·</span>
    <span style={{ fontSize: '12px', color: '#6b5c45', fontWeight: 500 }}>{friendCount} 好友</span>
    <span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px' }}>·</span>
    <span style={{ fontSize: '12px', color: '#6b5c45', fontWeight: 500 }}>{sessions.length} 场次</span>
    <span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px' }}>·</span>
    <span style={{ fontSize: '12px', color: winRate >= 60 ? '#5a8f7a' : '#6b5c45', fontWeight: 500 }}>胜率 {winRate}%</span>
  </div>
)}
{isPrivateStranger && (
  <div style={{ marginBottom: '12px' }}>
    <span style={{ fontSize: '12px', color: '#a4b9b5', letterSpacing: '0.04em' }}>@{profile.username}</span>
  </div>
)}
```

- [ ] **Step 7: Gate avg score and radar chart**

Find the avg score display (`<AnimatedNumber value={...} .../>`) and the radar chart `<div>`. Wrap both:

```jsx
{!isPrivateStranger && (
  <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(200,184,154,0.3)' }}>
    <AnimatedNumber value={Number(profile.avg_score)} decimals={1} style={{ fontSize: '26px', fontWeight: 800, color: '#7d9b96', lineHeight: 1 }} />
    <span style={{ fontSize: '11px', color: '#9a8570', marginLeft: '4px' }}>综合均分</span>
  </div>
)}
```

```jsx
{!isPrivateStranger && (
  <div style={{ height: '210px', paddingTop: '4px' }}>
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <PolarGrid stroke="rgba(164,185,181,0.3)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b5c45', fontSize: 11, fontFamily: 'inherit' }} />
        <Radar dataKey="score" stroke="#7d9b96" fill="#a4b9b5" fillOpacity={0.28} strokeWidth={1.5} />
      </RadarChart>
    </ResponsiveContainer>
  </div>
)}
```

- [ ] **Step 8: Gate match history (sessions list)**

Find the sessions map block (`{sessions.map((s, i) => (...))}`) and its surrounding container. Wrap the entire sessions section:

```jsx
{!isPrivateStranger && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    {sessions.map((s, i) => ( ... ))}
  </div>
)}
{isPrivateStranger && (
  <div style={{ padding: '32px', textAlign: 'center', color: '#c8b89a', fontSize: '13px' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 8px' }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    私密账号
  </div>
)}
```

- [ ] **Step 9: Add WeChat display (friends only) in view mode**

After the `displayHonors` block (after the honors section), add:

```jsx
{(isSelf || isFriendOfProfile) && profile.wechat && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    <span style={{ fontSize: '12px', color: '#7d6b55', fontWeight: 500 }}>微信：{profile.wechat}</span>
  </div>
)}
```

Note: `profile.wechat` for self uses `user.wechat`. Update the `profile` object construction for `isSelf` (around line 154) to include `wechat: user.wechat`.

- [ ] **Step 10: Add WeChat field in edit mode**

In the editing form, after the `团队` input block, add:

```jsx
<div>
  <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.06em' }}>微信号</label>
  <input style={inputStyle} value={draftWechat} onChange={e => setDraftWechat(e.target.value)} placeholder="你的微信号（仅好友可见）" />
</div>
```

- [ ] **Step 11: Manual test — public account, stranger view**

1. Log in as User A (public account)
2. Open User A's profile as User B (not a friend)
3. Verify: full name visible ✓, team/avatar/bio/stats/radar/history visible ✓, WeChat **not** visible ✓

- [ ] **Step 12: Manual test — private account, stranger view**

1. Set User A's profile to private
2. View as User B (not a friend)
3. Verify: abbreviated name (pinyin initials) ✓, team/avatar/bio visible ✓, stats/radar/history **not** visible ✓, lock icon shown ✓

- [ ] **Step 13: Manual test — any account, friend view**

1. Add User B as a friend of User A
2. View User A's profile as User B
3. Verify: WeChat visible ✓, all stats/history visible ✓ (regardless of public/private)

- [ ] **Step 14: Commit**

```bash
cd client
git add src/lib/utils.js src/contexts/UserContext.jsx src/pages/Profile.jsx package.json package-lock.json
git add ../server/setup.sql
git commit -m "feat: profile visibility rules + WeChat field (friend-only)"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `user_wechat` DB field | Task 1 |
| Abbreviated name for private strangers | Task 2, Task 4 Step 5 |
| Public profile: full info to strangers, WeChat to friends only | Task 4 Steps 6–9 |
| Private profile: name/team/avatar/bio to strangers, everything to friends | Task 4 Steps 6–8 |
| WeChat shown to friends regardless of public/private | Task 4 Step 9 |
| WeChat editable in profile | Task 4 Step 10 |
| `credits_left` not shown on profile | Already true — no change needed |
| `friends` count shown on public profile, hidden from private strangers | Task 4 Step 6 |
