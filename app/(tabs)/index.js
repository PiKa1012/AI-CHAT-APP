import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { formatTime } from '../../src/utils/time';
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
  const [fabOpen, setFabOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    loadConversations();
    loadAICharacters();
    checkUnreadMessages();
  }, []));

  useEffect(() => { checkUnreadMessages(); }, [conversations]);

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

  const handleNewChat = () => {
    if (aiCharacters.length === 0) { Alert.alert('提示', '请先创建AI角色'); router.push('/ai-manage'); return; }
    setAiSelectorVisible(true);
  };
  const handleNewGroup = () => {
    if (aiCharacters.length < 2) { Alert.alert('提示', '至少需要2个AI角色才能创建群聊'); return; }
    setSelectedAIs([]); setGroupSelectorVisible(true);
  };

  const startChatWithAI = async (ai) => {
    setAiSelectorVisible(false);
    const existing = conversations.find(c => c.type === 'private' && c.name === ai.name);
    if (existing) { router.push(`/chat/${existing.id}`); return; }
    const convId = await createConversation('private', ai.name, [ai.id]);
    router.push(`/chat/${convId}`);
  };

  const toggleAISelection = (aiId) => {
    setSelectedAIs(prev => prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId]);
  };

  const createGroupChat = async () => {
    if (selectedAIs.length < 2) return Alert.alert('提示', '请至少选择2个AI');
    const names = aiCharacters.filter(ai => selectedAIs.includes(ai.id)).map(ai => ai.name).join('、');
    const convId = await createConversation('group', `${names}的群聊`, selectedAIs);
    setGroupSelectorVisible(false);
    router.push(`/chat/${convId}`);
  };

  const openConversation = async (conv) => {
    await executeUpdate('UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_type = "ai"', [conv.id]);
    setUnreadCounts(prev => ({ ...prev, [conv.id]: 0 }));
    router.push(`/chat/${conv.id}`);
  };

  const handleDeleteConversation = (conv) => {
    Alert.alert('删除对话', `确定要删除与"${conv.name}"的聊天吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteConversation(conv.id) },
    ]);
  };

  const getConvAvatar = (item) => {
    if (item.type === 'group') return item.avatar || null;
    const ai = aiCharacters.find(a => a.name === item.name);
    return ai?.avatar || null;
  };

  const getConvColor = (item) => {
    if (item.type === 'group') return '#67C23A';
    const cs = ['#4A90D9', '#E6A23C', '#F56C6C', '#9B59B6', '#1ABC9C', '#E74C3C', '#909399'];
    return cs[item.id % cs.length];
  };

  const getLastMsg = (item) => {
    if (item.last_message_type === 'image') return '📷 图片';
    if (item.last_message_type === 'audio') return '🎤 语音';
    if (item.last_message_type === 'music_list') {
      try { const s = JSON.parse(item.last_message || '[]'); return s.length > 0 ? `🎵 ${s[0].name || ''}` : '🎵 音乐'; }
      catch { return '🎵 音乐'; }
    }
    if (item.last_message_type === 'emoji') return '😊 表情';
    return item.last_message || '暂无消息';
  };

  const renderConversation = ({ item, index }) => {
    const unreadCount = unreadCounts[item.id] || 0;
    const hasUnread = unreadCount > 0;
    const color = getConvColor(item);
    const avatar = getConvAvatar(item);

    return (
      <TouchableOpacity style={[s.item, hasUnread && s.itemUnread]} onPress={() => openConversation(item)} onLongPress={() => handleDeleteConversation(item)} activeOpacity={0.7}>
        <View style={s.avatarWrap}>
          <SafeAvatar uri={avatar} size={52} name={item.name || 'A'} color={color} />
          {item.type === 'group' && <View style={[s.groupBadge, { backgroundColor: color }]}><Ionicons name="people" size={10} color="#fff" /></View>}
          {hasUnread && <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
        </View>
        <View style={s.info}>
          <View style={s.topRow}>
            <Text style={[s.name, hasUnread && s.nameBold]}>{item.name || '未命名'}</Text>
            <Text style={[s.time, hasUnread && s.timeNew]}>{formatTime(item.last_message_time)}</Text>
          </View>
          <View style={s.bottomRow}>
            <Text style={[s.msg, hasUnread && s.msgBold]} numberOfLines={1}>{getLastMsg(item)}</Text>
            {item.type === 'group' && <Text style={s.groupTag}>群聊</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const cs = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#9B59B6', '#1ABC9C', '#E74C3C'];

  return (
    <View style={s.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
            </View>
            <Text style={s.emptyTitle}>暂无对话</Text>
            <Text style={s.emptySub}>点击上方按钮开始聊天</Text>
          </View>
        }
      />

      {fabOpen && <TouchableOpacity style={s.fabOverlay} activeOpacity={1} onPress={() => setFabOpen(false)} />}

      {fabOpen && (
        <View style={s.fabMenu}>
          <TouchableOpacity style={s.fabItem} onPress={() => { setFabOpen(false); handleNewChat(); }}>
            <View style={[s.fabIcon, { backgroundColor: '#4A90D915' }]}><Ionicons name="chatbubble-outline" size={22} color="#4A90D9" /></View>
            <Text style={s.fabLabel}>私聊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.fabItem} onPress={() => { setFabOpen(false); handleNewGroup(); }}>
            <View style={[s.fabIcon, { backgroundColor: '#67C23A15' }]}><Ionicons name="people-outline" size={22} color="#67C23A" /></View>
            <Text style={s.fabLabel}>群聊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.fabItem} onPress={() => { setFabOpen(false); router.push('/ai-manage'); }}>
            <View style={[s.fabIcon, { backgroundColor: '#E6A23C15' }]}><Ionicons name="person-add-outline" size={22} color="#E6A23C" /></View>
            <Text style={s.fabLabel}>AI管理</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[s.fab, fabOpen && s.fabActive]} onPress={() => setFabOpen(!fabOpen)} activeOpacity={0.8}>
        <Ionicons name={fabOpen ? 'close' : 'add'} size={26} color="#333" />
      </TouchableOpacity>

      <Modal animationType="slide" transparent visible={aiSelectorVisible} onRequestClose={() => setAiSelectorVisible(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>选择 AI</Text>
              <TouchableOpacity onPress={() => setAiSelectorVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <FlatList data={aiCharacters} keyExtractor={it => it.id.toString()} renderItem={({ item: ai }) => (
              <TouchableOpacity style={s.aiRow} onPress={() => startChatWithAI(ai)}>
                <SafeAvatar uri={ai.avatar} size={44} name={ai.name || 'A'} color={cs[ai.id % cs.length]} />
                <View style={s.aiInfo}>
                  <Text style={s.aiName}>{ai.name}</Text>
                  <Text style={s.aiDesc}>{ai.signature || ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
            )} contentContainerStyle={s.aiList} />
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={groupSelectorVisible} onRequestClose={() => setGroupSelectorVisible(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>选择群成员</Text>
              <TouchableOpacity onPress={() => setGroupSelectorVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <Text style={s.hint}>请至少选择 2 个 AI 创建群聊</Text>
            <FlatList data={aiCharacters} keyExtractor={it => it.id.toString()} renderItem={({ item: ai }) => {
              const sel = selectedAIs.includes(ai.id);
              return (
                <TouchableOpacity style={[s.aiRow, sel && s.aiRowSel]} onPress={() => toggleAISelection(ai.id)}>
                  <SafeAvatar uri={ai.avatar} size={44} name={ai.name || 'A'} color={cs[ai.id % cs.length]} />
                  <View style={s.aiInfo}>
                    <Text style={s.aiName}>{ai.name}</Text>
                    <Text style={s.aiDesc}>{ai.signature || ''}</Text>
                  </View>
                  <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={sel ? '#4A90D9' : '#ccc'} />
                </TouchableOpacity>
              );
            }} contentContainerStyle={s.aiList} />
            <TouchableOpacity style={[s.btn, selectedAIs.length < 2 && s.btnDis]} onPress={createGroupChat} disabled={selectedAIs.length < 2}>
              <Text style={s.btnText}>创建群聊 ({selectedAIs.length}人)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  topBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5' },
  actionChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 52, height: 52, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, borderWidth: 1, borderColor: '#eee' },
  fabActive: { backgroundColor: '#f0f0f0', borderColor: '#ddd' },
  fabOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  fabMenu: { position: 'absolute', bottom: 90, right: 20, backgroundColor: '#fff', borderRadius: 16, padding: 8, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  fabItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  fabIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fabLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  listContent: { paddingTop: 6, paddingBottom: 20 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 6, padding: 14, borderRadius: 14 },
  itemUnread: { backgroundColor: '#4A90D908' },
  avatarWrap: { position: 'relative' },
  groupBadge: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  badge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#F56C6C', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  info: { flex: 1, marginLeft: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, color: '#333' },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 12, color: '#bbb' },
  timeNew: { color: '#4A90D9', fontWeight: '500' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  msg: { fontSize: 14, color: '#999', flex: 1 },
  msgBold: { color: '#666', fontWeight: '500' },
  groupTag: { fontSize: 10, color: '#67C23A', backgroundColor: '#67C23A15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, color: '#999', fontWeight: '500' },
  emptySub: { fontSize: 14, color: '#ccc', marginTop: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 20 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  hint: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 10 },
  aiList: { paddingHorizontal: 8 },
  aiRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  aiRowSel: { backgroundColor: '#4A90D908' },
  aiInfo: { flex: 1, marginLeft: 12 },
  aiName: { fontSize: 16, fontWeight: '500', color: '#333' },
  aiDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  btn: { backgroundColor: '#4A90D9', margin: 16, padding: 14, borderRadius: 12, alignItems: 'center' },
  btnDis: { backgroundColor: '#ccc' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
