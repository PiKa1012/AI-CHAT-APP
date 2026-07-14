import { executeQuery, executeInsert, executeUpdate } from '../database';
import { callAIAPI } from './api-client';
import { extractJSON } from './memory';

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
  } catch (e) {
    console.warn('获取AI心情失败:', e?.message);
  }

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
  const currentMood = await getAIMood(aiId);
  
  try {
    const analysis = await analyzeEmotionWithLLM(character, currentMood, userMessage, aiResponse);
    
    if (analysis) {
      const updated = await updateAIMood(aiId, {
        mood: analysis.mood,
        energy: analysis.energy_change,
        affection: analysis.affection_change,
        stress: analysis.stress_change,
        confidence: analysis.confidence_change,
      });

      if (analysis.memory) {
        await saveEmotionMemory(aiId, analysis.memory, analysis.mood);
      }
      
      return updated;
    }
  } catch (error) {
    console.error('情绪分析失败:', error);
  }
  
  return currentMood;
}

async function analyzeEmotionWithLLM(character, currentMood, userMessage, aiResponse) {
  const name = character.name;
  const description = character.description || '';

  const prompt = `分析以下对话中AI的情绪变化。

AI信息：
- 名字：${name}
- 设定：${description}
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
    const content = await callAIAPI(
      [{ role: 'user', content: prompt }],
      '你是一个情绪分析助手，严格按用户要求的JSON格式输出，不要输出其他内容。',
      { max_tokens: 600, temperature: 0.3, endpoint: 'emotion' }
    );

    const parsed = extractJSON(content);
    if (parsed && parsed.mood) {
      return parsed;
    }
  } catch (error) {
    console.error('情绪分析API错误:', error);
  }
  
  return null;
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
  
  let prompt = `你现在的情绪：${moodInfo.name}`;

  if (currentMood.mood === 'happy' || currentMood.mood === 'excited') {
    prompt += '，心情很好。多说几句话，语气活泼热烈，多用emoji。';
  } else if (currentMood.mood === 'sad' || currentMood.mood === 'lonely') {
    prompt += '，心情低落。回复简短冷淡，不想多说话。';
  } else if (currentMood.mood === 'angry') {
    prompt += '，有点生气。说话带刺，可以直接表达不满。';
  } else if (currentMood.mood === 'shy') {
    prompt += '，有点害羞。说话结结巴巴，用简短的句子。';
  } else if (currentMood.mood === 'love') {
    prompt += '，很喜欢对方。语气温柔甜蜜，可以肉麻一点。';
  } else if (currentMood.mood === 'anxious') {
    prompt += '，有点焦虑。说话吞吞吐吐，用省略号...';
  } else if (currentMood.mood === 'proud') {
    prompt += '，有点得意。说话自信满满，可以炫耀一下。';
  } else if (currentMood.mood === 'grateful') {
    prompt += '，心怀感激。说话真诚温暖。';
  } else if (currentMood.mood === 'disappointed') {
    prompt += '，有点失望。说话冷淡，可能抱怨。';
  } else if (currentMood.mood === 'bored') {
    prompt += '，无聊。说话敷衍，用最少的字。';
  } else {
    prompt += '，情绪平稳。回复随心自然。';
  }

  if (currentMood.energy < 30) {
    prompt += '精力不足，回复尽量短，一两句话就行。';
  } else if (currentMood.energy > 70) {
    prompt += '精力很足，可以多说几句，聊多点。';
  }

  if (currentMood.stress > 70) {
    prompt += '压力很大，说话可能有点冲，别太克制。';
  }

  if (currentMood.affection > 80) {
    prompt += '很喜欢对方，称呼可以亲密一些。';
  }

  return prompt;
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
