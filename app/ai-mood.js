import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getAIMood, updateAIMood, getMoodInfo } from '../src/services/emotion';
import { SafeAvatar } from '../src/components/SafeImage';

const MOODS = [
  { id: 'happy', name: '开心', icon: '😊', color: '#FFD700' },
  { id: 'sad', name: '难过', icon: '😢', color: '#4169E1' },
  { id: 'angry', name: '生气', icon: '😠', color: '#FF4500' },
  { id: 'excited', name: '兴奋', icon: '🤩', color: '#FF69B4' },
  { id: 'shy', name: '害羞', icon: '😳', color: '#FFB6C1' },
  { id: 'calm', name: '平静', icon: '😌', color: '#98FB98' },
  { id: 'lonely', name: '孤独', icon: '🥺', color: '#DDA0DD' },
  { id: 'surprised', name: '惊喜', icon: '😲', color: '#FFA500' },
  { id: 'bored', name: '无聊', icon: '😑', color: '#D3D3D3' },
  { id: 'love', name: '喜欢', icon: '🥰', color: '#FF1493' },
];

export default function AIMoodScreen() {
  const router = useRouter();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [moods, setMoods] = useState({});

  useEffect(() => {
    loadAllMoods();
  }, []);

  const loadAllMoods = async () => {
    const moodData = {};
    for (const ai of aiCharacters) {
      try {
        const mood = await getAIMood(ai.id);
        moodData[ai.id] = mood;
      } catch (e) {
        moodData[ai.id] = { mood: 'calm', energy: 50, affection: 50 };
      }
    }
    setMoods(moodData);
  };

  const handleResetMood = (ai) => {
    Alert.alert(
      '重置情绪',
      `确定要重置 ${ai.name} 的情绪状态吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置',
          onPress: async () => {
            await updateAIMood(ai.id, { mood: 'calm', energy: 50, affection: 50 });
            loadAllMoods();
          }
        },
      ]
    );
  };

  const getAvatarColor = (id) => {
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  const getMoodColor = (mood) => {
    const moodInfo = MOODS.find(m => m.id === mood);
    return moodInfo?.color || '#98FB98';
  };

  const getMoodIcon = (mood) => {
    const moodInfo = MOODS.find(m => m.id === mood);
    return moodInfo?.icon || '😌';
  };

  const getMoodName = (mood) => {
    const moodInfo = MOODS.find(m => m.id === mood);
    return moodInfo?.name || '平静';
  };

  const getEnergyLevel = (energy) => {
    if (energy > 70) return '充沛';
    if (energy > 40) return '一般';
    return '疲惫';
  };

  const getAffectionLevel = (affection) => {
    if (affection > 70) return '很喜欢';
    if (affection > 40) return '一般';
    return '疏远';
  };

  const getStressLevel = (stress) => {
    if (stress > 70) return '高压';
    if (stress > 40) return '有点压力';
    return '放松';
  };

  const getConfidenceLevel = (confidence) => {
    if (confidence > 70) return '自信';
    if (confidence > 40) return '一般';
    return '不自信';
  };

  const renderAIItem = ({ item }) => {
    const mood = moods[item.id] || { mood: 'calm', energy: 50, affection: 50, stress: 20, confidence: 50 };
    
    return (
      <View style={styles.aiItem}>
        <View style={styles.aiHeader}>
          <SafeAvatar
            uri={item.avatar}
            size={50}
            name={item.name || 'A'}
            color={getAvatarColor(item.id)}
          />
          <View style={styles.aiInfo}>
            <Text style={styles.aiName}>{item.name}</Text>
            <View style={styles.moodBadge}>
              <Text style={styles.moodIcon}>{getMoodIcon(mood.mood)}</Text>
              <Text style={[styles.moodName, { color: getMoodColor(mood.mood) }]}>
                {getMoodName(mood.mood)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => handleResetMood(item)} style={styles.resetBtn}>
            <Ionicons name="refresh" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>精力</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${mood.energy}%`, backgroundColor: mood.energy > 60 ? '#67C23A' : mood.energy > 30 ? '#E6A23C' : '#F56C6C' }]} />
            </View>
            <Text style={styles.statValue}>{getEnergyLevel(mood.energy)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>好感</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${mood.affection}%`, backgroundColor: mood.affection > 60 ? '#FF69B4' : mood.affection > 30 ? '#FFB6C1' : '#D3D3D3' }]} />
            </View>
            <Text style={styles.statValue}>{getAffectionLevel(mood.affection)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>压力</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${mood.stress || 20}%`, backgroundColor: (mood.stress || 20) > 60 ? '#F56C6C' : (mood.stress || 20) > 30 ? '#E6A23C' : '#67C23A' }]} />
            </View>
            <Text style={styles.statValue}>{getStressLevel(mood.stress || 20)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>自信</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${mood.confidence || 50}%`, backgroundColor: (mood.confidence || 50) > 60 ? '#4A90D9' : (mood.confidence || 50) > 30 ? '#87CEEB' : '#D3D3D3' }]} />
            </View>
            <Text style={styles.statValue}>{getConfidenceLevel(mood.confidence || 50)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="heart" size={20} color="#FF69B4" />
        <Text style={styles.headerTitle}>AI情绪系统</Text>
        <Text style={styles.headerDesc}>AI的情绪会随着聊天累积变化</Text>
      </View>

      <FlatList
        data={aiCharacters}
        renderItem={renderAIItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>暂无AI角色</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>情绪会随时间自动回归平静</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerDesc: {
    fontSize: 13,
    color: '#999',
  },
  list: {
    padding: 12,
  },
  aiItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiInfo: {
    flex: 1,
    marginLeft: 12,
  },
  aiName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  moodIcon: {
    fontSize: 20,
  },
  moodName: {
    fontSize: 14,
    fontWeight: '500',
  },
  resetBtn: {
    padding: 8,
  },
  statsContainer: {
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    width: 30,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    fontSize: 12,
    color: '#999',
    width: 40,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#999',
  },
});
