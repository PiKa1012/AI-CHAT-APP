import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function SettingsScreen() {
  const router = useRouter();
  const exportData = useAppStore(s => s.exportData);
  const importData = useAppStore(s => s.importData);

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
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);
      
      Alert.alert(
        '确认导入',
        '导入将覆盖现有数据，确定要继续吗？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定',
            onPress: async () => {
              try {
                await importData(content);
                Alert.alert('成功', '数据导入成功！');
              } catch (error) {
                Alert.alert('导入失败', '数据格式不正确');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('导入失败', error.message);
    }
  };

  const SettingItem = ({ icon, title, subtitle, onPress, color = '#333' }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={[styles.settingIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>个人设置</Text>
        <SettingItem
          icon="person"
          title="我的资料"
          subtitle="设置昵称和头像"
          color="#67C23A"
          onPress={() => router.push('/profile')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI设置</Text>
        <SettingItem
          icon="key"
          title="API配置"
          subtitle="配置大模型API，让AI真正智能"
          color="#4A90D9"
          onPress={() => router.push('/api-settings')}
        />
        <SettingItem
          icon="people"
          title="AI角色管理"
          subtitle="创建和管理AI角色"
          color="#67C23A"
          onPress={() => router.push('/ai-manage')}
        />
        <SettingItem
          icon="calendar"
          title="定时任务"
          subtitle="管理定时任务和自动发布"
          color="#E6A23C"
          onPress={() => router.push('/scheduled-tasks')}
        />
        <SettingItem
          icon="heart"
          title="AI情绪"
          subtitle="查看和管理AI的情绪状态"
          color="#FF69B4"
          onPress={() => router.push('/ai-mood')}
        />
        <SettingItem
          icon="bulb"
          title="记忆管理"
          subtitle="查看和管理AI的记忆"
          color="#9B59B6"
          onPress={() => router.push('/memory-manage')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>数据管理</Text>
        <SettingItem
          icon="download"
          title="导出数据"
          subtitle="导出所有聊天记录和AI记忆"
          color="#4A90D9"
          onPress={handleExport}
        />
        <SettingItem
          icon="cloud-upload"
          title="导入数据"
          subtitle="从备份文件恢复数据"
          color="#67C23A"
          onPress={handleImport}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>其他</Text>
        <SettingItem
          icon="search"
          title="聊天记录搜索"
          subtitle="搜索所有聊天内容"
          color="#4A90D9"
          onPress={() => router.push('/chat-history')}
        />
        <SettingItem
          icon="images"
          title="表情包管理"
          subtitle="管理自定义表情包"
          color="#F56C6C"
          onPress={() => router.push('/emoji-manage')}
        />
        <SettingItem
          icon="server"
          title="存储管理"
          subtitle="查看和清理占用空间"
          color="#E6A23C"
          onPress={() => router.push('/storage-manage')}
        />
        <SettingItem
          icon="document-text"
          title="操作日志"
          subtitle="查看应用运行日志和错误"
          color="#909399"
          onPress={() => router.push('/log-viewer')}
        />
        <SettingItem
          icon="information-circle"
          title="关于"
          subtitle="版本 1.0.0"
          color="#909399"
          onPress={() => Alert.alert('AI陪伴', '版本 1.0.0\n一个AI社交陪伴应用')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    padding: 12,
    paddingBottom: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
