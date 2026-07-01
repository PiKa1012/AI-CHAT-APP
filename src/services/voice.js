import * as Speech from 'expo-speech';
import { loadSetting } from './settings';

const SYSTEM_VOICES = {
  '默认': { language: 'zh-CN', rate: 1.0, pitch: 1.0 },
  '甜美': { language: 'zh-CN', rate: 0.9, pitch: 1.3 },
  '磁性': { language: 'zh-CN', rate: 0.85, pitch: 0.7 },
  '可爱': { language: 'zh-CN', rate: 1.1, pitch: 1.4 },
  '成熟': { language: 'zh-CN', rate: 0.9, pitch: 0.8 },
};

async function getVoiceSettings() {
  try {
    return await loadSetting('voice_settings', {
      voiceId: '默认',
      autoPlay: true,
    });
  } catch {
    return { voiceId: '默认', autoPlay: true };
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

export async function speakText(text, voiceId = null) {
  const settings = await getVoiceSettings();
  const useVoiceId = voiceId || settings.voiceId;
  await speakWithSystem(text, useVoiceId);
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
