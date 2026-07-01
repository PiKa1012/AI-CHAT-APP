const http = require('http');
const fs = require('fs');
const path = require('path');
const createVoiceWSServer = require('./voice/ws-server');

const PORT = process.env.VOICE_PORT || 3002;
const CFG_PATH = path.join(__dirname, 'bridge-config.json');

function getConfig() {
  try {
    if (fs.existsSync(CFG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
      if (cfg.apiKey) return cfg;
    }
  } catch {}
  return null;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200).end('OK');
  } else {
    res.writeHead(404).end();
  }
});

createVoiceWSServer(server, getConfig);

server.listen(PORT, () => {
  console.log(`[语音服务] 已启动, 端口 ${PORT}`);
  console.log(`[语音服务] 读取配置: ${CFG_PATH}`);
  const cfg = getConfig();
  console.log(`[语音服务] AI 配置: ${cfg ? cfg.model + ' @ ' + cfg.baseUrl : '未配置（需先在微信桥接中配置）'}`);
});
