const BASE = 'https://ilinkai.weixin.qq.com';

async function main() {
  // 1. 获取二维码
  const { qrcode, qrcode_img_content } = await fetch(`${BASE}/ilink/bot/get_bot_qrcode?bot_type=3`).then(r => r.json());
  console.log('请用微信扫描二维码：');
  console.log(qrcode_img_content);

  // 2. 等待扫码
  let botToken, botUrl;
  while (true) {
    const status = await fetch(`${BASE}/ilink/bot/get_qrcode_status?qrcode=${qrcode}`).then(r => r.json());
    if (status.status === 'confirmed') { botToken = status.bot_token; botUrl = status.baseurl; break; }
    if (status.status === 'expired') { console.log('二维码已过期'); return; }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('登录成功！');

  // 3. 长轮询收消息
  const api = (path, body) => fetch(`${botUrl || BASE}/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${botToken}` },
    body: JSON.stringify(body),
  }).then(r => r.json());

  let buf = '';
  while (true) {
    try {
      const { msgs, get_updates_buf } = await api('ilink/bot/getupdates', { get_updates_buf: buf });
      buf = get_updates_buf || buf;
      for (const msg of msgs || []) {
        if (msg.message_type !== 1) continue;
        const text = msg.item_list?.[0]?.text_item?.text;
        if (!text) continue;
        console.log('收到:', text);

        const reply = await getAIResponse(text);
        console.log('回复:', reply);

        await api('ilink/bot/sendmessage', {
          msg: { to_user_id: msg.from_user_id, message_type: 2, message_state: 2, context_token: msg.context_token, item_list: [{ type: 1, text_item: { text: reply } }] },
        });
      }
    } catch (e) { console.error('轮询错误:', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}

async function getAIResponse(userText) {
  const apiKey = process.env.AI_API_KEY || '';
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.AI_MODEL || 'deepseek-chat';

  if (!apiKey) return 'AI 未配置，请在环境变量中设置 AI_API_KEY';

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: userText }],
      max_tokens: 1024,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '抱歉，我没理解';
}

main().catch(console.error);
