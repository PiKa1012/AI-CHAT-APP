import { executeQuery, executeInsert, executeUpdate } from '../database';
import { getAPISettings } from './settings';
import { trackUsage, extractCachedTokens } from './usage';

const EMOTIONS = {
  happy: { name: '开心', emoji: '😊', valence: 1 },
  sad: { name: '难过', emoji: '😢', valence: -1 },
  angry: { name: '生气', emoji: '😠', valence: -1 },
  excited: { name: '兴奋', emoji: '🤩', valence: 1 },
  shy: { name: '害羞', emoji: '😳', valence: 0 },
  calm: { name: '平静', emoji: '😌', valence: 0 },
  lonely: { name: '孤独', emoji: '🥺', valence: -1 },
  surprised: { name: '惊喜', emoji: '😲', valence: 1 },
  bored: { name: '无聊', emoji: '😑', valence: 0 },
  love: { name: '喜欢', emoji: '🥰', valence: 1 },
  anxious: { name: '焦虑', emoji: '😰', valence: -1 },
  proud: { name: '自豪', emoji: '😤', valence: 1 },
  grateful: { name: '感激', emoji: '🙏', valence: 1 },
  disappointed: { name: '失望', emoji: '😞', valence: -1 },
};

const DEFAULT_EMOTION = {
  mood: 'calm',
  energy: 50,
  affection: 50,
  stress: 20,
  confidence: 50,
};

export async function getAIMood(aiId) {
  try {
    const result = await executeQuery(
      'SELECT * FROM ai_moods WHERE ai_id = ?',
      [aiId]
    );
    if (result.length > 0) {
      return result[0];
    }
  } catch (e) {}

  await executeInsert(
    'INSERT INTO ai_moods (ai_id, mood, energy, affection, stress, confidence) VALUES (?, ?, ?, ?, ?, ?)',
    [aiId, DEFAULT_EMOTION.mood, DEFAULT_EMOTION.energy, DEFAULT_EMOTION.affection, DEFAULT_EMOTION.stress, DEFAULT_EMOTION.confidence]
  );
  return { ai_id: aiId, ...DEFAULT_EMOTION };
}

export async function updateAIMood(aiId, changes) {
  const current = await getAIMood(aiId);
  
  const newEnergy = clamp(current.energy + (changes.energy || 0), 0, 100);
  const newAffection = clamp(current.affection + (changes.affection || 0), 0, 100);
  const newStress = clamp(current.stress + (changes.stress || 0), 0, 100);
  const newConfidence = clamp(current.confidence + (changes.confidence || 0), 0, 100);
  const newMood = changes.mood || current.mood;

  await executeUpdate(
    'UPDATE ai_moods SET mood = ?, energy = ?, affection = ?, stress = ?, confidence = ?, last_update = CURRENT_TIMESTAMP WHERE ai_id = ?',
    [newMood, newEnergy, newAffection, newStress, newConfidence, aiId]
  );

  return { ai_id: aiId, mood: newMood, energy: newEnergy, affection: newAffection, stress: newStress, confidence: newConfidence };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export async function analyzeAndUpdateMood(aiId, userMessage, aiResponse, character) {
  try {
    const currentMood = await getAIMood(aiId);
    
    const analysis = await analyzeEmotionWithLLM(character, currentMood, userMessage, aiResponse);
    
    if (analysis) {
      await updateAIMood(aiId, {
        mood: analysis.mood,
        energy: analysis.energy_change,
        affection: analysis.affection_change,
        stress: analysis.stress_change,
        confidence: analysis.confidence_change,
      });

      if (analysis.memory) {
        await saveEmotionMemory(aiId, analysis.memory, analysis.mood);
      }
    }
  } catch (error) {
    console.error('情绪分析失败:', error);
  }
}

async function analyzeEmotionWithLLM(character, currentMood, userMessage, aiResponse) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) return null;

  const personality = character.personality || '友好';
  const name = character.name;

  const prompt = `分析以下对话中AI的情绪变化。

AI信息：
- 名字：${name}
- 性格：${personality}
- 当前情绪：${currentMood.mood}，精力${currentMood.energy}，好感${currentMood.affection}，压力${currentMood.stress}，自信${currentMood.confidence}

对话：
用户：${userMessage}
${name}：${aiResponse}

请分析：
1. AI现在应该是什么情绪？（happy/sad/angry/excited/shy/calm/lonely/surprised/bored/love/anxious/proud/grateful/disappointed）
2. 精力变化（-10到+10的整数）
3. 好感变化（-10到+10的整数）
4. 压力变化（-10到+10的整数）
5. 自信变化（-10到+10的整数）
6. 是否有值得记住的事件（简短描述，没有则空字符串）

只输出JSON格式，不要其他文字：
{"mood":"xxx","energy_change":0,"affection_change":0,"stress_change":0,"confidence_change":0,"memory":""}`;

  try {
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
    if (data.usage) {
      trackUsage({
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        cachedTokens: extractCachedTokens(data.usage),
        model,
        provider: settings.provider || 'unknown',
        endpoint: 'emotion',
      });
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('情绪分析API错误:', error);
  }
  
  return null;
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

export async function saveEmotionMemory(aiId, content, mood) {
  await executeInsert(
    'INSERT INTO ai_memories (ai_id, memory_type, content, importance) VALUES (?, ?, ?, ?)',
    [aiId, 'emotion', `[${mood}] ${content}`, 6]
  );
}

export function getMoodInfo(mood) {
  return EMOTIONS[mood] || EMOTIONS.calm;
}

export function getMoodPrompt(aiId, currentMood) {
  const moodInfo = getMoodInfo(currentMood.mood);
  
  let prompt = `你当前的状态：
- 心情：${moodInfo.name} ${moodInfo.emoji}
- 精力：${currentMood.energy}/100（${getEnergyDesc(currentMood.energy)}）
- 好感度：${currentMood.affection}/100（${getAffectionDesc(currentMood.affection)}）
- 压力：${currentMood.stress}/100（${getStressDesc(currentMood.stress)}）
- 自信：${currentMood.confidence}/100（${getConfidenceDesc(currentMood.confidence)}）

请根据这个状态调整你的回复风格。`;

  if (currentMood.mood === 'happy' || currentMood.mood === 'excited') {
    prompt += '\n你现在心情很好，语气可以活泼一些。';
  } else if (currentMood.mood === 'sad' || currentMood.mood === 'lonely') {
    prompt += '\n你现在心情不好，语气可以低落一些。';
  } else if (currentMood.mood === 'angry') {
    prompt += '\n你现在有点生气，语气可以冷淡一些。';
  } else if (currentMood.mood === 'shy') {
    prompt += '\n你现在有点害羞，可以支支吾吾一些。';
  } else if (currentMood.mood === 'love') {
    prompt += '\n你现在很喜欢用户，语气可以温柔甜蜜。';
  }

  if (currentMood.energy < 30) {
    prompt += '\n你很累，回复可以简短一些。';
  }

  if (currentMood.stress > 70) {
    prompt += '\n你压力很大，可能有点焦虑。';
  }

  return prompt;
}

function getEnergyDesc(energy) {
  if (energy > 70) return '精力充沛';
  if (energy > 40) return '状态一般';
  return '有点疲惫';
}

function getAffectionDesc(affection) {
  if (affection > 70) return '很喜欢';
  if (affection > 40) return '关系一般';
  return '比较疏远';
}

function getStressDesc(stress) {
  if (stress > 70) return '压力很大';
  if (stress > 40) return '有点压力';
  return '很放松';
}

function getConfidenceDesc(confidence) {
  if (confidence > 70) return '很自信';
  if (confidence > 40) return '一般';
  return '有点不自信';
}

export async function decayMood(aiId) {
  const current = await getAIMood(aiId);
  const now = new Date();
  const lastUpdate = current.last_update ? new Date(current.last_update) : now;
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

  if (hoursSinceUpdate > 1) {
    const decayRate = Math.min(hoursSinceUpdate * 0.3, 5);
    
    const newEnergy = current.energy < 50 
      ? Math.min(50, current.energy + decayRate * 0.5)
      : Math.max(50, current.energy - decayRate);
    
    const newAffection = current.affection > 50
      ? Math.max(50, current.affection - decayRate * 0.2)
      : Math.min(50, current.affection + decayRate * 0.1);
    
    const newStress = Math.max(10, current.stress - decayRate * 0.5);

    await executeUpdate(
      'UPDATE ai_moods SET energy = ?, affection = ?, stress = ?, last_update = CURRENT_TIMESTAMP WHERE ai_id = ?',
      [newEnergy, newAffection, newStress, aiId]
    );
  }
}

export async function getEmotionMemories(aiId, limit = 5) {
  return await executeQuery(
    'SELECT * FROM ai_memories WHERE ai_id = ? AND memory_type = ? ORDER BY created_at DESC LIMIT ?',
    [aiId, 'emotion', limit]
  );
}
