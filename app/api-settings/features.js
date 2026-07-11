import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting, clearAPISettingsCache } from '../../src/services/settings';

const OPT = [{ v: 10, l: '低' }, { v: 30, l: '中' }, { v: 50, l: '高' }, { v: 70, l: '很高' }];

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
const I = ({ label, value, onChangeText, placeholder, secure }) => (
  <View>
    <Text style={st.label}>{label}</Text>
    <TextInput style={st.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#999" secureTextEntry={secure} />
  </View>
);
const B = ({ text, onPress, disabled }) => <TouchableOpacity style={st.btn} onPress={onPress} disabled={disabled}><Text style={st.btnText}>{disabled ? '测试中...' : text}</Text></TouchableOpacity>;

export default function FeaturesSettings() {
  const [search, setSearch] = useState(false); const [sk, setSk] = useState('');
  const [vis, setVis] = useState(false); const [vk, setVk] = useState(''); const [vu, setVu] = useState(''); const [vm, setVm] = useState('');
  const [gen, setGen] = useState(false); const [gm, setGm] = useState(true); const [gd, setGd] = useState(true); const [gc, setGc] = useState(true);
  const [gk, setGk] = useState(''); const [gu, setGu] = useState(''); const [gmodel, setGmodel] = useState('');
  const [emoji, setEmoji] = useState(true); const [ef, setEf] = useState(30);
  const [t, setT] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    const d = await loadSetting('api_settings', {});
    setSearch(d.enableSearch || false); setSk(d.searchApiKey || '');
    setVis(d.enableImageRecognition || false); setVk(d.visionApiKey || ''); setVu(d.visionApiBaseUrl || ''); setVm(d.visionModelName || '');
    setGen(d.enableImageGen || false); setGm(d.enableMomentImage !== false); setGd(d.enableDiaryImage !== false); setGc(d.enableChatImage !== false);
    setGk(d.imageGenApiKey || ''); setGu(d.imageGenBaseUrl || ''); setGmodel(d.imageGenModel || '');
    setEmoji(d.enableEmoji !== false); setEf(d.emojiFrequency || 30);
  };
  const save = async () => {
    const d = await loadSetting('api_settings', {});
    await saveSetting('api_settings', { ...d, enableSearch: search, searchApiKey: sk, enableImageRecognition: vis, visionApiKey: vk, visionApiBaseUrl: vu, visionModelName: vm, enableImageGen: gen, enableMomentImage: gm, enableDiaryImage: gd, enableChatImage: gc, imageGenApiKey: gk, imageGenBaseUrl: gu, imageGenModel: gmodel, enableEmoji: emoji, emojiFrequency: ef });
    clearAPISettingsCache();
    Alert.alert('成功', '已保存');
  };

  const doTest = async (fn, label) => { setT(label); try { await fn(); } catch (e) { Alert.alert('失败', e.message); } setT(''); };

  const testSearch = async () => { if (!sk?.trim()) return Alert.alert('提示', '请先输入 API Key'); const r = await fetch('https://api.bochaai.com/v1/web-search', { method: 'POST', headers: { 'Authorization': `Bearer ${sk.trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'test', count: 1, summary: true }) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); Alert.alert('成功', '连接正常'); };
  const testVis = async () => { if (!vk) return Alert.alert('提示', '请先输入 API Key'); const r = await fetch(`${vu || 'https://api.openai.com'}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vk}` }, body: JSON.stringify({ model: vm || 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); Alert.alert('成功', '连接正常'); };
  const testGen = async () => { if (!gk) return Alert.alert('提示', '请先输入 API Key'); const r = await fetch(`${gu || 'https://api.siliconflow.cn/v1'}/images/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gk}` }, body: JSON.stringify({ model: gmodel || 'stabilityai/stable-diffusion-xl-base-1.0', prompt: 'a cute cat', image_size: '512x512' }) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); Alert.alert('成功', '连接正常'); };

  return (
    <ScrollView style={st.ctn}>
      <View style={st.sec}>
        <SW icon="search" color="#4A90D9" label="联网搜索" desc="博查AI搜索最新信息" value={search} onChange={setSearch} />
        {search && <View style={st.sub}><I label="搜索 API Key" value={sk} onChangeText={setSk} placeholder="输入博查搜索API Key" secure /><B onPress={() => doTest(testSearch, '搜索')} text="测试连接" disabled={!!t} /></View>}
        <SW icon="image" color="#9B59B6" label="图像识别" desc="识别发送的图片内容" value={vis} onChange={setVis} />
        {vis && <View style={st.sub}><I label="视觉 API Key" value={vk} onChangeText={setVk} placeholder="如 moonshot API Key" secure /><I label="视觉 API 地址" value={vu} onChangeText={setVu} placeholder="如 https://api.moonshot.cn" /><I label="视觉模型" value={vm} onChangeText={setVm} placeholder="如 moonshot-v1-128k-vision-preview" /><B onPress={() => doTest(testVis, '视觉')} text="测试连接" disabled={!!t} /></View>}
        <SW icon="brush" color="#FF69B4" label="AI 生图" desc="自动为内容配图" value={gen} onChange={setGen} />
        {gen && <View style={st.sub}>
          <View style={st.swRow}><View style={st.swInfo}><Ionicons name="images" size={18} color="#E6A23C" /><Text style={st.swLabel}>朋友圈配图</Text></View><Switch value={gm} onValueChange={setGm} trackColor={{ true: '#E6A23C' }} /></View>
          <View style={st.swRow}><View style={st.swInfo}><Ionicons name="book" size={18} color="#9B59B6" /><Text style={st.swLabel}>日记配图</Text></View><Switch value={gd} onValueChange={setGd} trackColor={{ true: '#9B59B6' }} /></View>
          <View style={st.swRow}><View style={st.swInfo}><Ionicons name="chatbubble" size={18} color="#67C23A" /><Text style={st.swLabel}>聊天生图</Text><Text style={st.swDesc}>说"画xxx"触发</Text></View><Switch value={gc} onValueChange={setGc} trackColor={{ true: '#67C23A' }} /></View>
          <I label="生图 API Key" value={gk} onChangeText={setGk} placeholder="硅基流动等 API Key" secure />
          <I label="生图 API 地址" value={gu} onChangeText={setGu} placeholder="https://api.siliconflow.cn/v1" />
          <I label="生图模型" value={gmodel} onChangeText={setGmodel} placeholder="stabilityai/stable-diffusion-xl-base-1.0" />
          <B onPress={() => doTest(testGen, '生图')} text="测试连接" disabled={!!t} />
        </View>}
        <SW icon="happy" color="#E6A23C" label="AI 发表情" desc="根据心情发表情包" value={emoji} onChange={setEmoji} />
        {emoji && <View style={st.sub}><Text style={st.label}>发表情频率</Text><View style={st.optGrid}>{OPT.map(o => <TouchableOpacity key={o.v} style={[st.opt, ef === o.v && st.optActive]} onPress={() => setEf(o.v)}><Text style={[st.optName, ef === o.v && st.optNameActive]}>{o.l}</Text></TouchableOpacity>)}</View></View>}
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
