# 恋语

一个 AI 陪伴社交应用，基于 Expo + React Native 构建。

## 功能

### AI 聊天
- 创建多个 AI 角色，设定性格、背景、说话风格
- 私聊和群聊
- AI 情绪系统，回复随心情变化
- 长期记忆，记住用户的喜好和发生过的事
- 自定义 API 配置，支持 DeepSeek / OpenAI / Claude / 通义千问 / 文心一言
- 联网搜索，图片识别

### 音乐播放
- 对接网易云音乐 API，聊天中搜歌
- 音乐卡片展示，支持播放
- 浮动迷你播放器，可拖拽，不阻塞输入
- 顺序播放 / 随机播放 / 单曲循环
- 播放队列持久化（SQLite）

### 地图（高德 API）
- 附近搜索、地点查询、天气、路线规划
- AI 自动识别意图（附近有什么吃的 / 怎么走 / 天气）
- IP 定位（无需 GPS 权限，无 Google Play 的国产机也能用）

### 朋友圈 & 日记
- AI 自动发朋友圈，带配图
- AI 之间的点赞评论互动
- AI 写日记，自动配图
- 通知推送

### 定时任务
- 在聊天中创建定时任务（"每天早上 8 点叫我起床"）
- AI 日程编排

### 表情包 & 语音
- 自定义表情包，AI 根据心情自动发表情
- AI 消息朗读，支持 Edge / OpenAI / MiMo 多音色

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

#### 2. 安装依赖
```bash
cd server
npm install
```

#### 3. 开放防火墙端口（以管理员运行）
```powershell
netsh advfirewall firewall add rule name="WeChatBridge" dir=in action=allow protocol=TCP localport=3001
```
如果是阿里云/腾讯云，还需要去**云控制台 → 安全组**添加入方向规则：TCP 3001，授权对象 0.0.0.0/0。

#### 4. 启动
```bash
node index.js
```

### App 端操作

1. 设置 → 连接微信
2. 服务器地址填 `http://你的服务器IP:3001`
3. 点**测试连接**确认服务器能通
4. 选择一个 AI 角色
5. 点击**连接微信**
6. App 显示二维码 → 用微信扫码授权
7. 扫码后自动运行

> 端口 3001 无需备案，仅用于 App 与服务器的内部通信。

## 技术栈

- **前端：** Expo SDK 52, React Native, Expo Router
- **状态管理：** Zustand
- **数据库：** expo-sqlite (WAL 模式)
- **后端：** Node.js, Express (微信桥接)
- **微信：** iLink Bot API (ilinkai.weixin.qq.com)
- **地图：** 高德 Web 服务 API（无 GPS 依赖）
- **音乐：** NeteaseCloudMusicApi Enhanced

## 项目结构

```
├── app/                    # Expo Router 页面
│   ├── (tabs)/             # 主页标签（首页/日记/朋友圈/设置）
│   ├── chat/[id].js        # 聊天界面
│   ├── api-settings.js     # API 配置
│   ├── ai-manage.js        # AI 角色管理
│   ├── wechat-connect.js   # 微信桥接配置
│   └── ...
├── src/
│   ├── services/           # 业务逻辑
│   │   ├── ai.js           # AI 调用 + 人设 + 记忆
│   │   ├── map.js          # 高德地图 API
│   │   ├── netease.js      # 网易云音乐 API
│   │   ├── memory.js       # 记忆系统
│   │   ├── diary.js        # 日记
│   │   └── settings.js     # 设置存储
│   ├── stores/index.js     # Zustand 全局状态
│   ├── database/index.js   # SQLite 数据库
│   └── components/         # 通用组件
├── server/                 # 微信桥接后端
│   ├── package.json
│   └── index.js
└── app.json                # Expo 配置
```

## 快速开始

```bash
npm install
npx expo start
```

音乐功能需要额外启动：
```bash
npx @neteasecloudmusicapienhanced/api@latest
```

## 配置

在 App 设置 → API 配置中填写：
- **AI API Key：** DeepSeek / OpenAI / 其他兼容 Key
- **地图 API Key：** 高德 Web 服务 Key（可选）
- **网易云音乐地址：** 自部署的 NeteaseCloudMusicApi 地址（可选）
