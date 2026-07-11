import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { loadSetting } from '../../src/services/settings';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const GRID_ITEMS = [
  { icon: 'key', label: 'API配置', color: '#4A90D9', route: '/api-settings' },
  { icon: 'people', label: 'AI角色', color: '#67C23A', route: '/ai-manage' },
  { icon: 'logo-wechat', label: '连接微信', color: '#07C160', route: '/wechat-connect' },
  { icon: 'calendar', label: '定时任务', color: '#E6A23C', route: '/scheduled-tasks' },
  { icon: 'heart', label: 'AI情绪', color: '#FF69B4', route: '/ai-mood' },
  { icon: 'bulb', label: '记忆管理', color: '#9B59B6', route: '/memory-manage' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const exportData = useAppStore(s => s.exportData);
  const importData = useAppStore(s => s.importData);
  const [profile, setProfile] = useState({});
  const [apiStatus, setApiStatus] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      const p = await loadSetting('user_profile', {});
      setProfile(p);
      const d = await loadSetting('api_settings', {});
      if (d.apiKey) {
        const prov = { openai: 'OpenAI', deepseek: 'DeepSeek', qwen: '通义千问' };
        setApiStatus(`${prov[d.provider] || d.provider || ''}${d.modelName ? ' · ' + d.modelName : ''}`);
      } else {
        setApiStatus('未配置');
      }
    })();
  }, []));

  const handleExport = async () => {
    try {
      const data = await exportData();
      const fileName = `ai_companion_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert('导出成功', `文件已保存到：${filePath}`);
      }
    } catch (error) {
      Alert.alert('导出失败', error.message);
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      Alert.alert('确认导入', '导入将覆盖现有数据，确定要继续吗？', [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: async () => {
          try { await importData(content); Alert.alert('成功', '数据导入成功！'); }
          catch { Alert.alert('导入失败', '数据格式不正确'); }
        }}
      ]);
    } catch (error) {
      Alert.alert('导入失败', error.message);
    }
  };

  const ListItem = ({ icon, title, subtitle, onPress, color = '#333' }) => (
    <TouchableOpacity style={s.item} onPress={onPress}>
      <View style={[s.itemIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={s.itemContent}>
        <Text style={s.itemTitle}>{title}</Text>
        {subtitle && <Text style={s.itemSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={s.ctn} showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarPlaceholder]}>
              <Ionicons name="person" size={30} color="#ccc" />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.headerInfo} onPress={() => router.push('/profile')}>
          <Text style={s.nickname}>{profile.name || '点击设置昵称'}</Text>
          {profile.bio ? <Text style={s.bio} numberOfLines={1}>{profile.bio}</Text> : null}
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>

      <View style={s.grid}>
        {GRID_ITEMS.map(item => (
          <TouchableOpacity key={item.route} style={s.gridItem} onPress={() => router.push(item.route)}>
            <View style={[s.gridIcon, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <Text style={s.gridLabel}>{item.label}</Text>
            {item.route === '/api-settings' && (
              <Text style={[s.gridStatus, apiStatus === '未配置' ? s.statusWarn : null]} numberOfLines={1}>
                {apiStatus}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.section}>
        <ListItem icon="download" title="导出聊天记录" color="#4A90D9" onPress={handleExport} />
        <ListItem icon="cloud-upload" title="导入数据" color="#67C23A" onPress={handleImport} />
        <ListItem icon="search" title="聊天记录搜索" color="#4A90D9" onPress={() => router.push('/chat-history')} />
        <ListItem icon="images" title="表情包管理" color="#F56C6C" onPress={() => router.push('/emoji-manage')} />
        <ListItem icon="server" title="存储管理" color="#E6A23C" onPress={() => router.push('/storage-manage')} />
        <ListItem icon="stats-chart" title="API用量" color="#4A90D9" onPress={() => router.push('/usage-stats')} />
        <ListItem icon="document-text" title="操作日志" color="#909399" onPress={() => router.push('/log-viewer')} />
        <ListItem icon="information-circle" title="关于" color="#909399" onPress={() => router.push('/about')} />
      </View>

      <Text style={s.version}>恋语 v1.1.0</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 16, marginBottom: 4, padding: 16, borderRadius: 14 },
  avatar: { width: 64, height: 64, borderRadius: 8 },
  avatarPlaceholder: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 14 },
  nickname: { fontSize: 18, fontWeight: '600', color: '#333' },
  bio: { fontSize: 13, color: '#999', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 4, marginBottom: 4 },
  gridItem: { width: '33.33%', alignItems: 'center', paddingVertical: 10 },
  gridIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  gridLabel: { fontSize: 13, color: '#333' },
  gridStatus: { fontSize: 10, color: '#999', marginTop: 2, maxWidth: 80 },
  statusWarn: { color: '#F56C6C' },
  section: { backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 14, marginTop: 0, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, color: '#333' },
  itemSub: { fontSize: 12, color: '#999', marginTop: 2 },
  version: { textAlign: 'center', color: '#ccc', fontSize: 12, paddingVertical: 24 },
});
