import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { 
  getTTSProviders, 
  getVoicesForProvider, 
  getVoiceSettings, 
  saveVoiceSettings 
} from '../src/services/voice';

export default function VoiceSettingsScreen() {
  const [settings, setSettings] = useState({
    provider: 'system',
    voiceId: '默认',
    autoPlay: true,
    apiKey: '',
    apiBaseUrl: '',
  });
  const [selectedProvider, setSelectedProvider] = useState('system');
  const [selectedVoice, setSelectedVoice] = useState('默认');

  const providers = getTTSProviders();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const voiceSettings = await getVoiceSettings();
    setSettings(voiceSettings);
    setSelectedProvider(voiceSettings.provider);
    setSelectedVoice(voiceSettings.voiceId);
  };

  const handleSaveProvider = async (provider) => {
    setSelectedProvider(provider);
    const voices = getVoicesForProvider(provider);
    const firstVoice = Object.keys(voices)[0];
    setSelectedVoice(firstVoice);
    
    const newSettings = {
      ...settings,
      provider: provider,
      voiceId: firstVoice,
    };
    setSettings(newSettings);
    await saveVoiceSettings(newSettings);
  };

  const handleSaveVoice = async (voiceId) => {
    setSelectedVoice(voiceId);
    const newSettings = {
      ...settings,
      voiceId: voiceId,
    };
    setSettings(newSettings);
    await saveVoiceSettings(newSettings);
  };

  const handleSaveApiSettings = async () => {
    await saveVoiceSettings(settings);
    Alert.alert('成功', '语音API设置已保存');
  };

  const renderProviderItem = (providerId, providerInfo) => (
    <TouchableOpacity
      key={providerId}
      style={[styles.providerItem, selectedProvider === providerId && styles.providerItemActive]}
      onPress={() => handleSaveProvider(providerId)}
    >
      <View style={styles.providerInfo}>
        <Text style={[styles.providerName, selectedProvider === providerId && styles.providerNameActive]}>
          {providerInfo.name}
        </Text>
        <Text style={styles.providerDesc}>{providerInfo.description}</Text>
      </View>
      {selectedProvider === providerId && (
        <Ionicons name="checkmark-circle" size={24} color="#4A90D9" />
      )}
    </TouchableOpacity>
  );

  const renderVoiceItem = (voiceId, voiceInfo) => (
    <TouchableOpacity
      key={voiceId}
      style={[styles.voiceItem, selectedVoice === voiceId && styles.voiceItemActive]}
      onPress={() => handleSaveVoice(voiceId)}
    >
      <Text style={[styles.voiceName, selectedVoice === voiceId && styles.voiceNameActive]}>
        {voiceInfo.name || voiceId}
      </Text>
      {selectedVoice === voiceId && (
        <Ionicons name="checkmark" size={20} color="#4A90D9" />
      )}
    </TouchableOpacity>
  );

  const voices = getVoicesForProvider(selectedProvider);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>语音引擎</Text>
        <Text style={styles.sectionDesc}>选择TTS语音合成服务</Text>
        {Object.entries(providers).map(([id, info]) => renderProviderItem(id, info))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>音色选择</Text>
        <Text style={styles.sectionDesc}>
          {selectedProvider === 'system' ? '系统语音通过调节音高和语速模拟不同效果' : '选择不同的发音人'}
        </Text>
        <View style={styles.voiceGrid}>
          {Object.entries(voices).map(([id, info]) => renderVoiceItem(id, info))}
        </View>
      </View>

      {selectedProvider !== 'system' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>语音API配置</Text>
          
          <Text style={styles.label}>API Key</Text>
          <TextInput
            style={styles.input}
            value={settings.apiKey || ''}
            onChangeText={(text) => setSettings({ ...settings, apiKey: text })}
            placeholder="输入语音API Key"
            placeholderTextColor="#999"
            secureTextEntry
          />

          <Text style={styles.label}>API地址</Text>
          <TextInput
            style={styles.input}
            value={settings.apiBaseUrl || ''}
            onChangeText={(text) => setSettings({ ...settings, apiBaseUrl: text })}
            placeholder="如 https://api.example.com"
            placeholderTextColor="#999"
          />

          <TouchableOpacity style={styles.saveApiButton} onPress={handleSaveApiSettings}>
            <Text style={styles.saveApiButtonText}>保存API设置</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>说明</Text>
        {selectedProvider === 'system' && (
          <View style={styles.infoItem}>
            <Ionicons name="phone-portrait" size={16} color="#4A90D9" />
            <Text style={styles.infoText}>使用手机自带语音引擎，无需联网</Text>
          </View>
        )}
        {selectedProvider === 'mimo' && (
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={16} color="#E6A23C" />
            <Text style={styles.infoText}>MiMo语音需要配置API Key</Text>
          </View>
        )}
        {selectedProvider === 'edge' && (
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={16} color="#67C23A" />
            <Text style={styles.infoText}>Edge语音免费使用，音质优秀</Text>
          </View>
        )}
        {selectedProvider === 'openai' && (
          <View style={styles.infoItem}>
            <Ionicons name="information-circle" size={16} color="#9B59B6" />
            <Text style={styles.infoText}>OpenAI语音需要API Key，使用会产生费用</Text>
          </View>
        )}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  providerNameActive: {
    color: '#4A90D9',
  },
  providerDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  voiceItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  voiceName: {
    fontSize: 14,
    color: '#666',
  },
  voiceNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
  saveApiButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveApiButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
});
