import { loadSetting } from './settings';
import * as FileSystem from 'expo-file-system';

const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

export async function generateImage(prompt) {
  const settings = await loadSetting('api_settings', {});
  const apiKey = settings?.imageGenApiKey || settings?.apiKey;
  
  if (!apiKey) {
    throw new Error('未配置图片生成API Key');
  }

  const baseUrl = settings?.imageGenBaseUrl || SILICONFLOW_BASE_URL;
  const model = settings?.imageGenModel || 'stabilityai/stable-diffusion-xl-base-1.0';

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: prompt,
      image_size: '1024x1024',
      num_inference_steps: 20,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`图片生成失败 (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  if (data.images && data.images.length > 0) {
    return data.images[0].url;
  }
  
  if (data.data && data.data.length > 0) {
    return data.data[0].url;
  }
  
  throw new Error('图片生成返回数据格式错误');
}

export async function generateAndSaveImage(prompt, folder = 'generated') {
  try {
    const imageUrl = await generateImage(prompt);
    
    const fileName = `${folder}_${Date.now()}.jpg`;
    const dirPath = `${FileSystem.documentDirectory}${folder}/`;
    
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    
    const filePath = `${dirPath}${fileName}`;
    await FileSystem.downloadAsync(imageUrl, filePath);
    
    return filePath;
  } catch (error) {
    console.error('生成并保存图片失败:', error);
    throw error;
  }
}

export async function generateMomentImage(imagePrompt, character = null, user = null) {
  let desc = '';
  if (character && user) {
    const aiName = character.name || 'AI';
    const aiGender = character.gender || '';
    const aiAge = character.age ? character.age + '岁' : '';
    const aiBackground = character.background || '';
    const aiLikes = character.likes || '';
    const aiDesc = character.description || '';
    const userName = user.name || '用户';
    const userGender = user.gender || '';

    let peopleDesc = '';
    if (userGender && aiGender) {
      if (userGender === aiGender) {
        peopleDesc = userGender === 'male' ? '两个男生' : '两个女生';
      } else {
        peopleDesc = '一男一女';
      }
    } else {
      peopleDesc = '两个人';
    }

    const aiInfo = [aiGender, aiAge, aiBackground, aiLikes, aiDesc].filter(Boolean).join('，');
    desc = `（${peopleDesc}，${userName}和${aiName}${aiInfo ? '，' + aiName + '是' + aiInfo : ''}）`;
  } else if (character) {
    const parts = [
      character.gender || '',
      character.age ? character.age + '岁' : '',
      character.background || '',
      character.likes || '',
      character.description || '',
    ].filter(Boolean);
    const name = character.name || '';
    desc = `（人物是${name}${parts.length > 0 ? '，' + parts.join('，') : ''}）`;
  }
  const prompt = `朋友圈配图${desc}，画面写实温暖，包含人物和场景：${imagePrompt}`;
  return await generateAndSaveImage(prompt, 'generated');
}

export async function generateDiaryImage(title, content) {
  const prompt = `根据以下日记内容生成一张配图，风格温馨治愈：标题"${title}"，内容"${content.substring(0, 100)}"`;
  return await generateAndSaveImage(prompt, 'generated');
}

export async function generateChatImage(description) {
  const prompt = description;
  return await generateAndSaveImage(prompt, 'generated');
}

export function isImageGenerationRequest(text) {
  const keywords = ['画', '画一个', '画一只', '画一幅', '生成图片', '生成一张', '画张', 'draw', 'generate image', '帮我画', '我想看'];
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}

export function extractImageDescription(text) {
  const patterns = [
    /画一个(.+)/,
    /画一只(.+)/,
    /画一幅(.+)/,
    /画张(.+)/,
    /生成图片[:：]?(.*)/,
    /生成一张(.+)/,
    /帮我画(.+)/,
    /我想看(.+)/,
    /draw\s+(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return text.replace(/^画/, '').trim();
}
