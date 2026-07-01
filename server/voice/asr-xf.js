// 讯飞实时语音识别 WebSocket API
// 需要去 https://www.xfyun.cn/service/voicedictation 注册获取
// 免费额度：新用户 5 小时

const WebSocket = require('ws');
const crypto = require('crypto');

class XunfeiASR {
  constructor(appId, apiKey, apiSecret) {
    if (!appId || !apiKey || !apiSecret) {
      console.warn('[讯飞ASR] 未配置凭据，ASR 不可用');
      console.warn('[讯飞ASR] 请去 https://www.xfyun.cn/service/voicedictation 注册');
    }
    this.appId = appId || '';
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
    this.ws = null;
  }

  getAuthUrl() {
    const host = 'iat-api.xfyun.cn';
    const path = '/v2/iat';
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureOrigin)
      .digest('base64');
    const authorization = Buffer.from(
      `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    ).toString('base64');
    return `ws://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
  }

  async start(onText, onError) {
    if (!this.appId || !this.apiKey || !this.apiSecret) {
      onError(new Error('讯飞 ASR 未配置凭据'));
      return;
    }

    const url = this.getAuthUrl();
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      const frame = {
        common: { app_id: this.appId },
        business: {
          language: 'zh_cn',
          domain: 'iat',
          accent: 'mandarin',
          vad_eos: 2000,
          dwa: 'wpgs',
          pd: 'game',
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: '',
        },
      };
      ws.send(JSON.stringify(frame));
      this.started = true;
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.code !== 0) {
          onError(new Error(`讯飞 ASR 错误: ${msg.message}`));
          return;
        }
        if (msg.data?.result) {
          const text = msg.data.result.ws
            .map((ws) => ws.cw.map((cw) => cw.w).join(''))
            .join('');
          if (text) onText(text, msg.data.result.pgs === 'rpl');
        }
      } catch (e) {
        onError(e);
      }
    });

    ws.on('error', (e) => onError(e));
    ws.on('close', () => { this.ws = null; this.started = false; });
  }

  sendAudio(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const frame = {
      data: {
        status: 1,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: data.toString('base64'),
      },
    };
    this.ws.send(JSON.stringify(frame));
  }

  stop() {
    if (!this.ws) return;
    const frame = {
      data: {
        status: 2,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: '',
      },
    };
    this.ws.send(JSON.stringify(frame));
  }

  destroy() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.started = false;
  }
}

module.exports = XunfeiASR;
