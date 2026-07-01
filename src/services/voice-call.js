import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { loadSetting } from './settings';

const CHUNK_MS = 500;
const AUDIO_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

export class VoiceCallService {
  constructor() {
    this.ws = null;
    this.recording = null;
    this.sounds = [];
    this.active = false;
    this.onStateChange = null;
    this.onError = null;
    this.wsUrl = null;
    this.xfConfig = null;
  }

  async connect(characterId, callbacks) {
    this.onStateChange = callbacks.onStateChange;
    this.onError = callbacks.onError;
    this.active = true;

    // 从设置读取服务器地址和讯飞凭据
    try {
      const settings = await loadSetting('api_settings', {});
      this.wsUrl = settings.voiceServerUrl || '';
      this.xfConfig = {
        xfAppId: settings.xfAppId || '',
        xfApiKey: settings.xfApiKey || '',
        xfApiSecret: settings.xfApiSecret || '',
      };
    } catch (e) {
      this.wsUrl = '';
      this.xfConfig = { xfAppId: '', xfApiKey: '', xfApiSecret: '' };
    }

    if (!this.wsUrl) {
      this.onError?.('请在 API 设置中配置语音通话服务器地址');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (e) {
      console.warn('Audio mode error:', e);
    }

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (e) {
      this.onError?.('无法连接服务器');
      return;
    }

    this.ws.onopen = () => {
      // 发送拨号指令，附带讯飞凭据
      this.ws.send(JSON.stringify({
        type: 'dial',
        characterId,
        xfConfig: this.xfConfig,
      }));
      this.startRecordingLoop();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.warn('WS parse error:', e);
      }
    };

    this.ws.onerror = () => {
      this.onError?.('连接断开');
      this.cleanup();
    };

    this.ws.onclose = () => {
      this.active = false;
      this.onStateChange?.('hungup');
    };
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'ringing':
        this.onStateChange?.('ringing');
        break;
      case 'connected':
        this.onStateChange?.('connected');
        break;
      case 'audio':
        this.playAudio(msg.data, msg.format || 'mp3');
        break;
      case 'tts_start':
        this.onStateChange?.('ai_speaking');
        break;
      case 'tts_end':
        this.onStateChange?.('listening');
        break;
      case 'interrupted':
        this.stopAllSounds();
        this.onStateChange?.('interrupted');
        break;
      case 'hungup':
        this.active = false;
        this.cleanup();
        this.onStateChange?.('hungup');
        break;
      case 'error':
        this.onError?.(msg.message);
        break;
    }
  }

  async startRecordingLoop() {
    while (this.active && this.ws?.readyState === WebSocket.OPEN) {
      try {
        const data = await this.recordChunk();
        if (data && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'audio', data }));
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  async recordChunk() {
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(AUDIO_OPTIONS);
    await recording.startAsync();

    await new Promise((r) => setTimeout(r, CHUNK_MS));

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) return null;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await FileSystem.deleteAsync(uri, { idempotent: true });
    return base64;
  }

  async playAudio(base64, format) {
    const ext = format === 'mp3' ? '.mp3' : '.aac';
    const path = `${FileSystem.cacheDirectory}voice_${Date.now()}_${Math.random()}.${ext}`;

    try {
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: path },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
            FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
          }
        }
      );

      this.sounds.push(sound);
      if (this.sounds.length > 10) {
        const old = this.sounds.shift();
        try { await old.unloadAsync(); } catch (e) {}
      }
    } catch (e) {
      console.warn('Play audio error:', e);
    }
  }

  stopAllSounds() {
    this.sounds.forEach((s) => {
      try { s.stopAsync(); s.unloadAsync(); } catch (e) {}
    });
    this.sounds = [];
  }

  sendInterrupt() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
  }

  async hangup() {
    this.active = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'hangup' }));
    }
    this.cleanup();
  }

  cleanup() {
    this.stopAllSounds();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.onStateChange = null;
    this.onError = null;
  }
}
