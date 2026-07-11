import { executeQuery, executeInsert, executeUpdate } from '../database';
import { getCurrentTimeInfo, getBeijingToday } from '../utils/time';
import { getAPISettings, loadSetting } from './settings';
import { generateDiaryImage } from './imageGen';
import { callAIAPI } from './api-client';
import { sanitizeAIOutput } from './ai';

export async function getTodayContext(aiId) {
  const today = getBeijingToday();
  
  const messages = await executeQuery(
    `SELECT content, sender_type FROM messages 
     WHERE created_at >= ? AND (conversation_id IN (
       SELECT conversation_id FROM conversation_members WHERE member_id = ?
     ))
     ORDER BY created_at DESC LIMIT 20`,
    [today, aiId]
  );

  const moments = await executeQuery(
    "SELECT content FROM moments WHERE created_at >= ? AND author_type = 'user' ORDER BY created_at DESC LIMIT 5",
    [today]
  );

  const comments = await executeQuery(
    'SELECT content FROM moment_comments WHERE created_at >= ? ORDER BY created_at DESC LIMIT 5',
    [today]
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
    [aiId, getBeijingToday()]
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

  const result = sanitizeAIOutput(await callAIAPI([{ role: 'user', content: '请写今天的日记' }], prompt, { max_tokens: 4096, temperature: 0.8, endpoint: 'diary' }));
  
  const titleMatch = result.match(/标题[：:]\s*(.+)/);
  const contentMatch = result.match(/内容[：:]\s*([\s\S]+?)(?=\n心情[：:]|\n天气[：:]|$)/);
  const moodMatch = result.match(/心情[：:]\s*(.+)/);
  const weatherMatch = result.match(/天气[：:]\s*(.+)/);

  const title = titleMatch?.[1]?.trim() || `${character.name}的日记`;
  const content = contentMatch?.[1]?.trim() || `${character.name}今天过得很平静。`;
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

  if (diaries.length > 0) {
    const ids = diaries.map(d => d.id);
    const placeholders = ids.map(() => '?').join(',');
    const allComments = await executeQuery(
      `SELECT * FROM diary_comments WHERE diary_id IN (${placeholders}) ORDER BY created_at ASC`,
      ids
    );
    const commentsByDiary = {};
    for (const c of allComments) {
      if (!commentsByDiary[c.diary_id]) commentsByDiary[c.diary_id] = [];
      commentsByDiary[c.diary_id].push(c);
    }
    for (let diary of diaries) {
      diary.comments = commentsByDiary[diary.id] || [];
      diary.tags = JSON.parse(diary.tags || '[]');
      diary.images = JSON.parse(diary.images || '[]');
    }
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

    const rawReply = await callAIAPI([{ role: 'user', content: '回复用户' }], prompt, { max_tokens: 4096, temperature: 0.8, endpoint: 'diary' });
    const reply = sanitizeAIOutput(rawReply);
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
