import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import { getAIMood, getMoodInfo } from '../src/services/emotion';
import { SafeAvatar } from '../src/components/SafeImage';

const GENDER_MAP = { '男': '♂', '女': '♀', '其他': '⚪' };

export default function AIProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const conversations = useAppStore(s => s.conversations);
  
  const [mood, setMood] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);

  const ai = aiCharacters.find(a => a.id === parseInt(id));

  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadMood();
      }
    }, [id])
  );

  const loadMood = async () => {
    try {
      const moodData = await getAIMood(parseInt(id));
      setMood(moodData);
    } catch (e) {}
  };

  const getAvatarColor = (id) => {
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  const getMoodEmoji = (moodId) => {
    const moods = {
      'happy': '😊', 'sad': '😢', 'angry': '😠', 'excited': '🤩',
      'shy': '😳', 'calm': '😌', 'lonely': '🥺', 'surprised': '😲',
      'bored': '😑', 'love': '🥰', 'anxious': '😰', 'proud': '😤',
      'grateful': '🙏', 'disappointed': '😞',
    };
    return moods[moodId] || '😌';
  };

  const getMoodName = (moodId) => {
    const moods = {
      'happy': '开心', 'sad': '难过', 'angry': '生气', 'excited': '兴奋',
      'shy': '害羞', 'calm': '平静', 'lonely': '孤独', 'surprised': '惊喜',
      'bored': '无聊', 'love': '喜欢', 'anxious': '焦虑', 'proud': '自豪',
      'grateful': '感激', 'disappointed': '失望',
    };
    return moods[moodId] || '平静';
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

  if (!ai) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>AI角色不存在</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => ai.avatar && setPreviewAvatar(ai.avatar)}>
          <SafeAvatar
            uri={ai.avatar}
            size={80}
            name={ai.name || 'A'}
            color={getAvatarColor(ai.id)}
          />
        </TouchableOpacity>
        <Text style={styles.name}>{ai.name}</Text>
        {ai.gender && (
          <Text style={styles.gender}>{GENDER_MAP[ai.gender] || ai.gender}</Text>
        )}
        {ai.age && <Text style={styles.age}>{ai.age}岁</Text>}
      </View>

      {mood && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>当前状态</Text>
          <View style={styles.moodContainer}>
            <Text style={styles.moodEmoji}>{getMoodEmoji(mood.mood)}</Text>
            <Text style={styles.moodName}>{getMoodName(mood.mood)}</Text>
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
                <View style={[styles.progressFill, { width: `${mood.affection}%`, backgroundColor: '#FF69B4' }]} />
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
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person" size={18} color="#4A90D9" />
          <Text style={styles.infoLabel}>性格</Text>
          <Text style={styles.infoValue}>{ai.personality || '友好'}</Text>
        </View>
        {ai.relationship && (
          <View style={styles.infoRow}>
            <Ionicons name="heart" size={18} color="#FF69B4" />
            <Text style={styles.infoLabel}>关系</Text>
            <Text style={styles.infoValue}>{ai.relationship}</Text>
          </View>
        )}
        {ai.speaking_style && (
          <View style={styles.infoRow}>
            <Ionicons name="chatbubble" size={18} color="#67C23A" />
            <Text style={styles.infoLabel}>说话风格</Text>
            <Text style={styles.infoValue}>{ai.speaking_style}</Text>
          </View>
        )}
        {ai.voice_id && (
          <View style={styles.infoRow}>
            <Ionicons name="mic" size={18} color="#E6A23C" />
            <Text style={styles.infoLabel}>声音</Text>
            <Text style={styles.infoValue}>{ai.voice_id}</Text>
          </View>
        )}
      </View>

      {ai.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>简介</Text>
          <Text style={styles.description}>{ai.description}</Text>
        </View>
      )}

      {ai.likes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>兴趣爱好</Text>
          <View style={styles.tagsContainer}>
            {ai.likes.split('、').map((like, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{like}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {ai.background && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>背景故事</Text>
          <Text style={styles.description}>{ai.background}</Text>
        </View>
      )}

      {ai.greeting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>打招呼</Text>
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingText}>"{ai.greeting}"</Text>
          </View>
        </View>
      )}

      <Modal
        visible={!!previewAvatar}
        transparent={true}
        onRequestClose={() => setPreviewAvatar(null)}
      >
        <TouchableOpacity 
          style={styles.avatarPreviewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewAvatar(null)}
        >
          <View style={styles.avatarPreviewContainer}>
            {previewAvatar ? (
              <Image source={{ uri: previewAvatar }} style={styles.avatarPreviewImage} />
            ) : (
              <View style={[styles.avatarPreviewPlaceholder, { backgroundColor: getAvatarColor(ai.id) }]}>
                <Text style={styles.avatarPreviewText}>{ai.name?.[0]}</Text>
              </View>
            )}
            <Text style={styles.avatarPreviewName}>{ai.name}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  gender: {
    fontSize: 16,
    color: '#FF69B4',
    marginTop: 4,
  },
  age: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  errorText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 50,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  moodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
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
    fontSize: 14,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 70,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#4A90D915',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 13,
    color: '#4A90D9',
  },
  greetingContainer: {
    backgroundColor: '#f9f9f9',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90D9',
  },
  greetingText: {
    fontSize: 15,
    color: '#444',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  avatarPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreviewContainer: {
    alignItems: 'center',
  },
  avatarPreviewImage: {
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  avatarPreviewPlaceholder: {
    width: 250,
    height: 250,
    borderRadius: 125,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreviewText: {
    color: '#fff',
    fontSize: 80,
    fontWeight: 'bold',
  },
  avatarPreviewName: {
    color: '#fff',
    fontSize: 20,
    marginTop: 16,
    fontWeight: '500',
  },
});
