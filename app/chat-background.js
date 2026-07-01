import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting } from '../src/services/settings';
import * as ImagePicker from 'expo-image-picker';
import { copyToAppStorage } from '../src/services/media';
import * as FileSystem from 'expo-file-system';

const DEFAULT_BACKGROUNDS = [
  { id: 'default', color: '#f5f5f5', name: '默认' },
  { id: 'warm', color: '#FFF5E6', name: '暖色' },
  { id: 'cool', color: '#E6F3FF', name: '冷色' },
  { id: 'green', color: '#E6FFE6', name: '清新' },
  { id: 'pink', color: '#FFE6F0', name: '粉色' },
  { id: 'purple', color: '#F0E6FF', name: '紫色' },
  { id: 'dark', color: '#2C2C2C', name: '深色' },
];

export default function ChatBackgroundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params?.id;
  const [selectedBg, setSelectedBg] = useState('default');
  const [customImage, setCustomImage] = useState(null);

  useEffect(() => {
    if (conversationId) {
      loadBackground();
    }
  }, [conversationId]);

  const loadBackground = async () => {
    try {
      const data = await loadSetting(`chat_bg_${conversationId}`, {});
      if (data) {
        setSelectedBg(data.id || 'default');
        setCustomImage(data.image || null);
      }
    } catch (e) {}
  };

  const saveBackground = async (bgId, image = null) => {
    try {
      const bgData = {
        id: bgId,
        image: image,
        color: DEFAULT_BACKGROUNDS.find(b => b.id === bgId)?.color || '#f5f5f5',
      };
      await saveSetting(`chat_bg_${conversationId}`, bgData);
      setSelectedBg(bgId);
      setCustomImage(image);
      Alert.alert('成功', '聊天背景已设置');
    } catch (e) {
      Alert.alert('错误', '设置失败');
    }
  };

  const pickCustomImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const tempUri = result.assets[0].uri;
      if (customImage) { try { await FileSystem.deleteAsync(customImage, { idempotent: true }); } catch (e) {} }
      const permanentUri = await copyToAppStorage(tempUri, 'backgrounds');
      saveBackground('custom', permanentUri || tempUri);
    }
  };

  const renderBackgroundItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.bgItem, selectedBg === item.id && styles.bgItemActive]}
      onPress={() => saveBackground(item.id)}
    >
      <View style={[styles.bgPreview, { backgroundColor: item.color }]}>
        {selectedBg === item.id && (
          <Ionicons name="checkmark-circle" size={24} color="#4A90D9" />
        )}
      </View>
      <Text style={styles.bgName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>纯色背景</Text>
        <FlatList
          data={DEFAULT_BACKGROUNDS}
          renderItem={renderBackgroundItem}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={styles.bgGrid}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>自定义图片</Text>
        <TouchableOpacity style={styles.customBgButton} onPress={pickCustomImage}>
          {customImage ? (
            <Image source={{ uri: customImage }} style={styles.customBgPreview} />
          ) : (
            <View style={styles.customBgPlaceholder}>
              <Ionicons name="image-outline" size={48} color="#999" />
              <Text style={styles.customBgText}>选择图片</Text>
            </View>
          )}
        </TouchableOpacity>
        {customImage && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => saveBackground('default')}
          >
            <Text style={styles.clearButtonText}>恢复默认</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  bgGrid: {
    gap: 12,
  },
  bgItem: {
    flex: 1,
    alignItems: 'center',
    maxWidth: '25%',
  },
  bgItemActive: {
    opacity: 1,
  },
  bgPreview: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
  },
  bgName: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  customBgButton: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  customBgPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  customBgPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  customBgText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  clearButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#F56C6C',
  },
});
