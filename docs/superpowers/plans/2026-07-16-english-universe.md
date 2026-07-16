# English Universe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 中/EN universe toggle that switches the entire app — UI language, recruit hall feed, leaderboard visibility, and session language tagging.

**Architecture:** A `LanguageContext` (in `main.jsx` between `AuthProvider` and `UserProvider`) reads `localStorage` on init and syncs to `profiles.language` after login. It exposes `lang`, `setLang`, and `t(key, vars?)`. CSS variables on `:root` / `html[data-universe="en"]` provide theme color overrides. DB columns tag posts and sessions by language; `get_recruit_feed` and `get_leaderboards` are updated to filter accordingly.

**Tech Stack:** React Context, CSS custom properties, Supabase RPC, localStorage

## Global Constraints

- Keep parchment background `#E8E4DC` in both universes — only accent/nav colors change
- English universe accent: navy nav `rgba(30,45,72,0.97)`, steel-blue accents replacing sage-greens
- Roles stored in DB as Chinese canonical values (`找队友` etc.) regardless of UI language; UI translates via `t('role.找队友')`
- Special filter values (`全部`, `好友`, `我的`) are always passed to the DB in Chinese/canonical form
- No new npm dependencies
- Commits in Chinese matching repo convention

---

### Task 1: DB Migrations

**Files:**
- Modify: `server/setup.sql` (append idempotent migration blocks)

**Interfaces:**
- Produces: `profiles.language`, `recruit_posts.language`, `sessions.language` columns; updated `get_recruit_feed(p_lang)` and `get_leaderboards()` that exclude non-zh sessions

- [ ] **Step 1: Append migration blocks to setup.sql**

Append this entire block at the very end of `server/setup.sql`:

```sql
-- ============================================================
-- English Universe migrations (2026-07-16)
-- ============================================================

-- profiles: language preference
do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_name='profiles' and column_name='language') then
    alter table profiles add column language text not null default 'zh';
  end if;
end $$;

-- recruit_posts: which universe this post belongs to
do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_name='recruit_posts' and column_name='language') then
    alter table recruit_posts add column language text not null default 'zh';
  end if;
end $$;

-- sessions: which universe this session belongs to
do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_name='sessions' and column_name='language') then
    alter table sessions add column language text not null default 'zh';
  end if;
end $$;

-- get_recruit_feed: add p_lang parameter to filter by universe
drop function if exists get_recruit_feed(text[], double precision, int);
create or replace function get_recruit_feed(
  p_roles text[] default null,
  p_seed double precision default 0,
  p_limit int default 15,
  p_lang text default 'zh'
)
returns table (
  id uuid,
  user_id uuid,
  role text,
  note text,
  created_at timestamptz,
  name text,
  school text,
  avatar_url text,
  like_count bigint,
  is_friend boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select id, school from profiles where id = auth.uid()
  ),
  my_friends as (
    select case when fr.sender_id = auth.uid() then fr.receiver_id else fr.sender_id end as fid
    from friend_requests fr
    where fr.status = 'accepted'
      and (fr.sender_id = auth.uid() or fr.receiver_id = auth.uid())
  ),
  visible as (
    select rp.id, rp.user_id, rp.role, rp.note, rp.created_at,
           pr.name, pr.school, pr.avatar_url,
           (rp.user_id in (select fid from my_friends)) as is_friend
    from recruit_posts rp
    join profiles pr on pr.id = rp.user_id
    where rp.archived = false
      and coalesce(rp.language, 'zh') = p_lang
      and (
        rp.user_id = auth.uid()
        or rp.user_id in (select fid from my_friends)
        or pr.is_public = true
      )
      and (
        p_roles is null or array_length(p_roles, 1) is null or '全部' = any(p_roles)
        or (rp.role = any(p_roles))
        or ('好友' = any(p_roles) and rp.user_id in (select fid from my_friends))
      )
  ),
  scored as (
    select v.*,
      (select count(*) from recruit_likes rl where rl.post_id = v.id) as like_count,
      (case when v.is_friend then 2.0 else 0 end)
      + (case when v.school is not null and v.school = (select school from me) then 1.0 else 0 end)
      + least(1.5, 0.3 * (select count(*) from recruit_likes rl where rl.post_id = v.id))
      + greatest(0, 3.0 - extract(epoch from (now() - v.created_at)) / 86400.0)
      + 2.0 * (('x' || substr(md5(v.id::text || p_seed::text), 1, 8))::bit(32)::bigint::double precision / 4294967295.0)
      as score
    from visible v
  )
  select id, user_id, role, note, created_at, name, school, avatar_url, like_count, is_friend
  from scored
  order by score desc
  limit greatest(1, least(50, p_limit));
$$;
grant execute on function get_recruit_feed(text[], double precision, int, text) to authenticated;

-- get_leaderboards: exclude non-zh sessions
create or replace function get_leaderboards()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_entries jsonb;
  v_position int;
  v_self uuid := auth.uid();
  v_self_name text;
  v_self_username text;
  v_self_avatar text;
  v_self_points int;
  v_self_rank int;
  v_self_matches int;
  v_self_mvp_count int;
  v_total_matches int := 0;
  v_total_mvp_count int := 0;
  v_self_result jsonb;
begin
  select name, username, avatar_url
    into v_self_name, v_self_username, v_self_avatar
    from profiles where id = v_self;

  v_self_result := jsonb_build_object(
    'name', v_self_name, 'username', v_self_username, 'avatar_url', v_self_avatar
  );

  for v_position in 1..4 loop
    with pos_points as (
      select
        p.id as profile_id,
        sum(
          100
            + case when s.won then 100 else 0 end
            + case when coalesce(s.mvp_flags[v_position], false) then 100 else 0 end
        )::int as points
      from sessions s
      join profiles p
        on p.username = lower(substring(s.debaters[v_position] from '^@(\S+)'))
      where s.debaters[v_position] ~ '^@\S+'
        and coalesce(s.language, 'zh') = 'zh'
      group by p.id
    ),
    ranked as (
      select *, row_number() over (order by points desc, profile_id) as rn
      from pos_points
    )
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'username', pr.username, 'name', pr.name,
        'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', ranked.points
      ) order by ranked.points desc, pr.id), '[]'::jsonb),
      (select points from ranked where profile_id = v_self),
      (select rn from ranked where profile_id = v_self)
    into v_entries, v_self_points, v_self_rank
    from ranked
    join profiles pr on pr.id = ranked.profile_id
    where ranked.rn <= 50;

    select
      count(*)::int,
      coalesce(sum(case when coalesce(s.mvp_flags[v_position], false) then 1 else 0 end), 0)::int
    into v_self_matches, v_self_mvp_count
    from sessions s
    where lower(substring(s.debaters[v_position] from '^@(\S+)')) = v_self_username
      and coalesce(s.language, 'zh') = 'zh';

    v_total_matches := v_total_matches + v_self_matches;
    v_total_mvp_count := v_total_mvp_count + v_self_mvp_count;

    v_result := v_result || jsonb_build_object(v_position::text, v_entries);
    v_self_result := v_self_result || jsonb_build_object(
      v_position::text,
      jsonb_build_object(
        'rank', v_self_rank, 'points', coalesce(v_self_points, 0),
        'matches', v_self_matches, 'mvp_count', v_self_mvp_count
      )
    );
  end loop;

  with slot_points as (
    select
      p.id as profile_id,
      100
        + case when s.won then 100 else 0 end
        + case when coalesce(s.mvp_flags[gs.i], false) then 100 else 0 end
        as points
    from sessions s
    cross join generate_series(1, 4) as gs(i)
    join profiles p
      on p.username = lower(substring(s.debaters[gs.i] from '^@(\S+)'))
    where s.debaters[gs.i] ~ '^@\S+'
      and coalesce(s.language, 'zh') = 'zh'
  ),
  overall_points as (
    select profile_id, sum(points)::int as points
    from slot_points
    group by profile_id
  ),
  ranked as (
    select *, row_number() over (order by points desc, profile_id) as rn
    from overall_points
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', pr.id, 'username', pr.username, 'name', pr.name,
      'avatar_url', pr.avatar_url, 'is_public', pr.is_public, 'points', ranked.points
    ) order by ranked.points desc, pr.id), '[]'::jsonb),
    (select points from ranked where profile_id = v_self),
    (select rn from ranked where profile_id = v_self)
  into v_entries, v_self_points, v_self_rank
  from ranked
  join profiles pr on pr.id = ranked.profile_id
  where ranked.rn <= 50;

  v_result := v_result || jsonb_build_object('overall', v_entries);
  v_self_result := v_self_result || jsonb_build_object(
    'overall',
    jsonb_build_object(
      'rank', v_self_rank, 'points', coalesce(v_self_points, 0),
      'matches', v_total_matches, 'mvp_count', v_total_mvp_count
    )
  );

  v_result := v_result || jsonb_build_object('self', v_self_result);
  return v_result;
end;
$$;

grant execute on function get_leaderboards() to authenticated;
```

- [ ] **Step 2: Apply migration**

Paste the appended SQL block into the Supabase SQL Editor and run it. Verify no errors. The old `get_recruit_feed` signature is dropped first so the new one with `p_lang` takes its place.

- [ ] **Step 3: Commit**

```bash
git add server/setup.sql
git commit -m "feat: 数据库迁移 — 语言列 + 双宇宙查询函数"
```

---

### Task 2: LanguageContext + i18n Dictionaries

**Files:**
- Create: `client/src/contexts/LanguageContext.jsx`
- Create: `client/src/i18n/zh.js`
- Create: `client/src/i18n/en.js`

**Interfaces:**
- Produces: `useLanguage()` → `{ lang, setLang, t }` where `lang` is `'zh'|'en'`, `setLang(l)` writes localStorage + DB, `t(key, vars?)` returns translated string with `{var}` interpolation

- [ ] **Step 1: Create `client/src/i18n/zh.js`**

```js
export default {
  // nav
  'nav.discover': '发现', 'nav.review': '复盘', 'nav.chat': '聊天',
  'nav.home': '首页', 'nav.profile': '我的', 'nav.leaderboard': '积分榜',
  'nav.find_friends': '发现好友', 'nav.tutorial': '新手教程',
  'nav.login': '登录 / 注册',

  // roles (canonical DB values)
  'role.找队友': '找队友', 'role.找评委': '找评委',
  'role.找教练': '找教练', 'role.其他': '其他',

  // filters
  'filter.全部': '全部', 'filter.我的': '我的', 'filter.好友': '好友',
  'filter.找队友': '找队友', 'filter.找评委': '找评委',
  'filter.找教练': '找教练', 'filter.其他': '其他',

  // discover page
  'discover.recruit_hall': '招募大厅',
  'discover.post_btn': '+ 发起招募',
  'discover.loading': '加载中…',
  'discover.no_posts': '还没有招募帖',
  'discover.no_match': '没有符合筛选的招募',
  'discover.be_first': '成为第一个发起招募的人，找到你的辩论搭档',
  'discover.try_other': '试试切换其他分类，或换一批看看',
  'discover.expand': '[展开]',
  'discover.mutual_friends': '{count} 位共同好友',
  'discover.same_school': '同校',
  'discover.add_friend': '+ 加好友',
  'discover.friend_sent': '已发送',
  'discover.friend_accept': '接受',
  'discover.say_hi': '打个招呼（可选）',
  'discover.send': '发送',
  'discover.find_more': '发现更多辩手 →',
  'discover.people_know': '你可能认识',
  'discover.my_points': '我的撇捺积分',
  'discover.my_recruits': '我的招募',
  'discover.no_my_recruits': '还没有自己的招募帖',
  'discover.refresh': '换一批',
  'discover.archive': '归档',
  'discover.unarchive': '取消归档',
  'discover.archived_badge': '已归档',
  'discover.delete': '删除',

  // recruit modal
  'recruit.title': '发起招募',
  'recruit.role_label': '身份 *',
  'recruit.note_label': '详情 *',
  'recruit.note_placeholder': '介绍一下你自己，说明你在找什么类型的搭档…',
  'recruit.submit': '发布',
  'recruit.submitting': '发布中…',
  'recruit.error': '发布失败，请重试',
  'recruit.edit_title': '编辑招募帖',
  'recruit.save': '保存修改',
  'recruit.saving': '保存中…',
  'recruit.save_error': '保存失败，请重试',

  // profile
  'profile.view': '查看我的档案',
  'profile.friends': '好友',
  'profile.avg_score': '平均分',
  'profile.win_rate': '胜率',
  'profile.matches_unit': '场',
  'profile.history': '出战记录',
  'profile.no_history': '暂无比赛记录',
  'profile.send_msg': '发送消息',
  'profile.challenge': '切磋对战',
  'profile.add_friend': '+ 加好友',
  'profile.friend_sent': '已发送好友申请',
  'profile.cancel_request': '取消申请',
  'profile.already_friends': '✓ 已是好友',
  'profile.private': '该用户档案不公开',
  'profile.honors': '荣誉',
  'profile.bio': '简介',
  'profile.team': '战队',
  'profile.school': '学校',
  'profile.region': '地区',
  'profile.name': '姓名',
  'profile.position': '辩位',
  'profile.save': '保存',
  'profile.saving': '保存中…',
  'profile.cancel': '取消',
  'profile.edit': '编辑资料',
  'profile.settings': '设置',
  'profile.avatar_hint': '头像：点击头像图片上传 · 邮箱、微信、公开设置在「设置」中修改',
  'profile.won': '胜',
  'profile.lost': '负',

  // settings
  'settings.title': '设置',
  'settings.username_section': '更改用户名',
  'settings.username_current': '当前：@{username}',
  'settings.username_placeholder': '新用户名（英文、数字、下划线）',
  'settings.confirm': '确认修改',
  'settings.email_section': '更改邮箱',
  'settings.email_current': '当前：{email}',
  'settings.email_placeholder': '新邮箱',
  'settings.wechat_section': '微信号',
  'settings.wechat_placeholder': '输入微信号',
  'settings.privacy_section': '档案可见性',
  'settings.public': '公开',
  'settings.private': '仅好友',
  'settings.logout': '退出登录',
  'settings.delete': '删除账号',
  'settings.delete_confirm': '删除账号后所有数据将永久丢失，确认删除吗？',
  'settings.saved': '已保存',

  // login
  'login.welcome': '欢迎来到撇捺',
  'login.tagline': '辩手的角斗场',
  'login.email': '邮箱',
  'login.password': '密码',
  'login.login': '登录',
  'login.register': '注册',
  'login.forgot': '忘记密码？',
  'login.reset_send': '发送重置邮件',
  'login.back': '返回',
  'login.have_account': '已有账户？登录',
  'login.no_account': '还没有账户？注册',
  'login.logging_in': '登录中…',
  'login.registering': '注册中…',
  'login.sending': '发送中…',
  'login.reset_sent': '重置邮件已发送，请查收',

  // network
  'network.title': '辩手圈',
  'network.friends_tab': '好友 ({count})',
  'network.pending_tab': '待处理 ({count})',
  'network.search': '搜索辩手',
  'network.find_new': '认识新朋友',
  'network.no_friends': '还没有好友',
  'network.no_pending': '没有待处理的好友请求',
  'network.accept': '接受',
  'network.decline': '拒绝',
  'network.message': '发消息',
  'network.view': '查看',

  // chat
  'chat.title': '消息',
  'chat.empty': '还没有消息',
  'chat.placeholder': '发消息…',
  'chat.send': '发送',
  'chat.today': '今天',
  'chat.yesterday': '昨天',
  'chat.select': '选择一个对话',
  'chat.new': '新消息',

  // leaderboard
  'lb.title': '撇捺积分榜',
  'lb.pos1': '一辩', 'lb.pos2': '二辩', 'lb.pos3': '三辩', 'lb.pos4': '四辩',
  'lb.overall': '全能',
  'lb.rank': '名次', 'lb.points': '积分',
  'lb.matches': '场次', 'lb.mvp': 'MVP',
  'lb.my_stats': '我的数据',
  'lb.no_data': '暂无数据',
  'lb.loading': '加载中…',

  // upload
  'upload.title': '上传录音',
  'upload.select_file': '选择录音文件',
  'upload.drop': '拖拽或点击上传',
  'upload.formats': '支持 MP3、M4A、WAV、MP4 等格式',
  'upload.tournament': '赛事名称（可选）',
  'upload.date': '比赛日期',
  'upload.result': '比赛结果',
  'upload.won': '赢了', 'upload.lost': '输了',
  'upload.submit': '提交分析',
  'upload.submitting': '上传中…',
  'upload.credits': '剩余次数：{count}',
  'upload.no_credits': '分析次数已用完',

  // record
  'record.title': '记录比赛',
  'record.submit': '保存记录',
  'record.saving': '保存中…',
  'record.tournament': '赛事名称（可选）',
  'record.date': '比赛日期',
  'record.result': '比赛结果',
  'record.won': '赢了', 'record.lost': '输了',
  'record.position': '我的辩位',
  'record.debaters': '辩手（@用户名）',
  'record.mvp': 'MVP',
  'record.notes': '备注',
  'record.motion': '辩题',
  'record.saved': '已保存',
  'record.error': '保存失败，请重试',

  // review
  'review.title': 'AI 复盘',
  'review.upload': '上传录音',
  'review.record': '记录比赛',
  'review.no_sessions': '暂无比赛记录',
  'review.start': '开始复盘',
  'review.analyzing': '分析中…',

  // report
  'report.title': '比赛详情',
  'report.score': '评分',
  'report.logic': '逻辑', 'report.argumentation': '立论', 'report.teamwork': '配合',
  'report.analysis': 'AI 分析',
  'report.delete': '删除记录',
  'report.delete_confirm': '确认删除这场比赛记录？',
  'report.transcript': '发言记录',
  'report.no_analysis': '暂无 AI 分析',

  // common
  'common.loading': '加载中…',
  'common.error': '出错了，请重试',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.delete': '删除',
  'common.save': '保存',
  'common.close': '关闭',
  'common.back': '返回',
  'common.send': '发送',

  // onboarding
  'onboard.title': '欢迎使用撇捺',
  'onboard.skip': '跳过',
  'onboard.next': '下一步',
  'onboard.done': '开始使用',

  // notifications
  'notif.title': '通知',
  'notif.empty': '暂无通知',
  'notif.friend_request': '{name} 向你发送了好友申请',
  'notif.match_invite': '{name} 邀请你查看比赛记录',
};
```

- [ ] **Step 2: Create `client/src/i18n/en.js`**

```js
export default {
  // nav
  'nav.discover': 'Discover', 'nav.review': 'Review', 'nav.chat': 'Chat',
  'nav.home': 'Home', 'nav.profile': 'Profile', 'nav.leaderboard': 'Leaderboard',
  'nav.find_friends': 'Find Debaters', 'nav.tutorial': 'Tutorial',
  'nav.login': 'Log In',

  // roles
  'role.找队友': 'Find Teammate', 'role.找评委': 'Find Judge',
  'role.找教练': 'Find Coach', 'role.其他': 'Other',

  // filters
  'filter.全部': 'All', 'filter.我的': 'Mine', 'filter.好友': 'Friends',
  'filter.找队友': 'Find Teammate', 'filter.找评委': 'Find Judge',
  'filter.找教练': 'Find Coach', 'filter.其他': 'Other',

  // discover
  'discover.recruit_hall': 'Recruiting Hall',
  'discover.post_btn': '+ Post',
  'discover.loading': 'Loading…',
  'discover.no_posts': 'No posts yet',
  'discover.no_match': 'No posts match your filters',
  'discover.be_first': 'Be the first to post and find your debate partner',
  'discover.try_other': 'Try another category or refresh',
  'discover.expand': '[expand]',
  'discover.mutual_friends': '{count} mutual friends',
  'discover.same_school': 'Same school',
  'discover.add_friend': '+ Add Friend',
  'discover.friend_sent': 'Sent',
  'discover.friend_accept': 'Accept',
  'discover.say_hi': 'Say hi (optional)',
  'discover.send': 'Send',
  'discover.find_more': 'Find more debaters →',
  'discover.people_know': 'People you may know',
  'discover.my_points': 'My PieNa Points',
  'discover.my_recruits': 'My Posts',
  'discover.no_my_recruits': 'No posts yet',
  'discover.refresh': 'Refresh',
  'discover.archive': 'Archive',
  'discover.unarchive': 'Unarchive',
  'discover.archived_badge': 'Archived',
  'discover.delete': 'Delete',

  // recruit modal
  'recruit.title': 'Post Recruitment',
  'recruit.role_label': 'Role *',
  'recruit.note_label': 'Details *',
  'recruit.note_placeholder': 'Introduce yourself and describe what kind of partner you\'re looking for…',
  'recruit.submit': 'Post',
  'recruit.submitting': 'Posting…',
  'recruit.error': 'Failed to post, please try again',
  'recruit.edit_title': 'Edit Post',
  'recruit.save': 'Save Changes',
  'recruit.saving': 'Saving…',
  'recruit.save_error': 'Failed to save, please try again',

  // profile
  'profile.view': 'View My Profile',
  'profile.friends': 'Friends',
  'profile.avg_score': 'Avg',
  'profile.win_rate': 'Win Rate',
  'profile.matches_unit': 'matches',
  'profile.history': 'Match History',
  'profile.no_history': 'No matches yet',
  'profile.send_msg': 'Message',
  'profile.challenge': 'Challenge',
  'profile.add_friend': '+ Add Friend',
  'profile.friend_sent': 'Friend request sent',
  'profile.cancel_request': 'Cancel Request',
  'profile.already_friends': '✓ Friends',
  'profile.private': 'This profile is private',
  'profile.honors': 'Honors',
  'profile.bio': 'About',
  'profile.team': 'Team',
  'profile.school': 'School',
  'profile.region': 'Region',
  'profile.name': 'Name',
  'profile.position': 'Position',
  'profile.save': 'Save',
  'profile.saving': 'Saving…',
  'profile.cancel': 'Cancel',
  'profile.edit': 'Edit Profile',
  'profile.settings': 'Settings',
  'profile.avatar_hint': 'Click avatar to upload · Email and privacy settings in "Settings"',
  'profile.won': 'W',
  'profile.lost': 'L',

  // settings
  'settings.title': 'Settings',
  'settings.username_section': 'Change Username',
  'settings.username_current': 'Current: @{username}',
  'settings.username_placeholder': 'New username (letters, numbers, underscores)',
  'settings.confirm': 'Confirm',
  'settings.email_section': 'Change Email',
  'settings.email_current': 'Current: {email}',
  'settings.email_placeholder': 'New email',
  'settings.wechat_section': 'WeChat ID',
  'settings.wechat_placeholder': 'Enter WeChat ID',
  'settings.privacy_section': 'Profile Visibility',
  'settings.public': 'Public',
  'settings.private': 'Friends Only',
  'settings.logout': 'Log Out',
  'settings.delete': 'Delete Account',
  'settings.delete_confirm': 'All data will be permanently deleted. Are you sure?',
  'settings.saved': 'Saved',

  // login
  'login.welcome': 'Welcome to PieNa',
  'login.tagline': 'The Debater\'s Arena',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.login': 'Log In',
  'login.register': 'Register',
  'login.forgot': 'Forgot password?',
  'login.reset_send': 'Send Reset Email',
  'login.back': 'Back',
  'login.have_account': 'Already have an account? Log In',
  'login.no_account': 'No account? Register',
  'login.logging_in': 'Logging in…',
  'login.registering': 'Registering…',
  'login.sending': 'Sending…',
  'login.reset_sent': 'Reset email sent, please check your inbox',

  // network
  'network.title': 'Network',
  'network.friends_tab': 'Friends ({count})',
  'network.pending_tab': 'Pending ({count})',
  'network.search': 'Search debaters',
  'network.find_new': 'Find New People',
  'network.no_friends': 'No friends yet',
  'network.no_pending': 'No pending requests',
  'network.accept': 'Accept',
  'network.decline': 'Decline',
  'network.message': 'Message',
  'network.view': 'View',

  // chat
  'chat.title': 'Messages',
  'chat.empty': 'No messages yet',
  'chat.placeholder': 'Send a message…',
  'chat.send': 'Send',
  'chat.today': 'Today',
  'chat.yesterday': 'Yesterday',
  'chat.select': 'Select a conversation',
  'chat.new': 'New Message',

  // leaderboard
  'lb.title': 'PieNa Leaderboard',
  'lb.pos1': 'Pos. 1', 'lb.pos2': 'Pos. 2', 'lb.pos3': 'Pos. 3', 'lb.pos4': 'Pos. 4',
  'lb.overall': 'Overall',
  'lb.rank': 'Rank', 'lb.points': 'Points',
  'lb.matches': 'Matches', 'lb.mvp': 'MVP',
  'lb.my_stats': 'My Stats',
  'lb.no_data': 'No data yet',
  'lb.loading': 'Loading…',

  // upload
  'upload.title': 'Upload Recording',
  'upload.select_file': 'Select file',
  'upload.drop': 'Drag & drop or click to upload',
  'upload.formats': 'Supports MP3, M4A, WAV, MP4, etc.',
  'upload.tournament': 'Tournament name (optional)',
  'upload.date': 'Match date',
  'upload.result': 'Result',
  'upload.won': 'Won', 'upload.lost': 'Lost',
  'upload.submit': 'Submit for Analysis',
  'upload.submitting': 'Uploading…',
  'upload.credits': 'Credits remaining: {count}',
  'upload.no_credits': 'No credits remaining',

  // record
  'record.title': 'Record Match',
  'record.submit': 'Save Record',
  'record.saving': 'Saving…',
  'record.tournament': 'Tournament name (optional)',
  'record.date': 'Match date',
  'record.result': 'Result',
  'record.won': 'Won', 'record.lost': 'Lost',
  'record.position': 'My position',
  'record.debaters': 'Debaters (@username)',
  'record.mvp': 'MVP',
  'record.notes': 'Notes',
  'record.motion': 'Motion',
  'record.saved': 'Saved',
  'record.error': 'Failed to save, please try again',

  // review
  'review.title': 'AI Review',
  'review.upload': 'Upload Recording',
  'review.record': 'Record Match',
  'review.no_sessions': 'No match records yet',
  'review.start': 'Start Review',
  'review.analyzing': 'Analyzing…',

  // report
  'report.title': 'Match Details',
  'report.score': 'Score',
  'report.logic': 'Logic', 'report.argumentation': 'Argumentation', 'report.teamwork': 'Teamwork',
  'report.analysis': 'AI Analysis',
  'report.delete': 'Delete Record',
  'report.delete_confirm': 'Delete this match record?',
  'report.transcript': 'Transcript',
  'report.no_analysis': 'No AI analysis yet',

  // common
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong, please try again',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.send': 'Send',

  // onboarding
  'onboard.title': 'Welcome to PieNa',
  'onboard.skip': 'Skip',
  'onboard.next': 'Next',
  'onboard.done': 'Get Started',

  // notifications
  'notif.title': 'Notifications',
  'notif.empty': 'No notifications',
  'notif.friend_request': '{name} sent you a friend request',
  'notif.match_invite': '{name} invited you to view a match record',
};
```

- [ ] **Step 3: Create `client/src/contexts/LanguageContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import zh from '../i18n/zh';
import en from '../i18n/en';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'piena_lang';

function resolve(lang, key, vars = {}) {
  const dict = lang === 'en' ? en : zh;
  let str = dict[key] ?? zh[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
  return str;
}

export function LanguageProvider({ children }) {
  const { user: authUser } = useAuth();
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' ? 'en' : 'zh';
  });

  // Apply data-universe attribute on html element for CSS theming
  useEffect(() => {
    document.documentElement.setAttribute('data-universe', lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  // Sync from profile on login
  useEffect(() => {
    if (!isConfigured || !authUser) return;
    supabase.from('profiles').select('language').eq('id', authUser.id).single()
      .then(({ data }) => {
        if (data?.language && data.language !== lang) {
          setLangState(data.language);
        }
      });
  }, [authUser]);

  const setLang = async (l) => {
    setLangState(l);
    if (isConfigured && authUser) {
      await supabase.from('profiles').update({ language: l }).eq('id', authUser.id);
    }
  };

  const t = (key, vars) => resolve(lang, key, vars);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
```

- [ ] **Step 4: Commit**

```bash
git add client/src/contexts/LanguageContext.jsx client/src/i18n/zh.js client/src/i18n/en.js
git commit -m "feat: LanguageContext + 双语词典"
```

---

### Task 3: CSS Theme — English Universe Colors

**Files:**
- Modify: `client/src/index.css`

**Interfaces:**
- Produces: `--color-nav-bg` CSS variable; `html[data-universe="en"]` overrides for sage/success/nav colors

- [ ] **Step 1: Add `--color-nav-bg` to `:root` and English overrides**

In `client/src/index.css`, inside the `@theme {` block, add after `--color-error`:
```css
  --color-nav-bg:           rgba(44,48,37,0.97);
```

After the closing `}` of `@theme`, add:
```css
/* ── English universe color overrides ─────────── */
html[data-universe="en"] {
  --color-sage:             #8BABC9;
  --color-sage-dark:        #5B7EA6;
  --color-sage-muted:       #C5D8EC;
  --color-success:          #4A7BA6;
  --color-nav-bg:           rgba(30,45,72,0.97);
}
```

Also update the scrollbar thumb lines (they use hardcoded values):
- Find `::-webkit-scrollbar-thumb   { background: #a4b9b5;` → change to `background: var(--color-sage);`
- Find `::-webkit-scrollbar-thumb:hover { background: #7d9b96;` → change to `background: var(--color-sage-dark);`

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "feat: CSS 英文宇宙主题色变量"
```

---

### Task 4: Wire LanguageProvider into main.jsx + App.jsx leaderboard redirect

**Files:**
- Modify: `client/src/main.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: `LanguageProvider` from `../contexts/LanguageContext`
- Produces: `useLanguage()` available throughout the app; `/leaderboard` redirects to `/discover` in English mode

- [ ] **Step 1: Add LanguageProvider to main.jsx**

In `client/src/main.jsx`, add import:
```jsx
import { LanguageProvider } from './contexts/LanguageContext.jsx'
```

Wrap the provider between `AuthProvider` and `UserProvider`:
```jsx
<AuthProvider>
  <LanguageProvider>
    <UserProvider>
      ...
```

- [ ] **Step 2: Redirect leaderboard in English mode (App.jsx)**

In `client/src/App.jsx`, add import at top:
```jsx
import { useLanguage } from './contexts/LanguageContext';
```

Replace the leaderboard route:
```jsx
// OLD:
<Route path="/leaderboard" element={<PrivateRoute><Layout><Leaderboard /></Layout></PrivateRoute>} />

// NEW — add LeaderboardRoute helper before App():
function LeaderboardRoute() {
  const { lang } = useLanguage();
  if (lang === 'en') return <Navigate to="/discover" replace />;
  return <PrivateRoute><Layout><Leaderboard /></Layout></PrivateRoute>;
}

// and use it:
<Route path="/leaderboard" element={<LeaderboardRoute />} />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/main.jsx client/src/App.jsx
git commit -m "feat: 注入 LanguageProvider，英文模式屏蔽积分榜路由"
```

---

### Task 5: Navbar — Universe Toggle + Color Updates

**Files:**
- Modify: `client/src/components/Navbar.jsx`

**Interfaces:**
- Consumes: `useLanguage()` → `{ lang, setLang, t }`
- Produces: 中/EN toggle in both desktop and mobile top bar; leaderboard icon hidden in EN; navbar bg uses `var(--color-nav-bg)`

- [ ] **Step 1: Add imports and hook**

At top of Navbar.jsx, add:
```jsx
import { useLanguage } from '../contexts/LanguageContext';
```

Inside the `Navbar()` function, add after the existing hooks:
```jsx
const { lang, setLang, t } = useLanguage();
```

- [ ] **Step 2: Add UniverseToggle component (add above Navbar export)**

```jsx
function UniverseToggle({ lang, setLang }) {
  return (
    <motion.button
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      whileTap={{ scale: 0.93 }}
      title={lang === 'zh' ? 'Switch to English' : '切换中文'}
      style={{
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: '14px',
        padding: '3px 10px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 700,
        color: 'rgba(232,228,220,0.85)',
        fontFamily: 'inherit',
        letterSpacing: '0.06em',
        lineHeight: 1.4,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
      }}
    >
      <span style={{ opacity: lang === 'zh' ? 1 : 0.45 }}>中</span>
      <span style={{ opacity: 0.3, fontSize: '9px' }}>|</span>
      <span style={{ opacity: lang === 'en' ? 1 : 0.45 }}>EN</span>
    </motion.button>
  );
}
```

- [ ] **Step 3: Mobile top bar — add toggle, hide leaderboard in EN, use CSS var for bg**

In the mobile top bar `<div>` (the one with `background: 'rgba(44,48,37,0.97)'`):
- Change `background: 'rgba(44,48,37,0.97)'` → `background: 'var(--color-nav-bg)'`

In the left icon group (where `leaderboardIcon` is rendered):
```jsx
{!guest && (
  <>
    <OnboardingButton />
    {lang === 'zh' && <TopIconButton icon={leaderboardIcon} label={t('nav.leaderboard')} onClick={() => navigate('/leaderboard')} />}
    <TopIconButton icon={findFriendsIcon} label={t('nav.find_friends')} onClick={() => setShowDebaterModal(true)} />
  </>
)}
```

In the right section (where `NotificationBell isMobile` is), add `UniverseToggle` before the bell:
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '40px', justifyContent: 'flex-end' }}>
  <UniverseToggle lang={lang} setLang={setLang} />
  {guest ? (
    <motion.button ... >{t('nav.login')}</motion.button>
  ) : (
    <NotificationBell isMobile />
  )}
</div>
```

- [ ] **Step 4: Desktop nav — add toggle, CSS var bg, translated labels**

In the desktop `<nav>`:
- Change `background: 'rgba(44,48,37,0.97)'` → `background: 'var(--color-nav-bg)'`

In the `NAV` array (top of file), change to use `t()` — but `NAV` is defined outside the component so we can't use hooks there. Instead, compute nav items inside the component:
```jsx
// Replace the NAV constant at the top with:
const NAV_DEFS = [
  { to: '/discover', labelKey: 'nav.discover', icon: homeIcon },
  { to: '/review', labelKey: 'nav.review', icon: reviewIcon },
  { to: '/chat', labelKey: 'nav.chat', icon: chatIcon },
];
```

Inside `Navbar()`, after adding `useLanguage()`:
```jsx
const nav = NAV_DEFS.map(d => ({ ...d, label: t(d.labelKey) }));
```

Then replace `{NAV.map(...)}` with `{nav.map(...)}`.

In the right section, add `UniverseToggle` before `NotificationBell`:
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, marginLeft: '40px' }}>
  <UniverseToggle lang={lang} setLang={setLang} />
  {guest ? ( ... login button with {t('nav.login')} ... ) : (
    <>
      <NotificationBell />
      <Link to="/me">...</Link>
    </>
  )}
</div>
```

Update the login button label in both mobile and desktop to use `{t('nav.login')}`.

Update the profile avatar's active/inactive colors to use CSS vars:
```jsx
// avatar background:
backgroundColor: pathname === '/me' ? 'var(--color-sage)' : 'var(--color-sage-dark)',
// border:
border: pathname === '/me' ? '2px solid rgba(164,185,181,0.6)' : '2px solid transparent',
```

Update nav underline color:
```jsx
// In NavTab, the underline motion.div:
backgroundColor: 'var(--color-sage)',
```

- [ ] **Step 5: Mobile bottom nav — update tab labels and avatar colors**

In `MobileBottomNav`, the `tabs` array uses hardcoded strings. Change:
```jsx
const { t } = useLanguage();
const tabs = [
  { to: '/discover', label: t('nav.home'), icon: homeIcon },
  { to: '/review', label: t('nav.review'), icon: reviewIcon },
  { to: '/chat', label: t('nav.chat'), icon: chatIcon, dot: totalUnread > 0 },
  { to: '/me', label: t('nav.profile'), profile: true },
];
```

Update avatar background in `MobileBottomNav`:
```jsx
background: active ? 'var(--color-sage)' : 'var(--color-sage-dark)',
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Navbar.jsx
git commit -m "feat: Navbar 双宇宙切换按钮 + 英文主题色"
```

---

### Task 6: Discover Page

**Files:**
- Modify: `client/src/pages/Discover.jsx`

**Interfaces:**
- Consumes: `useLanguage()` → `{ lang, t }`
- Produces: Recruit hall title translates; feed passes `p_lang` to RPC; filter/role chips translate; LeaderboardCard hidden in EN

- [ ] **Step 1: Add imports and hook**

Add at top:
```jsx
import { useLanguage } from '../contexts/LanguageContext';
```

Add `const { lang, t } = useLanguage();` inside each component that needs translation (MiniProfile, LeaderboardCard, PeopleSuggestions, MyRecruits, EditRecruitModal, RecruitModal, TeammatesTab, CenterFeed, Discover).

- [ ] **Step 2: Update FEED_FILTERS display and CenterFeed title**

`FEED_FILTERS` stays as zh canonical values (`['全部', '我的', '好友', '找队友', '找评委', '找教练', '其他']`). In the filter button render, use `t('filter.' + f)` for display:
```jsx
{FEED_FILTERS.map(f => (
  <button key={f} onClick={() => toggleFilter(f)} style={{ ... }}>
    {t('filter.' + f)}
  </button>
))}
```

In `ROLE_OPTIONS`, keep zh values. In role chip display, use `t('role.' + (p.role || '其他'))`.

In `CenterFeed`, update title:
```jsx
<p ...>{t('discover.recruit_hall')}</p>
<motion.button onClick={...}>{t('discover.post_btn')}</motion.button>
```

- [ ] **Step 3: Pass p_lang to get_recruit_feed**

In `TeammatesTab`, the `loadPosts` function:
```jsx
const { data: postData } = await supabase.rpc('get_recruit_feed', {
  p_roles: filters.length ? filters : null,
  p_seed: seed,
  p_limit: 15,
  p_lang: lang,
});
```

Also add `lang` to the `useEffect` dependency array:
```jsx
useEffect(() => { loadPosts(); }, [refreshKey, filters, seed, lang]);
```

- [ ] **Step 4: Pass language when inserting a recruit post (RecruitModal)**

In `RecruitModal` handleSubmit, add `language: lang` to the insert:
```jsx
await supabase.from('recruit_posts').insert({
  user_id: selfId,
  role: form.role,
  note: form.note.trim(),
  language: lang,
});
```

- [ ] **Step 5: Translate all strings in Discover.jsx**

Replace hardcoded strings throughout:
- `'加载中…'` → `t('discover.loading')` or `t('common.loading')`
- `'还没有招募帖'` → `t('discover.no_posts')`
- `'没有符合筛选的招募'` → `t('discover.no_match')`
- `'成为第一个发起招募的人…'` → `t('discover.be_first')`
- `'试试切换其他分类…'` → `t('discover.try_other')`
- `'[展开]'` → `t('discover.expand')`
- `'{n} 位共同好友'` → `t('discover.mutual_friends', { count: d.mutual_count })`
- `'同校'` → `t('discover.same_school')`
- `'+ 加好友'` → `t('discover.add_friend')`
- `'已发送'` → `t('discover.friend_sent')`
- `'接受'` → `t('discover.friend_accept')`
- `'打个招呼（可选）'` → `t('discover.say_hi')` (placeholder)
- `'发送'` → `t('discover.send')`
- `'发现更多辩手 →'` → `t('discover.find_more')`
- `'你可能认识'` → `t('discover.people_know')`
- `'我的撇捺积分'` → `t('discover.my_points')`
- `'我的招募'` → `t('discover.my_recruits')`
- `'还没有自己的招募帖'` → `t('discover.no_my_recruits')`
- `'换一批'` title → `t('discover.refresh')`
- RecruitModal: `'发起招募'` → `t('recruit.title')`, `'身份 *'` → `t('recruit.role_label')`, `'详情 *'` → `t('recruit.note_label')`, placeholder → `t('recruit.note_placeholder')`, `'发布'` → `t('recruit.submit')`, `'发布中…'` → `t('recruit.submitting')`, error → `t('recruit.error')`
- EditRecruitModal: similar using `recruit.edit_title`, `recruit.save`, `recruit.saving`, `recruit.save_error`
- Archive/delete: `t('discover.archive')`, `t('discover.unarchive')`, `t('discover.archived_badge')`, `t('discover.delete')`

- [ ] **Step 6: Hide LeaderboardCard in English mode**

In the `CenterFeed` / desktop left rail:
```jsx
// In left aside:
<MiniProfile />
{lang === 'zh' && <LeaderboardCard />}
```

`LeaderboardCard` is rendered in the left rail of the Discover desktop layout. Wrap it:
```jsx
// In the left <aside>:
<MiniProfile />
{lang === 'zh' && <LeaderboardCard />}
```

Also translate `MiniProfile` strings: `'查看我的档案'` → `t('profile.view')`, `'好友'` → `t('profile.friends')`, `'平均分'` → `t('profile.avg_score')`, `'胜率'` → `t('profile.win_rate')`.

- [ ] **Step 7: Translate PeopleSuggestions and MiniProfile accent colors to CSS vars**

In `PeopleSuggestions`, change `color: '#7d9b96'` (add friend button) → `color: 'var(--color-sage-dark)'` and `border: '1px solid rgba(125,155,150,0.35)'` stays (it's semi-transparent so adapts with the variable).

In `MiniProfile` gradient banner: `rgba(125,155,150,0.4), rgba(90,143,122,0.3)` → add a CSS var approach or just leave as-is (subtle enough).

Change MiniProfile stat accent `color: '#7d9b96'` → `color: 'var(--color-sage-dark)'`.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Discover.jsx
git commit -m "feat: Discover 页双语化 + 招募帖语言标记"
```

---

### Task 7: Profile Page

**Files:**
- Modify: `client/src/pages/Profile.jsx`

**Interfaces:**
- Consumes: `useLanguage()` → `{ lang, t }`

- [ ] **Step 1: Add import and hook**

Add `import { useLanguage } from '../contexts/LanguageContext';`

Add `const { lang, t } = useLanguage();` in `Profile`, `SettingsModal`, `FriendsModal`, `MatchCard`.

- [ ] **Step 2: Translate SettingsModal**

Replace every hardcoded string in `SettingsModal`:
- `'设置'` → `t('settings.title')`
- `'更改用户名'` → `t('settings.username_section')`
- `` `当前：@${user.username}` `` → `t('settings.username_current', { username: user.username })`
- `'新用户名（英文、数字、下划线）'` → `t('settings.username_placeholder')`
- `'确认修改'` (save button label) → `t('settings.confirm')`
- `'更改邮箱'` → `t('settings.email_section')`
- `` `当前：${user.email}` `` → `t('settings.email_current', { email: authUser?.email ?? '' })`
- `'新邮箱'` → `t('settings.email_placeholder')`
- `'微信号'` → `t('settings.wechat_section')`
- `'输入微信号'` → `t('settings.wechat_placeholder')`
- `'档案可见性'` → `t('settings.privacy_section')`
- `'公开'` / `'仅好友'` → `t('settings.public')` / `t('settings.private')`
- `'退出登录'` → `t('settings.logout')`
- `'删除账号'` → `t('settings.delete')`
- Delete confirm string → `t('settings.delete_confirm')`
- `'已保存'` feedback → `t('settings.saved')`

- [ ] **Step 3: Translate Profile display**

In `Profile` default export and sub-components:
- `'编辑资料'` → `t('profile.edit')`
- `'设置'` title attr → `t('profile.settings')`
- `'出战记录'` → `t('profile.history')`
- `'暂无比赛记录'` → `t('profile.no_history')`
- `'发送消息'` → `t('profile.send_msg')`
- `'切磋对战'` → `t('profile.challenge')`
- `'+ 加好友'` → `t('profile.add_friend')`
- `'已发送好友申请'` → `t('profile.friend_sent')`
- `'取消申请'` → `t('profile.cancel_request')`
- `'✓ 已是好友'` → `t('profile.already_friends')`
- `'该用户档案不公开'` → `t('profile.private')`
- `'荣誉'` → `t('profile.honors')`
- `'简介'` → `t('profile.bio')`
- `'战队'` → `t('profile.team')`
- `'头像：点击头像图片上传…'` → `t('profile.avatar_hint')`
- `'好友'` stat label → `t('profile.friends')`
- `'平均分'` → `t('profile.avg_score')`
- `'胜率'` → `t('profile.win_rate')`
- `'场'` counter → `t('profile.matches_unit')`
- `'姓名'` / `'学校'` / `'地区'` / `'战队'` / `'简介'` edit labels → appropriate `t('profile.*')` keys
- `'保存'` / `'保存中…'` / `'取消'` → `t('profile.save')` / `t('profile.saving')` / `t('profile.cancel')`
- `'胜'` / `'负'` in MatchCard → `t('profile.won')` / `t('profile.lost')`

Update accent colors:
- Avatar ring/background colors using `#7d9b96` / `#a4b9b5` → `var(--color-sage-dark)` / `var(--color-sage)`
- Success text `#5a8f7a` → `var(--color-success)`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Profile.jsx
git commit -m "feat: Profile 页双语化"
```

---

### Task 8: Network + Chat + Login Pages

**Files:**
- Modify: `client/src/pages/Network.jsx`
- Modify: `client/src/pages/Chat.jsx`
- Modify: `client/src/pages/Login.jsx`

- [ ] **Step 1: Network.jsx**

Add `import { useLanguage } from '../contexts/LanguageContext';` and `const { t } = useLanguage();`.

Replace strings:
- Page title `'辩手圈'` → `t('network.title')`
- `'好友 ({n})'` → `t('network.friends_tab', { count: n })`
- `'待处理 ({n})'` → `t('network.pending_tab', { count: n })`
- Search placeholder `'搜索辩手'` → `t('network.search')`
- `'认识新朋友'` → `t('network.find_new')`
- `'还没有好友'` → `t('network.no_friends')`
- `'没有待处理的好友请求'` → `t('network.no_pending')`
- `'接受'` → `t('network.accept')`
- `'拒绝'` → `t('network.decline')`
- `'发消息'` → `t('network.message')`
- `'查看'` → `t('network.view')`

- [ ] **Step 2: Chat.jsx**

Add `import { useLanguage } from '../contexts/LanguageContext';` and `const { t } = useLanguage();`.

Replace strings:
- `'消息'` heading → `t('chat.title')`
- `'还没有消息'` empty state → `t('chat.empty')`
- `'发消息…'` placeholder → `t('chat.placeholder')`
- `'发送'` button → `t('chat.send')`
- `'今天'` / `'昨天'` date separators → `t('chat.today')` / `t('chat.yesterday')`
- `'选择一个对话'` right-panel empty → `t('chat.select')`
- `'新消息'` → `t('chat.new')`

- [ ] **Step 3: Login.jsx**

Add `import { useLanguage } from '../contexts/LanguageContext';` and `const { t } = useLanguage();`.

Replace strings:
- `'欢迎来到撇捺'` → `t('login.welcome')`
- `'辩手的角斗场'` → `t('login.tagline')`
- `'邮箱'` placeholder/label → `t('login.email')`
- `'密码'` → `t('login.password')`
- `'登录'` button → `t('login.login')`
- `'注册'` button → `t('login.register')`
- `'忘记密码？'` → `t('login.forgot')`
- `'发送重置邮件'` → `t('login.reset_send')`
- `'返回'` → `t('login.back')`
- `'已有账户？登录'` → `t('login.have_account')`
- `'还没有账户？注册'` → `t('login.no_account')`
- `'登录中…'` → `t('login.logging_in')`
- `'注册中…'` → `t('login.registering')`
- `'发送中…'` → `t('login.sending')`
- `'重置邮件已发送…'` → `t('login.reset_sent')`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Network.jsx client/src/pages/Chat.jsx client/src/pages/Login.jsx
git commit -m "feat: Network / Chat / Login 页双语化"
```

---

### Task 9: Upload + RecordMatch + Review + Report Pages (+ Session Language Tagging)

**Files:**
- Modify: `client/src/pages/Upload.jsx`
- Modify: `client/src/pages/RecordMatch.jsx`
- Modify: `client/src/pages/Review.jsx`
- Modify: `client/src/pages/Report.jsx`
- Modify: `client/src/contexts/ReviewJobContext.jsx`

- [ ] **Step 1: Add language to session inserts**

Every place a session is inserted, add `language: lang`:

**Upload.jsx** — find the `.from('sessions').insert({...})` call, add `language: lang` to the payload. Add `const { lang, t } = useLanguage();` at top.

**RecordMatch.jsx** — same: find `.from('sessions').insert({...})`, add `language: lang`. Add hook.

**ReviewJobContext.jsx** — find `.from('sessions').insert({...payload, user_id: selfId})`, add `language` to payload. ReviewJobContext needs to receive `lang` somehow — add `useLanguage()` hook inside `ReviewJobProvider`.

- [ ] **Step 2: Translate Upload.jsx**

Add `const { lang, t } = useLanguage();`.

Replace:
- Page title `'上传录音'` → `t('upload.title')`
- `'选择录音文件'` / drag text → `t('upload.select_file')` / `t('upload.drop')`
- Format hint → `t('upload.formats')`
- Tournament placeholder → `t('upload.tournament')`
- Date label → `t('upload.date')`
- Result label → `t('upload.result')`
- `'赢了'` / `'输了'` → `t('upload.won')` / `t('upload.lost')`
- Submit button → `t('upload.submit')` / `t('upload.submitting')`
- Credits display → `t('upload.credits', { count: credits })`
- No credits → `t('upload.no_credits')`

- [ ] **Step 3: Translate RecordMatch.jsx**

Add `const { lang, t } = useLanguage();`.

Replace:
- Title `'记录比赛'` → `t('record.title')`
- Tournament → `t('record.tournament')`
- Date → `t('record.date')`
- Result → `t('record.result')`
- `'赢了'` / `'输了'` → `t('record.won')` / `t('record.lost')`
- Position label → `t('record.position')`
- Debaters label → `t('record.debaters')`
- MVP → `t('record.mvp')`
- Notes → `t('record.notes')`
- Motion → `t('record.motion')`
- Submit → `t('record.submit')` / `t('record.saving')`
- Success/error → `t('record.saved')` / `t('record.error')`

- [ ] **Step 4: Translate Review.jsx**

Add hook. Replace:
- `'AI 复盘'` → `t('review.title')`
- `'上传录音'` → `t('review.upload')`
- `'记录比赛'` → `t('review.record')`
- `'暂无比赛记录'` → `t('review.no_sessions')`
- `'开始复盘'` → `t('review.start')`
- `'分析中…'` → `t('review.analyzing')`

- [ ] **Step 5: Translate Report.jsx**

Add hook. Replace:
- Title `'比赛详情'` → `t('report.title')`
- `'评分'` → `t('report.score')`
- `'逻辑'` / `'立论'` / `'配合'` → `t('report.logic')` / `t('report.argumentation')` / `t('report.teamwork')`
- `'AI 分析'` → `t('report.analysis')`
- `'删除记录'` → `t('report.delete')`
- Delete confirm string → `t('report.delete_confirm')`
- `'发言记录'` → `t('report.transcript')`
- `'暂无 AI 分析'` → `t('report.no_analysis')`

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Upload.jsx client/src/pages/RecordMatch.jsx \
        client/src/pages/Review.jsx client/src/pages/Report.jsx \
        client/src/contexts/ReviewJobContext.jsx
git commit -m "feat: 上传/记录/复盘/详情页双语化 + session 语言标记"
```

---

### Task 10: Leaderboard Page + All Components/Modals

**Files:**
- Modify: `client/src/pages/Leaderboard.jsx`
- Modify: `client/src/components/OnboardingModal.jsx`
- Modify: `client/src/components/LoginPromptModal.jsx`
- Modify: `client/src/components/NotificationBell.jsx`
- Modify: `client/src/components/DebaterModal.jsx`
- Modify: `client/src/components/TeamPicker.jsx`
- Modify: `client/src/components/ReviewJobWidget.jsx`
- Modify: `client/src/components/AnalysisOverlay.jsx`
- Modify: `client/src/components/ConfirmModal.jsx`
- Modify: `client/src/components/EditMatchModal.jsx`

- [ ] **Step 1: Translate Leaderboard.jsx**

Add `const { t } = useLanguage();`.

Replace:
- `'撇捺积分榜'` → `t('lb.title')`
- `'一辩'` through `'四辩'` → `t('lb.pos1')` through `t('lb.pos4')`
- `'全能'` → `t('lb.overall')`
- `'名次'` / `'积分'` / `'场次'` / `'MVP'` column headers → `t('lb.rank')` / `t('lb.points')` / `t('lb.matches')` / `t('lb.mvp')`
- `'我的数据'` section → `t('lb.my_stats')`
- `'暂无数据'` → `t('lb.no_data')`
- `'加载中…'` → `t('lb.loading')`

- [ ] **Step 2: Translate each component**

For each component, add `import { useLanguage } from '../contexts/LanguageContext';` and the `const { t } = useLanguage();` hook, then replace Chinese strings with `t()` calls.

**ConfirmModal.jsx** — Typically has `'确认'` / `'取消'` → `t('common.confirm')` / `t('common.cancel')`. Also translate the message prop if it's hardcoded (it's usually passed as prop, so just translate the default button labels).

**LoginPromptModal.jsx** — Translate the prompt text and buttons.

**DebaterModal.jsx** — Translate search and people suggestion strings.

**NotificationBell.jsx** — Translate `'通知'`, `'暂无通知'`, notification templates using `t('notif.friend_request', { name })`, etc.

**TeamPicker.jsx** — Translate team search/select UI strings.

**ReviewJobWidget.jsx** — Translate `'分析中…'`, status messages.

**AnalysisOverlay.jsx** — Translate overlay messages.

**EditMatchModal.jsx** — Translate form labels (mirror RecordMatch translations using `record.*` keys).

**OnboardingModal.jsx** — Translate step text, `'跳过'` → `t('onboard.skip')`, `'下一步'` → `t('onboard.next')`, `'开始使用'` → `t('onboard.done')`. Note: the onboarding content is long Chinese narrative — decide whether to fully translate or keep in zh for now. For v1, translate the button labels and titles at minimum; body text can be translated per-slide.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Leaderboard.jsx \
        client/src/components/OnboardingModal.jsx \
        client/src/components/LoginPromptModal.jsx \
        client/src/components/NotificationBell.jsx \
        client/src/components/DebaterModal.jsx \
        client/src/components/TeamPicker.jsx \
        client/src/components/ReviewJobWidget.jsx \
        client/src/components/AnalysisOverlay.jsx \
        client/src/components/ConfirmModal.jsx \
        client/src/components/EditMatchModal.jsx
git commit -m "feat: 积分榜 + 所有组件双语化"
```

---

### Task 11: Browser Verification

- [ ] **Step 1: Start dev server**

```bash
cd client && npm run dev
```

- [ ] **Step 2: Verify Chinese universe (default)**

Open http://localhost:5183. Confirm:
- Navbar shows olive/green background, "中 | EN" toggle with 中 lit
- Recruit hall shows "招募大厅", Chinese role chips
- Desktop left rail shows leaderboard card
- `/leaderboard` loads normally
- Post a recruit post → check Supabase `recruit_posts.language` = 'zh'

- [ ] **Step 3: Verify English universe**

Click EN in navbar toggle. Confirm:
- Navbar background shifts to dark navy `rgba(30,45,72,0.97)`
- Active tab underline is steel blue
- All nav labels in English
- Recruit hall shows "Recruiting Hall", English role chips
- Desktop left rail leaderboard card is gone
- Mobile leaderboard icon in top bar is gone
- `/leaderboard` redirects to `/discover`
- Post a recruit post → check `recruit_posts.language` = 'en'
- Record a match → check `sessions.language` = 'en'

- [ ] **Step 4: Verify preference persistence**

Reload page. EN toggle should still be selected (localStorage). Log in → check `profiles.language` updated in Supabase.

- [ ] **Step 5: Verify feed separation**

In EN mode: confirm only EN-tagged recruit posts appear in the feed. In ZH mode: only ZH posts.
