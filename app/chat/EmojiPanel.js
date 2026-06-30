import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPackEmojis } from '../../src/services/emoji';
import { styles } from './styles';

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

  const handleManage = () => {
    onClose();
    router.push('/emoji-manage');
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.emojiPanel}>
        <View style={styles.emojiHeader}>
          <Text style={styles.emojiTitle}>表情包</Text>
          <View style={styles.emojiHeaderActions}>
            <TouchableOpacity style={styles.emojiSettingsBtn} onPress={handleManage}>
              <Ionicons name="settings-outline" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.emojiCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.emojiTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {emojiPacks.map((pack) => (
              <TouchableOpacity
                key={pack.id}
                style={[styles.emojiTab, selectedPack?.id === pack.id && styles.emojiTabActive]}
                onPress={() => loadPackEmojis(pack)}
              >
                <Text style={[styles.emojiTabText, selectedPack?.id === pack.id && styles.emojiTabTextActive]}>
                  {pack.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <FlatList
          data={packEmojis}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.emojiItem} onPress={() => onSelectEmoji(item)}>
              <Image source={{ uri: item.image_uri }} style={styles.emojiImage} />
            </TouchableOpacity>
          )}
          keyExtractor={(item, i) => `${item?.id ?? i}-emoji-${i}`}
          numColumns={5}
          contentContainerStyle={styles.emojiGrid}
          ListEmptyComponent={
            <View style={styles.emptyEmojiContainer}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.emptyEmojiText}>暂无表情</Text>
              <TouchableOpacity style={styles.goManageBtn} onPress={handleManage}>
                <Text style={styles.goManageBtnText}>去添加</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </Modal>
  );
};
