import { executeQuery, executeInsert, executeUpdate } from '../database';
import { getAPISettings } from './settings';
import { callAIAPI } from './api-client';

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
  const keywords = query
    .replace(/[^\w\u4e00-\u9fff\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1)
    .slice(0, 5);

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

    const response = await callAIAPI([{ role: 'user', content: prompt }], '', { max_tokens: 200, temperature: 0.3, endpoint: 'memory' });
    
    try {
      const memories = JSON.parse(response);
      if (Array.isArray(memories)) {
        for (const mem of memories) {
          if (mem.content && mem.type) {
            await saveMemory(aiId, mem.type, mem.content, 6);
          }
        }
      }
      } catch (e) {
        console.warn('解析记忆JSON失败:', e?.message);
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

export async function saveMemoryFromExchange(aiId, userMessage, aiResponse, label = '') {
  const settings = await getAPISettings();
  if (!settings?.apiKey) return;

  const summaryPrompt = `分析这段对话，提取关键信息并分类。

用户：${userMessage}
AI：${aiResponse}

分类规则：
- fact：用户个人信息（姓名、年龄、职业等）
- preference：用户喜好（喜欢什么、讨厌什么）
- event：发生的具体事件

输出JSON格式：
{"type":"分类","content":"总结内容"}

如果没什么值得记住的，输出：{"type":"none","content":""}

只输出JSON，不要其他文字。`;

  try {
    const result = await callAIAPI([{ role: 'user', content: summaryPrompt }], '你是一个信息提取助手，按用户要求的JSON格式输出。', { max_tokens: 300, endpoint: 'memory' });
    try {
      const parsed = JSON.parse(result);
      if (parsed.type && parsed.type !== 'none' && parsed.content) {
        await executeInsert(
          'INSERT INTO ai_memories (ai_id, memory_type, content, importance) VALUES (?, ?, ?, ?)',
          [aiId, parsed.type, parsed.content, 5]
        );
      }
    } catch (e) {
      console.warn(`解析${label}记忆JSON失败:`, e?.message);
    }
  } catch (e) {
    console.warn(`保存${label}对话记忆失败:`, e?.message || e);
  }
}

export function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) return '';

  const grouped = {
    fact: [],
    preference: [],
    event: [],
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
