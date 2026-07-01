const crypto = require('crypto');
const WebSocket = require('ws');

const VOICES = { 'xiaoyan': 'xiaoyan', 'aisjiuxu': 'aisjiuxu', 'default': 'xiaoyan' };
const DEFAULT_VOICE = 'xiaoyan';

class XunfeiTTSService {
  constructor(xfConfig = {}) {
    this.speaking = false;
    this.appId = xfConfig.xfAppId || process.env.XF_APPID || '';
    this.apiKey = xfConfig.xfApiKey || process.env.XF_API_KEY || '';
    this.apiSecret = xfConfig.xfApiSecret || process.env.XF_API_SECRET || '';
  }

  _getAuthUrl() {
    const host = 'tts-api.xfyun.cn';
    const path = '/v2/tts';
    const date = new Date().toUTCString();
    const signStr = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const sig = crypto.createHmac('sha256', this.apiSecret).update(signStr).digest('base64');
    const auth = Buffer.from(`api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${sig}"`).toString('base64');
    return `wss://${host}${path}?authorization=${encodeURIComponent(auth)}&date=${encodeURIComponent(date)}&host=${host}`;
  }

  async synthesize(text, voice = DEFAULT_VOICE) {
    voice = VOICES[voice] || DEFAULT_VOICE;
    const textBase64 = Buffer.from(text, 'utf8').toString('base64');

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this._getAuthUrl());
      const chunks = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({
          common: { app_id: this.appId },
          business: { aue: 'lame', sfl: 1, auf: 'audio/L16;rate=16000', vcn: voice, speed: 50, volume: 50, pitch: 50, tte: 'utf8' },
          data: { text: textBase64, status: 2 },
        }));
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.code !== 0) {
            ws.close();
            reject(new Error(`讯飞TTS错误 ${msg.code}: ${msg.message || '未知'}`));
            return;
          }
          if (msg.data?.audio) {
            chunks.push(Buffer.from(msg.data.audio, 'base64'));
          }
          if (msg.data?.status === 2) {
            ws.close();
            resolve(Buffer.concat(chunks));
          }
        } catch (e) {
          ws.close();
          reject(e);
        }
      });

      ws.on('error', (e) => { reject(e); });
      ws.on('close', () => { if (chunks.length === 0) reject(new Error('TTS连接关闭但无数据')); });
    });
  }

  async *stream(text, voice = DEFAULT_VOICE) {
    this.speaking = true;
    try {
      const data = await this.synthesize(text, voice);
      if (this.speaking) yield data;
    } finally {
      this.speaking = false;
    }
  }

  stop() {
    this.speaking = false;
  }
}

module.exports = XunfeiTTSService;
