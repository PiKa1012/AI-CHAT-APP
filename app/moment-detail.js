import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, Image, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { aiCommentOnMoment } from '../src/services/ai';
import { sendLocalNotification } from '../src/services/notification';
import { formatDateTime } from '../src/utils/time';
import { SafeAvatar } from '../src/components/SafeImage';
import { loadSetting } from '../src/services/settings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_GAP = 4;

export default function MomentDetailScreen() {
  const router = useRouter();
  const { momentId } = useLocalSearchParams();
  const moments = useAppStore(s => s.moments);
  const loadMoments = useAppStore(s => s.loadMoments);
  const commentOnMoment = useAppStore(s => s.commentOnMoment);
  const deleteComment = useAppStore(s => s.deleteComment);
  const likeMoment = useAppStore(s => s.likeMoment);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [userProfile, setUserProfile] = useState({ name: '我', avatar: null });
  const [commentText, setCommentText] = useState('');
  const [replyToComment, setReplyToComment] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const inputRef = useRef(null);

  const moment = moments.find(m => m.id === parseInt(momentId));
  const replyTarget = replyToComment ? moment?.comments?.find(c => c.id === replyToComment) : null;

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await loadSetting('user_profile', {});
      if (profile) setUserProfile({ name: profile.name || '我', avatar: profile.avatar || null });
    } catch (e) {}
  };

  const getAuthorName = (type, id) => {
    if (type === 'user') return userProfile.name || '我';
    const ai = aiCharacters.find(a => a.id === id);
    return ai?.name || 'AI';
  };

  const getAuthorAvatarUri = (type, id) => {
    if (type === 'user') return userProfile.avatar;
    const ai = aiCharacters.find(a => a.id === id);
    return ai?.avatar || null;
  };

  const getAvatarColor = (type, id) => {
    if (type === 'user') return '#67C23A';
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  const handleLike = async () => {
    if (!moment) return;
    await likeMoment(moment.id, 1);
  };

  const handleComment = async (text, parentId = null) => {
    if (!text?.trim() || !moment) return;
    const userCommentText = text.trim();
    const newCommentId = await commentOnMoment(moment.id, 'user', 1, userCommentText, parentId);
    setReplyToComment(null);
    setCommentText('');
    setTimeout(async () => {
      try {
        const updatedMoments = useAppStore.getState().moments;
        const updatedMoment = updatedMoments.find(m => m.id === moment.id);
        let replyAIId = null;
        let replyToCommentId = newCommentId;
        if (parentId) {
          const parentComment = updatedMoment?.comments?.find(c => c.id === parentId);
          if (parentComment && parentComment.author_type === 'ai') { replyAIId = parentComment.author_id; replyToCommentId = parentId; }
        }
        if (!replyAIId && updatedMoment?.author_type === 'ai') replyAIId = updatedMoment.author_id;
        if (!replyAIId && aiCharacters.length > 0) replyAIId = aiCharacters[0].id;
        if (replyAIId) {
          const aiReply = await aiCommentOnMoment(moment.id, replyToCommentId, userCommentText, replyAIId);
          await loadMoments();
          const replyAI = aiCharacters.find(a => a.id === replyAIId);
          if (replyAI) {
            await sendLocalNotification('收到回复', `${replyAI.name} 回复了你: ${aiReply?.text?.slice(0, 50) || ''}`, { type: 'reply', momentId: moment.id });
          }
        }
      } catch (e) { console.error('AI回复评论失败:', e); }
    }, 2000);
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert('删除评论', '确定要删除这条评论吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await deleteComment(commentId); } },
    ]);
  };

  const getNestedComments = (comments) => {
    const rootComments = [];
    comments.forEach(comment => {
      if (!comment.parent_id) rootComments.push({ ...comment, replies: [] });
    });
    rootComments.forEach(root => { root.replies = getAllReplies(root.id, comments); });
    return rootComments;
  };

  const getAllReplies = (parentId, comments, depth = 0, visited = new Set()) => {
    if (depth > 20 || visited.has(parentId)) return [];
    visited.add(parentId);
    const directReplies = comments.filter(c => c.parent_id === parentId);
    let allReplies = [...directReplies];
    directReplies.forEach(reply => { allReplies = [...allReplies, ...getAllReplies(reply.id, comments, depth + 1, visited)]; });
    return allReplies;
  };

  const getImageGridSize = (count) => {
    if (count === 1) return { cols: 1, imageWidth: SCREEN_WIDTH - 48, imageHeight: (SCREEN_WIDTH - 48) * 0.6 };
    if (count <= 3) return { cols: 3, imageWidth: (SCREEN_WIDTH - 48 - IMAGE_GAP * 2) / 3, imageHeight: (SCREEN_WIDTH - 48 - IMAGE_GAP * 2) / 3 };
    if (count <= 6) return { cols: 3, imageWidth: (SCREEN_WIDTH - 48 - IMAGE_GAP * 2) / 3, imageHeight: (SCREEN_WIDTH - 48 - IMAGE_GAP * 2) / 3 };
    return { cols: 3, imageWidth: (SCREEN_WIDTH - 48 - IMAGE_GAP * 2) / 3, imageHeight: (SCREEN_WIDTH - 48 - IMAGE_GAP * 2) / 3 };
  };

  const renderNestedComment = (comment, isReply = false) => {
    const isUser = comment.author_type === 'user';
    return (
      <View key={comment.id} style={[styles.commentItem, isReply && styles.commentNested]}>
        <SafeAvatar uri={isUser ? userProfile.avatar : getAuthorAvatarUri('ai', comment.author_id)} size={28} name={getAuthorName(comment.author_type, comment.author_id)} color={getAvatarColor(comment.author_type, comment.author_id)} />
        <View style={styles.commentContent}>
          <Text style={styles.commentAuthor}>{getAuthorName(comment.author_type, comment.author_id)}</Text>
          <Text style={styles.commentText}>{comment.content}</Text>
          <View style={styles.commentActions}>
            <Text style={styles.commentTime}>{formatDateTime(comment.created_at)}</Text>
            <TouchableOpacity onPress={() => { setReplyToComment(comment.id); inputRef.current?.focus(); }}>
              <Text style={styles.commentActionText}>回复</Text>
            </TouchableOpacity>
            {isUser && <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}><Text style={[styles.commentActionText, { color: '#F56C6C' }]}>删除</Text></TouchableOpacity>}
          </View>
        </View>
      </View>
    );
  };

  if (!moment) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Ionicons name="images-outline" size={48} color="#ddd" />
          <Text style={{ fontSize: 16, color: '#999' }}>动态不存在</Text>
          <TouchableOpacity style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#4A90D9', borderRadius: 6 }} onPress={() => router.back()}>
            <Text style={{ color: '#fff', fontSize: 15 }}>返回</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isUser = moment.author_type === 'user';
  const isLiked = moment.likes?.includes(1);
  const imgSize = getImageGridSize(moment.images?.length || 0);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        style={{ flex: 1 }}
        data={[{ key: 'moment' }]}
        contentContainerStyle={styles.listContent}
        renderItem={() => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <SafeAvatar uri={isUser ? userProfile.avatar : getAuthorAvatarUri('ai', moment.author_id)} size={44} name={getAuthorName(moment.author_type, moment.author_id)} color={getAvatarColor(moment.author_type, moment.author_id)} />
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardHeaderName}>{getAuthorName(moment.author_type, moment.author_id)}</Text>
                <Text style={styles.cardHeaderTime}>{formatDateTime(moment.created_at)}</Text>
              </View>
            </View>

            {moment.content ? (
              <Text style={styles.contentText}>{moment.content}</Text>
            ) : null}

            {moment.images?.length > 0 && (
              <View style={[styles.imageGrid, { gap: IMAGE_GAP }]}>
                {moment.images.map((img, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => setImagePreview(img)}>
                    <Image
                      source={{ uri: img }}
                      style={{
                        width: imgSize.imageWidth,
                        height: imgSize.imageHeight,
                        borderRadius: 6,
                        backgroundColor: '#f0f0f0',
                      }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? '#F56C6C' : '#999'} />
                <Text style={[styles.actionBtnText, isLiked && { color: '#F56C6C' }]}>{moment.likes?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setReplyToComment(null); inputRef.current?.focus(); }}>
                <Ionicons name="chatbubble-outline" size={21} color="#999" />
                <Text style={styles.actionBtnText}>{moment.comments?.length || 0}</Text>
              </TouchableOpacity>
            </View>

            {moment.likes?.length > 0 && (
              <View style={styles.likesBar}>
                <Ionicons name="heart" size={14} color="#F56C6C" />
                <Text style={styles.likesText}>
                  {moment.likes.map((userId, idx) => {
                    const isAILike = userId !== 1 && aiCharacters.some(a => a.id === userId);
                    return <Text key={userId}>{idx > 0 && '、'}{isAILike ? getAuthorName('ai', userId) : (userProfile.name || '我')}</Text>;
                  })}
                </Text>
              </View>
            )}

            {moment.comments?.length > 0 && (
              <View style={styles.commentsSection}>
                {getNestedComments(moment.comments).map(rootComment => {
                  const allReplies = rootComment.replies || [];
                  const isExpanded = expandedComments[rootComment.id] === true;
                  return (
                    <View key={rootComment.id}>
                      {renderNestedComment(rootComment)}
                      {allReplies.length > 0 && !isExpanded && (
                        <TouchableOpacity style={styles.expandBtn} onPress={() => setExpandedComments(prev => ({ ...prev, [rootComment.id]: true }))}>
                          <Text style={styles.expandBtnText}>展开{allReplies.length}条回复</Text>
                        </TouchableOpacity>
                      )}
                      {isExpanded && allReplies.map(reply => renderNestedComment(reply, true))}
                      {allReplies.length > 0 && isExpanded && (
                        <TouchableOpacity style={styles.expandBtn} onPress={() => setExpandedComments(prev => ({ ...prev, [rootComment.id]: false }))}>
                          <Text style={styles.expandBtnText}>收起回复</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      />

      <View style={styles.inputBar}>
        {replyToComment && replyTarget && (
          <View style={styles.inputBarReply}>
            <Text style={styles.inputBarReplyText}>回复 @{getAuthorName(replyTarget.author_type, replyTarget.author_id)}：{replyTarget.content.slice(0, 20)}{replyTarget.content.length > 20 ? '...' : ''}</Text>
            <TouchableOpacity onPress={() => { setReplyToComment(null); setCommentText(''); }}>
              <Ionicons name="close" size={18} color="#999" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputBarRow}>
          <TextInput
            ref={inputRef}
            style={styles.inputField}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyToComment ? '回复...' : '写评论...'}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && { opacity: 0.4 }]}
            disabled={!commentText.trim()}
            onPress={() => handleComment(commentText, replyToComment)}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={!!imagePreview} transparent onRequestClose={() => setImagePreview(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setImagePreview(null)}>
          {imagePreview && <Image source={{ uri: imagePreview }} style={styles.previewImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 12, paddingBottom: 8 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cardHeaderInfo: { flex: 1 },
  cardHeaderName: { fontSize: 16, fontWeight: '600', color: '#4A90D9' },
  cardHeaderTime: { fontSize: 12, color: '#bbb', marginTop: 1 },

  contentText: { fontSize: 16, color: '#333', lineHeight: 24, marginTop: 12 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },

  actionBar: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 14, color: '#999' },

  likesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 4,
  },
  likesText: { fontSize: 14, color: '#666', flex: 1 },

  commentsSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  commentItem: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  commentNested: { marginLeft: 36, marginBottom: 6 },
  commentContent: { flex: 1 },
  commentAuthor: { fontSize: 13, color: '#4A90D9', fontWeight: '500' },
  commentText: { fontSize: 14, color: '#333', marginTop: 1, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 12, marginTop: 3 },
  commentTime: { fontSize: 11, color: '#bbb' },
  commentActionText: { fontSize: 12, color: '#4A90D9' },
  expandBtn: { paddingVertical: 4, paddingLeft: 36 },
  expandBtnText: { fontSize: 13, color: '#4A90D9' },

  inputBar: { borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff', paddingBottom: 4 },
  inputBarReply: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  inputBarReplyText: { flex: 1, fontSize: 12, color: '#999' },
  inputBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  inputField: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, color: '#333' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
});
