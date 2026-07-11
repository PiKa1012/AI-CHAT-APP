const BASE = 'https://ilinkai.weixin.qq.com';
const fs = require('fs');
const path = require('path');
const CRED_FILE = path.join(require('os').homedir(), '.wechat-bridge.json');
const SESSION_FILE = path.join(require('os').homedir(), '.wechat-sessions.json');

// 从环境变量读取配置
const config = {
  apiKey: process.env.AI_API_KEY || '',
  baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com',
  model: process.env.AI_MODEL || 'deepseek-chat',
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024'),
  systemPrompt: process.env.AI_SYSTEM_PROMPT || '你是小美，一个温柔友善的AI伙伴。用自然的中文回复，像朋友聊天一样。不要使用emoji。',
};

// 每个用户的消息历史（内存中，重启后丢失）
let sessions = {};
if (fs.existsSync(SESSION_FILE)) {
  try { sessions = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); } catch (e) {}
}

function saveSessions() {
  const toSave = {};
  for (const [k, v] of Object.entries(sessions)) {
    toSave[k] = v.slice(-50);
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(toSave));
}

let credentials = {};
if (fs.existsSync(CRED_FILE)) {
  try { credentials = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8')); } catch (e) {}
}

const api = (base, path, body, token) =>
  fetch(`${base || BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(r => r.json());

async function callAI(userId, text) {
  if (!config.apiKey) return 'AI 未配置，请在环境变量中设置 AI_API_KEY';

  if (!sessions[userId]) sessions[userId] = [];
  sessions[userId].push({ role: 'user', content: text });

  const messages = [{ role: 'system', content: config.systemPrompt }, ...sessions[userId].slice(-40)];

  const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages, max_tokens: config.maxTokens, temperature: 0.7 }),
  });
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const reply = raw
    ? raw.replace(/```[\s\S]*?```/g, '')
        .replace(/^你是[^\n]*\n?/gm, '')
        .replace(/^当前时间[^\n]*\n?/gm, '')
        .replace(/^请用符合[^\n]*\n?/gm, '')
        .replace(/^不要使用[^\n]*\n?/gm, '')
        .replace(/\n{3,}/g, '\n').trim()
    : '抱歉，我没理解';

  sessions[userId].push({ role: 'assistant', content: reply });
  saveSessions();
  return reply;
}

async function main() {
  // 如果有缓存的凭据，直接使用
  if (credentials.token && credentials.baseUrl) {
    console.log('使用缓存的登录凭据');
  } else {
    // 获取二维码
    const { qrcode, qrcode_img_content } = await fetch(`${BASE}/ilink/bot/get_bot_qrcode?bot_type=3`).then(r => r.json());
    console.log('\n请用微信扫描二维码，授权后即可使用：\n');
    console.log(qrcode_img_content);
    console.log('\n扫码后等待确认...\n');

    // 等待扫码
    let botToken, botUrl;
    while (true) {
      const status = await fetch(`${BASE}/ilink/bot/get_qrcode_status?qrcode=${qrcode}`).then(r => r.json());
      if (status.status === 'confirmed') {
        botToken = status.bot_token;
        botUrl = status.baseurl;
        break;
      }
      if (status.status === 'expired') {
        console.log('二维码已过期，请重新运行');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    credentials = { token: botToken, baseUrl: botUrl };
    fs.writeFileSync(CRED_FILE, JSON.stringify(credentials));
    console.log('✅ 登录成功！凭据已保存，下次启动无需重新扫码');
  }

  // 长轮询收消息
  let buf = '';
  while (true) {
    try {
      const { msgs, get_updates_buf } = await api(credentials.baseUrl, 'ilink/bot/getupdates', { get_updates_buf: buf }, credentials.token);
      buf = get_updates_buf || buf;

      for (const msg of msgs || []) {
        if (msg.message_type !== 1) continue;
        const text = msg.item_list?.[0]?.text_item?.text;
        if (!text) continue;

        console.log(`\n📩 微信: ${text}`);

        // 打字中提示
        try {
          const configData = await api(credentials.baseUrl, 'ilink/bot/getconfig', { to_user_id: msg.from_user_id }, credentials.token);
          if (configData.typing_ticket) {
            await api(credentials.baseUrl, 'ilink/bot/sendtyping', { to_user_id: msg.from_user_id, typing_ticket: configData.typing_ticket, status: 1 }, credentials.token);
          }
        } catch (e) {}

        const reply = await callAI(msg.from_user_id, text);
        console.log(`🤖 AI: ${reply}`);

        await api(credentials.baseUrl, 'ilink/bot/sendmessage', {
          msg: { to_user_id: msg.from_user_id, message_type: 2, message_state: 2, context_token: msg.context_token, item_list: [{ type: 1, text_item: { text: reply } }] },
        }, credentials.token);
      }
    } catch (e) {
      console.error('轮询错误:', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main().catch(console.error);
