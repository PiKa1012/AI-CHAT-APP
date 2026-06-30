import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getDiaryById, deleteDiary, commentOnDiary, aiReplyToDiaryComment } from '../src/services/diary';
import { loadSetting } from '../src/services/settings';
import { formatDateTime } from '../src/utils/time';
import { SafeAvatar } from '../src/components/SafeImage';

export default function DiaryDetailScreen() {
  const router = useRouter();
  const { diaryId } = useLocalSearchParams();
  const [diary, setDiary] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [userProfile, setUserProfile] = useState({ name: '我', avatar: null });

  useEffect(() => {
    loadProfile();
    loadDiary();
  }, []);

  const loadProfile = async () => {
    const p = await loadSetting('user_profile', {});
    setUserProfile({ name: p.name || '我', avatar: p.avatar || null });
  };

  const loadDiary = async () => {
    const data = await getDiaryById(parseInt(diaryId));
    setDiary(data);
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '确定要删除这篇日记吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        await deleteDiary(parseInt(diaryId));
        router.back();
      }},
    ]);
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText('');
    try {
      await commentOnDiary(parseInt(diaryId), 'user', 1, text);
      await loadDiary();
      await aiReplyToDiaryComment(parseInt(diaryId), text);
      await loadDiary();
    } catch (e) {
      Alert.alert('评论失败', e.message);
    }
  };

  if (!diary) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}><Text style={styles.loadingText}>加载中...</Text></View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <SafeAvatar uri={diary.ai_avatar} size={40} name={diary.ai_name?.[0] || 'A'} color="#4A90D9" />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{diary.ai_name}</Text>
              <Text style={styles.headerDate}>{formatDateTime(diary.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#ccc" />
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <Text style={styles.title}>{diary.title}</Text>
          <Text style={styles.contentText}>{diary.content}</Text>

          {diary.tags?.length > 0 && (
            <View style={styles.tags}>
              {diary.tags.map((t, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          )}

          {diary.images?.length > 0 && (
            <View style={styles.images}>
              {diary.images.map((img, i) => (
                <Image key={i} source={{ uri: img }} style={styles.image} resizeMode="cover" />
              ))}
            </View>
          )}
        </View>

        <View style={styles.commentsSection}>
          {(diary.comments || []).map((c, i) => (
            <View key={i} style={styles.commentRow}>
              <SafeAvatar
                uri={c.author_type === 'user' ? userProfile.avatar : diary.ai_avatar}
                size={26}
                name={c.author_type === 'user' ? (userProfile.name[0] || '我') : (diary.ai_name?.[0] || 'A')}
                color={c.author_type === 'user' ? '#F56C6C' : '#4A90D9'}
              />
              <View style={styles.commentContent}>
                <Text style={styles.commentAuthor}>
                  {c.author_type === 'user' ? userProfile.name : diary.ai_name}
                </Text>
                <Text style={styles.commentText}>{c.content}</Text>
                <Text style={styles.commentTime}>{formatDateTime(c.created_at)}</Text>
              </View>
            </View>
          ))}
          {(diary.comments || []).length === 0 && (
            <Text style={styles.noComments}>暂无评论</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TextInput
          style={styles.commentInput}
          value={commentText}
          onChangeText={setCommentText}
          placeholder="写评论..."
          placeholderTextColor="#999"
          returnKeyType="send"
          onSubmitEditing={handleComment}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleComment}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F5' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#999' },

  headerCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '600', color: '#333' },
  headerDate: { fontSize: 12, color: '#bbb', marginTop: 2 },
  deleteBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 14, lineHeight: 30 },
  contentText: { fontSize: 16, color: '#444', lineHeight: 28 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 8 },
  tag: { backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 13, color: '#666', fontWeight: '500' },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  image: { width: 150, height: 150, borderRadius: 12, backgroundColor: '#f0f0f0' },

  commentsSection: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  commentRow: { flexDirection: 'row', marginBottom: 14, gap: 8 },
  commentContent: { flex: 1 },
  commentAuthor: { fontSize: 13, color: '#4A90D9', fontWeight: '500' },
  commentText: { fontSize: 14, color: '#333', marginTop: 1, lineHeight: 20 },
  commentTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
  noComments: { fontSize: 14, color: '#ccc', textAlign: 'center', paddingVertical: 16 },

  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff', gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, color: '#333' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center' },
});
