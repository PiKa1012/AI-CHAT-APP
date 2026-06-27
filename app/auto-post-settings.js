import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveAutoPostSettings, getAutoPostSettingsExport } from '../src/services/scheduler';

export default function AutoPostSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    autoMomentEnabled: false,
    autoMomentInterval: 4,
    autoDiaryEnabled: false,
    autoDiaryTime: '22:00',
    autoGroupChatEnabled: false,
    autoGroupChatInterval: 6,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedSettings = await getAutoPostSettingsExport();
    setSettings(savedSettings);
  };

  const handleSave = async () => {
    await saveAutoPostSettings(settings);
    Alert.alert('成功', '自动发布设置已保存');
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="images" size={20} color="#E6A23C" />
            <Text style={styles.sectionTitle}>自动发朋友圈</Text>
          </View>
          <Switch
            value={settings.autoMomentEnabled}
            onValueChange={(value) => updateSetting('autoMomentEnabled', value)}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
        {settings.autoMomentEnabled && (
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>发布间隔（小时）</Text>
            <TextInput
              style={styles.input}
              value={settings.autoMomentInterval.toString()}
              onChangeText={(text) => updateSetting('autoMomentInterval', parseInt(text) || 4)}
              keyboardType="numeric"
              placeholder="4"
              placeholderTextColor="#999"
            />
          </View>
        )}
        <Text style={styles.sectionDesc}>
          AI会在每天8:00-23:00之间自动发朋友圈
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="book" size={20} color="#9B59B6" />
            <Text style={styles.sectionTitle}>自动写日记</Text>
          </View>
          <Switch
            value={settings.autoDiaryEnabled}
            onValueChange={(value) => updateSetting('autoDiaryEnabled', value)}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
        {settings.autoDiaryEnabled && (
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>日记生成时间</Text>
            <TextInput
              style={styles.input}
              value={settings.autoDiaryTime}
              onChangeText={(text) => updateSetting('autoDiaryTime', text)}
              placeholder="22:00"
              placeholderTextColor="#999"
            />
          </View>
        )}
        <Text style={styles.sectionDesc}>
          AI会在指定时间自动生成当天的日记
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="chatbubbles" size={20} color="#67C23A" />
            <Text style={styles.sectionTitle}>群聊自动聊天</Text>
          </View>
          <Switch
            value={settings.autoGroupChatEnabled}
            onValueChange={(value) => updateSetting('autoGroupChatEnabled', value)}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
        {settings.autoGroupChatEnabled && (
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>聊天间隔（小时）</Text>
            <TextInput
              style={styles.input}
              value={settings.autoGroupChatInterval.toString()}
              onChangeText={(text) => updateSetting('autoGroupChatInterval', parseInt(text) || 6)}
              keyboardType="numeric"
              placeholder="6"
              placeholderTextColor="#999"
            />
          </View>
        )}
        <Text style={styles.sectionDesc}>
          AI们会在群里自动聊天互动
        </Text>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>保存设置</Text>
      </TouchableOpacity>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>说明</Text>
        <Text style={styles.infoText}>• 自动发布功能需要配置API才能正常工作</Text>
        <Text style={styles.infoText}>• 发布时间会随机波动，避免过于规律</Text>
        <Text style={styles.infoText}>• 可以在"定时任务"中设置更详细的计划</Text>
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
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 15,
    color: '#333',
  },
  input: {
    width: 80,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#67C23A',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 22,
  },
});
