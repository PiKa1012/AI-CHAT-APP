import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchSongs } from '../../services/netease';
import { styles } from './styles';

export const MusicSearchModal = ({ visible, onClose, onSendToChat, onPlaySong }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    const term = keyword.trim();
    if (!term) return;
    setIsSearching(true);
    try {
      const data = await searchSongs(term);
      setResults(data);
    } catch (e) {
      Alert.alert('搜索失败', e.message);
      setResults([]);
    }
    setIsSearching(false);
  };

  const handleClose = () => {
    setKeyword('');
    setResults([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.musicSearchOverlay}>
        <View style={styles.musicSearchContainer}>
          <View style={styles.musicSearchHeader}>
            <Text style={styles.musicSearchTitle}>搜音乐</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.musicSearchInputRow}>
            <TextInput
              style={styles.musicSearchInput}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="输入歌曲名或歌手"
              placeholderTextColor="#999"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.musicSearchBtn} onPress={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          {results.length > 0 && (
            <TouchableOpacity style={styles.sendToChatBtn} onPress={() => onSendToChat(results)}>
              <Ionicons name="paper-plane" size={16} color="#fff" />
              <Text style={styles.sendToChatBtnText}>发送到聊天 ({results.length}首)</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={results}
            keyExtractor={(item, i) => `${item?.id ?? i}-music-${i}`}
            renderItem={({ item, index }) => (
              <TouchableOpacity style={styles.musicResultItem} onPress={() => onPlaySong(item)}>
                <Image
                  source={{ uri: item.cover || 'https://via.placeholder.com/44/4A90D9/fff?text=♫' }}
                  style={styles.musicResultCover}
                />
                <View style={styles.musicResultInfo}>
                  <Text style={styles.musicResultName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.musicResultArtist} numberOfLines={1}>{item.artist}</Text>
                </View>
                <Ionicons name="play-circle" size={28} color="#4A90D9" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !isSearching ? (
                <View style={styles.musicSearchEmpty}>
                  <Ionicons name="musical-notes-outline" size={48} color="#ccc" />
                  <Text style={styles.musicSearchEmptyText}>搜索你想听的歌曲</Text>
                </View>
              ) : null
            }
            contentContainerStyle={styles.musicResultList}
          />
        </View>
      </View>
    </Modal>
  );
};
