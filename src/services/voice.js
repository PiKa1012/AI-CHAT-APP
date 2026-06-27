import * as Speech from 'expo-speech';
import { saveSetting, loadSetting } from './settings';

const TTS_PROVIDERS = {
  system: { name: '系统语音', description: '手机自带语音，无需联网' },
  mimo: { name: 'MiMo语音', description: '小米MiMo TTS（需配置API）' },
  edge: { name: 'Edge语音', description: '微软Edge TTS（开发中）' },
  openai: { name: 'OpenAI语音', description: 'OpenAI TTS（需配置API）' },
};

const SYSTEM_VOICES = {
  '默认': { language: 'zh-CN', rate: 1.0, pitch: 1.0 },
  '甜美': { language: 'zh-CN', rate: 0.9, pitch: 1.3 },
  '磁性': { language: 'zh-CN', rate: 0.85, pitch: 0.7 },
  '可爱': { language: 'zh-CN', rate: 1.1, pitch: 1.4 },
  '成熟': { language: 'zh-CN', rate: 0.9, pitch: 0.8 },
};

const MIMO_VOICES = {
  'mimo-zh_female': { name: '中文女声', voice: 'zh_female' },
  'mimo-zh_male': { name: '中文男声', voice: 'zh_male' },
  'mimo-en_female': { name: '英文女声', voice: 'en_female' },
  'mimo-en_male': { name: '英文男声', voice: 'en_male' },
};

const EDGE_VOICES = {
  'edge-xiaoxiao': { name: '晓晓(女)', voice: 'zh-CN-XiaoxiaoNeural' },
  'edge-yunxi': { name: '云希(男)', voice: 'zh-CN-YunxiNeural' },
  'edge-xiaoyi': { name: '晓伊(女)', voice: 'zh-CN-XiaoyiNeural' },
  'edge-yunjian': { name: '云健(男)', voice: 'zh-CN-YunjianNeural' },
};

const OPENAI_VOICES = {
  'openai-alloy': { name: 'Alloy(中性)', voice: 'alloy' },
  'openai-echo': { name: 'Echo(男)', voice: 'echo' },
  'openai-nova': { name: 'Nova(女)', voice: 'nova' },
  'openai-shimmer': { name: 'Shimmer(女)', voice: 'shimmer' },
};

async function getVoiceSettings() {
  try {
    return await loadSetting('voice_settings', {
      provider: 'system',
      voiceId: '默认',
      autoPlay: true,
    });
  } catch (e) {}
  return {
    provider: 'system',
    voiceId: '默认',
    autoPlay: true,
  };
}

export async function saveVoiceSettings(settings) {
  await saveSetting('voice_settings', settings);
}

export function getTTSProviders() {
  return TTS_PROVIDERS;
}

export function getVoicesForProvider(provider) {
  switch (provider) {
    case 'system': return SYSTEM_VOICES;
    case 'mimo': return MIMO_VOICES;
    case 'edge': return EDGE_VOICES;
    case 'openai': return OPENAI_VOICES;
    default: return SYSTEM_VOICES;
  }
}

async function speakWithSystem(text, voiceId) {
  const config = SYSTEM_VOICES[voiceId] || SYSTEM_VOICES['默认'];
  await Speech.speak(text, {
    language: config.language,
    rate: config.rate,
    pitch: config.pitch,
  });
}

async function speakWithMiMo(text, voiceId) {
  const voiceSettings = await getVoiceSettings();
  const apiKey = voiceSettings.apiKey;
  const apiBaseUrl = voiceSettings.apiBaseUrl || 'https://api.mimo.ai';
  
  if (!apiKey) {
    console.warn('MiMo TTS需要API Key，回退到系统语音');
    await speakWithSystem(text, '默认');
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mimo-tts-1',
        input: text,
        voice: MIMO_VOICES[voiceId]?.voice || 'zh_female',
      }),
    });

    if (!response.ok) {
      console.warn('MiMo TTS失败，回退到系统语音');
      await speakWithSystem(text, '默认');
      return;
    }

    await speakWithSystem(text, '默认');
  } catch (error) {
    console.warn('MiMo TTS错误，回退到系统语音:', error);
    await speakWithSystem(text, '默认');
  }
}

export async function speakText(text, voiceId = null, provider = null) {
  const settings = await getVoiceSettings();
  const useProvider = provider || settings.provider;
  const useVoiceId = voiceId || settings.voiceId;

  switch (useProvider) {
    case 'mimo':
      await speakWithMiMo(text, useVoiceId);
      break;
    case 'edge':
    case 'openai':
      await speakWithSystem(text, useVoiceId);
      break;
    case 'system':
    default:
      await speakWithSystem(text, useVoiceId);
      break;
  }
}

export async function stopSpeaking() {
  await Speech.stop();
}

export async function isSpeaking() {
  return await Speech.isSpeakingAsync();
}

export function getAvailableVoices() {
  return Object.keys(SYSTEM_VOICES);
}
