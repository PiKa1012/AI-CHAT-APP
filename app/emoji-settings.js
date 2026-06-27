import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting } from '../src/services/settings';

export default function EmojiSettingsScreen() {
  const [settings, setSettings] = useState({
    enabled: true,
    frequency: 30,
  });
  const [sliderValue, setSliderValue] = useState(30);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const parsed = await loadSetting('emoji_settings', { enabled: true, frequency: 30 });
      if (parsed) {
        setSettings(parsed);
        setSliderValue(parsed.frequency);
      }
    } catch (e) {}
  };

  const saveSettings = async (newSettings) => {
    try {
      await saveSetting('emoji_settings', newSettings);
      setSettings(newSettings);
    } catch (e) {
      Alert.alert('错误', '保存失败');
    }
  };

  const toggleEnabled = (value) => {
    saveSettings({ ...settings, enabled: value });
  };

  const handleSliderChange = (value) => {
    const rounded = Math.round(value / 5) * 5;
    setSliderValue(rounded);
    saveSettings({ ...settings, frequency: rounded });
  };

  const getFrequencyLabel = (value) => {
    if (value <= 10) return '很少';
    if (value <= 25) return '偶尔';
    if (value <= 40) return '适中';
    if (value <= 60) return '经常';
    if (value <= 80) return '频繁';
    return '几乎每条';
  };

  const getFrequencyEmoji = (value) => {
    if (value <= 10) return '😐';
    if (value <= 25) return '🙂';
    if (value <= 40) return '😊';
    if (value <= 60) return '😄';
    if (value <= 80) return '🤣';
    return '😍';
  };

  const frequencyMarks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="happy" size={22} color="#E6A23C" />
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>AI发表情包</Text>
              <Text style={styles.switchDesc}>AI会根据心情发表情</Text>
            </View>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={toggleEnabled}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
      </View>

      {settings.enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>发表情频率</Text>
          
          <View style={styles.frequencyDisplay}>
            <Text style={styles.frequencyEmoji}>{getFrequencyEmoji(sliderValue)}</Text>
            <Text style={styles.frequencyValue}>{sliderValue}%</Text>
            <Text style={styles.frequencyLabel}>{getFrequencyLabel(sliderValue)}</Text>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${sliderValue}%` }]} />
              <View style={[styles.sliderThumb, { left: `${sliderValue}%` }]} />
            </View>
            
            <View style={styles.sliderTouchArea}>
              {frequencyMarks.map(mark => (
                <TouchableOpacity
                  key={mark}
                  style={[styles.markButton, sliderValue === mark && styles.markButtonActive]}
                  onPress={() => handleSliderChange(mark)}
                >
                  <View style={[styles.markDot, sliderValue === mark && styles.markDotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0%</Text>
            <Text style={styles.sliderLabel}>50%</Text>
            <Text style={styles.sliderLabel}>100%</Text>
          </View>

          <View style={styles.previewSection}>
            <Ionicons name="information-circle" size={18} color="#4A90D9" />
            <Text style={styles.previewText}>
              约每 {sliderValue === 0 ? '∞' : Math.round(100 / sliderValue)} 条消息中有 1 条带表情
            </Text>
          </View>

          <View style={styles.quickButtons}>
            <TouchableOpacity 
              style={[styles.quickBtn, sliderValue === 0 && styles.quickBtnActive]}
              onPress={() => handleSliderChange(0)}
            >
              <Text style={[styles.quickBtnText, sliderValue === 0 && styles.quickBtnTextActive]}>关闭</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickBtn, sliderValue === 20 && styles.quickBtnActive]}
              onPress={() => handleSliderChange(20)}
            >
              <Text style={[styles.quickBtnText, sliderValue === 20 && styles.quickBtnTextActive]}>20%</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickBtn, sliderValue === 50 && styles.quickBtnActive]}
              onPress={() => handleSliderChange(50)}
            >
              <Text style={[styles.quickBtnText, sliderValue === 50 && styles.quickBtnTextActive]}>50%</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickBtn, sliderValue === 100 && styles.quickBtnActive]}
              onPress={() => handleSliderChange(100)}
            >
              <Text style={[styles.quickBtnText, sliderValue === 100 && styles.quickBtnTextActive]}>100%</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>工作原理</Text>
        <View style={styles.infoItem}>
          <Ionicons name="heart" size={16} color="#FF69B4" />
          <Text style={styles.infoText}>AI根据自己的情绪状态选择表情</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="images" size={16} color="#67C23A" />
          <Text style={styles.infoText}>从对应情绪标签的表情包中选择</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="shuffle" size={16} color="#9B59B6" />
          <Text style={styles.infoText}>按概率随机决定是否发表情</Text>
        </View>
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
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  switchText: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  switchDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  frequencyDisplay: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  frequencyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  frequencyValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  frequencyLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  sliderContainer: {
    marginBottom: 8,
    position: 'relative',
    height: 40,
  },
  sliderTrack: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#4A90D9',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: 10,
    width: 20,
    height: 20,
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  markButton: {
    width: 30,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markButtonActive: {},
  markDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
  },
  markDotActive: {
    backgroundColor: '#4A90D9',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#999',
  },
  previewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    marginBottom: 16,
  },
  previewText: {
    fontSize: 13,
    color: '#4A90D9',
    flex: 1,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickBtnActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  quickBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  quickBtnTextActive: {
    color: '#4A90D9',
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
