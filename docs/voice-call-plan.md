# 实时语音通话功能 - 方案设计

## 1. 整体架构

```
[手机端 React Native / Expo]
  ┌─────────────────────────────────────┐
  │ 通话界面 (拨号 → 响铃 → 接通)       │
  │                                      │
  │ 音频采集 ← expo-av Audio.Recording   │
  │ 音频播放 ← expo-av Audio.Sound       │
  │ VAD检测 ← Silero VAD (本地)          │
  │ WebSocket ← 收发音频流               │
  └──────────────┬──────────────────────┘
                 │ WebSocket (wss://)
                 ▼
  ┌─────────────────────────────────────┐
  │ Node.js 后端 (你的 Express 服务器)   │
  │                                      │
  │ WebSocket Server (ws库)              │
  │ 音频流转发                           │
  │ ASR调用 → 讯飞实时语音识别API        │
  │ LLM调用 → 已有 DeepSeek API          │
  │ TTS调用 → Edge TTS                   │
  │ 打断逻辑 (Barge-in)                  │
  └─────────────────────────────────────┘
```

## 2. 核心流程

### 2.1 拨号阶段
1. 用户点"拨打电话" → 选 AI 角色
2. 客户端建立 WebSocket 连接
3. 发送 `{ type: "dial", characterId: "xxx" }`
4. 后端加载角色 prompt，准备LLM会话
5. 返回 `{ type: "ringing" }` → 客户端播放"嘟"声
6. 2-3秒后 → 后端 `{ type: "connected" }` → 客户端播放"咔"（接通音）

### 2.2 通话阶段（全双工）

```
用户说话 → 客户端 VAD 检测到人声开始
  → 16kHz PCM 音频帧 → WebSocket → 后端
  → 讯飞 ASR (实时流式，增量识别)
  → 一句话识别完 → LLM (流式输出)
  → 每生成一段文本 → Edge TTS (流式合成)
  → 音频帧 → WebSocket → 客户端
  → expo-av 播放

同时支持打断：
  TTS播放中 → 客户端 VAD 检测到用户开口
  → 发 { type: "interrupt" }
  → 后端停止 TTS + 停止 LLM 输出
  → 开始 ASR 识别用户新输入
  → 客户端停止播放 → 开始采集新音频
```

### 2.3 挂断阶段
- 任意方发送挂断信号 → 关闭 WebSocket → 清理会话

## 3. 组件清单

### 3.1 前端新增/修改

| 文件 | 用途 |
|------|------|
| `app/voice-call/[id].js` | 通话页面（拨号→通话→挂断界面） |
| `src/services/voice-call.js` | WebSocket 管理 + VAD + 音频流 |
| `src/stores/voice-call.js` | 通话状态管理 |
| 安装: `react-native-webrtc` 或原生音频处理 | 音频采集 |

### 3.2 后端新增/修改

| 文件 | 用途 |
|------|------|
| `server/voice/ws-server.js` | WebSocket 连接管理 |
| `server/voice/asr-xf.js` | 讯飞 ASR 接入 |
| `server/voice/tts-edge.js` | Edge TTS 接入 |
| `server/voice/call-session.js` | 通话会话逻辑（VAD/打断/状态机） |
| `server/index.js` | 集成 WebSocket 服务 |

### 3.3 外部依赖

| 用途 | 成本 |
|------|------|
| **讯飞 ASR** (实时语音识别API) | 新用户免费5小时，之后~0.3元/时 |
| **Edge TTS** (微软免费TTS) | 0元 |
| **Silero VAD** (本地检测，不联网) | 0元，开源 |
| **ws** (Node WebSocket库) | 0元 |
| **websocket** (RN端) | 0元 |

## 4. 关键实现细节

### 4.1 音频参数统一标准

全链路用 **16kHz, 16bit, 单声道 PCM**：
- 手机端采集：用 16kHz 采样率
- 传给 ASR：讯飞接受 16kHz PCM
- TTS 输出：Edge TTS 返回 16kHz PCM 或 MP3
- 播放端：统一转 16kHz PCM

### 4.2 VAD (语音活动检测)

使用 Silero VAD 模型（ONNX 格式）：
- 可编译到 RN 端本地运行
- 或传到后端由 Node 端运行
- 每 30ms 输出一个概率值（0-1）
- 大于 0.5 判定为有人说话
- 连续 500ms 低于阈值 → 判定说话结束

### 4.3 打断逻辑

```
状态枚举：
  LISTENING   — 后端正在ASR识别，用户说话中
  PROCESSING  — 后端正在调LLM+TTS，TTS正在播放
  SPEAKING    — TTS播放中，等待打断

LISTENING → (用户说完) → PROCESSING → (发送音频帧) → SPEAKING
SPEAKING → (收到打断信号) → LISTENING
PROCESSING → (收到打断信号) → 停止LLM流 → LISTENING
```

### 4.4 延迟目标

| 阶段 | 目标延迟 |
|------|----------|
| VAD 检测到说话结束 | < 500ms |
| ASR 识别完成 | < 300ms |
| LLM 首 token | < 1s (流式) |
| TTS 首帧 | < 500ms |
| 端到端 | < 3s (优秀) / < 5s (可接受) |

## 5. 后端代码结构（新增）

```
server/
├── index.js                    # 原入口，加入 ws 服务
├── voice/
│   ├── ws-server.js            # WebSocket 连接管理
│   ├── call-session.js         # 通话会话 (状态机)
│   ├── asr-xf.js               # 讯飞实时语音识别
│   ├── tts-edge.js             # Edge TTS 流式合成
│   └── vad.js                  # VAD 检测逻辑
```

## 6. 后续优化方向
- 通话录音保存
- 多角色切换
- AI 主动打过来
- 降噪处理 (webrtc-ns)

---

*如果你觉得方案没问题，下一步就开始搭建 WebSocket + 音频采集测试链路。*
