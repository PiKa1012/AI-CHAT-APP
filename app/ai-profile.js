import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { saveSetting, loadSetting } from '../src/services/settings';
import { copyToAppStorage } from '../src/services/media';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COVER_HEIGHT = 260;

export default function AIProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const updateAICharacter = useAppStore(s => s.updateAICharacter);

  const [previewCover, setPreviewCover] = useState(null);
  const [coverBg, setCoverBg] = useState(null);

  const ai = aiCharacters.find(a => a.id === parseInt(id));

  useFocusEffect(
    useCallback(() => {
      if (ai) loadCover();
    }, [ai?.id])
  );

  const loadCover = async () => {
    try {
      const uri = await loadSetting(`ai_cover_${ai.id}`, null);
      if (uri) setCoverBg(uri);
    } catch (e) {}
  };

  const pickCoverBg = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && ai) {
      const tempUri = result.assets[0].uri;
      const permanentUri = await copyToAppStorage(tempUri, 'covers');
      const newCover = permanentUri || tempUri;
      const oldCover = coverBg || ai.coverBg;
      if (oldCover) { try { await FileSystem.deleteAsync(oldCover, { idempotent: true }); } catch (e) {} }
      setCoverBg(newCover);
      await saveSetting(`ai_cover_${ai.id}`, newCover);
      await updateAICharacter(ai.id, { coverBg: newCover });
    }
  };

  const getAvatarColor = (id) => {
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  if (!ai) {
    return (
      <View style={styles.wrapper}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Ionicons name="person-outline" size={48} color="#ddd" />
          <Text style={{ fontSize: 16, color: '#999' }}>AI角色不存在</Text>
        </View>
      </View>
    );
  }

  const avatarColor = getAvatarColor(ai.id);

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => (coverBg || ai.coverBg) && setPreviewCover(coverBg || ai.coverBg)}>
            {(coverBg || ai.coverBg) ? (
              <Image source={{ uri: coverBg || ai.coverBg }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: avatarColor }]} />
            )}
            <View style={styles.coverOverlay} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.avatarWrap}>
              {ai.avatar ? (
                <Image source={{ uri: ai.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarPlaceholderText}>{ai.name?.[0] || 'A'}</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={styles.headerName}>{ai.name}</Text>
              <View style={styles.headerMeta}>
                {ai.gender && <Text style={styles.headerMetaText}>{ai.gender === '男' ? '♂ 男' : ai.gender === '女' ? '♀ 女' : ai.gender}</Text>}
                {ai.age && <Text style={styles.headerMetaText}>{ai.age}岁</Text>}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          {ai.description && (
            <TouchableOpacity style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#4A90D915' }]}>
                <Ionicons name="document-text" size={20} color="#4A90D9" />
              </View>
              <Text style={styles.rowLabel}>简介</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{ai.description}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ddd" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.row, !ai.description && { borderBottomWidth: 0 }]}>
            <View style={[styles.rowIcon, { backgroundColor: '#4A90D915' }]}>
              <Ionicons name="person" size={20} color="#4A90D9" />
            </View>
            <Text style={styles.rowLabel}>性格</Text>
            <Text style={styles.rowValue}>{ai.personality || '友好'}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
          {ai.relationship && (
            <TouchableOpacity style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: '#FF69B415' }]}>
                <Ionicons name="heart" size={20} color="#FF69B4" />
              </View>
              <Text style={styles.rowLabel}>关系</Text>
              <Text style={styles.rowValue}>{ai.relationship}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ddd" />
            </TouchableOpacity>
          )}
          {ai.speaking_style && (
            <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={[styles.rowIcon, { backgroundColor: '#67C23A15' }]}>
                <Ionicons name="chatbubble" size={20} color="#67C23A" />
              </View>
              <Text style={styles.rowLabel}>说话风格</Text>
              <Text style={styles.rowValue}>{ai.speaking_style}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ddd" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push({ pathname: '/moment-feed', params: { filterAuthor: ai.id.toString() } })}>
            <View style={[styles.rowIcon, { backgroundColor: '#67C23A15' }]}>
              <Ionicons name="images" size={20} color="#67C23A" />
            </View>
            <Text style={styles.rowLabel}>朋友圈</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
        </View>

        <Modal visible={!!previewCover} transparent onRequestClose={() => setPreviewCover(null)}>
          <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewCover(null)}>
            {previewCover && <Image source={{ uri: previewCover }} style={styles.previewImage} resizeMode="contain" />}
          </TouchableOpacity>
        </Modal>
      </ScrollView>
      <TouchableOpacity style={styles.coverEditHint} onPress={pickCoverBg}>
        <Ionicons name="camera-outline" size={16} color="rgba(255,255,255,0.7)" />
        <Text style={styles.coverEditHintText}>更换封面</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f0f0f0', position: 'relative' },
  container: { flex: 1 },

  header: { position: 'relative', height: COVER_HEIGHT, marginBottom: 12 },
  coverImage: { width: SCREEN_WIDTH, height: COVER_HEIGHT, resizeMode: 'cover' },
  coverPlaceholder: { width: SCREEN_WIDTH, height: COVER_HEIGHT },
  coverOverlay: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: COVER_HEIGHT, backgroundColor: 'rgba(0,0,0,0.15)' },
  coverEditHint: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 100,
  },
  coverEditHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  headerContent: { position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  headerName: { fontSize: 22, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  headerMetaText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 10, borderWidth: 3, borderColor: '#fff' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 10, borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 12,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 15, color: '#333', flex: 1 },
  rowValue: { flex: 1, fontSize: 15, color: '#999', textAlign: 'right' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
});
