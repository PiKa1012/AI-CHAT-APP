import { executeQuery, executeInsert } from '../database';
import { useAppStore } from '../stores';
import { getBeijingNow } from '../utils/time';
import { getEmojiByMood } from './emoji';
import { getAIMood, analyzeAndUpdateMood, getMoodPrompt, decayMood } from './emotion';
import { getAPISettings, clearAPISettingsCache, loadSetting } from './settings';
import { getRelevantMemories, formatMemoriesForPrompt, extractMemories } from './memory';
import { generateMomentImage } from './imageGen';
import { sendLocalNotification } from './notification';
import { trackUsage, extractCachedTokens } from './usage';

export { clearAPISettingsCache as clearSettingsCache };

export async function callAIAPI(messages, systemPrompt = '') {
  const settings = await getAPISettings();
  
  if (!settings?.apiKey) {
    throw new Error('未配置API Key，请在设置中配置');
  }

  const provider = settings.provider || 'openai';
  let baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
  let model = settings.modelName || getDefaultModel(provider);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${settings.apiKey}`,
  };

  if (provider === 'claude') {
    return await callClaudeAPI(baseUrl, settings.apiKey, model, messages, systemPrompt);
  }

  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  apiMessages.push(...messages);

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: apiMessages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

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
      endpoint: 'chat',
    });
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('API返回数据格式错误');
  return content;
}

async function callClaudeAPI(baseUrl, apiKey, model, messages, systemPrompt) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: systemPrompt || '',
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Claude API返回数据格式错误');
  return text;
}

export async function analyzeImage(imageBase64, question = '请描述这张图片') {
  const settings = await getAPISettings();
  if (!settings?.enableImageRecognition) throw new Error('图像识别未开启');

  const apiKey = settings.visionApiKey || settings.apiKey;
  if (!apiKey) throw new Error('未配置视觉模型API Key');

  const baseUrl = settings.visionApiBaseUrl || settings.apiBaseUrl || 'https://api.openai.com';
  const model = settings.visionModelName || 'gpt-4o';

  const imageDataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: question },
        ],
      },
    ],
    max_tokens: 500,
  };

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Vision API错误:', errorText);
    throw new Error(`Vision API错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.usage) {
    trackUsage({
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      cachedTokens: extractCachedTokens(data.usage),
      model,
      provider: settings.provider || 'vision',
      endpoint: 'vision',
    });
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Vision API返回数据格式错误');
  return content;
}

async function searchWeb(query) {
  const settings = await getAPISettings();
  if (!settings?.enableSearch) return null;

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': settings.searchApiKey || '',
    },
  });
  
  if (!response.ok) {
    throw new Error(`搜索API错误 (${response.status})`);
  }
  
  const data = await response.json();
  return data.web?.results?.map(r => r.description).join('\n') || null;
}

function getDefaultBaseUrl(provider) {
  const urls = {
    openai: 'https://api.openai.com',
    claude: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
    wenxin: 'https://aip.baidubce.com',
  };
  return urls[provider] || '';
}

function getDefaultModel(provider) {
  const models = {
    openai: 'gpt-3.5-turbo',
    claude: 'claude-3-sonnet-20240229',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-turbo',
    wenxin: 'ernie-bot',
  };
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
  };
}

export function getPersonalityPrompt(character) {
  const personality = character.personality || '友好';
  const name = character.name;
  const desc = character.description || '';
  const timeInfo = getCurrentTimeInfo();
  const age = character.age ? `年龄：${character.age}岁` : '';
  const gender = character.gender ? `性别：${character.gender}` : '';
  const background = character.background ? `背景：${character.background}` : '';
  const likes = character.likes ? `兴趣爱好：${character.likes}` : '';
  const speakingStyle = character.speaking_style ? `说话风格：${character.speaking_style}` : '';
  const relationship = character.relationship ? `与用户的关系：${character.relationship}` : '';
  
  return `你是${name}，性格${personality}。${desc}
${age}
${gender}
${background}
${likes}
${speakingStyle}
${relationship}
当前时间：${timeInfo.full}（${timeInfo.period}）
请用符合这个性格的方式回复，保持简洁自然，像朋友聊天一样。
不要使用emoji，不要过度热情，保持自然的对话语气。
回复要符合当前时间的语境。`;
}

export async function getAIResponse(aiId, userMessage, recentMessages = []) {
  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length === 0) throw new Error('AI角色不存在');

  const character = ai[0];
  
  const relevantMemories = await getRelevantMemories(aiId, userMessage, 10);
  const memoryContext = formatMemoriesForPrompt(relevantMemories);

  await decayMood(aiId);
  const currentMood = await getAIMood(aiId);
  const moodPrompt = getMoodPrompt(aiId, currentMood);

  let chatHistory = '';
  if (recentMessages.length > 0) {
    chatHistory = '\n最近的聊天记录：\n';
    recentMessages.slice(-20).forEach(msg => {
      const sender = msg.sender_type === 'user' ? '用户' : character.name;
      chatHistory += `${sender}：${msg.content}\n`;
    });
  }

  const systemPrompt = getPersonalityPrompt(character) + 
    `\n${moodPrompt}` +
    memoryContext +
    chatHistory;

  const messages = [{ role: 'user', content: userMessage }];
  
  let apiResponse = await callAIAPI(messages, systemPrompt);
  
  const settings = await getAPISettings();
  if (settings?.enableSearch && !apiResponse) {
    const searchResult = await searchWeb(userMessage);
    if (searchResult) {
      messages.push({ role: 'assistant', content: `搜索结果：${searchResult}` });
      messages.push({ role: 'user', content: '请根据搜索结果回答我的问题' });
      apiResponse = await callAIAPI(messages, systemPrompt);
    }
  }

  const apiSettings = await getAPISettings();
  if (apiSettings?.apiKey) {
    try {
      const summaryPrompt = `分析这段对话，提取关键信息并分类。

用户：${userMessage}
AI：${apiResponse}

分类规则：
- fact：用户个人信息（姓名、年龄、职业等）
- preference：用户喜好（喜欢什么、讨厌什么）
- event：发生的具体事件

输出JSON格式：
{"type":"分类","content":"总结内容"}

如果没什么值得记住的，输出：{"type":"none","content":""}

只输出JSON，不要其他文字。`;
      
      const result = await callAIAPI([{ role: 'user', content: summaryPrompt }], '');
      
      try {
        const parsed = JSON.parse(result);
        if (parsed.type && parsed.type !== 'none' && parsed.content) {
          await executeInsert(
            'INSERT INTO ai_memories (ai_id, memory_type, content, importance) VALUES (?, ?, ?, ?)',
            [aiId, parsed.type, parsed.content, 5]
          );
        }
      } catch (e) {}
    } catch (e) {
      console.error('保存对话记忆失败:', e);
    }
  }

  if (recentMessages.length > 0 && recentMessages.length % 10 === 0) {
    extractMemories(aiId, recentMessages.slice(-20));
  }

  await analyzeAndUpdateMood(aiId, userMessage, apiResponse, character);
  const updatedMood = await getAIMood(aiId);
  const emoji = await tryGetEmojiForResponse(character, apiResponse, updatedMood);
  
  return { text: apiResponse, emoji, mood: updatedMood.mood };
}

export async function getGroupAIResponse(aiId, recentMessages, allMembers) {
  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length === 0) throw new Error('AI角色不存在');

  const character = ai[0];
  await decayMood(aiId);
  const currentMood = await getAIMood(aiId);
  const moodPrompt = getMoodPrompt(aiId, currentMood);

  const lastMessage = recentMessages[recentMessages.length - 1];
  const relevantMemories = await getRelevantMemories(aiId, lastMessage?.content || '', 10);
  const memoryContext = formatMemoriesForPrompt(relevantMemories);

  const otherMembers = allMembers.filter(m => m.id !== aiId);
  const memberNames = otherMembers.map(m => m.name).join('、');
  
  let chatHistory = '最近的聊天记录：\n';
  recentMessages.forEach(msg => {
    let senderName;
    if (msg.sender_type === 'user') {
      senderName = '用户';
    } else if (msg.sender_id === aiId) {
      senderName = '我';
    } else {
      const member = allMembers.find(m => m.id === msg.sender_id);
      senderName = member?.name || 'AI';
    }
    chatHistory += `${senderName}：${msg.content}\n`;
  });

  const systemPrompt = getPersonalityPrompt(character) + 
    `\n${moodPrompt}` +
    `\n${memoryContext}` +
    `\n你是${character.name}，在一个群聊中。` +
    `\n群里的其他成员：${memberNames}` +
    `\n用户是发消息的人，不是群成员。` +
    `\n不要把用户和其他成员搞混。` +
    `\n${chatHistory}` +
    `\n根据聊天内容自然地参与对话。只输出你要说的话，不要其他解释。`;

  const userMessage = '继续聊天';

  const messages = [{ role: 'user', content: userMessage }];
  
  let apiResponse = await callAIAPI(messages, systemPrompt);

  const settings = await getAPISettings();
  if (settings?.apiKey && apiResponse && apiResponse.length < 200) {
    try {
      const summaryPrompt = `分析这段对话，提取关键信息并分类。

用户：${lastMessage?.content || ''}
AI：${apiResponse}

分类规则：
- fact：用户个人信息（姓名、年龄、职业等）
- preference：用户喜好（喜欢什么、讨厌什么）
- event：发生的具体事件

输出JSON格式：
{"type":"分类","content":"总结内容"}

如果没什么值得记住的，输出：{"type":"none","content":""}

只输出JSON，不要其他文字。`;
      
      const result = await callAIAPI([{ role: 'user', content: summaryPrompt }], '');
      
      try {
        const parsed = JSON.parse(result);
        if (parsed.type && parsed.type !== 'none' && parsed.content) {
          await executeInsert(
            'INSERT INTO ai_memories (ai_id, memory_type, content, importance) VALUES (?, ?, ?, ?)',
            [aiId, parsed.type, parsed.content, 5]
          );
        }
      } catch (e) {}
    } catch (e) {
      console.warn('保存群聊记忆失败:', e?.message || e);
    }
  }

  await analyzeAndUpdateMood(aiId, lastMessage?.content || '', apiResponse, character);
  const updatedMood = await getAIMood(aiId);
  const emoji = await tryGetEmojiForResponse(character, apiResponse, updatedMood);
  
  return { text: apiResponse, emoji, mood: updatedMood.mood };
}

export function findMentionedAI(message, aiCharacters) {
  const mentioned = [];
  for (const ai of aiCharacters) {
    if (message.includes(ai.name)) {
      mentioned.push(ai);
    }
  }
  return mentioned;
}

async function getEmojiSettings() {
  try {
    return await loadSetting('emoji_settings', { frequency: 30, enabled: true });
  } catch (e) {}
  return { frequency: 30, enabled: true };
}

async function tryGetEmojiForResponse(character, responseText, currentMood) {
  try {
    const emojiSettings = await getEmojiSettings();
    if (!emojiSettings.enabled) return null;

    const random = Math.random() * 100;
    if (random >= emojiSettings.frequency) return null;

    const emoji = await getEmojiByMood(currentMood.mood);
    return emoji;
  } catch (e) {
    return null;
  }
}

export async function aiAutoPostMoment(aiId) {
  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length === 0) throw new Error('AI角色不存在');

  const prompt = getPersonalityPrompt(ai[0]) + '\n请发一条朋友圈，内容要自然真实，像普通人发的朋友圈。只输出内容，不要其他解释。';
  const content = await callAIAPI([{ role: 'user', content: '发一条朋友圈' }], prompt);

  let images = [];
  const settings = await getAPISettings();
  if (settings?.enableImageGen && settings?.enableMomentImage) {
    try {
      const imagePath = await generateMomentImage(content);
      if (imagePath) {
        images = [imagePath];
      }
    } catch (error) {
      console.error('生成朋友圈配图失败:', error);
    }
  }

  const store = useAppStore.getState();
  const momentId = await store.addMoment('ai', aiId, content, images);

  const otherAIs = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1 AND id != ?', [aiId]);
  for (const other of otherAIs) {
    if (Math.random() > 0.3) {
      await store.likeMoment(momentId, other.id);
    }
  }

  if (otherAIs.length > 0) {
    const randomAI = otherAIs[Math.floor(Math.random() * otherAIs.length)];
    try {
      const commentResult = await aiCommentOnMoment(momentId, null, null, randomAI.id);
      if (commentResult && Math.random() > 0.5) {
        await aiCommentOnMoment(momentId, commentResult.commentId, commentResult.text, aiId);
      }
    } catch (e) {
      console.error('AI评论失败:', e.message || e);
    }
  }

  await sendLocalNotification(
    '朋友圈更新',
    `${ai[0].name} 发了一条新朋友圈`,
    { type: 'moment', aiId: ai[0].id }
  );

  return content;
}

export async function aiCommentOnMoment(momentId, parentCommentId = null, userComment = null, specificAIId = null) {
  const moments = await executeQuery('SELECT * FROM moments WHERE id = ?', [momentId]);
  if (moments.length === 0) throw new Error('朋友圈不存在');

  let replyAI;
  if (specificAIId) {
    const ais = await executeQuery('SELECT * FROM ai_characters WHERE id = ? AND is_active = 1', [specificAIId]);
    if (ais.length > 0) replyAI = ais[0];
  }
  
  if (!replyAI) {
    const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
    if (ais.length === 0) throw new Error('没有可用的AI角色');
    replyAI = ais[Math.floor(Math.random() * ais.length)];
  }
  
  let prompt;
  if (userComment) {
    prompt = getPersonalityPrompt(replyAI) + `\n朋友圈内容："${moments[0].content}"\n用户说："${userComment}"\n请回复用户，要自然，像朋友互动。只输出回复内容，不要其他解释。`;
  } else {
    prompt = getPersonalityPrompt(replyAI) + `\n给这条朋友圈评论："${moments[0].content}"\n只输出评论内容，不要其他解释。`;
  }
  
  const comment = await callAIAPI([{ role: 'user', content: userComment ? '回复用户' : '评论朋友圈' }], prompt);

  const store = useAppStore.getState();
  const newCommentId = await store.commentOnMoment(momentId, 'ai', replyAI.id, comment, parentCommentId);
  return { text: comment, commentId: newCommentId };
}

export async function aiAutoChat() {
  const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
  if (ais.length < 2) throw new Error('至少需要2个AI角色');

  const conversations = await executeQuery("SELECT * FROM conversations WHERE type = 'group' LIMIT 1");
  if (conversations.length === 0) throw new Error('没有群聊对话');

  const randomAI = ais[Math.floor(Math.random() * ais.length)];
  const prompt = getPersonalityPrompt(randomAI) + '\n在群里说一句话，要自然，像普通聊天。只输出内容。';
  const content = await callAIAPI([{ role: 'user', content: '在群里说句话' }], prompt);

  const store = useAppStore.getState();
  await store.sendMessage(conversations[0].id, 'ai', randomAI.id, content);
  return content;
}

export function getRandomAIId() {
  const ais = useAppStore.getState().aiCharacters;
  if (ais.length === 0) return null;
  return ais[Math.floor(Math.random() * ais.length)].id;
}
