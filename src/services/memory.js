import { executeQuery, executeInsert, executeUpdate } from '../database';
import { getAPISettings } from './settings';
import { callAIAPI } from './api-client';

export function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1]); } catch {} }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch {} }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  return null;
}

const MEMORY_TYPES = {
  FACT: 'fact',
  PREFERENCE: 'preference',
  EVENT: 'event',
  SUMMARY: 'summary',
};

export async function saveMemory(aiId, type, content, importance = 5, context = null) {
  const existing = await executeQuery(
    'SELECT id FROM ai_memories WHERE ai_id = ? AND content = ?',
    [aiId, content]
  );
  
  if (existing.length > 0) {
    await executeUpdate(
      'UPDATE ai_memories SET importance = ?, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
      [importance, existing[0].id]
    );
    return existing[0].id;
  }

  return await executeInsert(
    'INSERT INTO ai_memories (ai_id, memory_type, content, importance, context) VALUES (?, ?, ?, ?, ?)',
    [aiId, type, content, importance, context]
  );
}

export async function getRelevantMemories(aiId, query, limit = 10) {
  const clean = query.replace(/[^\w\u4e00-\u9fff]/g, '');
  const tokens = [];
  for (let i = 0; i < clean.length - 1; i++) {
    tokens.push(clean.slice(i, i + 2));
  }
  const keywords = [...new Set(tokens)].slice(0, 10);

  if (keywords.length === 0) {
    return await executeQuery(
      'SELECT * FROM ai_memories WHERE ai_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?',
      [aiId, limit]
    );
  }

  const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
  const params = [aiId, ...keywords.map(k => `%${k}%`), limit];

  const memories = await executeQuery(
    `SELECT * FROM ai_memories 
     WHERE ai_id = ? AND (${conditions})
     ORDER BY importance DESC, created_at DESC 
     LIMIT ?`,
    params
  );

  if (memories.length < limit) {
    const existingIds = memories.map(m => Number(m.id));
    const placeholders = existingIds.length > 0 
      ? `AND id NOT IN (${existingIds.join(',')})` 
      : '';
    
    const moreMemories = await executeQuery(
      `SELECT * FROM ai_memories 
       WHERE ai_id = ? ${placeholders}
       ORDER BY importance DESC, created_at DESC 
       LIMIT ?`,
      [aiId, limit - memories.length]
    );
    
    return [...memories, ...moreMemories];
  }

  return memories;
}

export async function extractMemories(aiId, messages) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) return;

  try {
    const conversationText = messages
      .map(m => `${m.sender_type === 'user' ? '用户' : 'AI'}：${m.content}`)
      .join('\n');

    const prompt = `分析以下对话，提取关键信息并正确分类。

对话：
${conversationText}

分类规则（严格遵守）：
- "fact"：用户的个人信息（姓名、年龄、职业、所在地等）
- "preference"：用户的喜好、偏好（喜欢什么、讨厌什么、爱好等）
- "event"：发生的具体事件、经历（去了哪里、做了什么、遇到什么事）

示例：
- "我叫小明" → fact
- "我今年20岁" → fact
- "我喜欢吃火锅" → preference
- "我喜欢看电影" → preference
- "我今天去了公园" → event
- "我昨天考试了" → event
- "定时任务" → 不提取，忽略
- "提醒我吃饭" → 不提取，忽略

只输出JSON数组，每个元素包含type和content：
[{"type":"fact","content":"用户叫小明"},{"type":"preference","content":"用户喜欢吃火锅"}]

如果对话中没有值得记忆的信息，输出空数组：[]
只输出JSON，不要其他文字。`;

    const response = await callAIAPI([{ role: 'user', content: prompt }], '', { max_tokens: 1000, temperature: 0.3, endpoint: 'memory' });
    
    const memories = extractJSON(response);
    if (Array.isArray(memories)) {
      for (const mem of memories) {
        if (mem.content && mem.type) {
          await saveMemory(aiId, mem.type, mem.content, 6);
        }
      }
    }
  } catch (e) {
    console.error('提取记忆失败:', e);
  }
}

export async function generateSummary(aiId, messages) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) return;

  try {
    const conversationText = messages
      .map(m => `${m.sender_type === 'user' ? '用户' : 'AI'}：${m.content}`)
      .join('\n');

    const prompt = `用一句话总结这段对话的要点（不超过50字）：

${conversationText}

只输出总结，不要其他文字。`;

    const summary = await callAIAPI([{ role: 'user', content: prompt }], '', { max_tokens: 200, temperature: 0.3, endpoint: 'memory' });
    
    if (summary) {
      await saveMemory(aiId, MEMORY_TYPES.SUMMARY, summary, 4);
    }
  } catch (e) {
    console.error('生成摘要失败:', e);
  }
}

export function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) return '';

  const grouped = {
    fact: [],
    preference: [],
    event: [],
    emotion: [],
    summary: [],
  };

  memories.forEach(m => {
    if (grouped[m.memory_type]) {
      grouped[m.memory_type].push(m.content);
    }
  });

  let result = '';

  if (grouped.fact.length > 0) {
    result += `\n关于用户的事实：\n${grouped.fact.map(c => `- ${c}`).join('\n')}`;
  }
  if (grouped.preference.length > 0) {
    result += `\n用户的喜好：\n${grouped.preference.map(c => `- ${c}`).join('\n')}`;
  }
  if (grouped.event.length > 0) {
    result += `\n最近发生的事：\n${grouped.event.map(c => `- ${c}`).join('\n')}`;
  }
  if (grouped.emotion.length > 0) {
    result += `\n重要的情绪记忆：\n${grouped.emotion.slice(0, 3).map(c => `- ${c}`).join('\n')}`;
  }
  if (grouped.summary.length > 0) {
    result += `\n之前的对话摘要：\n${grouped.summary.slice(0, 3).map(c => `- ${c}`).join('\n')}`;
  }

  return result;
}

export async function getAllMemories(aiId) {
  return await executeQuery(
    'SELECT * FROM ai_memories WHERE ai_id = ? ORDER BY importance DESC, created_at DESC',
    [aiId]
  );
}

export async function deleteMemory(memoryId) {
  await executeUpdate('DELETE FROM ai_memories WHERE id = ?', [memoryId]);
}

export async function clearAllMemories(aiId) {
  await executeUpdate('DELETE FROM ai_memories WHERE ai_id = ?', [aiId]);
}
