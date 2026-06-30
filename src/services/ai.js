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
      for (const call of result.toolCalls) {
        const args = JSON.parse(call.function.arguments);
        const searchResult = await searchWeb(args.query);
        messages.push(result.content ? { role: 'assistant', content: result.content } : null);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: searchResult || '未找到相关信息',
        });
      }
      apiResponse = await callAIAPI(messages.filter(Boolean), systemPrompt);
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
    await saveMemoryFromExchange(aiId, lastMessage?.content || '', apiResponse, '群聊');
  }

  const updatedMood = await analyzeAndUpdateMood(aiId, lastMessage?.content || '', apiResponse, character);
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

  const userReq = userRequest ? `\n用户要求：${userRequest}` : '';
  const chatContext = recentMessages.length > 0 && userRequest
    ? '\n聊天记录：\n' + recentMessages.map(m =>
        `${m.sender_type === 'user' ? userName : '你'}：${m.content}`
      ).join('\n').slice(0, 10000)
    : '';
  const formatHint = hasImageGen
    ? '内容：[朋友圈文字]\n配图：[一句话描述配图画面，包含人物、场景、物品]'
    : '内容：[朋友圈文字]';
  const prompt = getPersonalityPrompt(ai[0]) + `\n我的名字是${ai[0].name}，用户的名字是${userName}。
请发一条朋友圈，内容要自然真实，像普通人发的朋友圈。用第一人称"我"来写，不要出现我自己的名字。${userReq}${chatContext}
用以下格式输出：
${formatHint}`;
  const raw = await callAIAPI([{ role: 'user', content: '发一条朋友圈' }], prompt);

  const content = (raw.match(/内容[：:](.+?)(?=\n|$)/)?.[1] || (hasImageGen ? raw.replace(/配图[：:][\s\S]*$/, '').trim() : raw.trim()));
  const imageDesc = hasImageGen ? (raw.match(/配图[：:](.+?)(?=\n|$)/)?.[1] || '').trim() : '';

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
  if (userComment) {
    prompt = getPersonalityPrompt(replyAI) + `\n朋友圈内容："${momentText}"${imageContext}\n用户说："${userComment}"\n请回复用户，要自然，像朋友互动。只输出回复内容，不要其他解释。`;
  } else {
    prompt = getPersonalityPrompt(replyAI) + `\n给这条朋友圈评论："${momentText}"${imageContext}\n只输出评论内容，不要其他解释。`;
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
