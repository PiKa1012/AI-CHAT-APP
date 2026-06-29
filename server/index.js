const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3001;
const CRED_PATH = path.join(__dirname, 'credentials.json');
const CFG_PATH = path.join(__dirname, 'bridge-config.json');

// 当前桥接状态
let bridgeState = {
  status: 'idle', // idle | logging | running | error
  qrCode: null,
  qrContent: null,
  qrImage: null,
  error: null,
  config: null,
};

const crypto = require('crypto');

// 生成 X-WECHAT-UIN（随机 uint32 → 十进制 → base64）
function wechatUin() {
  const val = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(val), 'utf8').toString('base64');
}

// iLink API 工具
const ILINK_BASE = 'https://ilinkai.weixin.qq.com';
const CHANNEL_VERSION = 'ai-companion/1.0.0';

async function iLinkPost(baseUrl, path, body, token) {
  const fullBody = { ...body, base_info: { channel_version: CHANNEL_VERSION } };
  const res = await fetch(`${baseUrl || ILINK_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AuthorizationType': 'ilink_bot_token',
      'Authorization': `Bearer ${token}`,
      'X-WECHAT-UIN': wechatUin(),
    },
    body: JSON.stringify(fullBody),
  });
  return res.json();
}

// 保存凭据
function saveCredentials(creds) {
  fs.writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2));
}

// 提取二维码信息，用 qrcode 包生成图片
async function storeQRImage(qrData) {
  bridgeState.qrCode = qrData.qrcode;
  bridgeState.qrContent = qrData.qrcode_img_content || '';
  console.log(`[QR] token: ${bridgeState.qrCode}`);
  console.log(`[QR] url: ${bridgeState.qrContent}`);

  // 从 URL 生成二维码 PNG
  if (bridgeState.qrContent) {
    try {
      bridgeState.qrImage = await QRCode.toBuffer(bridgeState.qrContent, {
        type: 'png',
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      console.log(`[QR] generated PNG: ${bridgeState.qrImage.length} bytes`);
    } catch (e) {
      console.error(`[QR] failed to generate QR code: ${e.message}`);
      bridgeState.qrImage = null;
    }
  } else {
    bridgeState.qrImage = null;
  }
}

// 启动 iLink 登录流程
async function startILinkLogin() {
  bridgeState.status = 'logging';
  bridgeState.qrCode = null;
  bridgeState.qrImage = null;
  bridgeState.error = null;

  try {
    // 1. 获取二维码（GET + query string）
    const qrUrl = `${ILINK_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`;
    console.log(`[QR] fetching: ${qrUrl}`);
    const qrRes = await fetch(qrUrl);
    console.log(`[QR] iLink response status: ${qrRes.status}`);
    const qrRaw = await qrRes.json();
    console.log(`[QR] raw response: ${JSON.stringify(qrRaw).substring(0, 500)}`);
    const qrData = qrRaw.data || qrRaw;
    await storeQRImage(qrData);

    // 2. 后台轮询扫码状态
    if (bridgeState.qrCode) {
      pollQRStatus(bridgeState.qrCode).catch(e => {
        bridgeState.status = 'error';
        bridgeState.error = e.message;
      });
    } else {
      bridgeState.status = 'error';
      bridgeState.error = '未获取到二维码';
    }
  } catch (e) {
    bridgeState.status = 'error';
    bridgeState.error = `获取二维码失败: ${e.message}`;
  }
}

async function pollQRStatus(qrcode) {
  while (bridgeState.status === 'logging') {
    try {
      const res = await fetch(`${ILINK_BASE}/ilink/bot/get_qrcode_status?qrcode=${qrcode}`, {
        headers: { 'iLink-App-ClientVersion': '1' },
      });
      const raw = await res.json();
      const data = raw.data || raw;

      if (data.status === 'confirmed') {
        const creds = { token: data.bot_token, baseUrl: data.baseurl, ilink_bot_id: data.ilink_bot_id };
        saveCredentials(creds);
        bridgeState.status = 'running';
        bridgeState.qrImage = null;
        startMessageLoop(creds).catch(e => {
          bridgeState.status = 'error';
          bridgeState.error = `消息循环出错: ${e.message}`;
        });
        return;
      }
      if (data.status === 'expired') {
        bridgeState.status = 'error';
        bridgeState.error = '二维码已过期，请重新连接';
        return;
      }
    } catch (e) {
      bridgeState.status = 'error';
      bridgeState.error = `轮询状态失败: ${e.message}`;
      return;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

// 消息循环
async function startMessageLoop(creds) {
  let buf = '';

  while (bridgeState.status === 'running') {
    try {
      const { msgs, get_updates_buf } = await iLinkPost(
        creds.baseUrl, 'ilink/bot/getupdates',
        { get_updates_buf: buf, timeout_ms: 30000 }, creds.token
      );
      buf = get_updates_buf || buf;

      for (const msg of msgs || []) {
        if (msg.message_type !== 1) continue;
        const text = msg.item_list?.[0]?.text_item?.text;
        if (!text) continue;

        console.log(`[微信] ${text}`);

        // 调 AI
        const reply = await callAI(text);
        console.log(`[AI] ${reply}`);

        const clientId = `ai-companion:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const body = {
          msg: {
            from_user_id: '',
            to_user_id: msg.from_user_id,
            client_id: clientId,
            message_type: 2,
            message_state: 2,
            context_token: msg.context_token,
            item_list: [{ type: 1, text_item: { text: reply } }],
          },
        };
        if (creds.ilink_bot_id) body.ilink_bot_id = creds.ilink_bot_id;

        await iLinkPost(creds.baseUrl, 'ilink/bot/sendmessage', body, creds.token);
      }
    } catch (e) {
      console.error('轮询错误:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// 会话历史（内存中）
const sessions = {};

async function callAI(text) {
  const cfg = bridgeState.config;
  if (!cfg || !cfg.apiKey) return 'AI 未配置';

  if (!sessions['wechat']) sessions['wechat'] = [];
  sessions['wechat'].push({ role: 'user', content: text });

  const messages = [
    { role: 'system', content: cfg.systemPrompt || '你是一个友善的AI伙伴' },
    ...sessions['wechat'].slice(-40),
  ];

  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: cfg.maxTokens || 1024,
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || '抱歉，我没理解';
  sessions['wechat'].push({ role: 'assistant', content: reply });
  return reply;
}

// ＝＝＝ API 路由 ＝＝＝

// 获取状态
app.get('/api/bridge/status', (req, res) => {
  res.json({
    status: bridgeState.status,
    qrCode: bridgeState.qrCode,
    error: bridgeState.error,
  });
});

// 启动桥接
app.post('/api/bridge/start', async (req, res) => {
  const { apiKey, baseUrl, model, systemPrompt, maxTokens } = req.body;
  if (!apiKey) return res.status(400).json({ error: '缺少 apiKey' });

  // 保存配置（内存 + 磁盘）
  bridgeState.config = {
    apiKey,
    baseUrl: baseUrl || 'https://api.deepseek.com',
    model: model || 'deepseek-chat',
    systemPrompt: systemPrompt || '你是一个友善的AI伙伴',
    maxTokens: maxTokens || 1024,
  };
  fs.writeFileSync(CFG_PATH, JSON.stringify(bridgeState.config, null, 2));

  // 如果已有缓存的凭据，尝试恢复运行
  if (fs.existsSync(CRED_PATH)) {
    try {
      const creds = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
      if (creds.token && creds.baseUrl) {
        bridgeState.status = 'running';
        startMessageLoop(creds).catch(e => {
          bridgeState.status = 'error';
          bridgeState.error = e.message;
        });
        return res.json({ status: 'running', msg: '已使用缓存的凭据恢复运行' });
      }
    } catch (e) {}
  }

  // 没有缓存的凭据，重新扫码
  await startILinkLogin();
  if (bridgeState.status === 'error') {
    return res.status(500).json({ error: bridgeState.error || '获取二维码失败' });
  }
  res.json({ status: 'logging', qrCode: bridgeState.qrCode });
});

// 返回二维码图片
app.get('/api/bridge/qrcode', (req, res) => {
  if (!bridgeState.qrImage) return res.status(404).end();
  res.type('png').send(bridgeState.qrImage);
});

// 停止桥接
app.post('/api/bridge/stop', (req, res) => {
  bridgeState.status = 'idle';
  bridgeState.qrImage = null;
  bridgeState.config = null;
  delete sessions['wechat'];
  // 删除缓存的凭据和配置，下次连接必须重新扫码
  if (fs.existsSync(CRED_PATH)) fs.unlinkSync(CRED_PATH);
  if (fs.existsSync(CFG_PATH)) fs.unlinkSync(CFG_PATH);
  res.json({ status: 'idle' });
});

app.listen(PORT, () => {
  console.log(`桥接服务器已启动，端口 ${PORT}`);

  // 自动尝试恢复
  // 从磁盘恢复 config（服务器重启后 config 不会丢）
  if (fs.existsSync(CFG_PATH)) {
    try { bridgeState.config = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); } catch (e) {}
  }

  if (fs.existsSync(CRED_PATH)) {
    try {
      const creds = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
      if (creds.token && creds.baseUrl && bridgeState.config) {
        bridgeState.status = 'running';
        startMessageLoop(creds).catch(e => {
          bridgeState.status = 'error';
          bridgeState.error = e.message;
        });
      }
    } catch (e) {}
  }
});
