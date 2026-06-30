import { executeQuery, executeInsert } from '../database';
import { useAppStore } from '../stores';
import { sendLocalNotification } from './notification';
import { formatTime, getCurrentTimeInfo } from '../utils/time';
import { callAIAPI } from './api-client';

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

  return await callAIAPI([{ role: 'user', content: '主动发一条消息' }], prompt, { max_tokens: 200, temperature: 0.9, endpoint: 'proactive' });
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
