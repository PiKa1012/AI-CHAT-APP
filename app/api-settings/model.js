import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting, clearAPISettingsCache } from '../../src/services/settings';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', ph: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', ph: 'sk-...' },
  { id: 'qwen', name: '通义千问', ph: 'sk-...' },
  { id: 'custom', name: '自定义', ph: '输入API地址' },
];

export default function ModelSettings() {
  const [p, setP] = useState('deepseek');
  const [key, setKey] = useState('');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const d = await loadSetting('api_settings', {});
    setP(d.provider || 'deepseek');
    setKey(d.apiKey || '');
    setUrl(d.apiBaseUrl || '');
    setModel(d.modelName || '');
  };
  const save = async () => {
    const d = await loadSetting('api_settings', {});
    await saveSetting('api_settings', { ...d, provider: p, apiKey: key, apiBaseUrl: url, modelName: model });
    clearAPISettingsCache();
    Alert.alert('成功', '已保存');
  };

  const defUrl = { openai: 'https://api.openai.com', deepseek: 'https://api.deepseek.com', qwen: 'https://dashscope.aliyuncs.com/compatible-mode', custom: '' };
  const defModel = { openai: 'gpt-3.5-turbo', deepseek: 'deepseek-chat', qwen: 'qwen-turbo', custom: '' };

  const test = async () => {
    if (!key) return Alert.alert('提示', '请先输入 API Key');
    setTesting(true);
    try {
      const res = await fetch(`${url || defUrl[p]}/v1/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: model || defModel[p], messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Alert.alert('成功', '连接正常');
    } catch (e) { Alert.alert('失败', e.message); }
    setTesting(false);
  };

  return (
    <ScrollView style={st.ctn}>
      <View style={st.sec}>
        <Text style={st.title}>服务商</Text>
        <View style={st.grid}>
          {PROVIDERS.map(pr => (
            <TouchableOpacity key={pr.id} style={[st.prov, p === pr.id && st.provActive]} onPress={() => setP(pr.id)}>
              <Text style={[st.provName, p === pr.id && st.provNameActive]}>{pr.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={st.sec}>
        <Text style={st.label}>API Key</Text>
        <TextInput style={st.input} value={key} onChangeText={setKey} placeholder={PROVIDERS.find(x => x.id === p)?.ph} placeholderTextColor="#999" secureTextEntry />
        <Text style={st.label}>API 地址</Text>
        <TextInput style={st.input} value={url} onChangeText={setUrl} placeholder={defUrl[p]} placeholderTextColor="#999" />
        <Text style={st.hint}>可选，留空使用默认</Text>
        <Text style={st.label}>模型名称</Text>
        <TextInput style={st.input} value={model} onChangeText={setModel} placeholder={defModel[p]} placeholderTextColor="#999" />
        <Text style={st.hint}>可选，留空使用默认模型</Text>
        <TouchableOpacity style={st.btn} onPress={test} disabled={testing}>
          <Text style={st.btnText}>{testing ? '测试中...' : '测试连接'}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={st.save} onPress={save}>
        <Text style={st.saveText}>保存设置</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  sec: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prov: { padding: 12, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: 'transparent' },
  provActive: { backgroundColor: '#4A90D915', borderColor: '#4A90D9' },
  provName: { fontSize: 14, color: '#666' },
  provNameActive: { color: '#4A90D9', fontWeight: '500' },
  label: { fontSize: 14, color: '#666', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, color: '#333' },
  hint: { fontSize: 12, color: '#999', marginTop: 4 },
  btn: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 14, borderWidth: 1, borderColor: '#ddd' },
  btnText: { color: '#4A90D9', fontSize: 14, fontWeight: '500' },
  save: { backgroundColor: '#67C23A', borderRadius: 8, padding: 16, alignItems: 'center', margin: 16 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
