import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { formatTime, formatDate } from '../src/utils/time';
import { loadSetting } from '../src/services/settings';

export default function ChatHistoryScreen() {
  const router = useRouter();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const searchAllMessages = useAppStore(s => s.searchAllMessages);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [userProfile, setUserProfile] = useState({});

  useFocusEffect(useCallback(() => {
    (async () => {
      const p = await loadSetting('user_profile', {});
      setUserProfile(p);
    })();
  }, []));

  const getConvName = (item) => {
    if (item.conversation_name) return item.conversation_name;
    return item.conversation_type === 'group' ? '群聊' : '私聊';
  };

  const handleSearch = async () => {
    if (!searchText.trim()) {
      Alert.alert('提示', '请输入搜索关键词');
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await searchAllMessages(searchText.trim());
      setSearchResults(results);
    } catch (error) {
      Alert.alert('错误', '搜索失败');
    }
    setIsSearching(false);
  };

  const highlightText = (text, keyword) => {
    if (!keyword) return <Text>{text}</Text>;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <Text>
        {parts.map((part, i) =>
          part.toLowerCase() === keyword.toLowerCase()
            ? <Text key={i} style={s.highlight}>{part}</Text>
            : <Text key={i}>{part}</Text>
        )}
      </Text>
    );
  };

  const getSenderName = (item) => {
    if (item.sender_type === 'user') return userProfile.name || '你';
    return item.sender_name || 'AI';
  };

  const renderResultItem = ({ item }) => {
    const ai = aiCharacters.find(a => a.id === item.sender_id);
    const senderName = getSenderName(item);
    const isUser = item.sender_type === 'user';

    return (
      <TouchableOpacity style={s.card} onPress={() => router.push(`/chat/${item.conversation_id}`)}>
        <View style={s.cardHeader}>
          <View style={s.convBadge}>
            <Ionicons name={item.conversation_type === 'group' ? 'people' : 'chatbubble'} size={11} color="#4A90D9" />
            <Text style={s.convBadgeText} numberOfLines={1}>{getConvName(item)}</Text>
          </View>
          <Text style={s.time}>
            {formatDate(item.created_at)} {formatTime(item.created_at)}
          </Text>
        </View>

        <View style={s.cardBody}>
          {isUser ? (
            userProfile.avatar ? (
              <Image source={{ uri: userProfile.avatar }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.userAvatar]}>
                <Ionicons name="person" size={18} color="#fff" />
              </View>
            )
          ) : ai?.avatar && ai.avatar.length > 1 ? (
            <Image source={{ uri: ai.avatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.aiAvatar]}>
              <Text style={s.avatarText}>{ai?.name?.[0] || 'A'}</Text>
            </View>
          )}
          <View style={s.msgContent}>
            <Text style={s.senderName}>{senderName}</Text>
            <Text style={s.msgText} numberOfLines={2}>
              {highlightText(item.content, searchText)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.ctn}>
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={s.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="输入关键词搜索..."
            placeholderTextColor="#999"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        <View style={s.centered}>
          <Text style={s.loadingText}>搜索中...</Text>
        </View>
      ) : !hasSearched ? (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="search-outline" size={40} color="#ccc" />
          </View>
          <Text style={s.emptyTitle}>搜索聊天记录</Text>
          <Text style={s.emptySub}>输入关键词，查找所有对话中的内容</Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="document-text-outline" size={40} color="#ccc" />
          </View>
          <Text style={s.emptyTitle}>未找到相关记录</Text>
          <Text style={s.emptySub}>试试其他关键词</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderResultItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  searchWrap: { padding: 12, backgroundColor: '#fff' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 12, gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#333' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, color: '#666', fontWeight: '500' },
  emptySub: { fontSize: 13, color: '#999', marginTop: 6 },

  list: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  convBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#4A90D910', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, gap: 4,
  },
  convBadgeText: { fontSize: 12, color: '#4A90D9', maxWidth: 160 },
  time: { fontSize: 12, color: '#bbb' },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  userAvatar: { backgroundColor: '#67C23A', justifyContent: 'center', alignItems: 'center' },
  aiAvatar: { backgroundColor: '#4A90D9', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  msgContent: { flex: 1 },
  senderName: { fontSize: 13, color: '#666', marginBottom: 3 },
  msgText: { fontSize: 15, color: '#333', lineHeight: 22 },
  highlight: { backgroundColor: '#FFE66D', fontWeight: '500' },
  loadingText: { fontSize: 15, color: '#999' },
});
