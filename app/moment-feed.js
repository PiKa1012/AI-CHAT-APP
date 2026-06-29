import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Image, Animated, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { sendLocalNotification, getUnreadCount } from '../src/services/notification';
import { aiCommentOnMoment } from '../src/services/ai';
import { formatDateTime } from '../src/utils/time';
import { SafeAvatar } from '../src/components/SafeImage';
import { loadSetting } from '../src/services/settings';
import * as ImagePicker from 'expo-image-picker';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COVER_HEIGHT = 240;
const IMAGE_GAP = 4;
const CARD_PADDING = 14;

export default function MomentFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const moments = useAppStore(s => s.moments);
  const loadMoments = useAppStore(s => s.loadMoments);
  const addMoment = useAppStore(s => s.addMoment);
  const commentOnMoment = useAppStore(s => s.commentOnMoment);
  const deleteComment = useAppStore(s => s.deleteComment);
  const deleteMoment = useAppStore(s => s.deleteMoment);
  const likeMoment = useAppStore(s => s.likeMoment);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMoment, setNewMoment] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [replyToComment, setReplyToComment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [userProfile, setUserProfile] = useState({ name: '我', avatar: null, coverBg: null, bio: '' });
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterAuthor, setFilterAuthor] = useState(null);
  const [filterAICover, setFilterAICover] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const commentInputRef = useRef(null);

  useLayoutEffect(() => {
    if (filterAuthor) {
      const name = getAuthorName(filterAuthor === 'user' ? 'user' : 'ai', filterAuthor === 'user' ? 1 : parseInt(filterAuthor));
      navigation.setOptions({ title: `${name} 的动态` });
    }
  }, [filterAuthor]);

  useEffect(() => {
    loadMoments();
    loadUserProfile();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    const fa = params.filterAuthor || null;
    setFilterAuthor(fa);
    if (fa && fa !== 'user') {
      loadSetting(`ai_cover_${fa}`, null).then(uri => {
        if (uri) setFilterAICover(uri);
      });
    } else {
      setFilterAICover(null);
    }
  }, [params.filterAuthor]);

  useFocusEffect(useCallback(() => {
    loadUnreadCount();
    loadUserProfile();
    if (!params.filterAuthor) {
      setFilterAuthor(null);
      setFilterAICover(null);
    }
  }, [params.filterAuthor]));

  const loadUnreadCount = async () => {
    try { const count = await getUnreadCount(); setUnreadCount(count); } catch (e) {}
  };

  const loadUserProfile = async () => {
    try {
      const profile = await loadSetting('user_profile', {});
      if (profile) setUserProfile({ name: profile.name || '我', avatar: profile.avatar || null, coverBg: profile.coverBg || null, bio: profile.bio || '' });
    } catch (e) {}
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 9 - selectedImages.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const filteredMoments = filterAuthor === 'user'
    ? moments.filter(m => m.author_type === 'user')
    : filterAuthor
      ? moments.filter(m => m.author_type === 'ai' && m.author_id === parseInt(filterAuthor))
      : moments;

  const onRefresh = async () => { setRefreshing(true); await loadMoments(); setRefreshing(false); };

  const handlePost = async () => {
    if (!newMoment.trim() && selectedImages.length === 0) { Alert.alert('提示', '请输入内容或选择图片'); return; }
    await addMoment('user', 1, newMoment.trim(), selectedImages);
    setNewMoment(''); setSelectedImages([]); setModalVisible(false);
    setTimeout(async () => {
      await loadMoments();
      const updatedMoments = useAppStore.getState().moments;
      const newMomentId = updatedMoments[0]?.id;
      if (newMomentId) {
        for (const ai of aiCharacters) {
          if (Math.random() > 0.3) {
            await likeMoment(newMomentId, ai.id);
            await sendLocalNotification('收到点赞', `${ai.name} 赞了你的朋友圈`, { type: 'like', momentId: newMomentId });
          }
        }
        const randomAI = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
        if (randomAI) {
          const commentResult = await aiCommentOnMoment(newMomentId, null, null, randomAI.id);
          await loadMoments();
          const commentSnippet = (commentResult?.text || '').slice(0, 50);
          await sendLocalNotification('收到评论', `${randomAI.name}: ${commentSnippet}`, { type: 'comment', momentId: newMomentId });
        }
        loadUnreadCount();
      }
    }, 2000);
  };

  const handleLike = async (momentId) => {
    await likeMoment(momentId, 1);
  };

  const handleComment = async (momentId, text, parentId = null) => {
    if (!text?.trim()) return;
    const userCommentText = text.trim();
    const newCommentId = await commentOnMoment(momentId, 'user', 1, userCommentText, parentId);
    setReplyToComment(null); setCommentText(''); setSelectedMoment(null);
    setTimeout(async () => {
      try {
        const updatedMoments = useAppStore.getState().moments;
        const updatedMoment = updatedMoments.find(m => m.id === momentId);
        let replyAIId = null;
        let replyToCommentId = newCommentId;
        if (parentId) {
          const parentComment = updatedMoment?.comments?.find(c => c.id === parentId);
          if (parentComment && parentComment.author_type === 'ai') { replyAIId = parentComment.author_id; replyToCommentId = parentId; }
        }
        if (!replyAIId && updatedMoment?.author_type === 'ai') replyAIId = updatedMoment.author_id;
        if (!replyAIId && aiCharacters.length > 0) replyAIId = aiCharacters[0].id;
        if (replyAIId) {
          const aiReply = await aiCommentOnMoment(momentId, replyToCommentId, userCommentText, replyAIId);
          await loadMoments();
          const replyAI = aiCharacters.find(a => a.id === replyAIId);
          if (replyAI) {
            const replySnippet = (aiReply?.text || '').slice(0, 50);
            await sendLocalNotification('收到回复', `${replyAI.name}: ${replySnippet}`, { type: 'reply', momentId });
            loadUnreadCount();
          }
        }
      } catch (e) { console.error('AI回复评论失败:', e); }
    }, 2000);
  };

  const toggleExpandComments = (momentId) => setExpandedComments(prev => ({ ...prev, [momentId]: !prev[momentId] }));

  const getAuthorAvatarUri = (type, id) => {
    if (type === 'user') return userProfile.avatar;
    const ai = aiCharacters.find(a => a.id === id);
    return ai?.avatar || null;
  };

  const getAuthorName = (type, id) => {
    if (type === 'user') return userProfile.name || '我';
    const ai = aiCharacters.find(a => a.id === id);
    return ai?.name || 'AI';
  };

  const getAvatarColor = (type, id) => {
    if (type === 'user') return '#67C23A';
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT - 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const CARD_MARGIN = 12;
  const IMG_CONTENT_W = SCREEN_WIDTH - CARD_MARGIN * 2 - CARD_PADDING * 2;

  const getImageGridSize = (count) => {
    if (count === 1) return { w: IMG_CONTENT_W, h: IMG_CONTENT_W * 0.6 };
    const w = (IMG_CONTENT_W - IMAGE_GAP * 2) / 3;
    return { w, h: w };
  };

  const renderHeaderRow = (item, isUser) => (
    <View style={styles.momentHeader}>
      <TouchableOpacity onPress={() => isUser ? router.push('/profile') : router.push({ pathname: '/ai-profile', params: { id: item.author_id } })}>
        <SafeAvatar uri={isUser ? userProfile.avatar : getAuthorAvatarUri('ai', item.author_id)} size={36} name={getAuthorName(item.author_type, item.author_id)} color={getAvatarColor(item.author_type, item.author_id)} />
      </TouchableOpacity>
      <Text style={styles.momentAuthor}>{getAuthorName(item.author_type, item.author_id)}</Text>
    </View>
  );

  const renderContent = (item, imgSize) => (
    <>
      <Text style={styles.momentText}>{item.content}</Text>
      {item.images?.length > 0 && (
        <View style={[styles.momentImages, { gap: IMAGE_GAP }]}>
          {item.images.slice(0, 9).map((img, i) => (
            <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => setImagePreview(img)}>
              <Image source={{ uri: img }} style={{ width: imgSize.w, height: imgSize.h, borderRadius: 6, backgroundColor: '#f0f0f0' }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  const renderMoment = ({ item }) => {
    const isUser = item.author_type === 'user';
    const imgSize = getImageGridSize(item.images?.length || 0);

    if (filterAuthor) {
      return (
        <TouchableOpacity style={styles.momentCard} activeOpacity={0.8} onPress={() => router.push({ pathname: '/moment-detail', params: { momentId: item.id } })}>
          {renderHeaderRow(item, isUser)}
          {renderContent(item, imgSize)}
          <Text style={[styles.momentTime, { marginTop: 8 }]}>{formatDateTime(item.created_at)}</Text>
        </TouchableOpacity>
      );
    }

    const isLiked = item.likes?.includes(1);
    const deleteBtn = isUser && (
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteMoment(item.id)}>
        <Ionicons name="trash-outline" size={16} color="#F56C6C" />
      </TouchableOpacity>
    );
    return (
      <View style={styles.momentCard}>
        {renderHeaderRow(item, isUser)}
        {renderContent(item, imgSize)}
        <View style={styles.momentFooter}>
          <Text style={styles.momentTime}>{formatDateTime(item.created_at)}</Text>
          <View style={styles.momentActions}>
            {deleteBtn}
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? '#F56C6C' : '#999'} />
              {item.likes?.length > 0 && <Text style={[styles.actionText, isLiked && { color: '#F56C6C' }]}>{item.likes.length}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setSelectedMoment(item); setReplyToComment(null); }}>
              <Ionicons name="chatbubble-outline" size={17} color="#999" />
              {item.comments?.length > 0 && <Text style={styles.actionText}>{item.comments.length}</Text>}
            </TouchableOpacity>
          </View>
        </View>
        {item.likes?.length > 0 && (
          <View style={styles.likesBar}>
            <Ionicons name="heart" size={13} color="#F56C6C" />
            <Text style={styles.likesText}>
              {item.likes.map((userId, idx) => {
                const isAILike = userId !== 1 && aiCharacters.some(a => a.id === userId);
                return <Text key={userId}>{idx > 0 && '、'}{isAILike ? getAuthorName('ai', userId) : (userProfile.name || '我')}</Text>;
              })}
            </Text>
          </View>
        )}
        {item.comments?.length > 0 && (
          <View style={styles.commentsBox}>
            {getNestedComments(item.comments).map(rootComment => {
              const allReplies = rootComment.replies || [];
              const isExpanded = expandedComments[rootComment.id] === true;
              return (
                <View key={rootComment.id}>
                  {renderNestedComment(rootComment)}
                  {allReplies.length > 0 && !isExpanded && (
                    <TouchableOpacity style={styles.expandBtn} onPress={() => toggleExpandComments(rootComment.id)}>
                      <Text style={styles.expandBtnText}>展开{allReplies.length}条回复</Text>
                    </TouchableOpacity>
                  )}
                  {isExpanded && allReplies.map(reply => renderNestedComment(reply, true))}
                  {allReplies.length > 0 && isExpanded && (
                    <TouchableOpacity style={styles.expandBtn} onPress={() => toggleExpandComments(rootComment.id)}>
                      <Text style={styles.expandBtnText}>收起回复</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
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

  const handleDeleteMoment = (momentId) => {
    Alert.alert('删除动态', '确定要删除这条动态吗？删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await deleteMoment(momentId); } },
    ]);
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert('删除评论', '确定要删除这条评论吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await deleteComment(commentId); } },
    ]);
  };

  const renderNestedComment = (comment, isReply = false) => {
    const isUser = comment.author_type === 'user';
    return (
      <View key={comment.id} style={[styles.commentItem, isReply && styles.commentNested]}>
        <View style={styles.commentRow}>
          <TouchableOpacity onPress={() => isUser ? router.push('/profile') : router.push({ pathname: '/ai-profile', params: { id: comment.author_id } })}>
            <SafeAvatar uri={isUser ? userProfile.avatar : getAuthorAvatarUri('ai', comment.author_id)} size={26} name={getAuthorName(comment.author_type, comment.author_id)} color={getAvatarColor(comment.author_type, comment.author_id)} />
          </TouchableOpacity>
          <View style={styles.commentContent}>
            <Text style={styles.commentAuthor}>{getAuthorName(comment.author_type, comment.author_id)}</Text>
            <Text style={styles.commentText}>{comment.content}</Text>
            <View style={styles.commentActions}>
              <Text style={styles.commentTime}>{formatDateTime(comment.created_at)}</Text>
              <TouchableOpacity onPress={() => { setReplyToComment(comment.id); setSelectedMoment(moments.find(m => m.id === comment.moment_id)); }}>
                <Text style={styles.commentActionText}>回复</Text>
              </TouchableOpacity>
              {isUser && <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}><Text style={[styles.commentActionText, { color: '#F56C6C' }]}>删除</Text></TouchableOpacity>}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    const showAI = filterAuthor && filterAuthor !== 'user';
    const targetAI = showAI ? aiCharacters.find(a => a.id === parseInt(filterAuthor)) : null;
    const displayName = targetAI ? targetAI.name : (userProfile.name || '我');
    const displayAvatar = targetAI ? targetAI.avatar : userProfile.avatar;
    const avatarColor = targetAI ? getAvatarColor('ai', targetAI.id) : '#67C23A';
    const coverSource = targetAI ? (filterAICover || targetAI.coverBg) : userProfile.coverBg;
    const onAvatarPress = targetAI ? () => router.push({ pathname: '/ai-profile', params: { id: targetAI.id } }) : () => router.push('/profile');

    return (
      <View style={styles.coverWrap}>
        <Animated.View style={[styles.coverBg, { opacity: !filterAuthor ? headerOpacity : 1 }]}>
          {coverSource ? (
            <Image source={{ uri: coverSource }} style={styles.coverBgImage} />
          ) : (
            <View style={[styles.coverBgPlaceholder, { backgroundColor: targetAI ? avatarColor : '#3b82c4' }]} />
          )}
          <View style={styles.coverOverlay} />
        </Animated.View>
        <View style={styles.coverTopRight}>
          {filterAuthor === 'user' && (
            <TouchableOpacity style={styles.coverTopBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="mail-outline" size={18} color="#fff" />
              {unreadCount > 0 && <View style={styles.notifyBadge}><Text style={styles.notifyBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
            </TouchableOpacity>
          )}
          {(!filterAuthor || filterAuthor === 'user') && (
            <TouchableOpacity style={styles.coverTopBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.coverContent}>
          <TouchableOpacity style={styles.coverAvatarWrap} onPress={onAvatarPress}>
            <SafeAvatar uri={displayAvatar} size={72} name={displayName} color={avatarColor} />
          </TouchableOpacity>
          <Text style={styles.coverName}>{displayName}</Text>
          <Text style={styles.coverBio}>{targetAI ? (targetAI.description || '') : (userProfile.bio || '这个人很懒，什么都没写')}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={flatListRef}
        data={filteredMoments}
        renderItem={renderMoment}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={selectedMoment ? { paddingBottom: 60 } : { paddingBottom: 16 }}
        ListHeaderComponentStyle={{ marginBottom: 8 }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>暂无动态</Text>
          </View>
        }
      />

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => { setModalVisible(false); setSelectedImages([]); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSelectedImages([]); }}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>发朋友圈</Text>
              <TouchableOpacity onPress={handlePost}><Text style={[styles.postText, !newMoment.trim() && selectedImages.length === 0 && { color: '#ccc' }]}>发布</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.momentInput} value={newMoment} onChangeText={setNewMoment} placeholder="分享新鲜事..." placeholderTextColor="#999" multiline autoFocus />
            <View style={styles.imagePickerRow}>
              {selectedImages.map((uri, i) => (
                <View key={i} style={styles.imageThumbWrap}>
                  <Image source={{ uri }} style={styles.imageThumb} />
                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(i)}>
                    <Ionicons name="close-circle" size={20} color="#F56C6C" />
                  </TouchableOpacity>
                </View>
              ))}
              {selectedImages.length < 9 && (
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                  <Ionicons name="camera-outline" size={28} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {selectedMoment && (() => {
        const replyTarget = replyToComment ? selectedMoment.comments?.find(c => c.id === replyToComment) : null;
        return (
        <View style={styles.commentBar}>
          {replyTarget && (
            <View style={styles.commentBarReply}>
              <Text style={styles.commentBarReplyText}>回复 @{getAuthorName(replyTarget.author_type, replyTarget.author_id)}：{replyTarget.content.slice(0, 20)}{replyTarget.content.length > 20 ? '...' : ''}</Text>
              <TouchableOpacity onPress={() => { setReplyToComment(null); setCommentText(''); }}>
                <Ionicons name="close" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentBarRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={replyToComment ? '回复评论...' : '写评论...'}
              placeholderTextColor="#999"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, !commentText.trim() && { opacity: 0.4 }]}
              disabled={!commentText.trim()}
              onPress={() => {
                if (selectedMoment) handleComment(selectedMoment.id, commentText, replyToComment);
              }}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        );
      })()}

      <Modal visible={!!imagePreview} transparent onRequestClose={() => setImagePreview(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setImagePreview(null)}>
          {imagePreview && <Image source={{ uri: imagePreview }} style={styles.previewImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },

  coverWrap: { height: COVER_HEIGHT, justifyContent: 'flex-end', paddingBottom: 16, position: 'relative' },
  coverBg: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: COVER_HEIGHT },
  coverBgImage: { width: SCREEN_WIDTH, height: COVER_HEIGHT, resizeMode: 'cover' },
  coverBgPlaceholder: { width: SCREEN_WIDTH, height: COVER_HEIGHT },
  coverOverlay: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: COVER_HEIGHT, backgroundColor: 'rgba(0,0,0,0.2)' },
  coverTopRight: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 10 },
  coverTopBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  coverContent: { paddingHorizontal: 20, alignItems: 'flex-end' },
  coverAvatarWrap: { borderWidth: 3, borderColor: '#fff', borderRadius: 39, marginBottom: 8 },
  coverName: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  coverBio: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  notifyBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#F56C6C', borderRadius: 8, minWidth: 15, height: 15, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  notifyBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  momentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    padding: CARD_PADDING,
  },
  momentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  momentAuthor: { fontSize: 15, fontWeight: '600', color: '#4A90D9' },
  momentText: { fontSize: 15, color: '#333', lineHeight: 22 },
  momentImages: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  momentTime: { fontSize: 12, color: '#bbb' },
  momentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  momentActions: { flexDirection: 'row', gap: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionText: { fontSize: 13, color: '#999' },
  deleteBtn: { marginRight: 4 },

  likesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 5,
  },
  likesText: { fontSize: 14, color: '#666', flex: 1 },

  commentsBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginTop: 10,
    padding: 10,
  },
  commentItem: { marginBottom: 8 },
  commentNested: { marginLeft: 34, marginTop: 4, marginBottom: 4 },
  commentRow: { flexDirection: 'row', gap: 6 },
  commentContent: { flex: 1 },
  commentAuthor: { fontSize: 13, color: '#4A90D9', fontWeight: '500' },
  commentText: { fontSize: 14, color: '#333', marginTop: 1, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 12, marginTop: 3 },
  commentTime: { fontSize: 11, color: '#bbb' },
  commentActionText: { fontSize: 12, color: '#4A90D9' },
  expandBtn: { paddingVertical: 4, paddingLeft: 34 },
  expandBtnText: { fontSize: 13, color: '#4A90D9' },

  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#ccc', marginTop: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  cancelText: { fontSize: 16, color: '#999' },
  postText: { fontSize: 16, color: '#4A90D9', fontWeight: '500' },
  momentInput: { padding: 16, fontSize: 16, minHeight: 120, textAlignVertical: 'top' },
  imagePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: (SCREEN_WIDTH - 64) / 3, height: (SCREEN_WIDTH - 64) / 3, borderRadius: 8, backgroundColor: '#f0f0f0' },
  imageRemoveBtn: { position: 'absolute', top: -8, right: -8, zIndex: 10, backgroundColor: '#fff', borderRadius: 10 },
  addImageBtn: { width: (SCREEN_WIDTH - 64) / 3, height: (SCREEN_WIDTH - 64) / 3, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },

  commentBar: { borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff', paddingBottom: 4 },
  commentBarReply: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  commentBarReplyText: { flex: 1, fontSize: 12, color: '#999' },
  commentBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, color: '#333' },
  commentSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
});
