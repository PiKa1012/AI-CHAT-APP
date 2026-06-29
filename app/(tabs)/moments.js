import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Image, Animated, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { aiAutoPostMoment, aiCommentOnMoment } from '../../src/services/ai';
import { sendLocalNotification, getUnreadCount } from '../../src/services/notification';
import { formatTime, formatDate, formatDateTime } from '../../src/utils/time';
import { SafeAvatar } from '../../src/components/SafeImage';
import { loadSetting } from '../../src/services/settings';

export default function MomentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const moments = useAppStore(s => s.moments);
  const loadMoments = useAppStore(s => s.loadMoments);
  const addMoment = useAppStore(s => s.addMoment);
  const commentOnMoment = useAppStore(s => s.commentOnMoment);
  const deleteComment = useAppStore(s => s.deleteComment);
  const likeMoment = useAppStore(s => s.likeMoment);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [modalVisible, setModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [newMoment, setNewMoment] = useState('');
  const [commentText, setCommentText] = useState('');
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState({});
  const [replyToComment, setReplyToComment] = useState(null);
  const [expandedComments, setExpandedComments] = useState({});
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [userProfile, setUserProfile] = useState({ name: '我', avatar: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const flatListRef = useRef(null);
  const commentRefs = useRef({});
  const [highlightComment, setHighlightComment] = useState(null);
  const lastHandledRef = useRef(null);

  useEffect(() => {
    loadMoments();
    loadUserProfile();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    const paramKey = `${params.scrollToMoment}-${params.commentId}`;
    
    if (params.scrollToMoment && moments.length > 0 && lastHandledRef.current !== paramKey) {
      lastHandledRef.current = paramKey;
      
      const targetId = parseInt(params.scrollToMoment);
      const moment = moments.find(m => m.id === targetId);
      
      if (moment && params.commentId && moment.comments) {
        const commentId = parseInt(params.commentId);
        const comment = moment.comments.find(c => c.id === commentId);
        
        if (comment) {
          let rootCommentId = comment.id;
          if (comment.parent_id) {
            const parent = moment.comments.find(c => c.id === comment.parent_id);
            rootCommentId = parent?.parent_id || comment.parent_id;
          }
          
          setExpandedComments(prev => ({ ...prev, [rootCommentId]: true }));
          
          setTimeout(() => {
            const commentRef = commentRefs.current[commentId];
            if (commentRef) {
              commentRef.measureInWindow((x, y) => {
                if (y > 0) {
                  flatListRef.current?.scrollToOffset({ 
                    offset: Math.max(0, y - 200), 
                    animated: true 
                  });
                }
              });
            }
            setHighlightComment(commentId);
          }, 600);
          
          setTimeout(() => setHighlightComment(null), 3000);
        }
      }
    }
  }, [params, moments]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount();
    }, [])
  );

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (e) {}
  };

  const loadUserProfile = async () => {
    try {
      const profile = await loadSetting('user_profile', {});
      if (profile) {
        setUserProfile({
          name: profile.name || '我',
          avatar: profile.avatar || null,
        });
      }
    } catch (e) {}
  };

  const filteredMoments = selectedFilter === 'all' 
    ? moments 
    : selectedFilter === 'user'
      ? moments.filter(m => m.author_type === 'user')
      : moments.filter(m => m.author_type === 'ai' && m.author_id === parseInt(selectedFilter));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMoments();
    setRefreshing(false);
  };

  const handlePost = async () => {
    if (!newMoment.trim()) {
      Alert.alert('提示', '请输入内容');
      return;
    }
    await addMoment('user', 1, newMoment.trim());
    setNewMoment('');
    setModalVisible(false);

    setTimeout(async () => {
      await loadMoments();
      const updatedMoments = useAppStore.getState().moments;
      const newMomentId = updatedMoments[0]?.id;
      
      if (newMomentId) {
        for (const ai of aiCharacters) {
          if (Math.random() > 0.3) {
            await likeMoment(newMomentId, ai.id);
            await sendLocalNotification(
              '收到点赞',
              `${ai.name} 赞了你的朋友圈`,
              { type: 'like' }
            );
          }
        }
        
        const randomAI = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
        if (randomAI) {
          await aiCommentOnMoment(newMomentId, null, null, randomAI.id);
          await loadMoments();
          await sendLocalNotification(
            '收到评论',
            `${randomAI.name} 评论了你的朋友圈`,
            { type: 'comment' }
          );
        }

        loadUnreadCount();
      }
    }, 2000);
  };

  const handleAIPost = async () => {
    const randomAI = aiCharacters[Math.floor(Math.random() * aiCharacters.length)];
    if (randomAI) {
      await aiAutoPostMoment(randomAI.id);
      await loadMoments();
      Alert.alert('提示', `${randomAI.name} 发了一条朋友圈`);
    }
  };

  const handleLike = async (momentId) => {
    await likeMoment(momentId, 1);

    setLikeAnimations(prev => ({ ...prev, [momentId]: true }));
    setTimeout(() => {
      setLikeAnimations(prev => ({ ...prev, [momentId]: false }));
    }, 1000);
  };

  const handleComment = async (momentId, text, parentId = null) => {
    if (!text?.trim()) return;
    
    const userCommentText = text.trim();
    const newCommentId = await commentOnMoment(momentId, 'user', 1, userCommentText, parentId);
    setReplyToComment(null);
    setCommentText('');
    setCommentModalVisible(false);

    setTimeout(async () => {
      try {
        const updatedMoments = useAppStore.getState().moments;
        const updatedMoment = updatedMoments.find(m => m.id === momentId);
        
        let replyAIId = null;
        let replyToCommentId = newCommentId;
        
        if (parentId) {
          const parentComment = updatedMoment?.comments?.find(c => c.id === parentId);
          if (parentComment && parentComment.author_type === 'ai') {
            replyAIId = parentComment.author_id;
            replyToCommentId = parentId;
          }
        }
        
        if (!replyAIId && updatedMoment?.author_type === 'ai') {
          replyAIId = updatedMoment.author_id;
        }
        
        if (!replyAIId && aiCharacters.length > 0) {
          replyAIId = aiCharacters[0].id;
        }
        
        if (replyAIId) {
          const aiReply = await aiCommentOnMoment(momentId, replyToCommentId, userCommentText, replyAIId);
          await loadMoments();
          
          const replyAI = aiCharacters.find(a => a.id === replyAIId);
          if (replyAI) {
            await sendLocalNotification(
              '收到回复',
              `${replyAI.name} 回复了你`,
              { type: 'reply', momentId: momentId, commentId: aiReply?.commentId }
            );
            loadUnreadCount();
          }
        }
      } catch (error) {
        console.error('AI回复评论失败:', error);
      }
    }, 2000);
  };

  const toggleExpandComments = (momentId) => {
    setExpandedComments(prev => ({
      ...prev,
      [momentId]: !prev[momentId]
    }));
  };

  const getAuthorAvatarUrl = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.avatar || null;
  };

  const getNestedComments = (comments) => {
    const rootComments = [];
    const repliesMap = {};
    
    comments.forEach(comment => {
      if (comment.parent_id) {
        if (!repliesMap[comment.parent_id]) {
          repliesMap[comment.parent_id] = [];
        }
        repliesMap[comment.parent_id].push(comment);
      } else {
        rootComments.push({ ...comment, replies: [] });
      }
    });
    
    rootComments.forEach(root => {
      root.replies = getAllReplies(root.id, comments);
    });
    
    return rootComments;
  };

  const getAllReplies = (parentId, comments, depth = 0, visited = new Set()) => {
    if (depth > 20 || visited.has(parentId)) return [];
    visited.add(parentId);

    const directReplies = comments.filter(c => c.parent_id === parentId);
    let allReplies = [...directReplies];
    
    directReplies.forEach(reply => {
      const subReplies = getAllReplies(reply.id, comments, depth + 1, visited);
      allReplies = [...allReplies, ...subReplies];
    });
    
    return allReplies;
  };

  const getReplyTarget = (comment, comments) => {
    if (!comment.parent_id) return null;
    const parent = comments.find(c => c.id === comment.parent_id);
    if (!parent) return null;
    return { name: getAuthorName(parent.author_type, parent.author_id) };
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert(
      '删除评论',
      '确定要删除这条评论吗？相关的回复也会被删除。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteComment(commentId);
          }
        },
      ]
    );
  };

  const renderNestedComment = (comment, isReply = false, replyTargetName = null) => {
    const isUser = comment.author_type === 'user';
    const isHighlighted = highlightComment === comment.id;
    
    return (
      <View 
        key={comment.id} 
        ref={el => commentRefs.current[comment.id] = el}
        style={[styles.commentItem, isReply && styles.nestedComment, isHighlighted && styles.highlightedComment]}
      >
        <View style={styles.commentRow}>
          {isUser ? (
            <SafeAvatar
              uri={userProfile.avatar}
              size={isReply ? 28 : 32}
              name={userProfile.name}
              color="#67C23A"
            />
          ) : (
            <SafeAvatar
              uri={getAuthorAvatarUrl(comment.author_id)}
              size={isReply ? 28 : 32}
              name={getAuthorName(comment.author_type, comment.author_id)}
              color={getAvatarColor(comment.author_type, comment.author_id)}
            />
          )}
          <View style={styles.commentContent}>
            <View style={styles.commentAuthorRow}>
              <Text style={styles.commentAuthor}>{getAuthorName(comment.author_type, comment.author_id)}</Text>
              {replyTargetName && (
                <>
                  <Ionicons name="arrow-forward" size={12} color="#999" style={{ marginHorizontal: 4 }} />
                  <Text style={styles.replyTargetName}>{replyTargetName}</Text>
                </>
              )}
            </View>
            <Text style={styles.commentText}>{comment.content}</Text>
            <View style={styles.commentActions}>
              <Text style={styles.commentTime}>{formatDateTime(comment.created_at)}</Text>
              <TouchableOpacity onPress={() => {
                setReplyToComment(comment.id);
                setSelectedMoment({ id: comment.moment_id });
                setCommentModalVisible(true);
              }}>
                <Text style={styles.replyButton}>回复</Text>
              </TouchableOpacity>
              {isUser && (
                <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                  <Text style={styles.deleteButton}>删除</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const getAuthorAvatar = (type, id) => {
    if (type === 'user') return '我';
    const ai = aiCharacters.find(a => a.id === id);
    return ai?.name?.[0] || 'A';
  };

  const getAuthorName = (type, id) => {
    if (type === 'user') return userProfile.name || '我';
    const ai = aiCharacters.find(a => a.id === id);
    return ai?.name || 'AI';
  };

  const getAvatarColor = (type, id) => {
    if (type === 'user') return '#67C23A';
    const colors = ['#4A90D9', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C'];
    return colors[(id - 1) % colors.length];
  };

  const LikeAnimation = ({ visible }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (visible) {
        Animated.sequence([
          Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();
      } else {
        scaleAnim.setValue(0);
        opacityAnim.setValue(0);
      }
    }, [visible]);

    return (
      <Animated.View style={[styles.likeAnimation, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <Ionicons name="heart" size={50} color="#F56C6C" />
      </Animated.View>
    );
  };

  const renderMoment = ({ item }) => {
    const isLiked = item.likes?.includes(1);
    const isAnimating = likeAnimations[item.id];

    return (
      <View style={styles.momentItem}>
        <TouchableOpacity
          style={styles.momentHeader}
          onPress={() => {
            if (item.author_type === 'ai') {
              router.push({ pathname: '/ai-profile', params: { id: item.author_id } });
            }
          }}
          disabled={item.author_type !== 'ai'}
        >
          {item.author_type === 'ai' ? (
            <SafeAvatar
              uri={getAuthorAvatarUrl(item.author_id)}
              size={44}
              name={getAuthorName(item.author_type, item.author_id)}
              color={getAvatarColor(item.author_type, item.author_id)}
            />
          ) : (
            <SafeAvatar
              uri={userProfile.avatar}
              size={44}
              name={userProfile.name}
              color="#67C23A"
            />
          )}
          <View style={styles.momentAuthorInfo}>
            <Text style={styles.momentAuthor}>{getAuthorName(item.author_type, item.author_id)}</Text>
            <Text style={styles.momentTime}>{formatDateTime(item.created_at)}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.momentContent}>{item.content}</Text>

        {item.images?.length > 0 && (
          <View style={styles.momentImages}>
            {item.images.map((img, i) => (
              <Image key={i} source={{ uri: img }} style={styles.momentImage} resizeMode="cover" />
            ))}
          </View>
        )}

        <View style={styles.momentActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleLike(item.id)}
            activeOpacity={0.7}
          >
            <Animated.View style={isLiked && styles.likeButtonActive}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={isLiked ? '#F56C6C' : '#999'}
              />
            </Animated.View>
            <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
              {item.likes?.length || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setSelectedMoment(item);
              setReplyToComment(null);
              setCommentModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#999" />
            <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        {item.likes?.length > 0 && (
          <View style={styles.likesContainer}>
            <Ionicons name="heart" size={14} color="#F56C6C" />
            <Text style={styles.likesText}>
              {item.likes.map((userId, index) => (
                <Text key={userId}>
                  {index > 0 && '、'}
                  {userId === 1 ? (userProfile.name || '我') : getAuthorName('ai', userId)}
                </Text>
              ))}
            </Text>
          </View>
        )}

        {item.comments?.length > 0 && (
          <View style={styles.commentsContainer}>
            {getNestedComments(item.comments).map(rootComment => {
              const allReplies = rootComment.replies || [];
              const isExpanded = expandedComments[rootComment.id] === true;
              const replyCount = allReplies.length;
              
              return (
                <View key={rootComment.id}>
                  {renderNestedComment(rootComment)}
                  
                  {replyCount > 0 && !isExpanded && (
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => toggleExpandComments(rootComment.id)}
                    >
                      <Text style={styles.expandButtonText}>展开{replyCount}条回复</Text>
                    </TouchableOpacity>
                  )}
                  
                  {isExpanded && allReplies.map(reply => {
                    const target = getReplyTarget(reply, item.comments);
                    return renderNestedComment(reply, true, target?.name);
                  })}
                  
                  {replyCount > 0 && isExpanded && (
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => toggleExpandComments(rootComment.id)}
                    >
                      <Text style={styles.expandButtonText}>收起回复</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <LikeAnimation visible={isAnimating} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'user' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('user')}
          >
            <Text style={[styles.filterText, selectedFilter === 'user' && styles.filterTextActive]}>我的</Text>
          </TouchableOpacity>
          {aiCharacters.map(ai => (
            <TouchableOpacity
              key={ai.id}
              style={[styles.filterChip, selectedFilter === ai.id.toString() && styles.filterChipActive]}
              onPress={() => setSelectedFilter(ai.id.toString())}
            >
              <Text style={[styles.filterText, selectedFilter === ai.id.toString() && styles.filterTextActive]}>
                {ai.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.headerButton} onPress={handleAIPost}>
          <Ionicons name="sparkles" size={20} color="#4A90D9" />
          <Text style={styles.headerButtonText}>AI发朋友圈</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.notificationBtn} 
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="mail-outline" size={24} color="#333" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredMoments}
        renderItem={renderMoment}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无动态</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="camera" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>发朋友圈</Text>
              <TouchableOpacity onPress={handlePost}>
                <Text style={styles.postText}>发布</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.momentInput}
              value={newMoment}
              onChangeText={setNewMoment}
              placeholder="分享新鲜事..."
              placeholderTextColor="#999"
              multiline
              autoFocus
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={commentModalVisible}
        onRequestClose={() => {
          setCommentModalVisible(false);
          setReplyToComment(null);
          setCommentText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setCommentModalVisible(false);
                setReplyToComment(null);
                setCommentText('');
              }}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {replyToComment ? '回复评论' : '写评论'}
              </Text>
              <TouchableOpacity onPress={() => {
                if (commentText.trim() && selectedMoment) {
                  handleComment(selectedMoment.id, commentText, replyToComment);
                }
              }}>
                <Text style={[styles.postText, !commentText.trim() && { color: '#ccc' }]}>发送</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.momentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={replyToComment ? "回复评论..." : "写评论..."}
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
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  filterChipActive: {
    backgroundColor: '#4A90D9',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  headerButtonText: {
    marginLeft: 4,
    color: '#4A90D9',
    fontSize: 14,
  },
  notificationBtn: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#F56C6C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  momentItem: {
    backgroundColor: '#fff',
    marginBottom: 8,
    padding: 16,
  },
  momentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  momentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  momentAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  momentAuthorInfo: {
    marginLeft: 12,
  },
  momentAuthor: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  momentTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  momentImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  momentImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  momentContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  momentActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    padding: 4,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#999',
  },
  actionTextActive: {
    color: '#F56C6C',
  },
  likeButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  likeAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -25,
    marginTop: -25,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  likesText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  commentsContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginTop: 8,
    padding: 10,
  },
  commentItem: {
    marginBottom: 10,
  },
  nestedComment: {
    marginLeft: 40,
    marginTop: 6,
  },
  highlightedComment: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  commentRow: {
    flexDirection: 'row',
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentContent: {
    marginLeft: 8,
    flex: 1,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthor: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '500',
  },
  replyTargetName: {
    fontSize: 13,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  commentTime: {
    fontSize: 11,
    color: '#999',
  },
  replyButton: {
    fontSize: 12,
    color: '#4A90D9',
  },
  deleteButton: {
    fontSize: 12,
    color: '#F56C6C',
  },
  expandButton: {
    marginLeft: 40,
    paddingVertical: 6,
  },
  expandButtonText: {
    fontSize: 13,
    color: '#4A90D9',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelReply: {
    fontSize: 13,
    color: '#999',
  },
  replySendBtn: {
    padding: 8,
    marginLeft: 4,
  },
  inlineCommentContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inlineCommentTrigger: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inlineCommentPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  inlineCommentSend: {
    padding: 8,
    marginLeft: 4,
  },
  inlineCommentClose: {
    padding: 8,
    marginLeft: 2,
  },
  addButton: {
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
  addButtonHidden: {
    opacity: 0,
    pointerEvents: 'none',
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
  momentInput: {
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    textAlignVertical: 'top',
  },
});
