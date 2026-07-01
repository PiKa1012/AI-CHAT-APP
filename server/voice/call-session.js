const XunfeiTTS = require('./tts-edge');
const XunfeiASR = require('./asr-xf');
const crypto = require('crypto');

const STATES = {
  IDLE: 'idle',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  HUNGUP: 'hungup',
};

class CallSession {
  constructor(ws, config, xfConfig = {}, apiConfig = {}) {
    this.ws = ws;
    this.config = config || {
      baseUrl: apiConfig.baseUrl || 'https://api.deepseek.com',
      apiKey: apiConfig.apiKey || '',
      model: apiConfig.model || 'deepseek-chat',
    };
    this.state = STATES.IDLE;
    this.tts = new XunfeiTTS(xfConfig);
    this.asr = new XunfeiASR(
      xfConfig.xfAppId || process.env.XF_APPID,
      xfConfig.xfApiKey || process.env.XF_API_KEY,
      xfConfig.xfApiSecret || process.env.XF_API_SECRET
    );
    this.messages = [];
    this.audioBuffer = [];
    this.silenceTimer = null;
    this.speaking = false;
    this.interrupting = false;
    this.asrTextBuffer = '';
    this.latestAsrText = '';
    this.sessionId = crypto.randomUUID();

    // 角色设定
    this.characterPrompt = '你是一个友善的AI伙伴。正在和用户进行语音通话，请用口语化的方式回应，简短自然。回答不要太长。';
  }

  async start(characterId) {
    this.state = STATES.RINGING;
    this.send({ type: 'ringing' });

    // 模拟 2s 响铃
    await new Promise((r) => setTimeout(r, 2000));

    if (this.state === STATES.HUNGUP) return;

    this.state = STATES.CONNECTED;
    this.send({ type: 'connected' });

    // 初始问候
    this.llmStreaming = true;
    await this.speak('喂你好，我是你的AI伙伴，现在可以开始聊天了。');
    this.llmStreaming = false;
    this.listen();
  }

  // ==================== 音频接收 ====================

  onAudio(data) {
    if (this.state !== STATES.CONNECTED) return;

    // 检测是否有声音 (简单音量检测)
    const isSilent = this.isSilent(data);

    if (!isSilent) {
      this.speaking = true;
      this.audioBuffer.push(data);

      // 转发到 ASR
      if (this.asr && this.asr.started) {
        this.asr.sendAudio(Buffer.from(data, 'base64'));
      }

      // 用户开口 → 打断 TTS
      if (!this.interrupting && (this.tts.speaking || this.llmStreaming)) {
        this.interrupt();
      }

      // 重置静音计时器
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => this.onSilence(), 800);
    }
  }

  isSilent(base64) {
    // 简单音量检测：解码前几个字节判断能量
    try {
      const buf = Buffer.from(base64, 'base64');
      let sum = 0;
      for (let i = 0; i < Math.min(buf.length, 640); i += 2) {
        sum += Math.abs(buf.readInt16LE(i));
      }
      const avg = sum / Math.min(buf.length / 2, 320);
      return avg < 500;
    } catch {
      return true;
    }
  }

  onSilence() {
    if (!this.speaking || this.state !== STATES.CONNECTED) return;
    this.speaking = false;
    this.silenceTimer = null;

    // 停止 ASR
    if (this.asr) this.asr.stop();

    // 处理完整句子
    const text = this.asrTextBuffer.trim() || this.latestAsrText.trim();
    this.asrTextBuffer = '';
    this.latestAsrText = '';

    if (text) {
      console.log(`[用户] ${text}`);
      this.messages.push({ role: 'user', content: text });
      this.processUserInput(text);
    } else {
      this.listen();
    }
  }

  // ==================== ASR 回调 ====================

  onAsrText(text, isPartial) {
    if (isPartial) {
      this.latestAsrText = text;
    } else {
      this.asrTextBuffer += text;
      this.latestAsrText = text;
    }
  }

  onAsrError(err) {
    console.error(`[ASR错误 ${this.sessionId}]`, err.message);
  }

  // ==================== 打断逻辑 ====================

  interrupt() {
    this.interrupting = true;
    this.tts.stop();
    this.llmStreaming = false;
    this.send({ type: 'interrupted' });

    // 清除旧 ASR 缓存
    this.asrTextBuffer = '';
    this.latestAsrText = '';

    // 重新启动 ASR
    setTimeout(() => {
      this.interrupting = false;
      if (this.state === STATES.CONNECTED) this.listen();
    }, 300);
  }

  // ==================== LLM + TTS ====================

  async processUserInput(text) {
    this.llmStreaming = true;

    try {
      const reply = await this.callLLM(text);
      console.log(`[AI] ${reply}`);

      if (!this.llmStreaming || this.state !== STATES.CONNECTED) return;

      await this.speak(reply);

      this.messages.push({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(`[LLM错误 ${this.sessionId}]`, err.message);
      if (this.state === STATES.CONNECTED) {
        await this.speak('抱歉，我刚才没听清，你能再说一遍吗？');
      }
    } finally {
      this.llmStreaming = false;
      if (this.state === STATES.CONNECTED) this.listen();
    }
  }

  async callLLM(text) {
    const { baseUrl, apiKey, model } = this.config;
    const messages = [
      { role: 'system', content: this.characterPrompt },
      ...this.messages.slice(-20),
      { role: 'user', content: text },
    ];

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        max_tokens: 512,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);

    // 流式读取 LLM 输出，边读边 TTS
    let fullText = '';
    let ttsBuffer = '';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (this.llmStreaming) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          fullText += delta;
          ttsBuffer += delta;

          // 遇到标点符号触发 TTS
          if (/[。！？，.\n!?,]/.test(delta) && ttsBuffer.length > 3) {
            if (this.tts.speaking) continue;
            await this.speak(ttsBuffer);
            ttsBuffer = '';
          }
        } catch {}
      }
    }

    if (ttsBuffer.trim() && this.llmStreaming) {
      await this.speak(ttsBuffer);
    }

    return fullText;
  }

  async speak(text) {
    if (!text?.trim() || this.state !== STATES.CONNECTED) return;

    console.log(`[TTS] 开始合成 (${this.sessionId.slice(0,8)}): "${text.slice(0,30)}..."`);
    this.send({ type: 'tts_start' });

    try {
      for await (const chunk of this.tts.stream(text)) {
        if (this.state !== STATES.CONNECTED || !this.llmStreaming) break;
        this.send({ type: 'audio', data: chunk.toString('base64'), format: 'mp3' });
      }
      console.log(`[TTS] 合成完成`);
    } catch (err) {
      console.error(`[TTS错误 ${this.sessionId.slice(0,8)}]`, err.message);
    }

    this.send({ type: 'tts_end' });
  }

  // ==================== 开始监听 ====================

  listen() {
    if (this.state !== STATES.CONNECTED) return;
    this.audioBuffer = [];
    this.asr.start(
      (text, isPartial) => this.onAsrText(text, isPartial),
      (err) => this.onAsrError(err)
    );
  }

  // ==================== 挂断 ====================

  hangup() {
    this.state = STATES.HUNGUP;
    this.tts.stop();
    this.llmStreaming = false;
    if (this.asr) this.asr.destroy();
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.send({ type: 'hungup' });
  }

  // ==================== 发送消息 ====================

  send(msg) {
    try {
      if (this.ws && this.ws.readyState === require('ws').OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    } catch (e) {
      console.error('[WS发送错误]', e.message);
    }
  }
}

module.exports = CallSession;
