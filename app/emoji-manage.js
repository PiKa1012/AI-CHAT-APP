import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Image, ScrollView } from 'react-native';
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
    (async () => {
      const d = await getEmojiPacks();
      setPacks(d);
      if (d.length > 0) {
        setSelectedPack(d[0]);
        const e = await getPackEmojis(d[0].id);
        setPackEmojis(e);
      }
    })();
  }, []);

  const loadPacks = async () => { const d = await getEmojiPacks(); setPacks(d); };
  const loadPackEmojis = async (packId) => { const e = await getPackEmojis(packId); setPackEmojis(e); };
  const onRefresh = async () => { setRefreshing(true); await loadPacks(); setRefreshing(false); };

  const handleCreatePack = async () => {
    if (!newPackName.trim()) return Alert.alert('提示', '请输入表情包名称');
    await createEmojiPack(newPackName.trim(), newPackMood);
    setNewPackName(''); setNewPackMood('general'); setModalVisible(false);
    await loadPacks();
    Alert.alert('成功', '表情包创建成功！');
  };

  const handleDeletePack = (pack) => {
    Alert.alert('确认删除', `确定要删除"${pack.name}"吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        await deleteEmojiPack(pack.id);
        if (selectedPack?.id === pack.id) { setSelectedPack(null); setPackEmojis([]); }
        await loadPacks();
      }}
    ]);
  };

  const handleSelectPack = async (pack) => {
    setSelectedPack(pack);
    await loadPackEmojis(pack.id);
  };

  const handleAddEmoji = async () => {
    if (!selectedPack) return Alert.alert('提示', '请先选择表情包');
    const uri = await pickImage();
    if (uri) { await addEmojiToPack(selectedPack.id, uri); await loadPackEmojis(selectedPack.id); }
  };

  const handleBatchAdd = async () => {
    if (!selectedPack) return Alert.alert('提示', '请先选择表情包');
    const uris = await pickMultipleImages();
    if (uris.length > 0) {
      for (const uri of uris) await addEmojiToPack(selectedPack.id, uri);
      await loadPackEmojis(selectedPack.id);
    }
  };

  const handleDeleteEmoji = (emoji) => {
    Alert.alert('确认删除', '确定要删除这个表情吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { await deleteEmoji(emoji.id); await loadPackEmojis(selectedPack.id); }}
    ]);
  };

  const getMoodIcon = (tag) => MOOD_TAGS.find(m => m.id === tag)?.icon || '👍';

  return (
    <View style={s.ctn}>
      <View style={s.bar}>
        <Text style={s.barTitle}>我的表情</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>新建</Text>
        </TouchableOpacity>
      </View>

      <View style={s.packBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={packs}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.packChip, selectedPack?.id === item.id && s.packChipOn]}
              onPress={() => handleSelectPack(item)}
              onLongPress={() => handleDeletePack(item)}
            >
              <Text style={[s.packChipEmoji]}>{getMoodIcon(item.mood_tag)}</Text>
              <Text style={[s.packChipText, selectedPack?.id === item.id && s.packChipTextOn]} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={s.emptyHint}>暂无表情包</Text>}
        />
      </View>

      {selectedPack ? (
        <View style={s.emojiSec}>
          <View style={s.emojiHead}>
            <Text style={s.emojiTitle}>{selectedPack.name}</Text>
            <View style={s.emojiActs}>
              <TouchableOpacity onPress={handleAddEmoji} style={s.emojiAct}>
                <Ionicons name="add-outline" size={18} color="#4A90D9" />
                <Text style={s.emojiActText}>添加</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBatchAdd} style={s.emojiAct}>
                <Ionicons name="albums-outline" size={18} color="#67C23A" />
                <Text style={[s.emojiActText, { color: '#67C23A' }]}>批量</Text>
              </TouchableOpacity>
            </View>
          </View>
          {packEmojis.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="happy-outline" size={36} color="#ddd" />
              <Text style={s.emptyText}>暂无表情，点上方添加</Text>
            </View>
          ) : (
            <FlatList
              data={packEmojis}
              keyExtractor={item => item.id.toString()}
              numColumns={4}
              contentContainerStyle={s.grid}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.emojiCell} onLongPress={() => handleDeleteEmoji(item)}>
                  <Image source={{ uri: item.image_uri }} style={s.emojiImg} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={48} color="#ddd" />
          <Text style={s.emptyTitle}>选择一个表情包</Text>
          <Text style={s.emptySub}>点击上方标签查看表情</Text>
        </View>
      )}

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>新建表情包</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={s.lb}>名称</Text>
            <TextInput style={s.inp} value={newPackName} onChangeText={setNewPackName} placeholder="输入名称" placeholderTextColor="#999" autoFocus />
            <Text style={s.lb}>情绪</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.moodScroll}>
              <View style={s.moodRow}>
                {MOOD_TAGS.map(m => (
                  <TouchableOpacity key={m.id} style={[s.moodChip, newPackMood === m.id && s.moodChipOn]}
                    onPress={() => setNewPackMood(m.id)}>
                    <Text>{m.icon}</Text>
                    <Text style={[s.moodChipText, newPackMood === m.id && s.moodChipTextOn]}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={s.submit} onPress={handleCreatePack}>
              <Text style={s.submitText}>创建</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  barTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A90D9', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, gap: 4 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  packBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingBottom: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  packChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#f0f0f0', marginRight: 8, gap: 4,
  },
  packChipOn: { backgroundColor: '#4A90D9' },
  packChipEmoji: { fontSize: 14 },
  packChipText: { fontSize: 13, color: '#666', maxWidth: 80 },
  packChipTextOn: { color: '#fff' },
  emptyHint: { fontSize: 13, color: '#999', paddingHorizontal: 4 },

  emojiSec: { flex: 1, backgroundColor: '#fff' },
  emojiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  emojiTitle: { fontSize: 15, fontWeight: '500', color: '#333' },
  emojiActs: { flexDirection: 'row', gap: 12 },
  emojiAct: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emojiActText: { fontSize: 13, color: '#4A90D9' },

  grid: { padding: 4, paddingBottom: 30 },
  emojiCell: { flex: 1, aspectRatio: 1, margin: 4, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f5f5f5', maxWidth: '25%' },
  emojiImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 60 },
  emptyTitle: { fontSize: 15, color: '#666' },
  emptySub: { fontSize: 13, color: '#bbb' },
  emptyText: { fontSize: 13, color: '#bbb' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 14, width: '85%', padding: 20 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  lb: { fontSize: 14, fontWeight: '500', color: '#666', marginBottom: 6, marginTop: 12 },
  inp: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, color: '#333' },
  moodScroll: { marginTop: 4 },
  moodRow: { flexDirection: 'row', gap: 8 },
  moodChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f5f5f5', gap: 4, borderWidth: 2, borderColor: 'transparent' },
  moodChipOn: { backgroundColor: '#4A90D915', borderColor: '#4A90D9' },
  moodChipText: { fontSize: 12, color: '#666' },
  moodChipTextOn: { color: '#4A90D9', fontWeight: '500' },
  submit: { backgroundColor: '#4A90D9', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
