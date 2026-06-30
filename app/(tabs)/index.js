import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { formatTime, formatDate } from '../../src/utils/time';
import { SafeAvatar } from '../../src/components/SafeImage';
import { executeQuery, executeUpdate } from '../../src/database';

export default function HomeScreen() {
  const router = useRouter();
  const conversations = useAppStore(s => s.conversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const loadConversations = useAppStore(s => s.loadConversations);
  const loadAICharacters = useAppStore(s => s.loadAICharacters);
  const createConversation = useAppStore(s => s.createConversation);
  const deleteConversation = useAppStore(s => s.deleteConversation);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [aiSelectorVisible, setAiSelectorVisible] = useState(false);
  const [groupSelectorVisible, setGroupSelectorVisible] = useState(false);
  const [selectedAIs, setSelectedAIs] = useState([]);

  useFocusEffect(useCallback(() => {
    loadConversations();
    loadAICharacters();
    checkUnreadMessages();
  }, []));

  useEffect(() => {
    checkUnreadMessages();
  }, [conversations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    await checkUnreadMessages();
    setRefreshing(false);
  };

  const checkUnreadMessages = async () => {
    const unreads = await executeQuery(
      'SELECT conversation_id, COUNT(*) as count FROM messages WHERE is_read = 0 AND sender_type = "ai" GROUP BY conversation_id'
    );
    const counts = {};
    unreads.forEach(u => { counts[u.conversation_id] = u.count; });
    setUnreadCounts(counts);
  };

  const handleNewChat = async () => {
    if (aiCharacters.length === 0) {
      Alert.alert('提示', '请先创建AI角色');
      router.push('/ai-manage');
      return;
    }
    setAiSelectorVisible(true);
  };

  const startChatWithAI = async (ai) => {
    setAiSelectorVisible(false);
    const convId = await createConversation('private', ai.name, [ai.id]);
    router.push(`/chat/${convId}`);
  };

  const handleNewGroup = async () => {
    if (aiCharacters.length < 2) {
      Alert.alert('提示', '至少需要2个AI角色才能创建群聊');
      router.push('/ai-manage');
      return;
    }
    setSelectedAIs([]);
    setGroupSelectorVisible(true);
  };

  const toggleAISelection = (aiId) => {
    setSelectedAIs(prev => {
      if (prev.includes(aiId)) {
        return prev.filter(id => id !== aiId);
      }
      return [...prev, aiId];
    });
  };

  const createGroupChat = async () => {
    if (selectedAIs.length < 2) {
      Alert.alert('提示', '请至少选择2个AI');
      return;
    }
    const selectedNames = aiCharacters
      .filter(ai => selectedAIs.includes(ai.id))
      .map(ai => ai.name)
      .join('、');
    const convId = await createConversation('group', `${selectedNames}的群聊`, selectedAIs);
    setGroupSelectorVisible(false);
    router.push(`/chat/${convId}`);
  };

  const openConversation = async (conv) => {
    await executeUpdate(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_type = "ai"',
      [conv.id]
    );
    setUnreadCounts(prev => ({ ...prev, [conv.id]: 0 }));
    router.push(`/chat/${conv.id}`);
  };

  const handleDeleteConversation = (conv) => {
    Alert.alert(
      '删除对话',
      `确定要删除与"${conv.name}"的聊天吗？删除后无法恢复。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive', 
          onPress: async () => {
            await deleteConversation(conv.id);
          }
        },
      ]
    );
  };

  const renderConversation = ({ item }) => {
    const unreadCount = unreadCounts[item.id] || 0;
    const hasUnread = unreadCount > 0;

    const getConversationAvatar = () => {
      if (item.type === 'group') {
        return item.avatar || null;
      }
      const ai = aiCharacters.find(a => a.name === item.name);
      return ai?.avatar || null;
    };

    const getAvatarColor = () => {
      if (item.type === 'group') return '#67C23A';
      const colors = ['#4A90D9', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C'];
      return colors[item.id % colors.length];
    };

    const avatar = getConversationAvatar();

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => openConversation(item)}
        onLongPress={() => handleDeleteConversation(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <SafeAvatar
            uri={avatar}
            size={50}
            name={item.name || 'A'}
            color={getAvatarColor()}
          />
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationName, hasUnread && styles.conversationNameUnread]}>
              {item.name || '未命名对话'}
            </Text>
            <Text style={[styles.conversationTime, hasUnread && styles.conversationTimeUnread]}>
              {formatTime(item.last_message_time)}
            </Text>
          </View>
          <Text style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]} numberOfLines={1}>
            {item.last_message_type === 'image' ? '[图片]' : item.last_message_type === 'music_list' ? (() => { try { const songs = JSON.parse(item.last_message || '[]'); return songs.length > 0 ? `[音乐] ${songs[0].name || ''}` : '[音乐]'; } catch (e) { return '[音乐]'; } })() : (item.last_message || '暂无消息')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleNewChat}>
          <View style={[styles.actionIcon, { backgroundColor: '#4A90D915' }]}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#4A90D9" />
          </View>
          <Text style={styles.actionText}>私聊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleNewGroup}>
          <View style={[styles.actionIcon, { backgroundColor: '#67C23A15' }]}>
            <Ionicons name="people" size={24} color="#67C23A" />
          </View>
          <Text style={styles.actionText}>群聊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/ai-manage')}>
          <View style={[styles.actionIcon, { backgroundColor: '#E6A23C15' }]}>
            <Ionicons name="person-add" size={24} color="#E6A23C" />
          </View>
          <Text style={styles.actionText}>AI管理</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无对话</Text>
            <Text style={styles.emptySubText}>点击上方按钮开始聊天</Text>
          </View>
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={aiSelectorVisible}
        onRequestClose={() => setAiSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择AI聊天</Text>
              <TouchableOpacity onPress={() => setAiSelectorVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={aiCharacters}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.aiItem}
                  onPress={() => startChatWithAI(item)}
                >
                  <SafeAvatar
                    uri={item.avatar}
                    size={44}
                    name={item.name || 'A'}
                    color={getAvatarColor(item.id)}
                  />
                  <View style={styles.aiInfo}>
                    <Text style={styles.aiName}>{item.name}</Text>
                    <Text style={styles.aiPersonality}>{item.personality || '友好'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.aiList}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={groupSelectorVisible}
        onRequestClose={() => setGroupSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择群成员</Text>
              <TouchableOpacity onPress={() => setGroupSelectorVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.groupHint}>请至少选择2个AI创建群聊</Text>
            <FlatList
              data={aiCharacters}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedAIs.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.aiItem, isSelected && styles.aiItemSelected]}
                    onPress={() => toggleAISelection(item.id)}
                  >
                    <SafeAvatar
                      uri={item.avatar}
                      size={44}
                      name={item.name || 'A'}
                      color={getAvatarColor(item.id)}
                    />
                    <View style={styles.aiInfo}>
                      <Text style={styles.aiName}>{item.name}</Text>
                      <Text style={styles.aiPersonality}>{item.personality || '友好'}</Text>
                    </View>
                    <Ionicons 
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                      size={24} 
                      color={isSelected ? "#4A90D9" : "#ccc"} 
                    />
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.aiList}
            />
            <TouchableOpacity 
              style={[styles.createGroupButton, selectedAIs.length < 2 && styles.createGroupButtonDisabled]}
              onPress={createGroupChat}
              disabled={selectedAIs.length < 2}
            >
              <Text style={styles.createGroupButtonText}>
                创建群聊 ({selectedAIs.length}人)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getAvatarColor = (id) => {
  const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
  return colors[(id - 1) % colors.length];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F56C6C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
  },
  conversationNameUnread: {
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  conversationTimeUnread: {
    color: '#4A90D9',
  },
  lastMessage: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  lastMessageUnread: {
    color: '#666',
    fontWeight: '500',
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
    maxHeight: '70%',
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
  aiList: {
    padding: 8,
  },
  aiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  aiAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aiInfo: {
    flex: 1,
    marginLeft: 12,
  },
  aiName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  aiPersonality: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  aiItemSelected: {
    backgroundColor: '#4A90D915',
  },
  groupHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 10,
  },
  createGroupButton: {
    backgroundColor: '#4A90D9',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  createGroupButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
