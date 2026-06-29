import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ScrollView, Image } from 'react-native';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getDiaries, generateDiary, deleteDiary, commentOnDiary, getDiaryStats } from '../../src/services/diary';
import { formatDate } from '../../src/utils/time';

const DIARY_STYLES = [
  { id: 'normal', name: '日常', icon: '📝' },
  { id: 'poetic', name: '诗意', icon: '🌸' },
  { id: 'funny', name: '幽默', icon: '😄' },
  { id: 'simple', name: '简洁', icon: '📋' },
];

export default function DiaryScreen() {
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [diaries, setDiaries] = useState([]);
  const [selectedAI, setSelectedAI] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('normal');
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadDiaries();
  }, [selectedAI]);

  const loadDiaries = async () => {
    try {
      const data = await getDiaries(selectedAI?.id);
      setDiaries(data);
      if (selectedAI) {
        const statsData = await getDiaryStats(selectedAI.id);
        setStats(statsData);
      }
    } catch (e) {
      console.error('加载日记失败:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiaries();
    setRefreshing(false);
  };

  const handleGenerate = async () => {
    if (!selectedAI) {
      Alert.alert('提示', '请先选择一个AI');
      return;
    }
    setGenerating(true);
    try {
      const diary = await generateDiary(selectedAI.id, selectedStyle);
      setGenerateModalVisible(false);
      await loadDiaries();
      Alert.alert('成功', `日记已生成：${diary.title}`);
    } catch (e) {
      Alert.alert('生成失败', e.message);
    }
    setGenerating(false);
  };

  const handleDelete = (diary) => {
    Alert.alert(
      '确认删除',
      '确定要删除这篇日记吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteDiary(diary.id);
            await loadDiaries();
          }
        },
      ]
    );
  };

  const handleComment = async () => {
    if (!commentText.trim() || !selectedDiary) return;
    try {
      await commentOnDiary(selectedDiary.id, 'user', 1, commentText.trim());
      setCommentText('');
      setCommentModalVisible(false);
      await loadDiaries();
    } catch (e) {
      Alert.alert('评论失败', e.message);
    }
  };

  const getMoodEmoji = (mood) => {
    const moods = {
      '开心': '😊', '快乐': '😄', '平静': '😌', '难过': '😢',
      '生气': '😠', '惊喜': '😲', '感动': '🥹', '无聊': '😑',
    };
    return moods[mood] || '😌';
  };

  const renderDiaryItem = ({ item }) => (
    <View style={styles.diaryItem}>
      <View style={styles.diaryHeader}>
        <View style={styles.diaryDateContainer}>
          <Text style={styles.diaryDate}>{formatDate(item.created_at)}</Text>
          {item.weather && <Text style={styles.diaryWeather}>{item.weather}</Text>}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.diaryAuthor}>
        <View style={[styles.authorAvatar, { backgroundColor: '#4A90D9' }]}>
          <Text style={styles.authorAvatarText}>{item.ai_name?.[0]}</Text>
        </View>
        <Text style={styles.authorName}>{item.ai_name}</Text>
        {item.mood && (
          <View style={styles.moodContainer}>
            <Text style={styles.moodEmoji}>{getMoodEmoji(item.mood)}</Text>
            <Text style={styles.moodText}>{item.mood}</Text>
          </View>
        )}
      </View>

      <Text style={styles.diaryTitle}>{item.title}</Text>
      <Text style={styles.diaryContent}>{item.content}</Text>

      {item.images?.length > 0 && (
        <View style={styles.diaryImages}>
          {item.images.map((img, i) => (
            <Image key={i} source={{ uri: img }} style={styles.diaryImage} resizeMode="cover" />
          ))}
        </View>
      )}

      {item.tags?.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.diaryActions}>
        <TouchableOpacity
          style={styles.diaryActionBtn}
          onPress={() => {
            setSelectedDiary(item);
            setCommentModalVisible(true);
          }}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#999" />
          <Text style={styles.diaryActionText}>{item.comments?.length || 0}</Text>
        </TouchableOpacity>
      </View>

      {item.comments?.length > 0 && (
        <View style={styles.commentsContainer}>
          {item.comments.map((comment, index) => (
            <View key={index} style={styles.commentItem}>
              <Text style={styles.commentAuthor}>
                {comment.author_type === 'user' ? '我' : item.ai_name}
              </Text>
              <Text style={styles.commentContent}>{comment.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.aiSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.aiChip, !selectedAI && styles.aiChipActive]}
            onPress={() => setSelectedAI(null)}
          >
            <Text style={[styles.aiChipText, !selectedAI && styles.aiChipTextActive]}>全部</Text>
          </TouchableOpacity>
          {aiCharacters.map(ai => (
            <TouchableOpacity
              key={ai.id}
              style={[styles.aiChip, selectedAI?.id === ai.id && styles.aiChipActive]}
              onPress={() => setSelectedAI(ai)}
            >
              <Text style={[styles.aiChipText, selectedAI?.id === ai.id && styles.aiChipTextActive]}>
                {ai.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>总日记</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>本月</Text>
          </View>
          {stats.topMoods.length > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>{getMoodEmoji(stats.topMoods[0]?.mood)}</Text>
              <Text style={styles.statLabel}>常{stats.topMoods[0]?.mood}</Text>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={diaries}
        renderItem={renderDiaryItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无日记</Text>
            <Text style={styles.emptySubText}>点击右下角按钮生成日记</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.generateButton}
        onPress={() => {
          if (!selectedAI) {
            Alert.alert('提示', '请先选择一个AI');
            return;
          }
          setGenerateModalVisible(true);
        }}
      >
        <Ionicons name="create" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={generateModalVisible}
        onRequestClose={() => setGenerateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>生成日记</Text>
              <TouchableOpacity onPress={() => setGenerateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>日记风格</Text>
              <View style={styles.styleGrid}>
                {DIARY_STYLES.map(style => (
                  <TouchableOpacity
                    key={style.id}
                    style={[styles.styleItem, selectedStyle === style.id && styles.styleItemActive]}
                    onPress={() => setSelectedStyle(style.id)}
                  >
                    <Text style={styles.styleIcon}>{style.icon}</Text>
                    <Text style={[styles.styleName, selectedStyle === style.id && styles.styleNameActive]}>
                      {style.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hint}>
                AI会根据今天的聊天记录和朋友圈自动生成日记
              </Text>

              <TouchableOpacity
                style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
                onPress={handleGenerate}
                disabled={generating}
              >
                <Text style={styles.generateBtnText}>
                  {generating ? '生成中...' : '生成日记'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={commentModalVisible}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>评论日记</Text>
              <TouchableOpacity onPress={handleComment}>
                <Text style={styles.postText}>发送</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="写评论..."
              placeholderTextColor="#999"
              multiline
              autoFocus
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  aiSelector: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  aiChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  aiChipActive: {
    backgroundColor: '#4A90D9',
  },
  aiChipText: {
    fontSize: 14,
    color: '#666',
  },
  aiChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  statEmoji: {
    fontSize: 24,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  listContent: {
    padding: 12,
  },
  diaryItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  diaryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diaryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  diaryWeather: {
    fontSize: 13,
    color: '#999',
    marginLeft: 8,
  },
  diaryAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  authorName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  moodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  moodText: {
    fontSize: 12,
    color: '#666',
  },
  diaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  diaryImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  diaryImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  diaryContent: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: '#4A90D915',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 12,
    color: '#4A90D9',
  },
  diaryActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  diaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  diaryActionText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 4,
  },
  commentsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  commentItem: {
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '500',
  },
  commentContent: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  generateButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelText: {
    fontSize: 16,
    color: '#999',
  },
  postText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  styleItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  styleItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  styleIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  styleName: {
    fontSize: 14,
    color: '#666',
  },
  styleNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  generateBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentInput: {
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
