import { executeQuery } from '../database';
import { useAppStore } from '../stores';
import { getCurrentTimeInfo } from '../utils/time';
import { getEmojiByMood } from './emoji';
import { getAIMood, analyzeAndUpdateMood, getMoodPrompt, decayMood } from './emotion';
import { getAPISettings, clearAPISettingsCache, loadSetting } from './settings';
import { getRelevantMemories, formatMemoriesForPrompt, extractMemories, saveMemoryFromExchange } from './memory';
import { generateMomentImage } from './imageGen';
import { sendLocalNotification } from './notification';
import { callAIAPI, searchWeb } from './api-client';
import * as FileSystem from 'expo-file-system';

export { clearAPISettingsCache as clearSettingsCache, callAIAPI };

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeout);

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

async function getUserInfoPrompt() {
  try {
    const profile = await loadSetting('user_profile', {});
    const parts = [];
    if (profile.name) parts.push(`用户名字：${profile.name}`);
    if (profile.gender) parts.push(`性别：${profile.gender}`);
    if (profile.age) parts.push(`年龄：${profile.age}岁`);
    if (profile.personality) parts.push(`性格：${profile.personality}`);
    return parts.length > 0 ? '\n' + parts.join('\n') : '';
  } catch { return ''; }
}

export function getPersonalityPrompt(character) {
  const name = character.name;
  const desc = character.description || '';
  const signature = character.signature ? `\n个性签名：${character.signature}` : '';
  const timeInfo = getCurrentTimeInfo();
  
  return `你是${name}。${desc}${signature}
当前时间：${timeInfo.full}（${timeInfo.period}）
请用符合以上设定的方式回复，保持简洁自然，像朋友聊天一样。
不要使用emoji，不要过度热情，保持自然的对话语气。`;
}

export function sanitizeAIOutput(text) {
  if (!text || typeof text !== 'string') return text || '';

  let cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^当前时间[^\n]*\n?/gm, '')
    .replace(/^请用符合[^\n]*\n?/gm, '')
    .replace(/^不要使用[^\n]*\n?/gm, '')
    .replace(/^你是一个[^\n]*\n?/gm, '')
    .replace(/^个性签名[^\n]*\n?/gm, '')
    .replace(/^你是[^，,\n]{0,30}[^\n]*\n?/gm, '')
    .replace(/\n{3,}/g, '\n')
    .trim();

  if (!cleaned || cleaned.length < 2) {
    return text.replace(/```[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n').trim() || '嗯嗯，好的';
  }

  return cleaned;
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
    await getUserInfoPrompt() +
    chatHistory;

  const messages = [{ role: 'user', content: userMessage }];
  
  const settings = await getAPISettings();
  
  let apiResponse;
  if (settings?.enableSearch) {
    const searchTool = {
      type: 'function',
      function: {
        name: 'search_web',
        description: '当用户询问实时信息、最新新闻、你不知道的内容时，搜索网络获取最新信息',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
          },
          required: ['query'],
        },
      },
    };

    const result = await callAIAPI(messages, systemPrompt, { tools: [searchTool] });

    if (result.toolCalls) {
      messages.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls });
      for (const call of result.toolCalls) {
        const args = JSON.parse(call.function.arguments);
        const searchResult = await searchWeb(args.query);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: searchResult || '未找到相关信息',
        });
      }
      apiResponse = await callAIAPI(messages, systemPrompt);
    } else {
      apiResponse = result;
    }
  } else {
    apiResponse = await callAIAPI(messages, systemPrompt);
  }

  if (settings?.apiKey) {
    await saveMemoryFromExchange(aiId, userMessage, apiResponse, '');
  }

  if (recentMessages.length > 0 && recentMessages.length % 10 === 0) {
    extractMemories(aiId, recentMessages.slice(-20));
  }

  const updatedMood = await analyzeAndUpdateMood(aiId, userMessage, apiResponse, character);
  const emoji = await tryGetEmojiForResponse(character, apiResponse, updatedMood);
  
  return { text: sanitizeAIOutput(apiResponse), emoji, mood: updatedMood.mood };
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
    await getUserInfoPrompt() +
    `\n${chatHistory}` +
    `\n根据聊天内容自然地参与对话。只输出你要说的话，不要其他解释。`;

  const userMessage = '继续聊天';

  const messages = [{ role: 'user', content: userMessage }];
  
  let apiResponse = await callAIAPI(messages, systemPrompt);

  const settings = await getAPISettings();
  if (settings?.apiKey && apiResponse && apiResponse.length < 200) {
    await saveMemoryFromExchange(aiId, lastMessage?.content || '', apiResponse, '群聊');
  }

  const updatedMood = await analyzeAndUpdateMood(aiId, lastMessage?.content || '', apiResponse, character);
  const emoji = await tryGetEmojiForResponse(character, apiResponse, updatedMood);
  
  return { text: sanitizeAIOutput(apiResponse), emoji, mood: updatedMood.mood };
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
  } catch (e) {
    console.warn('获取表情设置失败:', e?.message);
  }
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

export async function aiAutoPostMoment(aiId, userRequest = null, recentMessages = []) {
  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [aiId]);
  if (ai.length === 0) throw new Error('AI角色不存在');

  const settings = await getAPISettings();
  const hasImageGen = settings?.enableImageGen && settings?.enableMomentImage;
  const userProfile = await loadSetting('user_profile', {});
  const userName = userProfile.name || '你';
  const userGender = userProfile.gender || '';
  const userAge = userProfile.age || '';
  const userInfo = [userGender, userAge ? `${userAge}岁` : ''].filter(Boolean).join('，');

  const userReq = userRequest ? `\n用户要求：${userRequest}` : '';
  const chatContext = recentMessages.length > 0 && userRequest
    ? '\n聊天记录：\n' + recentMessages.map(m =>
        `${m.sender_type === 'user' ? userName : '你'}：${m.content}`
      ).join('\n').slice(0, 10000)
    : '';
  const formatHint = hasImageGen
    ? '内容：(写朋友圈正文)\n配图：(一句话描述配图画面，包含人物、场景、物品)\n回复：(一条简短的聊天回复，告知对方你已发朋友圈，语气活泼自然，要有你的个人风格)'
    : '内容：(写朋友圈正文)\n回复：(一条简短的聊天回复，告知对方你已发朋友圈，语气活泼自然，要有你的个人风格)';
  const prompt = getPersonalityPrompt(ai[0]) + `\n我的名字是${ai[0].name}，用户的名字是${userName}${userInfo ? `，${userInfo}` : ''}。
 请根据上面的聊天记录发一条朋友圈，话题要跟聊天内容相关。用第一人称"我"来写，像普通人发的朋友圈一样自然。不要出现我自己的名字。${userReq}${chatContext}
只输出朋友圈正文和配图描述，不要输出其他解释。按照以下格式输出（将括号内容替换为实际文字）：
${formatHint}`;
  const raw = sanitizeAIOutput(await callAIAPI([{ role: 'user', content: '发一条朋友圈' }], prompt, { max_tokens: 1000 }));

  const match = raw.match(/内容[：:]\s*([\s\S]+?)(?=\n*\s*(?:配图|回复)[：:]|\s*$)/);
  let content = match ? match[1].trim() : '';

  const hasPlaceholder = content.includes('（') || content.includes('【') || content.includes('[');
  if (!content || hasPlaceholder || /用户要求|聊天记录|请发一条朋友圈/.test(content)) {
    content = raw
      .replace(/[\s\S]*?内容[：:]\s*/, '')
      .replace(/(?:配图|回复)[：:][\s\S]*$/, '')
      .replace(/用户要求[：:][^\n]*/g, '')
      .replace(/聊天记录[\s\S]*$/g, '')
      .replace(/用以下格式输出[\s\S]*$/g, '')
      .replace(/我的名字是[^\n]*/g, '')
      .replace(/请发一条朋友圈[^\n]*/g, '')
      .replace(/当前时间[：:][^\n]*/g, '')
      .replace(/你是[^，\n]+，[^\n]*/g, '')
      .replace(/[\[\]【】（）]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (!content) {
    content = raw.trim();
  }

  let imageDesc = '';
  if (hasImageGen) {
    const imgMatch = raw.match(/配图[：:]\s*([\s\S]+?)(?=\s*$)/);
    if (imgMatch) {
      imageDesc = imgMatch[1].trim();
      if (imageDesc.includes('（') || imageDesc.includes('【') || imageDesc.includes('[')) {
        imageDesc = '';
      }
    }
  }

  let reply = '';
  const replyMatch = raw.match(/回复[：:]\s*(.+?)(?=\n|$)/);
  if (replyMatch) {
    reply = replyMatch[1].trim();
    if (reply.includes('（') || reply.includes('【') || reply.includes('[')) {
      reply = '';
    }
  }

  let images = [];
  if (hasImageGen) {
    try {
      const imagePrompt = imageDesc || content;
      const user = await loadSetting('user_profile', {});
      const imagePath = await generateMomentImage(imagePrompt, ai[0], user);
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

  return { content, reply };
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
  
  let momentText = moments[0].content || '';
  const images = JSON.parse(moments[0].images || '[]');

  let imageContext = '';
  if (images.length > 0) {
    const settings = await getAPISettings();
    if (settings?.enableImageRecognition) {
      try {
        const base64 = await FileSystem.readAsStringAsync(images[0], {
          encoding: FileSystem.EncodingType.Base64,
        });
        const description = await analyzeImage(base64, '请用一句话描述这张图片的内容');
        imageContext = `\n图片内容：${description}`;
      } catch (e) {
        imageContext = '\n这条朋友圈有图片';
      }
    } else {
      imageContext = '\n这条朋友圈有图片';
    }
  }
  
  let prompt;
  const userInfo = await getUserInfoPrompt();
  if (userComment) {
    prompt = getPersonalityPrompt(replyAI) + `\n朋友圈内容："${momentText}"${imageContext}\n用户说："${userComment}"\n请回复用户，要自然，像朋友互动。只输出回复内容，不要其他解释。${userInfo}`;
  } else {
    prompt = getPersonalityPrompt(replyAI) + `\n给这条朋友圈评论："${momentText}"${imageContext}\n只输出评论内容，不要其他解释。${userInfo}`;
  }
  
  const rawComment = await callAIAPI([{ role: 'user', content: userComment ? '回复用户' : '评论朋友圈' }], prompt);
  const comment = sanitizeAIOutput(rawComment);

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
  const content = sanitizeAIOutput(await callAIAPI([{ role: 'user', content: '在群里说句话' }], prompt));

  const store = useAppStore.getState();
  await store.sendMessage(conversations[0].id, 'ai', randomAI.id, content);
  return content;
}

export function getRandomAIId() {
  const ais = useAppStore.getState().aiCharacters;
  if (ais.length === 0) return null;
  return ais[Math.floor(Math.random() * ais.length)].id;
}
