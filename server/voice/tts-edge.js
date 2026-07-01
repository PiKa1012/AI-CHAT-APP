const VOICES = {
  'zh-CN-XiaoxiaoNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural': 'zh-CN-YunxiNeural',
};

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

class EdgeTTSService {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.edgeTTS = null;
  }

  async getEngine() {
    if (!this.edgeTTS) {
      this.edgeTTS = await import('edge-tts');
    }
    return this.edgeTTS;
  }

  async synthesize(text, voice = DEFAULT_VOICE) {
    const { createReadStream } = await this.getEngine();
    voice = VOICES[voice] || DEFAULT_VOICE;
    const chunks = [];
    const stream = await createReadStream(text, {
      voice,
      rate: 0,
      pitch: 0,
      volume: 0,
    });
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async *stream(text, voice = DEFAULT_VOICE) {
    const { createReadStream } = await this.getEngine();
    voice = VOICES[voice] || DEFAULT_VOICE;
    this.speaking = true;
    try {
      const stream = await createReadStream(text, {
        voice,
        rate: 0,
        pitch: 0,
        volume: 0,
      });
      for await (const chunk of stream) {
        if (!this.speaking) break;
        yield chunk;
      }
    } finally {
      this.speaking = false;
    }
  }

  stop() {
    this.speaking = false;
  }
}

module.exports = EdgeTTSService;
