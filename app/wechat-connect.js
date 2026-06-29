import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../src/stores';
import { loadSetting, saveSetting } from '../src/services/settings';
import { SafeAvatar } from '../src/components/SafeImage';

export default function WechatConnectScreen() {
  const router = useRouter();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [serverUrl, setServerUrl] = useState('');
  const [selectedAI, setSelectedAI] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | scanning | running | error
  const [qrCode, setQrCode] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectedAI, setConnectedAI] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadSetting('wechat_bridge', {}).then(s => {
      if (s.serverUrl) setServerUrl(s.serverUrl);
      if (s.aiId) setSelectedAI(s.aiId);
      if (s.connectedAI) setConnectedAI(s.connectedAI);
      if (s.status) setStatus(s.status);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const saveBridgeConfig = async (newStatus, newConnectedAI) => {
    await saveSetting('wechat_bridge', { serverUrl, aiId: selectedAI, connectedAI: newConnectedAI || connectedAI, status: newStatus || status });
  };

  const fetchWithTimeout = (url, opts = {}, ms = 10000) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
  };

  const testConnection = async () => {
    const url = serverUrl.trim();
    if (!url) { Alert.alert('提示', '请输入服务器地址'); return; }
    setTesting(true);
    try {
      const res = await fetchWithTimeout(`${url}/api/bridge/status`, {}, 5000);
      const data = await res.json();
      if (res.ok) {
        Alert.alert('成功', `服务器连接正常\n当前状态：${statusText(data.status)}`);
      } else {
        Alert.alert('失败', `服务器返回错误 (${res.status})`);
      }
    } catch (e) {
      Alert.alert('连接失败', `无法连接到服务器\n${e.message}\n\n请检查：\n1. 服务器是否已启动 node index.js\n2. 防火墙是否开放了 3001 端口\n3. 地址格式是否正确 http://IP:3001`);
    }
    setTesting(false);
  };

  const statusText = (s) => ({ idle: '空闲', logging: '等待扫码', running: '运行中', error: '错误' })[s] || s;

  const startBridge = async () => {
    if (!serverUrl.trim()) { Alert.alert('提示', '请输入服务器地址'); return; }
    if (!selectedAI) { Alert.alert('提示', '请选择一个 AI 角色'); return; }

    const ai = aiCharacters.find(a => a.id === selectedAI);
    if (!ai) { Alert.alert('提示', 'AI 角色不存在'); return; }

    const apiSettings = await loadSetting('api_settings', {});
    if (!apiSettings.apiKey) { Alert.alert('提示', '请先在 API 配置中填写 API Key'); return; }

    setLoading(true);
    setStatus('connecting');
    setErrorMsg('');

    try {
      const systemPrompt = buildPersonalityPrompt(ai);

      const res = await fetchWithTimeout(`${serverUrl.trim()}/api/bridge/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiSettings.apiKey,
          baseUrl: apiSettings.apiBaseUrl || getDefaultBaseUrl(apiSettings.provider),
          model: apiSettings.modelName || getDefaultModel(apiSettings.provider),
          systemPrompt,
          maxTokens: 1024,
        }),
      }, 15000);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `服务器错误 (${res.status})`);

      if (data.status === 'running') {
        setStatus('running');
        setConnectedAI(selectedAI);
        await saveBridgeConfig('running', selectedAI);
      } else if (data.status === 'logging') {
        setStatus('scanning');
        setQrCode(data.qrCode);
        setConnectedAI(selectedAI);
        await saveBridgeConfig('scanning', selectedAI);
        startPolling();
      } else {
        throw new Error(`服务器返回未知状态: ${data.status}`);
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
    }
    setLoading(false);
  };

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetchWithTimeout(`${serverUrl.trim()}/api/bridge/status`, {}, 5000);
        const data = await res.json();
        if (data.status === 'running') {
          setStatus('running');
          const newConnectedAI = connectedAI || selectedAI;
          setConnectedAI(newConnectedAI);
          setQrCode(null);
          if (pollRef.current) clearInterval(pollRef.current);
          await saveBridgeConfig('running', newConnectedAI);
        } else if (data.status === 'error') {
          setStatus('error');
          setErrorMsg(data.error || '连接失败');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (e) {}
    }, 2000);
  };

  const stopBridge = async () => {
    try { await fetchWithTimeout(`${serverUrl.trim()}/api/bridge/stop`, { method: 'POST' }, 3000); } catch (e) {}
    setStatus('idle');
    setQrCode(null);
    setConnectedAI(null);
    if (pollRef.current) clearInterval(pollRef.current);
    await saveSetting('wechat_bridge', { serverUrl, aiId: selectedAI, status: 'idle' });
  };

  const qrUri = qrCode ? `${serverUrl.trim()}/api/bridge/qrcode?t=${Date.now()}` : null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服务器地址</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://你的服务器IP:3001"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.testBtn} onPress={testConnection} disabled={testing}>
            <Text style={styles.testBtnText}>{testing ? '测试中' : '测试连接'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>你的服务器 IP + 端口，先点"测试连接"确认能通</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择 AI 角色</Text>
        {aiCharacters.length === 0 ? (
          <Text style={styles.emptyText}>还没有 AI 角色，先去创建吧</Text>
        ) : (
          <View style={styles.aiList}>
            {aiCharacters.map(ai => (
              <TouchableOpacity
                key={ai.id}
                style={[styles.aiItem, selectedAI === ai.id && styles.aiItemActive]}
                onPress={() => setSelectedAI(ai.id)}
              >
                <SafeAvatar uri={ai.avatar} size={40} name={ai.name || 'A'} color="#4A90D9" />
                <View style={styles.aiInfo}>
                  <Text style={styles.aiName}>{ai.name}</Text>
                  <Text style={styles.aiPersonality}>{ai.personality || '友好'}</Text>
                </View>
                {selectedAI === ai.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#4A90D9" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {status === 'idle' && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.connectBtn]}
          onPress={startBridge}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-wechat" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>连接微信</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {status === 'connecting' && (
        <View style={styles.statusCard}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.statusText}>正在连接服务器...</Text>
        </View>
      )}

      {status === 'scanning' && qrUri && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>扫码授权</Text>
          <View style={styles.qrContainer}>
            <Image
              source={{ uri: qrUri }}
              style={styles.qrImage}
              resizeMode="contain"
              onError={() => setErrorMsg('二维码图片加载失败，请重试')}
            />
          </View>
          <Text style={styles.qrHint}>打开微信 → 扫一扫，授权后自动连接</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={stopBridge}>
            <Text style={styles.cancelBtnText}>取消</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'running' && (() => {
        const ai = aiCharacters.find(a => a.id === connectedAI);
        return (
          <View style={styles.runningCard}>
            <View style={styles.runningHeader}>
              <SafeAvatar uri={ai?.avatar} size={56} name={ai?.name || 'A'} color="#67C23A" />
              <View style={styles.runningInfo}>
                <Text style={styles.runningName}>{ai?.name || 'AI'} 已接入微信</Text>
                <Text style={styles.runningDesc}>现在去微信跟 TA 聊天吧</Text>
              </View>
            </View>
            <View style={styles.runningMeta}>
              <Ionicons name="checkmark-circle" size={16} color="#67C23A" />
              <Text style={styles.runningMetaText}>在线</Text>
            </View>
            <TouchableOpacity style={styles.disconnectBtn} onPress={stopBridge}>
              <Ionicons name="link-outline" size={18} color="#F56C6C" />
              <Text style={styles.disconnectBtnText}>断开连接</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {status === 'error' && (
        <View style={styles.statusCard}>
          <Ionicons name="close-circle" size={48} color="#F56C6C" />
          <Text style={styles.statusErrorText}>连接失败</Text>
          <Text style={styles.statusDesc}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setStatus('idle')}>
            <Text style={styles.retryBtnText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function buildPersonalityPrompt(character) {
  return `你是${character.name}，性格${character.personality || '友好'}。${character.description || ''}
${character.age ? `年龄：${character.age}岁` : ''}
${character.gender ? `性别：${character.gender}` : ''}
${character.background ? `背景：${character.background}` : ''}
${character.likes ? `兴趣爱好：${character.likes}` : ''}
${character.speaking_style ? `说话风格：${character.speaking_style}` : ''}
${character.relationship ? `与用户的关系：${character.relationship}` : ''}
请用符合这个性格的方式回复，保持简洁自然，像朋友聊天一样。不要使用emoji。`;
}

function getDefaultBaseUrl(provider) {
  const urls = {
    openai: 'https://api.openai.com', deepseek: 'https://api.deepseek.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
    wenxin: 'https://aip.baidubce.com', claude: 'https://api.anthropic.com',
  };
  return urls[provider] || 'https://api.deepseek.com';
}

function getDefaultModel(provider) {
  const models = {
    openai: 'gpt-3.5-turbo', deepseek: 'deepseek-chat',
    qwen: 'qwen-turbo', claude: 'claude-3-sonnet-20240229', wenxin: 'ernie-bot',
  };
  return models[provider] || 'deepseek-chat';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, color: '#333' },
  testBtn: { backgroundColor: '#4A90D9', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  testBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  hint: { fontSize: 12, color: '#999', marginTop: 6 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', padding: 20 },
  aiList: { gap: 8 },
  aiItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, backgroundColor: '#f8f8f8', gap: 12 },
  aiItemActive: { backgroundColor: 'rgba(74,144,217,0.1)', borderWidth: 1, borderColor: '#4A90D9' },
  aiInfo: { flex: 1 },
  aiName: { fontSize: 15, fontWeight: '500', color: '#333' },
  aiPersonality: { fontSize: 12, color: '#999', marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 14, borderRadius: 8, gap: 8 },
  connectBtn: { backgroundColor: '#67C23A' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  statusCard: { backgroundColor: '#fff', margin: 16, padding: 24, borderRadius: 12, alignItems: 'center', gap: 12 },
  statusText: { fontSize: 15, color: '#666' },
  statusRunningText: { fontSize: 18, fontWeight: '600', color: '#67C23A' },
  statusErrorText: { fontSize: 18, fontWeight: '600', color: '#F56C6C' },
  statusDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  qrContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  qrImage: { width: 200, height: 200 },
  qrHint: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 12 },
  cancelBtn: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd', alignItems: 'center', alignSelf: 'stretch' },
  cancelBtnText: { fontSize: 14, color: '#666' },
  disconnectBtn: { flexDirection: 'row', marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: 'rgba(245,108,108,0.1)', borderWidth: 1, borderColor: '#F56C6C', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disconnectBtnText: { fontSize: 14, color: '#F56C6C', fontWeight: '500' },
  retryBtn: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: 'rgba(74,144,217,0.1)', borderWidth: 1, borderColor: '#4A90D9', alignItems: 'center', alignSelf: 'stretch' },
  retryBtnText: { fontSize: 14, color: '#4A90D9' },
  runningCard: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 16, gap: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  runningHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  runningInfo: { flex: 1 },
  runningName: { fontSize: 17, fontWeight: '600', color: '#333' },
  runningDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  runningMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  runningMetaText: { fontSize: 13, color: '#67C23A' },
});
