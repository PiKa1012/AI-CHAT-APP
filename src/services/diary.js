import { executeQuery, executeInsert, executeUpdate } from '../database';
import { getBeijingNow, getBeijingToday } from '../utils/time';
import { getAPISettings, loadSetting } from './settings';
import { generateDiaryImage } from './imageGen';
import { trackUsage, extractCachedTokens } from './usage';

async function callAIAPI(messages, systemPrompt = '') {
  const settings = await getAPISettings();
  if (!settings?.apiKey) throw new Error('未配置API Key');

  const provider = settings.provider || 'openai';
  let baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
  let model = settings.modelName || getDefaultModel(provider);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${settings.apiKey}`,
  };

  const apiMessages = [];
  if (systemPrompt) apiMessages.push({ role: 'system', content: systemPrompt });
  apiMessages.push(...messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: 4096, temperature: 0.8 }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.usage) {
    trackUsage({
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      cachedTokens: extractCachedTokens(data.usage),
      model,
      provider: settings.provider || 'unknown',
      endpoint: 'diary',
    });
  }
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
  const year = now.year;
  const month = now.month;
  const day = now.day;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[now.date.getUTCDay()];
  const hour = now.hours;

  return {
    full: `${year}年${month}月${day}日 星期${weekDay}`,
    date: getBeijingToday(),
    hour,
  };
}

export async function getTodayContext(aiId) {
  const timeInfo = getCurrentTimeInfo();
  
  const messages = await executeQuery(
    `SELECT content, sender_type FROM messages 
     WHERE created_at >= ? AND (conversation_id IN (
       SELECT conversation_id FROM conversation_members WHERE member_id = ?
     ))
     ORDER BY created_at DESC LIMIT 20`,
    [timeInfo.date, aiId]
  );

  const moments = await executeQuery(
    "SELECT content FROM moments WHERE created_at >= ? AND author_type = 'user' ORDER BY created_at DESC LIMIT 5",
    [timeInfo.date]
  );

  const comments = await executeQuery(
    'SELECT content FROM moment_comments WHERE created_at >= ? ORDER BY created_at DESC LIMIT 5',
    [timeInfo.date]
  );

  return {
    messages: messages.reverse(),
    moments,
    comments,
  };
}

export async function generateDiary(aiId, style = 'normal') {
  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length === 0) throw new Error('AI角色不存在');

  const character = ai[0];
  const context = await getTodayContext(aiId);
  const timeInfo = getCurrentTimeInfo();

  const userProfile = await loadSetting('user_profile', {});
  const userName = userProfile.name || '你';

  let contextText = '';
  if (context.messages.length > 0) {
    contextText += '今天的聊天记录：\n';
    context.messages.forEach(m => {
      contextText += `${m.sender_type === 'user' ? userName : character.name}：${m.content}\n`;
    });
  }
  if (context.moments.length > 0) {
    contextText += '\n今天的朋友圈：\n';
    context.moments.forEach(m => {
      contextText += `- ${m.content}\n`;
    });
  }

  if (!contextText) {
    contextText = '今天还没有任何互动记录。';
  }

  const lastDiary = await executeQuery(
    "SELECT title, content FROM diaries WHERE ai_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 1",
    [aiId, timeInfo.date]
  );

  let avoidRepeat = '';
  if (lastDiary.length > 0) {
    avoidRepeat = `\n你上次写的日记标题是"${lastDiary[0].title}"，这次请写完全不同的内容。\n`;
  }

  const prompt = `你是${character.name}，性格${character.personality || '友好'}。${character.description || ''}

今天是${timeInfo.full}，现在是${timeInfo.hour}点。

作为${character.name}，写下你最近对${userName}的观察和感受。
回忆今天的聊天内容、你注意到的${userName}的小事、你的心情变化。
用第一人称"我"来写，不要出现自己的名字，用"${userName}"称呼${userName}。

今天的情况：
${contextText}${avoidRepeat}
输出格式：
标题：xxx
内容：xxx
心情：xxx（一个词）
天气：xxx（可选）

只输出以上格式，不要其他解释。`;

  const result = await callAIAPI([{ role: 'user', content: '请写今天的日记' }], prompt);
  
  const titleMatch = result.match(/标题[：:]\s*(.+)/);
  const contentMatch = result.match(/内容[：:]\s*([\s\S]+?)(?=\n心情[：:]|\n天气[：:]|$)/);
  const moodMatch = result.match(/心情[：:]\s*(.+)/);
  const weatherMatch = result.match(/天气[：:]\s*(.+)/);

  const title = titleMatch?.[1]?.trim() || `${character.name}的日记`;
  const content = contentMatch?.[1]?.trim() || result;
  const mood = moodMatch?.[1]?.trim() || '平静';
  const weather = weatherMatch?.[1]?.trim() || '';

  const diaryId = await executeInsert(
    'INSERT INTO diaries (ai_id, title, content, mood, weather, images) VALUES (?, ?, ?, ?, ?, ?)',
    [aiId, title, content, mood, weather, '[]']
  );

  let images = [];
  const settings = await getAPISettings();
  if (settings?.enableImageGen && settings?.enableDiaryImage) {
    try {
      const imagePath = await generateDiaryImage(title, content);
      if (imagePath) {
        images = [imagePath];
        await executeUpdate(
          'UPDATE diaries SET images = ? WHERE id = ?',
          [JSON.stringify(images), diaryId]
        );
      }
    } catch (error) {
      console.error('生成日记配图失败:', error);
    }
  }

  return { id: diaryId, title, content, mood, weather, images };
}

const PAGE_SIZE = 10;

export async function getDiaries(aiId = null, offset = 0) {
  let sql = `
    SELECT d.*, a.name as ai_name, a.avatar as ai_avatar
    FROM diaries d
    JOIN ai_characters a ON d.ai_id = a.id
  `;
  const params = [];

  if (aiId) {
    sql += ' WHERE d.ai_id = ?';
    params.push(aiId);
  }

  sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
  params.push(PAGE_SIZE + 1, offset);

  const diaries = await executeQuery(sql, params);

  const hasMore = diaries.length > PAGE_SIZE;
  if (hasMore) diaries.pop();

  for (let diary of diaries) {
    diary.comments = await executeQuery(
      'SELECT * FROM diary_comments WHERE diary_id = ? ORDER BY created_at ASC',
      [diary.id]
    );
    diary.tags = JSON.parse(diary.tags || '[]');
    diary.images = JSON.parse(diary.images || '[]');
  }

  return { diaries, hasMore };
}

export async function getDiaryById(diaryId) {
  const diaries = await executeQuery(
    `SELECT d.*, a.name as ai_name, a.avatar as ai_avatar
     FROM diaries d
     JOIN ai_characters a ON d.ai_id = a.id
     WHERE d.id = ?`,
    [diaryId]
  );

  if (diaries.length === 0) return null;

  const diary = diaries[0];
  diary.comments = await executeQuery(
    'SELECT * FROM diary_comments WHERE diary_id = ? ORDER BY created_at ASC',
    [diaryId]
  );
  diary.tags = JSON.parse(diary.tags || '[]');
  diary.images = JSON.parse(diary.images || '[]');

  return diary;
}

export async function updateDiary(diaryId, updates) {
  const allowedFields = ['title', 'content', 'mood', 'weather', 'tags', 'images', 'is_public'];
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(diaryId);

  await executeUpdate(`UPDATE diaries SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteDiary(diaryId) {
  await executeUpdate('DELETE FROM diary_comments WHERE diary_id = ?', [diaryId]);
  await executeUpdate('DELETE FROM diaries WHERE id = ?', [diaryId]);
}

export async function commentOnDiary(diaryId, authorType, authorId, content) {
  return await executeInsert(
    'INSERT INTO diary_comments (diary_id, author_type, author_id, content) VALUES (?, ?, ?, ?)',
    [diaryId, authorType, authorId, content]
  );
}

export async function aiReplyToDiaryComment(diaryId, userComment) {
  try {
    const diary = await getDiaryById(diaryId);
    if (!diary) return;

    const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [diary.ai_id]);
    if (ai.length === 0) return;

    const character = ai[0];
    const userProfile = await loadSetting('user_profile', {});
    const userName = userProfile.name || '你';

    const prompt = `你是${character.name}，性格${character.personality || '友好'}。${character.description || ''}

你写了一篇日记：
标题：${diary.title}
内容：${diary.content.substring(0, 300)}

现在${userName}在你的日记下回应了："${userComment}"
请用第一人称回复${userName}的这条回应，语气自然真诚，像朋友聊天一样。
只输出回复内容，不要加引号。`;

    const reply = await callAIAPI([{ role: 'user', content: '回复用户' }], prompt);
    if (reply) {
      await executeInsert(
        'INSERT INTO diary_comments (diary_id, author_type, author_id, content) VALUES (?, ?, ?, ?)',
        [diaryId, 'ai', diary.ai_id, reply.trim()]
      );
    }
  } catch (e) {
    console.error('AI回复日记评论失败:', e);
  }
}

export async function getDiaryStats(aiId) {
  const total = await executeQuery('SELECT COUNT(*) as count FROM diaries WHERE ai_id = ?', [aiId]);
  const thisMonth = await executeQuery(
    "SELECT COUNT(*) as count FROM diaries WHERE ai_id = ? AND datetime(created_at, '+8 hours') >= datetime('now', '+8 hours', 'start of month')",
    [aiId]
  );
  const moods = await executeQuery(
    'SELECT mood, COUNT(*) as count FROM diaries WHERE ai_id = ? GROUP BY mood ORDER BY count DESC LIMIT 5',
    [aiId]
  );
  const ai = await executeQuery('SELECT created_at FROM ai_characters WHERE id = ?', [aiId]);

  let daysKnown = 0;
  if (ai[0]?.created_at) {
    const created = new Date(ai[0].created_at);
    const today = new Date(getBeijingToday());
    const diffMs = today.getTime() - created.getTime();
    daysKnown = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }

  return {
    total: total[0]?.count || 0,
    thisMonth: thisMonth[0]?.count || 0,
    topMoods: moods || [],
    daysKnown,
  };
}
