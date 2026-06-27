import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { formatTime, formatDate } from '../src/utils/time';

export default function ChatHistoryScreen() {
  const router = useRouter();
  const conversations = useAppStore(s => s.conversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const searchAllMessages = useAppStore(s => s.searchAllMessages);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
      console.error('搜索失败:', error);
      Alert.alert('错误', '搜索失败');
    }
    setIsSearching(false);
  };

  const highlightText = (text, keyword) => {
    if (!keyword) return <Text>{text}</Text>;
    
    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return (
      <Text>
        {parts.map((part, index) => 
          part.toLowerCase() === keyword.toLowerCase() ? (
            <Text key={index} style={styles.highlight}>{part}</Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const renderResultItem = ({ item }) => {
    const ai = aiCharacters.find(a => a.id === item.sender_id);
    const avatarName = item.sender_type === 'user' ? '我' : (ai?.name?.[0] || 'A');
    const isUser = item.sender_type === 'user';

    return (
      <TouchableOpacity 
        style={styles.resultItem}
        onPress={() => router.push(`/chat/${item.conversation_id}`)}
      >
        <View style={styles.resultHeader}>
          <View style={styles.conversationInfo}>
            <Ionicons 
              name={item.conversation_type === 'group' ? 'people' : 'chatbubble'} 
              size={14} 
              color="#999" 
            />
            <Text style={styles.conversationName} numberOfLines={1}>
              {item.conversation_name}
            </Text>
          </View>
          <Text style={styles.resultTime}>
            {formatDate(item.created_at)} {formatTime(item.created_at)}
          </Text>
        </View>
        
        <View style={styles.resultContent}>
          <View style={[styles.avatar, isUser ? styles.userAvatar : styles.aiAvatar]}>
            <Text style={styles.avatarText}>{avatarName}</Text>
          </View>
          <View style={styles.messagePreview}>
            <Text style={styles.senderName}>{item.sender_name}</Text>
            <Text style={styles.messageText} numberOfLines={2}>
              {highlightText(item.content, searchText)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>搜索聊天记录</Text>
          <Text style={styles.emptySubText}>输入关键词搜索所有聊天内容</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>未找到相关记录</Text>
        <Text style={styles.emptySubText}>试试其他关键词</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索聊天记录..."
            placeholderTextColor="#999"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>搜索</Text>
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>搜索中...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderResultItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#999',
  },
  resultsList: {
    padding: 12,
  },
  resultItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  conversationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  conversationName: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  resultTime: {
    fontSize: 12,
    color: '#999',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatar: {
    backgroundColor: '#67C23A',
  },
  aiAvatar: {
    backgroundColor: '#4A90D9',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messagePreview: {
    flex: 1,
  },
  senderName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  highlight: {
    backgroundColor: '#FFE66D',
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
});
