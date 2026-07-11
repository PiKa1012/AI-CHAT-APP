import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting, clearAPISettingsCache } from '../../src/services/settings';

const SW = ({ icon, color, label, desc, value, onChange }) => (
  <View style={st.swRow}>
    <View style={st.swInfo}>
      {icon && <Ionicons name={icon} size={18} color={color} />}
      <Text style={st.swLabel}>{label}</Text>
      {desc && <Text style={st.swDesc}>{desc}</Text>}
    </View>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: color }} />
  </View>
);
const I = ({ label, value, onChangeText, placeholder, secure, hint }) => (
  <View>
    <Text style={st.label}>{label}</Text>
    <TextInput style={st.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#999" secureTextEntry={secure} />
    {hint && <Text style={st.hint}>{hint}</Text>}
  </View>
);
const B = ({ text, onPress, disabled }) => <TouchableOpacity style={st.btn} onPress={onPress} disabled={disabled}><Text style={st.btnText}>{disabled ? '测试中...' : text}</Text></TouchableOpacity>;

export default function VoiceSettings() {
  const [avm, setAvm] = useState(false); const [avf, setAvf] = useState(30);
  const [vc, setVc] = useState(false);
  const [xa, setXa] = useState(''); const [xk, setXk] = useState(''); const [xs, setXs] = useState('');
  const [vurl, setVurl] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const d = await loadSetting('api_settings', {});
    setAvm(d.enableAIVoiceMsg || false); setAvf(d.aiVoiceMsgFrequency || 30);
    setVc(d.enableVoiceCall || false);
    setXa(d.xfAppId || ''); setXk(d.xfApiKey || ''); setXs(d.xfApiSecret || '');
    setVurl(d.voiceServerUrl || '');
  };
  const save = async () => {
    const d = await loadSetting('api_settings', {});
    await saveSetting('api_settings', { ...d, enableAIVoiceMsg: avm, aiVoiceMsgFrequency: avf, enableVoiceCall: vc, xfAppId: xa, xfApiKey: xk, xfApiSecret: xs, voiceServerUrl: vurl });
    clearAPISettingsCache();
    Alert.alert('成功', '已保存');
  };

  const testVoice = async () => {
    if (!vurl) return Alert.alert('提示', '请先输入服务器地址');
    setTesting(true);
    try {
      const ws = new WebSocket(vurl);
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('连接超时')), 5000);
        ws.onopen = () => { clearTimeout(t); ws.close(); resolve(); };
        ws.onerror = () => { clearTimeout(t); reject(new Error('无法连接')); };
      });
      Alert.alert('成功', '服务器连接正常');
    } catch (e) { Alert.alert('失败', e.message); }
    setTesting(false);
  };

  return (
    <ScrollView style={st.ctn}>
      <View style={st.sec}>
        <SW icon="chatbubble-ellipses" color="#9B59B6" label="AI 语音消息" desc="AI 以语音条回复" value={avm} onChange={setAvm} />
        {avm && <View style={st.sub}><Text style={st.label}>语音频率</Text><View style={st.optGrid}>{[{ v: 10, l: '10%' }, { v: 30, l: '30%' }, { v: 50, l: '50%' }, { v: 100, l: '每次' }].map(o => <TouchableOpacity key={o.v} style={[st.opt, avf === o.v && st.optActive]} onPress={() => setAvf(o.v)}><Text style={[st.optName, avf === o.v && st.optNameActive]}>{o.l}</Text></TouchableOpacity>)}</View></View>}
        <SW label="📞 语音通话" desc="拨打电话式 AI 对话" value={vc} onChange={setVc} />
        {vc && <View style={st.sub}>
          <I label="讯飞 App ID" value={xa} onChangeText={setXa} placeholder="去 xfyun.cn 注册获取" />
          <I label="讯飞 API Key" value={xk} onChangeText={setXk} placeholder="讯飞 API Key" secure />
          <I label="讯飞 API Secret" value={xs} onChangeText={setXs} placeholder="讯飞 API Secret" secure />
          <I label="服务器地址" value={vurl} onChangeText={setVurl} placeholder="ws://你的服务器IP:3002/voice" hint="语音通话服务器地址，端口 3002" />
          <B onPress={testVoice} text="测试语音连接" disabled={testing} />
        </View>}
      </View>
      <TouchableOpacity style={st.save} onPress={save}><Text style={st.saveText}>保存设置</Text></TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  sec: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 12 },
  sub: { paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  swRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  swInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  swLabel: { fontSize: 15, color: '#333' },
  swDesc: { fontSize: 12, color: '#999' },
  label: { fontSize: 14, color: '#666', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, color: '#333' },
  hint: { fontSize: 12, color: '#999', marginTop: 4 },
  btn: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#ddd' },
  btnText: { color: '#4A90D9', fontSize: 14, fontWeight: '500' },
  optGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: 'transparent' },
  optActive: { backgroundColor: '#4A90D915', borderColor: '#4A90D9' },
  optName: { fontSize: 14, color: '#666' },
  optNameActive: { color: '#4A90D9', fontWeight: '500' },
  save: { backgroundColor: '#67C23A', borderRadius: 8, padding: 16, alignItems: 'center', margin: 16 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
