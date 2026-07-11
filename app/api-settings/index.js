import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { loadSetting } from '../../src/services/settings';

const CATEGORIES = [
  { key: 'model', icon: 'hardware-chip-outline', color: '#4A90D9', title: 'AI 模型', desc: '服务商、API Key、模型配置' },
  { key: 'features', icon: 'sparkles-outline', color: '#9B59B6', title: 'AI 功能', desc: '搜索、识图、生图、表情包' },
  { key: 'voice', icon: 'mic-outline', color: '#4fc3f7', title: '语音', desc: '朗读、语音消息、语音通话' },
  { key: 'services', icon: 'apps-outline', color: '#E6A23C', title: '第三方服务', desc: '网易云音乐、高德地图' },
];

export default function APISettingsIndex() {
  const router = useRouter();
  const [summary, setSummary] = useState({});

  useFocusEffect(useCallback(() => {
    (async () => {
      const d = await loadSetting('api_settings', {});
      const sm = {};
      if (d.apiKey) sm.model = `${d.provider === 'deepseek' ? 'DeepSeek' : d.provider === 'openai' ? 'OpenAI' : d.provider === 'qwen' ? '通义千问' : '自定义'} · ${d.modelName || '默认'}`;
      else sm.model = '未配置 API Key';
      const f = [d.enableSearch, d.enableImageRecognition, d.enableImageGen, d.enableEmoji].filter(Boolean).length;
      sm.features = f > 0 ? `已开启 ${f} 项功能` : '未开启任何功能';
      const v = [d.enableAIVoiceMsg, d.enableVoiceCall].filter(Boolean).length;
      sm.voice = v > 0 ? `已开启 ${v} 项` : '未开启任何功能';
      const s = [d.enableMusic, d.enableMap].filter(Boolean).length;
      sm.services = s > 0 ? `已连接 ${s} 项服务` : '未连接任何服务';
      setSummary(sm);
    })();
  }, []));

  return (
    <ScrollView style={s.ctn} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={s.header}>
        <View style={[s.headerIcon, { backgroundColor: '#4A90D915' }]}>
          <Ionicons name="settings-outline" size={28} color="#4A90D9" />
        </View>
        <Text style={s.headerSub}>配置 AI 模型、语音服务及第三方连接</Text>
      </View>
      {CATEGORIES.map(c => {
        const configured = summary[c.key] && !summary[c.key].startsWith('未');
        return (
          <TouchableOpacity key={c.key} style={s.row} onPress={() => router.push(`/api-settings/${c.key}`)} activeOpacity={0.7}>
            <View style={[s.icon, { backgroundColor: c.color + '15' }]}>
              <Ionicons name={c.icon} size={24} color={c.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{c.title}</Text>
              <Text style={[s.summary, configured && { color: '#67C23A' }]} numberOfLines={1}>{summary[c.key] || c.desc}</Text>
            </View>
            {configured && <View style={[s.dot, { backgroundColor: '#67C23A' }]} />}
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 20, paddingHorizontal: 20 },
  headerIcon: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  headerSub: { fontSize: 14, color: '#999', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, padding: 18, borderRadius: 14, gap: 14 },
  icon: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 17, fontWeight: '600', color: '#333' },
  summary: { fontSize: 13, color: '#999', marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
});
