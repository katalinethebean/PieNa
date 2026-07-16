# English Universe（双语模式）设计文档

**日期**: 2026-07-16
**状态**: 待评审

## 目标

为撇捺增加英文辩论（English Debate）支持。中英辩手共用同一个账号体系、好友关系、聊天和比赛记录（不分家），但通过一个全局「宇宙开关」（language = `zh` | `en`）在两个世界之间切换：

- **UI 语言**：整个 app 的文案随开关切换（全量翻译，本轮完成）
- **招募大厅**：中文宇宙只看到中文辩手招募帖，英文宇宙只看到英文辩手招募帖
- **撇捺积分榜**：仅统计中文比赛；英文模式下积分榜入口整体隐藏
- **比赛记录**：英文模式下创建的 session 打上 `language='en'` 标记，不计入积分榜

个人主页、好友、聊天、历史战绩完全共享——切换宇宙不隐藏任何自己的数据，只是换了一个视角。

## 切换入口：仅导航栏

导航栏上放一个 中/EN 切换控件，桌面端和手机端顶栏都有，随时可切。
不做招募大厅下拉、不做设置页语言行——单一入口，单一事实来源。

招募大厅标题从「招募大厅」改为「**招募中文辩手**」（英文宇宙下为 "Recruiting English Debaters"），只反映当前宇宙，本身不是切换控件。

## 偏好存储

- `profiles.language text default 'zh'`：跨设备跟随用户
- localStorage 缓存：页面加载瞬间生效（profile 拉取前），未登录访客（Login 页）也可用
- 切换时同时写两处；登录后以 profile 值为准并回写 localStorage

## 数据库变更（追加到 `server/setup.sql`，幂等写法）

1. `profiles.language text default 'zh'`
2. `recruit_posts.language text not null default 'zh'` —— 存量帖子自动归为中文
3. `sessions.language text default 'zh'`
4. `get_leaderboards()` 更新：只统计 `coalesce(s.language, 'zh') = 'zh'` 的 session

发帖时按当前宇宙打语言标；招募大厅 feed 查询加 `.eq('language', lang)`。
录入/上传比赛时按当前宇宙给 session 打语言标。

## 前端架构

### i18n：轻量自研（不引库）

- `client/src/contexts/LanguageContext.jsx`：全局 language 状态 + `setLanguage`（写 profile + localStorage）+ `t()` 函数
- `client/src/i18n/zh.js`、`client/src/i18n/en.js`：字典模块，key → 字符串（支持简单插值参数）
- 不引入 react-i18next：两种语言、纯静态文案，自研 `t()` 足够，符合本项目手写风格

Provider 层级：`AuthProvider > LanguageProvider > UserProvider`。LanguageProvider 初始化时读 localStorage（瞬间生效），登录后自行用 supabase 读取/写回 `profiles.language`（只需要 AuthContext 的 user id，不依赖 UserContext）。

### 翻译范围：全量

所有页面和组件（约 20 个文件）：Navbar、Discover（招募大厅全部弹窗）、Profile（含设置）、Leaderboard、Network、Chat、Upload、RecordMatch、Review、Report、Login、各类 Modal（Onboarding、LoginPrompt、EditMatch、Confirm、AnalysisOverlay、NotificationBell、TeamPicker、ReviewJobWidget、DebaterModal）。

### 英文模式下的积分榜隐藏

- 手机顶栏的积分榜快捷图标（`TopIconButton`）隐藏
- Discover 桌面左栏的 `LeaderboardCard` 隐藏
- `/leaderboard` 路由在英文模式下重定向到 `/discover`

## 已知边界（本轮不解决，明确记录）

AI 复盘管线（`server/routes/review.js`）的 prompt 和发言人切分正则（一辩/二辩/自由辩论）是中文辩论制式。英文模式下用户可以正常录入/上传比赛（UI 是英文的），session 会打上 `en` 标记并被积分榜排除，但**英文赛制（BP/PF 等）的 AI 转写与评分质量未调优**，属于后续独立项目。

## 测试

项目无测试套件。验证方式：dev server + 浏览器手动走查——切换开关后检查 UI 语言、招募 feed 过滤、发帖语言标记、积分榜入口隐藏、刷新后偏好保持、登出/访客状态下的行为。
