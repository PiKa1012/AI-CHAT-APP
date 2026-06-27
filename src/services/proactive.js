import { executeQuery, executeInsert } from '../database';
import { useAppStore } from '../stores';
import { sendLocalNotification } from './notification';
import { formatTime, getBeijingNow } from '../utils/time';
import { getAPISettings } from './settings';

async function callAIAPI(messages, systemPrompt = '') {
  const settings = await getAPISettings();
  if (!settings?.apiKey) throw new Error('未配置API Key，请在设置中配置');

  const provider = settings.provider || 'openai';
  const baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
  const model = settings.modelName || getDefaultModel(provider);

  const apiMessages = [];
  if (systemPrompt) apiMessages.push({ role: 'system', content: systemPrompt });
  apiMessages.push(...messages);

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: 200, temperature: 0.9 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('API返回数据格式错误');
  return content;
}

function getDefaultBaseUrl(provider) {
  const urls = { openai: 'https://api.openai.com', deepseek: 'https://api.deepseek.com', qwen: 'https://dashscope.aliyuncs.com/compatible-mode' };
  return urls[provider] || '';
}

function getDefaultModel(provider) {
  const models = { openai: 'gpt-3.5-turbo', deepseek: 'deepseek-chat', qwen: 'qwen-turbo' };
  return models[provider] || '';
}

function getCurrentTimeInfo() {
  const now = getBeijingNow();
  const hour = now.hours;
  const minute = now.minutes;
  const year = now.year;
  const month = now.month;
  const day = now.day;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[now.date.getUTCDay()];

  let period;
  if (hour >= 5 && hour < 11) period = '早上';
  else if (hour >= 11 && hour < 14) period = '中午';
  else if (hour >= 14 && hour < 18) period = '下午';
  else if (hour >= 18 && hour < 22) period = '晚上';
  else period = '深夜';

  return {
    full: `${year}年${month}月${day}日 星期${weekDay} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    period,
    hour,
    minute,
    date: `${month}月${day}日`,
    weekDay: `星期${weekDay}`,
  };
}

async function getRecentContext(aiId) {
  const recentMessages = await executeQuery(
    `SELECT content, sender_type, created_at FROM messages 
     WHERE conversation_id IN (
       SELECT conversation_id FROM conversation_members WHERE member_id = ?
     )
     ORDER BY created_at DESC LIMIT 10`,
    [aiId]
  );
  return recentMessages.reverse();
}

export async function generateProactiveMessage(aiId) {
  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length === 0) throw new Error('AI角色不存在');

  const character = ai[0];
  const timeInfo = getCurrentTimeInfo();
  const recentMessages = await getRecentContext(aiId);

  const contextText = recentMessages.map(m => {
    const time = formatTime(m.created_at);
    return `[${time}] ${m.sender_type === 'user' ? '用户' : character.name}：${m.content}`;
  }).join('\n');

  const prompt = `你是${character.name}，性格${character.personality || '友好'}。${character.description || ''}

当前时间：${timeInfo.full}（${timeInfo.period}）

${contextText ? `最近的聊天记录：\n${contextText}\n` : '还没有聊天记录。\n'}

现在你想主动找用户聊天。请生成一条自然的主动消息。

要求：
- 要符合你的性格特点
- 要考虑当前时间（${timeInfo.period}），说合适的话
- 不要重复之前说过的话
- 要自然，像朋友之间发的消息
- 简短，不超过30字
- 只输出消息内容，不要其他解释`;

  return await callAIAPI([{ role: 'user', content: '主动发一条消息' }], prompt);
}

export async function triggerProactiveReply(conversationId, aiId) {
  const message = await generateProactiveMessage(aiId);
  if (!message) return;

  const store = useAppStore.getState();
  await store.sendMessage(conversationId, 'ai', aiId, message);

  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length > 0) {
    await sendLocalNotification(ai[0].name, message, { type: 'message', conversationId });
  }

  return message;
}

export async function triggerRandomProactiveChat() {
  const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
  if (ais.length === 0) throw new Error('没有可用的AI角色');

  const randomAI = ais[Math.floor(Math.random() * ais.length)];
  
  const conversations = await executeQuery(
    `SELECT c.* FROM conversations c
     JOIN conversation_members cm ON c.id = cm.conversation_id
     WHERE cm.member_id = ? AND c.type = 'private'
     ORDER BY RANDOM() LIMIT 1`,
    [randomAI.id]
  );

  if (conversations.length === 0) throw new Error('没有可用的对话');

  return await triggerProactiveReply(conversations[0].id, randomAI.id);
}
