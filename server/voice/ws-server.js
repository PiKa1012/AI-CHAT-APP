const { WebSocketServer } = require('ws');
const CallSession = require('./call-session');

function createVoiceWSServer(httpServer, getConfig) {
  const wss = new WebSocketServer({ server: httpServer, path: '/voice' });

  wss.on('connection', (ws) => {
    console.log('[语音WS] 新连接');
    let session = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'dial':
            if (session) {
              session.hangup();
            }
            session = new CallSession(ws, getConfig(), msg.xfConfig || {}, msg.apiConfig || {});
            session.start(msg.characterId);
            break;

          case 'audio':
            if (session) {
              session.onAudio(msg.data);
            }
            break;

          case 'interrupt':
            if (session) {
              session.interrupt();
            }
            break;

          case 'hangup':
            if (session) {
              session.hangup();
              session = null;
            }
            break;

          default:
            ws.send(JSON.stringify({ type: 'error', message: `未知消息类型: ${msg.type}` }));
        }
      } catch (e) {
        console.error('[语音WS] 消息解析错误:', e.message);
      }
    });

    ws.on('close', () => {
      console.log('[语音WS] 连接关闭');
      if (session) {
        session.hangup();
        session = null;
      }
    });

    ws.on('error', (e) => {
      console.error('[语音WS] 连接错误:', e.message);
      if (session) {
        session.hangup();
        session = null;
      }
    });
  });

  console.log('[语音WS] WebSocket 服务已启动 (ws://host:port/voice)');
  return wss;
}

module.exports = createVoiceWSServer;
