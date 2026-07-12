# 恋语 (Lian Yu)

一个 AI 陪伴社交应用，基于 Expo SDK 52 + React Native + Expo Router 构建。

**作者：** [PiKa1012](https://github.com/PiKa1012)  
**版本：** v1.2.2 — 查看 [Releases](https://github.com/PiKa1012/AI-CHAT-APP/releases) 获取最新版本

## 功能

### AI 聊天
- 创建多个 AI 角色，设定性格、背景、说话风格、关系、年龄、性别
- 私聊和群聊（多个 AI 同时在群中回复）
- AI 情绪系统，14 种情绪状态，自然衰减，回复随心情变化
- 长期记忆系统，自动提取并记住用户的喜好和经历的事
- 自定义 API 配置，支持 3 个厂商：DeepSeek / OpenAI / 通义千问 / 自定义
- 联网搜索、图片识别（Vision API）
- 消息搜索、按日期查看历史、聊天背景设置

### 音乐播放
- 对接网易云音乐 API（自部署 NeteaseCloudMusicApi Enhanced）
- 聊天中搜歌、发送音乐卡片
- 浮动迷你播放器，支持拖拽，不阻塞输入
- 顺序播放 / 随机播放 / 单曲循环
- 播放队列持久化（SQLite）
- 播放失败自动重试并刷新 URL

### 地图（高德 Web 服务 API）
- 附近搜索、关键词查询、天气查询、地理编码/逆地理编码、路线规划
- AI 自动识别意图（"附近有什么吃的"、"怎么去天安门"、"今天天气怎么样"）
- IP 定位（无需 GPS 权限，无 Google Play 的国产机也能用）

### 朋友圈
- 用户发布动态（文字 + 最多 9 张图片）
- AI 自动发朋友圈，带配图（SiliconFlow 图片生成）
- AI 点赞、评论互动，图片识别后在评论中描述图片内容
- 在聊天中说"发朋友圈"→AI 自动生成并发布
- 评论回复、二级评论（@回复）
- 朋友圈通知推送

### 日记
- AI 根据当日聊天记录自动写日记
- AI 自动配图，支持日/周/月统计
- AI 在日记中回复用户评论
- 日记详情页：头像+气泡+时间 的评论样式

### 定时任务
- 支持 4 种任务：发朋友圈、写日记、自动聊天、发送消息
- 一次性 / 每天 / 工作日 / 自定义周期
- 在聊天中创建（"每天早上 8 点叫我起床"）
- AI 日程编排，每 30 秒后台检查

### 表情包
- 自定义表情包，支持图文混合
- AI 根据心情自动使用对应表情
- 14 种情绪标签（开心、伤心、生气、孤独、惊喜等）
- 默认 40 个表情预置

### 语音
- 语音条：长按录音发送，点击播放，类似微信语音消息
- AI 语音回复：AI 自动以语音条形式回复，支持频率控制
- 语音转文字：录音后自动转写（讯飞 ASR），AI 理解语音内容
- 语音通话：实时 WebSocket 通话（讯飞 TTS + ASR），拨号铃音，打断功能
- 消息朗读：点击文字消息右下角小喇叭，TTS 朗读

### API 用量统计
- 每次 AI 调用记录 Token 用量
- 日/周/月趋势图表
- DeepSeek 余额查询（实时 + 缓存）
- 费用估算（按厂商单价）

### 存储管理
- 各类文件按目录分组显示大小：头像、封面、表情包、聊天背景、聊天图片、AI 生成图片
- 单个文件删除、整目录清空
- 孤立文件清理
- 数据库修复（AI 角色 ID 冲突修复）

### 微信桥接
- 将 AI 角色接入微信，通过 iLink Bot 协议
- App 配置 → 服务器扫码 → AI 自动回复微信消息
- AI 人设与 App 端同步
- 支持部署在阿里云 Windows 服务器
- 连接状态实时刷新

### 通知系统
- 点赞、评论、回复、新动态推送
- 本地通知调度
- 通知中心列表，可标记已读、清除、点击跳转原页面

## 技术栈

- **前端：** Expo SDK 52, React Native, Expo Router v4
- **状态管理：** Zustand
- **数据库：** expo-sqlite (WAL 模式 + 外键)
- **后端：** Node.js, Express（微信桥接）+ WebSocket（语音通话）
- **微信：** iLink Bot API (ilinkai.weixin.qq.com)
- **地图：** 高德 Web 服务 API（无 GPS 依赖）
- **音乐：** NeteaseCloudMusicApi Enhanced
- **图片生成：** SiliconFlow API (Stable Diffusion)
- **语音：** 讯飞 TTS + ASR / expo-speech
- **构建：** EAS Build

## 微信桥接

通过腾讯 iLink Bot 协议将 AI 角色接入微信。

```
App 设置 → 连接微信 → 选择 AI 角色 → 扫码
     │
     ▼ 推送 API 配置 + 人设
服务器（你的阿里云）
     │
     ├─ iLink 长轮询（收微信消息）
     ├─ 调用 AI API（DeepSeek 等）
     └─ 回复微信
```

**特点：**
- App 零改动，纯后端桥接
- AI 人设从 App 同步，两边性格一致
- 聊天历史互相独立

**⚠️ 当前限制：单用户**
一台服务器只能同时运行一个微信账号。如果你把 App 分享给他人：
- 对方用**同一台服务器地址** → 会覆盖你的人设配置，甚至重新扫码把你顶掉
- 对方用**自己的服务器地址** → 完全独立，互不影响

多租户支持（多人共用一台服务器）计划后续实现。

### 部署服务器

#### 1. 安装 Node.js（LTS 版）
https://nodejs.org

#### 2. 上传 `server/` 目录到服务器，然后安装依赖
```bash
cd server
npm install
```

#### 3. 开放防火墙端口（以管理员运行）
```powershell
# 微信桥接
netsh advfirewall firewall add rule name="WeChatBridge" dir=in action=allow protocol=TCP localport=3001
# 语音通话
netsh advfirewall firewall add rule name="VoiceCall" dir=in action=allow protocol=TCP localport=3002
```
如果是阿里云/腾讯云，还需要去**云控制台 → 安全组**添加：
- TCP 3001（微信桥接），授权对象 0.0.0.0/0
- TCP 3002（语音通话），授权对象 0.0.0.0/0

#### 4. 启动（两个窗口分别运行）
```bash
# 微信桥接
node index.js
```
```bash
# 语音通话
node voice-server.js
```

### App 端操作

1. 设置 → 连接微信
2. 服务器地址填 `http://你的服务器IP:3001`
3. 点**测试连接**确认服务器能通
4. 选择一个 AI 角色，点击**连接微信**
5. App 显示二维码 → 用微信扫码授权

6. 设置 → API 配置 → 语音通话
7. 服务器地址填 `ws://你的服务器IP:3002/voice`
8. 填入讯飞凭据（App ID / API Key / API Secret）
9. 打开**语音通话**开关
10. 在私聊中按 ⊕ → 语音通话 发起通话

## 项目结构

```
├── app/                               # Expo Router 页面（文件即路由）
│   ├── _layout.js                     # 根布局 → 初始化 DB/通知/调度 + 全局音乐播放器
│   ├── about.js                       # 关于页面（版本信息 + 检查更新）
│   ├── (tabs)/                        # 底部 Tab 导航
│   │   ├── _layout.js                 # Tab 配置（4 个标签）
│   │   ├── index.js                   # 首页 — 会话列表
│   │   ├── diary.js                   # 日记 feed
│   │   ├── moments.js                 # 朋友圈 feed
│   │   └── settings.js                # 设置中心
│   ├── chat/                          # 聊天（[id].js 是路由页面）
│   │   └── [id].js                    # 聊天页面（~1080 行）
│   ├── ai-manage.js                   # AI 角色 CRUD
│   ├── ai-mood.js                     # AI 心情查看/编辑
│   ├── ai-profile.js                  # AI 个人主页（封面/头像/性格）
│   ├── api-settings/                  # API 配置（厂商/功能/语音/第三方）
│   ├── chat-background.js             # 聊天背景选择（20 色 + 自定义图片）
│   ├── chat-detail-history.js         # 单会话历史（日历视图）
│   ├── chat-history.js                # 全局消息搜索
│   ├── diary-detail.js                # 日记详情（头像+气泡+时间评论样式）
│   ├── emoji-manage.js                # 表情包管理
│   ├── emoji-settings.js              # 表情自动发送设置
│   ├── group-settings.js              # 群聊设置
│   ├── log-viewer.js                  # 应用日志查看器
│   ├── memory-manage.js               # AI 记忆管理
│   ├── moment-detail.js               # 朋友圈详情
│   ├── moment-feed.js                 # 朋友圈全屏版
│   ├── notifications.js               # 通知中心
│   ├── profile.js                     # 用户主页编辑
│   ├── scheduled-tasks.js             # 定时任务管理
│   ├── storage-manage.js              # 存储管理
│   ├── usage-stats.js                 # API 用量统计
│   └── wechat-connect.js              # 微信桥接
├── src/                               # 核心逻辑
│   ├── database/
│   │   └── index.js                   # SQLite 初始化（20+ 张表）
│   ├── stores/
│   │   ├── index.js                   # Zustand 全局 Store
│   │   └── musicPlayer.js             # 音乐播放器 Store
│   ├── services/
│   │   ├── ai.js                      # AI 编排（人格+心情+记忆+API 调用）
│   │   ├── api-client.js              # AI API 客户端（3 厂商 + 工具调用 + 联网搜索）
│   │   ├── diary.js                   # 日记服务（AI 写日记+评论）
│   │   ├── emoji.js                   # 表情包服务
│   │   ├── emotion.js                 # 心情系统（11 种情绪）
│   │   ├── imageGen.js                # AI 图片生成（SiliconFlow）
│   │   ├── map.js                     # 高德地图 API
│   │   ├── media.js                   # 媒体权限/选取/存储
│   │   ├── memory.js                  # 长期记忆系统
│   │   ├── netease.js                 # 网易云音乐 API
│   │   ├── notification.js            # 通知服务
│   │   ├── proactive.js               # AI 主动聊天
│   │   ├── scheduler.js               # 后台调度器（每 30 秒）
│   │   ├── settings.js                # 设置持久化
│   │   ├── taskDetector.js            # 自然语言任务识别
│   │   ├── usage.js                   # API 用量追踪
│   │   └── voice.js                   # 系统 TTS 朗读
│   │   └── voice-call.js              # 语音通话 WebSocket 客户端
│   ├── components/
│   │   ├── MusicPlayer.js             # 悬浮迷你播放器（可拖拽）
│   │   ├── SafeImage.js               # 安全图片组件（失败占位符）
│   │   └── chat/
│   │       ├── EmojiPanel.js          # 表情选择面板
│   │       ├── MusicSearchModal.js    # 音乐搜索弹窗
│   │       └── styles.js              # 聊天样式（~680 行 StyleSheet）
│   ├── data/
│   │   └── emojis.js                  # 默认表情包数据
│   └── utils/
│       ├── time.js                    # 北京时间 (UTC+8) 工具
│       └── logger.js                  # 持久化日志 + 全局错误捕获
├── server/                            # 服务器后端
│   ├── package.json
│   ├── index.js                       # 微信桥接（端口 3001）
│   ├── voice-server.js                # 语音通话（端口 3002）
│   └── voice/
│       ├── ws-server.js               # 语音 WebSocket 服务
│       ├── call-session.js            # 通话会话管理
│       ├── tts-edge.js                # 讯飞 TTS
│       └── asr-xf.js                  # 讯飞 ASR
├── plugins/
│   └── withCleartextTraffic.js        # Expo 插件：启用 HTTP 明文流量
├── assets/                            # 图标资源
├── wechat-bridge.js                   # 独立微信桥接脚本
├── app.json                           # Expo 配置
├── eas.json                           # EAS Build 构建配置
└── package.json                       # 依赖管理
```

## 架构与数据流

### 数据流

```
用户操作 → app/ 页面 → src/stores/ (Zustand) → src/services/ → src/database/ (SQLite)
                                                                     ↕
                                                             外部 API: AI/地图/音乐/图片生成
                                                                     ↕
                                                             server/ (微信桥接)
```

### 关键设计

- **MVVM 模式：** 页面（View）通过 `useAppStore` hook（ViewModel）订阅状态，调用 actions 触发业务逻辑
- **单例数据库：** `getDatabase()` 返回缓存连接，所有服务通过 `../database` 导入
- **Store 分层：** 一个全局 Store（应用状态）+ 一个专用 Store（音乐播放器）
- **AI 编排：** `ai.js` 是中央协调器，整合人格、心情、记忆、表情、设置后调用 API 客户端
- **后台调度：** `scheduler.js` 每 30 秒检查定时任务、主动聊天、心情衰减
- **插件体系：** Expo 配置插件修改原生配置，无需 eject

### 数据库表

| 表 | 用途 |
|---|---|
| `ai_characters` | AI 角色定义（名称/头像/性格/声音/背景故事等） |
| `conversations` | 会话（私聊/群聊） |
| `conversation_members` | 会话成员 |
| `messages` | 所有聊天消息 |
| `ai_memories` | AI 长期记忆 |
| `diaries` | 日记条目 |
| `diary_comments` | 日记评论 |
| `moments` | 朋友圈动态 |
| `moment_comments` | 朋友圈评论 |
| `moment_likes` | 朋友圈点赞 |
| `emoji_packs` | 表情包 |
| `emojis` | 表情 |
| `scheduled_tasks` | 定时任务 |
| `notifications` | 通知 |
| `api_usage` | API Token 用量 |
| `user_settings` | 键值设置存储 |

## 快速开始

```bash
npm install
npx expo start
```

## 配置

在 App 设置 → API 配置中填写：
- **AI API Key：** DeepSeek / 通义千问 / OpenAI 兼容 Key
- **地图 API Key：** 高德 Web 服务 Key（可选）
- **网易云音乐地址：** 自部署的 NeteaseCloudMusicApi 地址（可选）
- **图片生成 API Key：** SiliconFlow API Key（可选）

## 网易云音乐 API 部署（Vercel）

本项目使用 `@neteasecloudmusicapienhanced/api` 搜歌，推荐用 Vercel 免费部署。

1. **Fork 仓库：** 打开 [api-vercel-init](https://github.com/NeteaseCloudMusicApiEnhanced/api-vercel-init) → 点右上角 **Fork**
2. **导入 Vercel：** 打开 [vercel.com](https://vercel.com) → **Add New → Project** → 选择刚 fork 的仓库 → **Framework Preset** 选 Other → **Deploy**
3. **填入 App：** 部署后得到 `https://xxx.vercel.app`，在 App **设置 → API 配置 → 网易云音乐地址** 填进去即可
4. **使用：** 聊天界面点 **⊕ → 🎵** 搜歌，点歌可试听或发送音乐卡片

> Vercel 免费版函数超时 10s，部分慢接口可能失败，生产用建议升级付费版。
