import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPackEmojis } from '../../services/emoji';

export const EmojiPanel = ({ visible, emojiPacks, onClose, onSelectEmoji }) => {
  const router = useRouter();
  const [selectedPack, setSelectedPack] = useState(null);
  const [packEmojis, setPackEmojis] = useState([]);

  useEffect(() => {
    if (visible && emojiPacks.length > 0 && !selectedPack) {
      loadPackEmojis(emojiPacks[0]);
    }
  }, [visible, emojiPacks]);

  const loadPackEmojis = async (pack) => {
    setSelectedPack(pack);
    const emojis = await getPackEmojis(pack.id);
    setPackEmojis(emojis);
  };

  if (!visible) return null;

  return (
    <View style={s.panel}>
      <View style={s.head}>
        <Text style={s.title}>表情包</Text>
        <View style={s.headActions}>
          <TouchableOpacity onPress={() => { onClose(); router.push('/emoji-manage'); }} style={s.headBtn}>
            <Ionicons name="settings-outline" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={s.headBtn}>
            <Ionicons name="close" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabContent}>
        {emojiPacks.map(pack => (
          <TouchableOpacity
            key={pack.id}
            style={[s.tab, selectedPack?.id === pack.id && s.tabActive]}
            onPress={() => loadPackEmojis(pack)}
          >
            <Text style={[s.tabText, selectedPack?.id === pack.id && s.tabTextActive]}>{pack.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={packEmojis}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.item} onPress={() => onSelectEmoji(item)} activeOpacity={0.6}>
            <Image source={{ uri: item.image_uri }} style={s.img} />
          </TouchableOpacity>
        )}
        keyExtractor={(item, i) => `${item?.id ?? i}-${i}`}
        numColumns={4}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.grid}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="images-outline" size={40} color="#ccc" />
            <Text style={s.emptyText}>暂无表情</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => { onClose(); router.push('/emoji-manage'); }}>
              <Text style={s.emptyBtnText}>去添加</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const s = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, height: 340 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 17, fontWeight: '600', color: '#333' },
  headActions: { flexDirection: 'row', gap: 8 },
  headBtn: { padding: 4 },
  tabBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tabContent: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  tabActive: { borderColor: '#4A90D9', backgroundColor: '#4A90D908' },
  tabText: { fontSize: 14, color: '#999' },
  tabTextActive: { color: '#4A90D9', fontWeight: '500' },
  grid: { padding: 12 },
  row: { justifyContent: 'space-between', marginBottom: 10 },
  item: { width: '22%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f8f8f8' },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#999', marginTop: 8 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#4A90D9', borderRadius: 16 },
  emptyBtnText: { color: '#fff', fontSize: 14 },
});
