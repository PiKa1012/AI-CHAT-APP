import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Alert, Image, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { getDiaries, deleteDiary, commentOnDiary, getDiaryStats, aiReplyToDiaryComment } from '../../src/services/diary';
import { loadSetting } from '../../src/services/settings';
import { formatDate } from '../../src/utils/time';
import { SafeAvatar } from '../../src/components/SafeImage';

export default function DiaryScreen() {
  const router = useRouter();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [diaries, setDiaries] = useState([]);
  const [selectedAI, setSelectedAI] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [stats, setStats] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userName, setUserName] = useState('我');
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentText, setCommentText] = useState('');

  useFocusEffect(useCallback(() => { loadProfile(); loadDiaries(); }, [selectedAI]));

  const loadProfile = async () => {
    const p = await loadSetting('user_profile', {});
    if (p.name) setUserName(p.name);
  };

  const loadDiaries = async (reset = true) => {
    try {
      const offset = reset ? 0 : diaries.length;
      const { diaries: data, hasMore: more } = await getDiaries(selectedAI?.id, offset);
      setDiaries(reset ? data : [...diaries, ...data]);
      setHasMore(more);
      if (reset && selectedAI) {
        setStats(await getDiaryStats(selectedAI.id));
      } else if (reset) {
        setStats(null);
      }
    } catch (e) { console.error('加载日记失败:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadDiaries(true); setRefreshing(false); };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadDiaries(false);
    setLoadingMore(false);
  };

  const handleDelete = item => {
    Alert.alert('确认删除', '确定要删除这篇日记吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await deleteDiary(item.id); await loadDiaries(); } },
    ]);
  };

  const handleComment = async (text, target) => {
    if (!text.trim() || !target) return;
    try {
      await commentOnDiary(target.id, 'user', 1, text.trim());
      setCommentText('');
      setCommentTarget(null);
      await loadDiaries();
      await aiReplyToDiaryComment(target.id, text);
      await loadDiaries();
    } catch (e) { Alert.alert('评论失败', e.message); }
  };

  const pickAI = ai => {
    setSelectedAI(ai);
    setShowAiPicker(false);
  };

  const noData = aiCharacters.length === 0;

  const renderHeader = () => {
    if (noData) return null;
    if (!selectedAI) {
      return (
        <TouchableOpacity style={styles.relationCard} onPress={() => setShowAiPicker(true)} activeOpacity={0.7}>
          <View style={styles.relationLeft}>
            <View style={[styles.allAvatar, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="people" size={24} color="#43A047" />
            </View>
          </View>
          <View style={styles.relationCenter}>
            <Text style={styles.relationName}>全部日记</Text>
            <Text style={styles.relationMeta}>共 {diaries.length} 篇 · 点击切换AI</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={styles.relationCard} onPress={() => setShowAiPicker(true)} activeOpacity={0.7}>
        <View style={styles.relationLeft}>
          <SafeAvatar uri={selectedAI.avatar} size={48} name={selectedAI.name?.[0] || 'A'} color="#4A90D9" />
        </View>
        <View style={styles.relationCenter}>
          <Text style={styles.relationName}>{selectedAI.name}</Text>
          <Text style={styles.relationMeta}>
            {stats ? `认识 ${stats.daysKnown || 1} 天 · ${stats.total} 篇日记` : '加载中...'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/diary-detail?diaryId=${item.id}`)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.95}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
          {!selectedAI && item.ai_name && (
            <View style={styles.cardAiBadge}>
              <SafeAvatar uri={item.ai_avatar} size={16} name={item.ai_name[0]} color="#999" />
              <Text style={styles.cardAiName}>{item.ai_name}</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardContent}>{item.content}</Text>

        {item.tags?.length > 0 && (
          <View style={styles.cardTags}>
            {item.tags.map((t, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {item.images?.length > 0 && (
          <View style={styles.cardImages}>
            {item.images.map((img, i) => (
              <Image key={i} source={{ uri: img }} style={styles.cardImage} resizeMode="cover" />
            ))}
          </View>
        )}

        <View style={styles.cardActions}>
          <View style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={15} color="#999" />
            <Text style={styles.actionText}>{item.comments?.length || 0} 评论</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (noData) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={64} color="#ddd" />
          <Text style={styles.emptyTitle}>还没有AI角色</Text>
          <Text style={styles.emptySub}>先去创建AI角色吧</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={diaries}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.list}
        ListHeaderComponent={renderHeader}
        ListHeaderComponentStyle={styles.listHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="journal-outline" size={64} color="#ddd" />
            <Text style={styles.emptyTitle}>还没有日记</Text>
            <Text style={styles.emptySub}>多聊聊天，AI会记录下TA眼中的你</Text>
          </View>
        }
        ListFooterComponent={hasMore ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color="#999" />
          </View>
        ) : diaries.length > 0 ? (
          <Text style={styles.footerEnd}>— 没有更多了 —</Text>
        ) : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
      />

      <Modal visible={showAiPicker} transparent animationType="slide" onRequestClose={() => setShowAiPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAiPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>切换AI</Text>
            <TouchableOpacity style={[styles.sheetItem, !selectedAI && styles.sheetItemActive]} onPress={() => pickAI(null)}>
              <View style={[styles.sheetAvatar, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="people" size={22} color="#43A047" />
              </View>
              <View style={styles.sheetInfo}>
                <Text style={[styles.sheetName, !selectedAI && styles.sheetNameActive]}>全部日记</Text>
                <Text style={styles.sheetMeta}>查看所有AI的日记</Text>
              </View>
              {!selectedAI && <Ionicons name="checkmark" size={20} color="#43A047" />}
            </TouchableOpacity>
            {aiCharacters.map(ai => (
              <TouchableOpacity key={ai.id} style={[styles.sheetItem, selectedAI?.id === ai.id && styles.sheetItemActive]} onPress={() => pickAI(ai)}>
                <SafeAvatar uri={ai.avatar} size={40} name={ai.name?.[0] || 'A'} color="#4A90D9" />
                <View style={styles.sheetInfo}>
                  <Text style={[styles.sheetName, selectedAI?.id === ai.id && styles.sheetNameActive]}>{ai.name}</Text>
                  <Text style={styles.sheetMeta}>{ai.description || ai.signature || ''}</Text>
                </View>
                {selectedAI?.id === ai.id && <Ionicons name="checkmark" size={20} color="#4A90D9" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!commentTarget} transparent animationType="slide" onRequestClose={() => setCommentTarget(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCommentTarget(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.commentHeader}>
              <TouchableOpacity onPress={() => setCommentTarget(null)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
              <Text style={styles.sheetTitle}>评论</Text>
              <TouchableOpacity onPress={() => handleComment(commentText, commentTarget)}><Text style={styles.postText}>发送</Text></TouchableOpacity>
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
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  list: { padding: 16 },
  listHeader: { marginBottom: 4 },
  relationCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  relationLeft: { marginRight: 14 },
  allAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  relationCenter: { flex: 1 },
  relationName: { fontSize: 17, fontWeight: '600', color: '#333' },
  relationMeta: { fontSize: 13, color: '#999', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardDate: { fontSize: 13, color: '#999', flex: 1 },
  cardAiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  cardAiName: { fontSize: 12, color: '#666' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 8 },
  cardContent: { fontSize: 15, color: '#555', lineHeight: 24 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: '500' },
  cardImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  cardImage: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#f0f0f0' },

  cardActions: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: '#999' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 17, color: '#999', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#ccc', marginTop: 6 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  footerEnd: { paddingVertical: 20, textAlign: 'center', fontSize: 13, color: '#ccc' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 12 },
  sheetItemActive: { backgroundColor: '#F5F8FF' },
  sheetAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sheetInfo: { flex: 1 },
  sheetName: { fontSize: 16, color: '#333' },
  sheetNameActive: { fontWeight: '600', color: '#4A90D9' },
  sheetMeta: { fontSize: 12, color: '#999', marginTop: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  cancelText: { fontSize: 16, color: '#999' },
  postText: { fontSize: 16, color: '#4A90D9', fontWeight: '500' },
  commentInput: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
});
