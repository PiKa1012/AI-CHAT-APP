import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getEmojiPacks, createEmojiPack, deleteEmojiPack, getPackEmojis, addEmojiToPack, deleteEmoji, pickImage, pickMultipleImages, MOOD_TAGS } from '../src/services/emoji';

export default function EmojiManageScreen() {
  const router = useRouter();
  const [packs, setPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [packEmojis, setPackEmojis] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [newPackMood, setNewPackMood] = useState('general');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    const data = await getEmojiPacks();
    setPacks(data);
  };

  const loadPackEmojis = async (packId) => {
    const emojis = await getPackEmojis(packId);
    setPackEmojis(emojis);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPacks();
    setRefreshing(false);
  };

  const handleCreatePack = async () => {
    if (!newPackName.trim()) {
      Alert.alert('提示', '请输入表情包名称');
      return;
    }
    await createEmojiPack(newPackName.trim(), newPackMood);
    setNewPackName('');
    setNewPackMood('general');
    setModalVisible(false);
    await loadPacks();
    Alert.alert('成功', '表情包创建成功！');
  };

  const handleDeletePack = (pack) => {
    Alert.alert(
      '确认删除',
      `确定要删除表情包"${pack.name}"吗？所有表情都会被删除。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteEmojiPack(pack.id);
            if (selectedPack?.id === pack.id) {
              setSelectedPack(null);
              setPackEmojis([]);
            }
            await loadPacks();
          }
        },
      ]
    );
  };

  const handleSelectPack = async (pack) => {
    setSelectedPack(pack);
    await loadPackEmojis(pack.id);
  };

  const handleAddEmoji = async () => {
    if (!selectedPack) {
      Alert.alert('提示', '请先选择表情包');
      return;
    }
    const uri = await pickImage();
    if (uri) {
      await addEmojiToPack(selectedPack.id, uri);
      await loadPackEmojis(selectedPack.id);
    }
  };

  const handleBatchAddEmoji = async () => {
    if (!selectedPack) {
      Alert.alert('提示', '请先选择表情包');
      return;
    }
    const uris = await pickMultipleImages();
    if (uris.length > 0) {
      for (const uri of uris) {
        await addEmojiToPack(selectedPack.id, uri);
      }
      await loadPackEmojis(selectedPack.id);
      Alert.alert('成功', `已添加${uris.length}个表情`);
    }
  };

  const handleDeleteEmoji = (emoji) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个表情吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteEmoji(emoji.id);
            await loadPackEmojis(selectedPack.id);
          }
        },
      ]
    );
  };

  const getMoodIcon = (moodTag) => {
    const mood = MOOD_TAGS.find(m => m.id === moodTag);
    return mood?.icon || '👍';
  };

  const getMoodName = (moodTag) => {
    const mood = MOOD_TAGS.find(m => m.id === moodTag);
    return mood?.name || '通用';
  };

  const renderPackItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.packItem, selectedPack?.id === item.id && styles.packItemActive]}
      onPress={() => handleSelectPack(item)}
    >
      <View style={styles.packInfo}>
        <Ionicons name="images" size={24} color={selectedPack?.id === item.id ? '#4A90D9' : '#666'} />
        <View style={styles.packText}>
          <Text style={[styles.packName, selectedPack?.id === item.id && styles.packNameActive]}>
            {item.name}
          </Text>
          <View style={styles.moodTag}>
            <Text style={styles.moodTagText}>{getMoodIcon(item.mood_tag)} {getMoodName(item.mood_tag)}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleDeletePack(item)} style={styles.deletePackBtn}>
        <Ionicons name="trash-outline" size={20} color="#F56C6C" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmojiItem = ({ item }) => (
    <TouchableOpacity
      style={styles.emojiItem}
      onLongPress={() => handleDeleteEmoji(item)}
    >
      <Image source={{ uri: item.image_uri }} style={styles.emojiImage} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>表情包管理</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color="#4A90D9" />
        </TouchableOpacity>
      </View>

      <View style={styles.packsSection}>
        <Text style={styles.sectionTitle}>我的表情包</Text>
        <FlatList
          data={packs}
          renderItem={renderPackItem}
          keyExtractor={(item) => item.id.toString()}
          horizontal={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <Text style={styles.emptyText}>暂无表情包，点击右上角创建</Text>
          }
        />
      </View>

      {selectedPack && (
        <View style={styles.emojisSection}>
          <View style={styles.emojisHeader}>
            <Text style={styles.sectionTitle}>{selectedPack.name}</Text>
            <View style={styles.emojiActions}>
              <TouchableOpacity style={styles.addEmojiBtn} onPress={handleAddEmoji}>
                <Ionicons name="image" size={20} color="#4A90D9" />
                <Text style={styles.addEmojiBtnText}>添加</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addEmojiBtn} onPress={handleBatchAddEmoji}>
                <Ionicons name="images" size={20} color="#67C23A" />
                <Text style={[styles.addEmojiBtnText, { color: '#67C23A' }]}>批量</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={packEmojis}
            renderItem={renderEmojiItem}
            keyExtractor={(item) => item.id.toString()}
            numColumns={4}
            contentContainerStyle={styles.emojiGrid}
            ListEmptyComponent={
              <Text style={styles.emptyText}>暂无表情，点击上方按钮添加</Text>
            }
          />
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>创建表情包</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>表情包名称</Text>
              <TextInput
                style={styles.input}
                value={newPackName}
                onChangeText={setNewPackName}
                placeholder="给表情包起个名字"
                placeholderTextColor="#999"
                autoFocus
              />
              
              <Text style={styles.label}>情绪标签</Text>
              <Text style={styles.labelDesc}>AI会根据情绪选择对应的表情包</Text>
              <View style={styles.moodGrid}>
                {MOOD_TAGS.map(mood => (
                  <TouchableOpacity
                    key={mood.id}
                    style={[styles.moodItem, newPackMood === mood.id && styles.moodItemActive]}
                    onPress={() => setNewPackMood(mood.id)}
                  >
                    <Text style={styles.moodIcon}>{mood.icon}</Text>
                    <Text style={[styles.moodName, newPackMood === mood.id && styles.moodNameActive]}>
                      {mood.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleCreatePack}>
                <Text style={styles.submitButtonText}>创建</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  packsSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  packItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  packItemActive: {
    backgroundColor: '#4A90D915',
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  packInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  packName: {
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  packNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  deletePackBtn: {
    padding: 8,
    marginLeft: 8,
  },
  emojisSection: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  emojisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emojiActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addEmojiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 4,
  },
  addEmojiBtnText: {
    fontSize: 13,
    color: '#4A90D9',
  },
  emojiGrid: {
    gap: 8,
  },
  emojiItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  emojiImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
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
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  packText: {
    flex: 1,
    marginLeft: 10,
  },
  moodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  moodTagText: {
    fontSize: 12,
    color: '#999',
  },
  labelDesc: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moodItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  moodIcon: {
    fontSize: 16,
  },
  moodName: {
    fontSize: 13,
    color: '#666',
  },
  moodNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
});
