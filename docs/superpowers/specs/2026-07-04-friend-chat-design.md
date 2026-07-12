# 好友私信（聊天）功能设计

## 背景与目标

在「撇捺」中加入好友之间的简单文字私信功能。目的不是把用户留在站内长期聊天，而是提供一个轻量的破冰/联系渠道——不做已读回执之外的复杂 IM 功能，不做消息自动过期清理（讨论后确认：文本消息存储成本可忽略，暂不实现 24 小时清除）。

## 范围

- 仅支持好友之间的一对一文字私信。
- 不支持群聊、附件、消息撤回/编辑。
- 不做自动过期清理。
- 不在顶部通知铃铛里提醒新私信；未读状态只在「聊天」nav tab 上用一个小红点表示。

## 数据模型

新增 `messages` 表（`server/setup.sql`），风格与已有的 `friend_requests` / `match_invites` 一致：

```sql
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table messages enable row level security;

create index if not exists messages_pair_idx on messages (sender_id, receiver_id, created_at);
create index if not exists messages_receiver_idx on messages (receiver_id, created_at);
```

没有单独的 `conversation_id` 表——一段对话就是 `(sender_id, receiver_id)` 这一对用户 ID，查询方式与 `friend_requests` 的 `.or(...)` 写法一致。

### RLS 策略（好友关系在数据库层强制，而不只是前端隐藏按钮）

```sql
create policy "users can view own messages"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "friends can send messages"
  on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.sender_id = auth.uid() and fr.receiver_id = messages.receiver_id)
          or (fr.receiver_id = auth.uid() and fr.sender_id = messages.receiver_id)
        )
    )
  );

create policy "receiver can mark messages read"
  on messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);
```

- `select` 策略保证解除好友关系后历史记录双方仍可见。
- `insert` 策略保证只有当前仍是「accepted」好友才能发送新消息——解除好友后即使客户端绕过 UI 检查直接调用 Supabase，也会被数据库拒绝。
- `update` 策略只允许接收方更新自己收到的消息行（用于标记已读）。这条策略是行级的，不限制具体改哪个字段——与项目里其他表（如 `friend_requests` 的 `status` 更新）一样，信任前端只会调用 `.update({ read_at: ... })`，不做额外的字段级数据库约束。

### Realtime

需要在 Supabase 后台把 `messages` 表加入 Realtime 发布（与 `friend_requests`、`match_invites` 现有做法一致，这两张表也未在 `setup.sql` 里看到显式的 `alter publication` 语句，应是通过 Supabase 控制台开启的）。

## 状态层：`ChatContext`

新建 `client/src/contexts/ChatContext.jsx`，结构参照 `MatchInviteContext.jsx`：

- `load()`：拉取所有 `sender_id = self or receiver_id = self` 的消息，按对方用户 ID 在客户端分组，得到 `conversations`：
  ```
  { otherId, otherProfile, lastMessage, lastMessageTime, unreadCount, isFriend }
  ```
  `otherProfile` 通过一次 `profiles` 表批量查询补齐（同 `Navbar.jsx` 里 `senderProfiles` 的做法）；`isFriend` 由 `FriendContext.friends` 交叉得出。
- Realtime：订阅 `postgres_changes`，`filter: receiver_id=eq.${selfId}` 和 `filter: sender_id=eq.${selfId}` 两个 channel，事件触发时 `load()`（与 `FriendContext` 的双订阅模式一致）。组件卸载时 `supabase.removeChannel`。
- 暴露：
  - `conversations`（数组，按 `lastMessageTime` 降序）
  - `totalUnread`（各 `unreadCount` 之和，供 nav tab 小红点使用）
  - `sendMessage(otherId, content)`
  - `markRead(otherId)`（把该对话中 `receiver_id = self` 且 `read_at is null` 的消息批量置为已读）

具体某个对话的完整消息历史**不**放在 `ChatContext` 里，而是在打开的聊天窗口组件内单独加载 + 订阅，避免所有对话的全部消息常驻内存。

## 页面与路由

- `App.jsx` 新增 `/chat` 与 `/chat/:id`，都走 `PrivateRoute` + `Layout`。
- 新建 `client/src/pages/Chat.jsx`：左右两栏布局。
  - 左栏：对话列表，数据来自 `ChatContext.conversations`，未读对话有小红点/加粗提示，点击后 `navigate('/chat/' + otherId)`。
  - 右栏：
    - 无 `:id` 时展示空状态占位（"选择一个对话开始聊天"，若 `conversations` 为空则显示"还没有私信，去关系网找好友聊聊吧"并链接到 `/network`）。
    - 有 `:id` 时展示 `ChatThread` 子组件：加载该 `otherId` 的完整消息历史（按 `created_at asc`），订阅一个只针对这对用户的 realtime channel 用于接收新消息，进入时调用 `markRead(otherId)`。
    - 若 `isFriend` 为 false（已解除好友），历史消息正常展示，输入框替换为提示文案"你们已不是好友，无法发送新消息"。

## 导航与 Profile 集成

- `Navbar.jsx`：`NAV` 数组新增 `{ to: '/chat', label: '聊天', icon: ... }`；tab 图标旁根据 `ChatContext.totalUnread > 0` 渲染一个小红点（不显示数字，与好友请求/比赛邀请共用的通知铃铛逻辑完全独立、互不影响）。
- `Profile.jsx`：`FriendButton` 旁新增"私信"按钮，仅当 `isFriendOfProfile` 为真时渲染，点击 `navigate('/chat/' + id)`。
- `main.jsx`：新增 `ChatProvider`，包裹在 `FriendProvider` 内部（需要读取 `friends`）、与 `MatchInviteProvider` 同级。

## 错误处理与边界情况

- 发送失败（网络错误，或对方刚好在发送瞬间解除了好友关系导致 RLS insert 策略拒绝）：在输入框下方显示内联错误提示，且不清空已输入的草稿内容。
- `/chat` 无任何对话时的空状态见上文。
- 若聊天窗口打开期间对方解除好友，`FriendContext` 已有的 realtime 订阅会更新 `friends`，`isFriend` 随之翻转，输入框自动切换为禁用提示，无需额外实现。
- `ChatContext` 的列表级订阅与 `ChatThread` 的对话级订阅均在组件卸载时 `supabase.removeChannel` 清理，与现有 context 写法一致。

## 验证计划

项目目前没有自动化测试（`client/package.json` 只有 `dev` / `build` / `lint` / `preview`），本功能同样只做手动验证：
1. 用两个互为好友的测试账号，在两个浏览器标签中确认消息实时收发。
2. 确认 nav tab 小红点在有未读消息时出现、打开对话后消失。
3. 确认「私信」按钮只在好友的 Profile 页出现，且能正确跳转到对应对话。
4. 解除好友后，确认历史记录仍可见但无法发送新消息（UI 提示 + 数据库层面 RLS 双重验证）。
