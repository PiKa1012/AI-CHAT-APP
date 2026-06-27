import { executeQuery, executeInsert, executeUpdate } from '../database';
import { getAPISettings } from './settings';

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
    const existingIds = memories.map(m => m.id);
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

    const prompt = `分析以下对话，提取关键信息。只输出JSON数组，每个元素包含type和content：
- type: "fact"（事实，如姓名、年龄）/ "preference"（喜好）/ "event"（事件）
- content: 简短描述

对话：
${conversationText}

示例输出：
[{"type":"fact","content":"用户叫小明"},{"type":"preference","content":"用户喜欢看电影"}]

只输出JSON，不要其他文字。`;

    const response = await callMemoryAPI(prompt, settings);
    
    try {
      const memories = JSON.parse(response);
      if (Array.isArray(memories)) {
        for (const mem of memories) {
          if (mem.content && mem.type) {
            await saveMemory(aiId, mem.type, mem.content, 6);
          }
        }
      }
    } catch (e) {}
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

    const summary = await callMemoryAPI(prompt, settings);
    
    if (summary) {
      await saveMemory(aiId, MEMORY_TYPES.SUMMARY, summary, 4);
    }
  } catch (e) {
    console.error('生成摘要失败:', e);
  }
}

async function callMemoryAPI(prompt, settings) {
  const provider = settings.provider || 'openai';
  const baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
  const model = settings.modelName || getDefaultModel(provider);

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

function getDefaultBaseUrl(provider) {
  const urls = {
    openai: 'https://api.openai.com',
    deepseek: 'https://api.deepseek.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  };
  return urls[provider] || 'https://api.openai.com';
}

function getDefaultModel(provider) {
  const models = {
    openai: 'gpt-3.5-turbo',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-turbo',
  };
  return models[provider] || 'gpt-3.5-turbo';
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
