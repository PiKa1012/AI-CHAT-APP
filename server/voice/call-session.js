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
  constructor(ws, config, xfConfig = {}, apiConfig = {}, charInfo = null) {
    this.ws = ws;
    this.charInfo = charInfo;
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
    this.processing = false;
    this.sessionId = crypto.randomUUID();

    // 角色设定
    if (this.charInfo) {
      const parts = [];
      // AI 角色信息
      const aiParts = [];
      if (this.charInfo.name) aiParts.push(`你是${this.charInfo.name}`);
      if (this.charInfo.age) aiParts.push(`${this.charInfo.age}岁`);
      if (this.charInfo.gender) aiParts.push(this.charInfo.gender);
      if (this.charInfo.personality) aiParts.push(`性格${this.charInfo.personality}`);
      if (this.charInfo.background) aiParts.push(`背景：${this.charInfo.background}`);
      if (this.charInfo.speaking_style) aiParts.push(`说话风格：${this.charInfo.speaking_style}`);
      if (this.charInfo.likes) aiParts.push(`喜好：${this.charInfo.likes}`);
      if (this.charInfo.relationship) aiParts.push(`与用户的关系：${this.charInfo.relationship}`);
      if (aiParts.length > 0) parts.push(aiParts.join('，'));

      // 用户信息
      const userParts = [];
      if (this.charInfo.userName) userParts.push(`用户在跟你通话，名字是${this.charInfo.userName}`);
      if (this.charInfo.userGender) userParts.push(`性别${this.charInfo.userGender}`);
      if (this.charInfo.userAge) userParts.push(`${this.charInfo.userAge}岁`);
      if (userParts.length > 0) parts.push(userParts.join('，'));

      parts.push('正在语音通话，每次只回复一句话，不超过30字，口语化自然');
      this.characterPrompt = parts.join('。');
    if (!this.characterPrompt) {
      this.characterPrompt = '你是一个友善的AI伙伴。正在和用户进行语音通话，每次只回复一句话，不超过30个字，口语化，自然简短。';
    }
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
    this.processing = true;
    this.llmStreaming = true;
    const greeting = this.charInfo?.name ? `喂你好，我是${this.charInfo.name}，现在可以开始聊天了。` : '喂你好，我是你的AI伙伴，现在可以开始聊天了。';
    await this.speak(greeting);
    this.llmStreaming = false;
    this.processing = false;
    this.listen();
  }

  // ==================== 音频接收 ====================

  onAudio(data) {
    if (this.state !== STATES.CONNECTED) return;
    if (this.processing) return;

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
    this.processing = true;

    try {
      const reply = await this.callLLM(text);
      console.log(`[AI] ${reply}`);

      if (!this.llmStreaming || this.state !== STATES.CONNECTED) return;

      this.messages.push({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(`[LLM错误 ${this.sessionId}]`, err.message);
      if (this.state === STATES.CONNECTED) {
        await this.speak('抱歉，我刚才没听清，你能再说一遍吗？');
      }
    } finally {
      this.llmStreaming = false;
      this.processing = false;
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

    const cleanBaseUrl = (baseUrl || '').replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/v1/chat/completions`;
    console.log(`[LLM] URL: ${url}`);
    console.log(`[LLM] Model: ${model}, Key长度: ${(apiKey || '').length}, 消息数: ${messages.length}`);

    const body = JSON.stringify({
      model: model || 'deepseek-chat',
      messages,
        max_tokens: 300,
      temperature: 0.7,
      stream: true,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body,
    });

    console.log(`[LLM] HTTP ${res.status}, OK: ${res.ok}, Content-Type: ${res.headers.get('content-type')}`);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[LLM] 错误: ${errText.slice(0, 500)}`);
      throw new Error(`LLM ${res.status}`);
    }

    let fullText = '';
    let chunkCount = 0;
    let lineCount = 0;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (this.llmStreaming) {
      const { done, value } = await reader.read();
      if (done) { console.log(`[LLM] 流结束, ${chunkCount}块 ${lineCount}行, ${fullText.length}字`); break; }

      chunkCount++;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
      if (chunkCount === 1) { console.log(`[LLM] 首块 ${value.length}B, data行: ${lines.length}`); }

      for (const line of lines) {
        lineCount++;
        const data = line.slice(6);
        if (data === '[DONE]') { console.log('[LLM] [DONE]'); continue; }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          fullText += delta;
        } catch (e) {}
      }
    }

    // 去掉思考过程，只保留真正的回复
    console.log(`[LLM思考] ${fullText.slice(0, 300)}`);
    let reply = fullText
      .replace(/（[^）]*）/g, '')
      .replace(/（[^）]*/g, '')
      .replace(/[）]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\([^)]*/g, '')
      .replace(/[\)]/g, '')
      .replace(/【[^】]*】/g, '')
      .replace(/\n{3,}/g, '\n')
      .trim();

    if (/^(你是|性格|当前时间|请以|我的名字是|用户的名字是|回复要符合)/.test(reply)) {
      reply = reply.replace(/^你[^\n]*\n?/, '')
        .replace(/^性格[^\n]*\n?/, '')
        .replace(/^当前时间[^\n]*\n?/, '')
        .replace(/^请以[^\n]*\n?/, '')
        .replace(/^我的名字[^\n]*\n?/, '')
        .replace(/^用户的名字[^\n]*\n?/, '')
        .replace(/^回复要符合[^\n]*\n?/, '')
        .replace(/^不要使用[^\n]*\n?/g, '')
        .replace(/^请用符合[^\n]*\n?/g, '')
        .trim();
    }

    if (!reply || reply.length < 2) {
      reply = '嗯嗯，好的';
    }

    console.log(`[LLM] 最终回复: "${reply.slice(0, 100)}"`);
    if (reply) {
      await this.speak(reply);
    }

    return reply;
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
