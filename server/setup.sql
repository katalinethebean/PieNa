-- 不是辩棍 数据库初始化 SQL
-- 请在 Supabase SQL Editor 中运行此文件

-- 1. profiles 表
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  email text,
  name text,
  school text,
  region text,
  bio text default '',
  team text default '',
  honors text[] default '{}',
  formats text[] default '{}',
  is_public boolean default false,
  avg_score float default 0,
  credits integer default 3,
  avatar_url text,
  user_wechat text default '',
  created_at timestamp with time zone default now()
);

-- Migration: add missing columns if table already exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='username') then
    alter table profiles add column username text unique;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='email') then
    alter table profiles add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='bio') then
    alter table profiles add column bio text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='team') then
    alter table profiles add column team text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='honors') then
    alter table profiles add column honors text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='credits') then
    alter table profiles add column credits integer default 3;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='avatar_url') then
    alter table profiles add column avatar_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='user_wechat') then
    alter table profiles add column user_wechat text default '';
  end if;
end $$;

-- Migration: add missing columns to sessions if table already exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='side') then
    alter table sessions add column side text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='won') then
    alter table sessions add column won boolean;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='score') then
    alter table sessions add column score text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='tournament') then
    alter table sessions add column tournament text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='debaters') then
    alter table sessions add column debaters text[] default '{}';
  end if;
end $$;

-- Migration: add mvp_flags to sessions (parallel array to debaters; marks 佳辩/best-debater per slot)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='mvp_flags') then
    alter table sessions add column mvp_flags boolean[] default '{}';
  end if;
end $$;

-- Migration: add notes (备注) to sessions
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='notes') then
    alter table sessions add column notes text default '';
  end if;
end $$;

-- Migration: add justification jsonb to sessions (stores per-dimension AI feedback)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='justification') then
    alter table sessions add column justification jsonb;
  end if;
end $$;

-- Migration: replace old 6-score rubric with new rubric (逻辑/反驳/论点/表达/团队/论据)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='logic_score') then
    alter table sessions add column logic_score float;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='argumentation_score') then
    alter table sessions add column argumentation_score float;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='sessions' and column_name='teamwork_score') then
    alter table sessions add column teamwork_score float;
  end if;
end $$;

-- Migration: allow users to update/delete their own sessions (编辑/删除比赛记录)
do $$
begin
  if not exists (select 1 from pg_policies where tablename='sessions' and policyname='users can update own sessions') then
    create policy "users can update own sessions"
      on sessions for update
      using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='sessions' and policyname='users can delete own sessions') then
    create policy "users can delete own sessions"
      on sessions for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- 1b. username → email lookup function (SECURITY DEFINER bypasses RLS for unauthenticated login)
create or replace function get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from profiles where username = lower(p_username) limit 1;
$$;

grant execute on function get_email_by_username(text) to anon, authenticated;

create or replace function is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where username = lower(p_username));
$$;

grant execute on function is_username_available(text) to anon, authenticated;

-- 2. sessions 表
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  motion text,
  format text,
  role text,
  side text,
  won boolean,
  score text,
  tournament text,
  debaters text[] default '{}',
  mvp_flags boolean[] default '{}',
  notes text default '',
  date timestamp with time zone default now(),
  argument_score float,
  delivery_score float,
  rebuttal_score float,
  structure_score float,
  evidence_score float,
  fluency_score float,
  avg_score float,
  feedback text,
  transcript text,
  created_at timestamp with time zone default now()
);

-- 3. credits 表
create table if not exists credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles(id) on delete cascade,
  balance integer default 3,
  created_at timestamp with time zone default now()
);

-- 4. 启用 Row Level Security
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table credits enable row level security;

-- 5. profiles 策略
-- 用户可以读取自己的档案
create policy "users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- 公开档案对所有已登录用户可见
create policy "public profiles viewable by authenticated users"
  on profiles for select
  using (is_public = true and auth.role() = 'authenticated');

-- 用户可以更新自己的档案
create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- 用户可以插入自己的档案
create policy "users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- 6. sessions 策略
create policy "users can view own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "users can insert own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

-- 7. credits 策略
create policy "users can view own credits"
  on credits for select
  using (auth.uid() = user_id);

create policy "users can insert own credits"
  on credits for insert
  with check (auth.uid() = user_id);

-- 8. friend_requests 表
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique (sender_id, receiver_id)
);

alter table friend_requests enable row level security;

create policy "users can view own friend requests"
  on friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "users can send friend requests"
  on friend_requests for insert
  with check (auth.uid() = sender_id);

create policy "users can update received requests"
  on friend_requests for update
  using (auth.uid() = receiver_id or auth.uid() = sender_id);

create policy "users can delete own friend requests"
  on friend_requests for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- 8b. match_invites 表：记录比赛时 @提及好友，对方可选择是否也把这场比赛存进自己的档案
create table if not exists match_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique (session_id, receiver_id)
);

alter table match_invites enable row level security;

create policy "users can view own match invites"
  on match_invites for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "users can send match invites"
  on match_invites for insert
  with check (auth.uid() = sender_id);

create policy "users can update received match invites"
  on match_invites for update
  using (auth.uid() = receiver_id);

create policy "users can delete own match invites"
  on match_invites for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- 8c. messages 表：好友之间的简单私信。没有 conversation_id，一段对话就是
-- (sender_id, receiver_id) 这对用户；解除好友后历史记录仍可读，但不能再发新消息。
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamp with time zone default now(),
  read_at timestamp with time zone
);

create index if not exists messages_pair_idx on messages (sender_id, receiver_id, created_at);
create index if not exists messages_receiver_idx on messages (receiver_id, created_at);

alter table messages enable row level security;

create policy "users can view own messages"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Migration: public 账号可被任何登录用户私信；private 账号仍仅限好友
drop policy if exists "friends can send messages" on messages;
drop policy if exists "friends or public can receive messages" on messages;

create policy "friends or public can receive messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and (
      exists (select 1 from profiles p where p.id = messages.receiver_id and p.is_public = true)
      or exists (
        select 1 from friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.sender_id = auth.uid() and fr.receiver_id = messages.receiver_id)
            or (fr.receiver_id = auth.uid() and fr.sender_id = messages.receiver_id)
          )
      )
    )
  );

create policy "receiver can mark messages read"
  on messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- RLS is row-level only; without this, a receiver could rewrite the content
-- of a message they received since the update policy only checks row ownership.
revoke update on messages from authenticated;
grant update (read_at) on messages to authenticated;

-- 9. recruit_posts 表
create table if not exists recruit_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  tournament text,
  positions text default '',
  role text,
  contact text not null,
  note text default '',
  created_at timestamp with time zone default now()
);

-- Migration: recruit_posts 从「赛事招募」改为「招募大厅」，赛事名称不再必填，新增身份字段
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='recruit_posts' and column_name='role') then
    alter table recruit_posts add column role text;
  end if;
  alter table recruit_posts alter column tournament drop not null;
end $$;

-- Migration: 招募帖支持归档（归档后仅本人在「我的招募」可见，不出现在公开招募大厅）
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='recruit_posts' and column_name='archived') then
    alter table recruit_posts add column archived boolean default false;
  end if;
end $$;

-- Migration: 招募帖不再收集联系方式，改为直接点进发帖人主页
do $$
begin
  alter table recruit_posts alter column contact drop not null;
end $$;

alter table recruit_posts enable row level security;

-- Migration: 招募帖可见性跟随发帖人的 public/private 设置——public 全服可见，private 仅好友（含本人）可见
drop policy if exists "recruit posts viewable by authenticated users" on recruit_posts;
drop policy if exists "recruit posts viewable by owner friends or public" on recruit_posts;

create policy "recruit posts viewable by owner friends or public"
  on recruit_posts for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = recruit_posts.user_id and p.is_public = true)
    or exists (
      select 1 from friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.sender_id = auth.uid() and fr.receiver_id = recruit_posts.user_id)
          or (fr.receiver_id = auth.uid() and fr.sender_id = recruit_posts.user_id)
        )
    )
  );

create policy "users can insert own recruit posts"
  on recruit_posts for insert
  with check (auth.uid() = user_id);

create policy "users can delete own recruit posts"
  on recruit_posts for delete
  using (auth.uid() = user_id);

create policy "users can update own recruit posts"
  on recruit_posts for update
  using (auth.uid() = user_id);

-- 8d. blocks 表：拉黑后对方无法向我发消息
create table if not exists blocks (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table blocks enable row level security;
create policy "users manage own blocks" on blocks for all using (auth.uid() = blocker_id);

-- 8e. conversation_settings 表：单方面清空/删除/备注（不影响对方）
create table if not exists conversation_settings (
  user_id uuid references profiles(id) on delete cascade,
  other_user_id uuid references profiles(id) on delete cascade,
  cleared_at timestamptz,       -- 在本端隐藏此时间点之前的消息
  hidden_after timestamptz,     -- 对话列表中隐藏此对话，直到有新消息
  note text check (char_length(note) <= 20),
  primary key (user_id, other_user_id)
);
alter table conversation_settings enable row level security;
create policy "users manage own conversation settings" on conversation_settings for all using (auth.uid() = user_id);

-- 更新 messages 发送策略：被拉黑的用户无法向拉黑方发消息
drop policy if exists "friends or public can receive messages" on messages;
create policy "friends or public can receive messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from blocks b
      where b.blocker_id = messages.receiver_id and b.blocked_id = auth.uid()
    )
    and (
      exists (select 1 from profiles p where p.id = messages.receiver_id and p.is_public = true)
      or exists (
        select 1 from friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.sender_id = auth.uid() and fr.receiver_id = messages.receiver_id)
            or (fr.receiver_id = auth.uid() and fr.sender_id = messages.receiver_id)
          )
      )
    )
  );

-- 9. 创建 Storage buckets
-- recordings bucket（私有）
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false)
  on conflict (id) do nothing;

-- avatars bucket（公开，头像需要公开访问）
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- avatars bucket 策略
create policy "avatars are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users can delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- 10. get_profile_view: 按隐私规则返回他人档案（SECURITY DEFINER 绕过 RLS）
-- 公开账号 / 好友 / 本人 → 完整资料（比赛记录仅本人可见，不对外返回）
-- 私密账号陌生人 → 仅 name(由前端缩写)/team/bio/头像/用户名
-- 注意：参数用 text（PostgREST/前端传来的是字符串），函数内转 uuid，
-- 避免「函数存在但签名不匹配」导致 RPC 返回 404
drop function if exists get_profile_view(uuid);

create or replace function get_profile_view(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid := p_id::uuid;
  v_viewer uuid := auth.uid();
  v_profile profiles;
  v_is_friend boolean := false;
  v_friend_count integer := 0;
  v_full jsonb;
  v_can_see_wechat boolean;
begin
  select * into v_profile from profiles where id = v_pid;
  if not found then
    return jsonb_build_object('not_found', true);
  end if;

  -- 该用户的好友总数
  select count(*) into v_friend_count
    from friend_requests
    where status = 'accepted' and (sender_id = v_pid or receiver_id = v_pid);

  -- 查看者是否为该用户的好友
  if v_viewer is not null then
    select exists(
      select 1 from friend_requests
      where status = 'accepted'
        and ((sender_id = v_viewer and receiver_id = v_pid)
          or (sender_id = v_pid and receiver_id = v_viewer))
    ) into v_is_friend;
  end if;

  -- 私密账号 + 非本人 + 非好友 → 有限字段
  if v_profile.is_public = false and v_viewer is distinct from v_pid and not v_is_friend then
    return jsonb_build_object(
      'profile', jsonb_build_object(
        'id', v_profile.id,
        'username', v_profile.username,
        'name', v_profile.name,
        'avatar_url', v_profile.avatar_url,
        'team', v_profile.team,
        'bio', v_profile.bio,
        'is_public', false,
        'friend_count', v_friend_count
      ),
      'sessions', '[]'::jsonb,
      'limited', true
    );
  end if;

  -- 公开 / 好友 / 本人 → 完整资料；好友可见 sessions，陌生人不可见
  v_can_see_wechat := v_is_friend or v_viewer = v_pid;
  v_full := (to_jsonb(v_profile) - 'user_wechat')
    || jsonb_build_object('friend_count', v_friend_count)
    || jsonb_build_object('wechat', case when v_can_see_wechat then v_profile.user_wechat else null end);

  if v_is_friend or v_viewer = v_pid then
    return jsonb_build_object(
      'profile', v_full,
      'sessions', (
        select coalesce(jsonb_agg(to_jsonb(s) order by s.date desc), '[]'::jsonb)
        from sessions s where s.user_id = v_pid
      ),
      'limited', false
    );
  end if;

  return jsonb_build_object('profile', v_full, 'sessions', '[]'::jsonb, 'limited', false);
end;
$$;

grant execute on function get_profile_view(text) to authenticated, anon;

-- 11. get_friend_network: 返回当前用户所有好友的档案（供「关系网」页面使用）
-- 好友之间互相可见完整资料，不受 is_public 限制（与 get_profile_view 的好友分支一致）
create or replace function get_friend_network()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_friends jsonb;
begin
  if v_self is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'username', p.username,
    'school', p.school,
    'region', p.region,
    'avg_score', p.avg_score,
    'is_public', p.is_public,
    'avatar_url', p.avatar_url,
    -- debaters 存的是 "@username  姓名" 而非裸 "@username"，必须做前缀匹配而不是相等比较
    'shared_sessions', (
      select count(*)
      from sessions s
      where s.user_id = v_self
        and exists (
          select 1 from unnest(s.debaters) d
          where d ~ ('^@' || p.username || '(\s|$)')
        )
    ),
    'total_sessions', (select count(*) from sessions s where s.user_id = p.id),
    'win_rate', (
      select case when count(*) = 0 then null
             else round(count(*) filter (where s.won = true)::numeric / count(*), 3)
             end
      from sessions s where s.user_id = p.id
    )
  )), '[]'::jsonb)
    into v_friends
    from friend_requests fr
    join profiles p on p.id = (case when fr.sender_id = v_self then fr.receiver_id else fr.sender_id end)
    where fr.status = 'accepted' and (fr.sender_id = v_self or fr.receiver_id = v_self);

  return v_friends;
end;
$$;

grant execute on function get_friend_network() to authenticated;

-- 12. get_leaderboards: 全平台段位榜（一辩/二辩/三辩/四辩 + 全能），仅统计 @已注册用户
-- 每场比赛：出场 +100，胜利 +100，佳辩（mvp_flags[i]）+100；未关联到注册账号的手打姓名不计分
-- 一辩~四辩四个榜单用循环生成，避免重复；全能榜结构不同（不按 position 分组），单独查询
-- 附加返回 "self"：调用者本人的姓名/头像 + 在每个榜的场次/佳辩次数/排名/积分（不管有没有进前 50 都返回；
-- 从未参与该位置则 rank 为 null，由前端显示为 "-"；rank 超过 50 由前端显示为 "50+"）
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
    where lower(substring(s.debaters[v_position] from '^@(\S+)')) = v_self_username;

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

-- 13. accept_match_invite: 好友接受"比赛记录邀请"后，把这场比赛复制进自己的档案
-- SECURITY DEFINER 绕过 RLS：接收者本来无权读取发送者的 session 行，这里在服务端安全地代为读取+复制
create or replace function accept_match_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite match_invites;
  v_session sessions;
begin
  select * into v_invite from match_invites
    where id = p_invite_id and receiver_id = auth.uid() and status = 'pending';
  if not found then
    raise exception '邀请不存在或已处理';
  end if;

  select * into v_session from sessions where id = v_invite.session_id;
  if found then
    insert into sessions (
      user_id, motion, format, role, side, won, score, tournament,
      debaters, mvp_flags, notes, date
    ) values (
      auth.uid(), v_session.motion, v_session.format, v_session.role, v_session.side,
      v_session.won, v_session.score, v_session.tournament, v_session.debaters,
      v_session.mvp_flags, v_session.notes, v_session.date
    );
  end if;

  update match_invites set status = 'accepted' where id = p_invite_id;
end;
$$;

grant execute on function accept_match_invite(uuid) to authenticated;

-- 队伍表:主队选择器的联想/新建来源
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamp with time zone default now()
);

alter table teams enable row level security;

drop policy if exists "authenticated users can view teams" on teams;
create policy "authenticated users can view teams"
  on teams for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated users can add teams" on teams;
create policy "authenticated users can add teams"
  on teams for insert
  with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';

-- get_people_suggestions: BFS 两层好友推荐 + 同校加分
-- 算法：找好友的好友（排除自己/已是好友/已有请求），共同好友数为基础分，同校 +2，取前 3
create or replace function get_people_suggestions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid := auth.uid();
  v_self_school text;
  v_result jsonb;
begin
  if v_self is null then return '[]'::jsonb; end if;

  select school into v_self_school from profiles where id = v_self;

  with my_friends as (
    select case when fr.sender_id = v_self then fr.receiver_id else fr.sender_id end as friend_id
    from friend_requests fr
    where fr.status = 'accepted' and (fr.sender_id = v_self or fr.receiver_id = v_self)
  ),
  all_my_requests as (
    -- 所有和自己有关的 friend_request（无论状态），用于排除
    select case when sender_id = v_self then receiver_id else sender_id end as other_id
    from friend_requests
    where sender_id = v_self or receiver_id = v_self
  ),
  candidates as (
    -- 好友的好友，统计共同好友数
    select
      case when fr.sender_id = mf.friend_id then fr.receiver_id else fr.sender_id end as candidate_id,
      count(*) as mutual_count
    from friend_requests fr
    join my_friends mf on (fr.sender_id = mf.friend_id or fr.receiver_id = mf.friend_id)
    where fr.status = 'accepted'
      and case when fr.sender_id = mf.friend_id then fr.receiver_id else fr.sender_id end <> v_self
      and case when fr.sender_id = mf.friend_id then fr.receiver_id else fr.sender_id end not in (select friend_id from my_friends)
      and case when fr.sender_id = mf.friend_id then fr.receiver_id else fr.sender_id end not in (select other_id from all_my_requests)
    group by candidate_id
  )
  select coalesce(jsonb_agg(obj), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'username', p.username,
      'school', p.school,
      'avatar_url', p.avatar_url,
      'mutual_count', c.mutual_count,
      'same_school', (v_self_school is not null and p.school = v_self_school)
    ) as obj
    from candidates c
    join profiles p on p.id = c.candidate_id
    where p.is_public = true
    order by (c.mutual_count + case when v_self_school is not null and p.school = v_self_school then 2 else 0 end) desc
    limit 3
  ) ranked;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function get_people_suggestions() to authenticated;

-- recruit_likes 表
create table if not exists recruit_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references recruit_posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(post_id, user_id)
);
alter table recruit_likes enable row level security;
drop policy if exists "authenticated users can view recruit likes" on recruit_likes;
create policy "authenticated users can view recruit likes" on recruit_likes for select using (auth.role() = 'authenticated');
drop policy if exists "users can insert own recruit likes" on recruit_likes;
create policy "users can insert own recruit likes" on recruit_likes for insert with check (auth.uid() = user_id);
drop policy if exists "users can delete own recruit likes" on recruit_likes;
create policy "users can delete own recruit likes" on recruit_likes for delete using (auth.uid() = user_id);

-- notifications 表（点赞通知）
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  actor_id uuid references profiles(id) on delete cascade,
  post_id uuid references recruit_posts(id) on delete cascade,
  read boolean default false,
  created_at timestamp with time zone default now()
);
alter table notifications enable row level security;
drop policy if exists "users can view own notifications" on notifications;
create policy "users can view own notifications" on notifications for select using (auth.uid() = user_id);
drop policy if exists "users can update own notifications" on notifications;
create policy "users can update own notifications" on notifications for update using (auth.uid() = user_id);
-- 不开放直接 insert：通知只能由 security definer 触发器（notify_recruit_like）写入，
-- 否则任何登录用户都能伪造任意人的通知
drop policy if exists "authenticated users can insert notifications" on notifications;

-- 点赞时自动生成通知（不给自己发通知）
create or replace function notify_recruit_like()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, type, actor_id, post_id)
  select rp.user_id, 'recruit_like', NEW.user_id, NEW.post_id
  from recruit_posts rp
  where rp.id = NEW.post_id and rp.user_id <> NEW.user_id;
  return NEW;
end;
$$;
drop trigger if exists on_recruit_like on recruit_likes;
create trigger on_recruit_like after insert on recruit_likes for each row execute function notify_recruit_like();

-- review_sessions 表：复盘分析（/review 页）的历史记录，独立于 sessions（比赛档案）
create table if not exists review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  motion text,
  position text,
  overall_average float,
  scores jsonb,
  justification jsonb,
  created_at timestamp with time zone default now()
);

alter table review_sessions enable row level security;

drop policy if exists "users can view own review sessions" on review_sessions;
create policy "users can view own review sessions"
  on review_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own review sessions" on review_sessions;
create policy "users can insert own review sessions"
  on review_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own review sessions" on review_sessions;
create policy "users can delete own review sessions"
  on review_sessions for delete
  using (auth.uid() = user_id);

-- DEFINED 8维创造力评估框架（KDD 2026, github.com/tzwo/DEFINED）：
-- 发散思维（流畅性/原创性/灵活性）+ 聚合思维（针对性/逻辑性/有效性）+ 表达（清晰度/吸引力）。
-- fluency_score 复用最早期 rubric 的同名列，其余 7 列为新增。
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'sessions' and column_name = 'originality_score') then
    alter table sessions add column originality_score float;
    alter table sessions add column flexibility_score float;
    alter table sessions add column targetedness_score float;
    alter table sessions add column logicality_score float;
    alter table sessions add column effectiveness_score float;
    alter table sessions add column clarity_score float;
    alter table sessions add column appeal_score float;
  end if;
end$$;

-- Migration: 访客模式——公开账号的档案对未登录用户也可见（招募大厅访客浏览需要显示发帖人名字/学校/头像）
drop policy if exists "public profiles viewable by authenticated users" on profiles;
drop policy if exists "public profiles viewable by everyone" on profiles;

create policy "public profiles viewable by everyone"
  on profiles for select
  using (is_public = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 招募大厅信息流：get_recruit_feed —— 不再一次性 load 全平台所有帖子，
-- 而是像 Instagram feed 一样按「亲密度 + 新鲜度 + 热度 + 随机抖动」打分排序，
-- 每次刷新传入不同的 p_seed 就会重新洗牌、把不同的帖子顶到前面。
--
-- p_roles: 多选过滤（数组）。null/空数组/含 '全部' = 全部；
--          '好友' = 好友发的；其余按 role 精确匹配。多个值之间取并集(OR)。
-- p_seed : 前端每次刷新生成的随机种子，决定本次排序的随机分量
-- p_limit: 单次返回条数（默认 15，分页/刷新用）
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists get_recruit_feed(text, double precision, int);
create or replace function get_recruit_feed(
  p_roles text[] default null,
  p_seed double precision default 0,
  p_limit int default 15
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
      -- 可见性：本人 / 好友 / 公开账号（与 recruit_posts 的 RLS 保持一致）
      and (
        rp.user_id = auth.uid()
        or rp.user_id in (select fid from my_friends)
        or pr.is_public = true
      )
      -- 身份过滤（多选，取并集）
      and (
        p_roles is null or array_length(p_roles, 1) is null or '全部' = any(p_roles)
        or (rp.role = any(p_roles))
        or ('好友' = any(p_roles) and rp.user_id in (select fid from my_friends))
      )
  ),
  scored as (
    select v.*,
      (select count(*) from recruit_likes rl where rl.post_id = v.id) as like_count,
      -- 亲密度：好友 +2.0
      (case when v.is_friend then 2.0 else 0 end)
      -- 同校 +1.0
      + (case when v.school is not null and v.school = (select school from me) then 1.0 else 0 end)
      -- 热度：每个赞 +0.3（上限 1.5）
      + least(1.5, 0.3 * (select count(*) from recruit_likes rl where rl.post_id = v.id))
      -- 新鲜度：越新分越高，约 3 天线性衰减到 0
      + greatest(0, 3.0 - extract(epoch from (now() - v.created_at)) / 86400.0)
      -- 随机抖动：由 post id + 本次 seed 共同决定，[0,2) 区间，保证每次刷新重新洗牌
      + 2.0 * (('x' || substr(md5(v.id::text || p_seed::text), 1, 8))::bit(32)::bigint::double precision / 4294967295.0)
      as score
    from visible v
  )
  select id, user_id, role, note, created_at, name, school, avatar_url, like_count, is_friend
  from scored
  order by score desc
  limit greatest(1, least(50, p_limit));
$$;
grant execute on function get_recruit_feed(text[], double precision, int) to authenticated;

-- ============================================================
-- 迁移：注册时由数据库触发器创建 profile 行
-- 开启邮箱验证（Confirm email）后，signUp 不返回 session，
-- 客户端的 insert 会被 RLS 拦截。改由 auth.users 上的触发器
-- 用注册时写入的 metadata（username / name）在服务端创建档案。
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, email, is_public, credits)
  values (
    new.id,
    nullif(lower(new.raw_user_meta_data->>'username'), ''),
    coalesce(new.raw_user_meta_data->>'name', ''),
    lower(new.email),
    true,
    3
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- 绝不因档案创建失败而阻断注册本身
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 放在文件末尾，确保上面新建的表/函数都进入 PostgREST 的 schema cache
notify pgrst, 'reload schema';

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

notify pgrst, 'reload schema';
