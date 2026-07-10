import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting, clearAPISettingsCache } from '../../src/services/settings';

export default function ServicesSettings() {
  const [music, setMusic] = useState(false); const [mu, setMu] = useState('');
  const [map, setMap] = useState(false); const [mk, setMk] = useState('');
  const [testing, setTesting] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    const d = await loadSetting('api_settings', {});
    setMusic(d.enableMusic !== false); setMu(d.neteaseApiBaseUrl || '');
    setMap(d.enableMap !== false); setMk(d.amapApiKey || '');
  };
  const save = async () => {
    const d = await loadSetting('api_settings', {});
    await saveSetting('api_settings', { ...d, enableMusic: music, neteaseApiBaseUrl: mu, enableMap: map, amapApiKey: mk });
    clearAPISettingsCache();
    Alert.alert('成功', '已保存');
  };

  const doTest = async (fn, label) => { setTesting(label); try { await fn(); } catch (e) { Alert.alert('失败', e.message); } setTesting(''); };

  const testMusic = async () => { if (!mu) return Alert.alert('提示', '请先输入地址'); const r = await fetch(`${mu}/search?keywords=test&limit=1`); if (!r.ok) throw new Error(`HTTP ${r.status}`); Alert.alert('成功', '连接正常'); };
  const testMap = async () => { if (!mk) return Alert.alert('提示', '请先输入 Key'); const r = await fetch(`https://restapi.amap.com/v3/ip?key=${mk}&output=JSON`); if (!r.ok) throw new Error(`HTTP ${r.status}`); const d = await r.json(); if (d.status !== '1') throw new Error(d.info); Alert.alert('成功', `连接正常，IP：${d.city || d.province || '未知'}`); };

  const SW = ({ label, desc, value, onChange }) => (
    <View style={st.swRow}>
      <View style={st.swInfo}>
        <Text style={st.swLabel}>{label}</Text>
        {desc && <Text style={st.swDesc}>{desc}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#4A90D9' }} />
    </View>
  );
  const I = ({ label, value, onChange, placeholder, hint }) => (
    <View>
      <Text style={st.label}>{label}</Text>
      <TextInput style={st.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#999" />
      {hint && <Text style={st.hint}>{hint}</Text>}
    </View>
  );
  const B = ({ text, onPress }) => <TouchableOpacity style={st.btn} onPress={onPress} disabled={!!testing}><Text style={st.btnText}>{testing ? '测试中...' : text}</Text></TouchableOpacity>;

  return (
    <ScrollView style={st.ctn}>
      <View style={st.sec}>
        <SW label="🎵 网易云音乐" desc="聊天搜歌播放" value={music} onChange={setMusic} />
        {music && <View style={st.sub}><I label="API 地址" value={mu} onChangeText={setMu} placeholder="https://xxx.vercel.app" hint="部署 NeteaseCloudMusicApi Enhanced 后的地址" /><B onPress={() => doTest(testMusic, '音乐')} text="测试连接" /></View>}
        <SW label="🗺️ 高德地图" desc="位置天气路线查询" value={map} onChange={setMap} />
        {map && <View style={st.sub}><I label="Web API Key" value={mk} onChangeText={setMk} placeholder="输入高德 Web 服务 API Key" hint='在控制台 → 应用管理 → 创建应用后获取 Key，启用「Web 服务」' /><B onPress={() => doTest(testMap, '地图')} text="测试连接" /></View>}
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
  save: { backgroundColor: '#67C23A', borderRadius: 8, padding: 16, alignItems: 'center', margin: 16 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
