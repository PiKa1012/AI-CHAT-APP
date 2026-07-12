import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, useEffect } from 'react';
import { saveSetting, loadSetting } from '../src/services/settings';
import { copyToAppStorage } from '../src/services/media';
import { executeQuery } from '../src/database';
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
  const [stats, setStats] = useState({ messages: 0, diaries: 0, days: 0 });
  const [latestMoment, setLatestMoment] = useState(null);

  const ai = aiCharacters.find(a => a.id === parseInt(id));

  useFocusEffect(useCallback(() => {
    if (ai) { loadCover(); loadStats(); }
  }, [ai?.id]));

  const loadStats = async () => {
    try {
      const [msgRow] = await executeQuery(
        'SELECT COUNT(*) as c FROM messages WHERE sender_type = ? AND sender_id = ?', ['ai', ai.id]);
      const [diaryRow] = await executeQuery('SELECT COUNT(*) as c FROM diaries WHERE ai_id = ?', [ai.id]);
      const [charRow] = await executeQuery('SELECT created_at FROM ai_characters WHERE id = ?', [ai.id]);
      const [momentRow] = await executeQuery(
        'SELECT * FROM moments WHERE author_type = ? AND author_id = ? ORDER BY created_at DESC LIMIT 1', ['ai', ai.id]);
      let days = 0;
      if (charRow?.created_at) {
        days = Math.floor((Date.now() - new Date(charRow.created_at).getTime()) / 86400000);
      }
      setStats({ messages: msgRow?.c || 0, diaries: diaryRow?.c || 0, days });
      setLatestMoment(momentRow || null);
    } catch (e) {}
  };

  const loadCover = async () => {
    try {
      const uri = await loadSetting(`ai_cover_${ai.id}`, null);
      if (uri) setCoverBg(uri);
    } catch (e) {}
  };

  const pickCoverBg = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
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
      <View style={s.wrapper}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Ionicons name="person-outline" size={48} color="#ddd" />
          <Text style={{ fontSize: 16, color: '#999' }}>AI角色不存在</Text>
        </View>
      </View>
    );
  }

  const avatarColor = getAvatarColor(ai.id);

  return (
    <View style={s.wrapper}>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => (coverBg || ai.coverBg) && setPreviewCover(coverBg || ai.coverBg)}>
            {(coverBg || ai.coverBg) ? (
              <Image source={{ uri: coverBg || ai.coverBg }} style={s.coverImage} />
            ) : (
              <View style={[s.coverPlaceholder, { backgroundColor: avatarColor }]} />
            )}
            <View style={s.coverOverlay} />
          </TouchableOpacity>
          <View style={s.headerContent}>
            <View style={s.avatarWrap}>
              {ai.avatar ? (
                <Image source={{ uri: ai.avatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={s.avatarPlaceholderText}>{ai.name?.[0] || 'A'}</Text>
                </View>
              )}
            </View>
            <View style={s.headerText}>
              <Text style={s.headerName}>{ai.name}</Text>
              {ai.signature ? <Text style={s.headerSig}>{ai.signature}</Text> : <Text style={s.headerSig}>这个人很懒，什么都没留下</Text>}
            </View>
          </View>
        </View>

        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{stats.messages}</Text>
            <Text style={s.statLabel}>消息</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{stats.diaries}</Text>
            <Text style={s.statLabel}>日记</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statNum}>{stats.days}</Text>
            <Text style={s.statLabel}>天陪伴</Text>
          </View>
        </View>

        {latestMoment ? (
          <View style={s.card}>
            <TouchableOpacity style={s.link} onPress={() => router.push({ pathname: '/moment-feed', params: { filterAuthor: ai.id.toString() } })}>
              <View style={s.linkLeft}>
                <View style={[s.linkIcon, { backgroundColor: '#67C23A15' }]}>
                  <Ionicons name="images" size={20} color="#67C23A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.linkLabel}>最新动态</Text>
                  <Text style={s.linkSub} numberOfLines={1}>{latestMoment.content || '[图片]'}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ddd" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            <TouchableOpacity style={[s.link, { borderBottomWidth: 0 }]} onPress={() => router.push({ pathname: '/moment-feed', params: { filterAuthor: ai.id.toString() } })}>
              <View style={[s.linkIcon, { backgroundColor: '#67C23A15' }]}>
                <Ionicons name="images" size={20} color="#67C23A" />
              </View>
              <Text style={s.linkLabel}>TA 的朋友圈</Text>
              <Ionicons name="chevron-forward" size={18} color="#ddd" />
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={!!previewCover} transparent onRequestClose={() => setPreviewCover(null)}>
          <TouchableOpacity style={s.previewOverlay} activeOpacity={1} onPress={() => setPreviewCover(null)}>
            {previewCover && <Image source={{ uri: previewCover }} style={s.previewImage} resizeMode="contain" />}
          </TouchableOpacity>
        </Modal>
      </ScrollView>
      <TouchableOpacity style={s.coverEditHint} onPress={pickCoverBg}>
        <Ionicons name="camera-outline" size={16} color="rgba(255,255,255,0.7)" />
        <Text style={s.coverEditHintText}>更换封面</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f0f0f0', position: 'relative' },
  scroll: { flex: 1 },

  header: { position: 'relative', height: COVER_HEIGHT, marginBottom: 12 },
  coverImage: { width: SCREEN_WIDTH, height: COVER_HEIGHT, resizeMode: 'cover' },
  coverPlaceholder: { width: SCREEN_WIDTH, height: COVER_HEIGHT },
  coverOverlay: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: COVER_HEIGHT, backgroundColor: 'rgba(0,0,0,0.15)' },
  coverEditHint: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, zIndex: 100,
  },
  coverEditHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  headerContent: { position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  headerText: { flexShrink: 1 },
  headerName: { fontSize: 22, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerSig: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 10, borderWidth: 3, borderColor: '#fff' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 10, borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },

  statsCard: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  statDiv: { width: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12, borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  descText: { fontSize: 14, color: '#666', lineHeight: 22, paddingHorizontal: 16, paddingVertical: 12 },

  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  linkIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  linkLabel: { fontSize: 15, color: '#333', flex: 1 },
  linkSub: { fontSize: 12, color: '#999', marginTop: 2 },
  linkLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: '#f5f5f5' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
});
