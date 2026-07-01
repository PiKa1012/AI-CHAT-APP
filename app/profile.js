import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, Image, ScrollView, Animated, Modal, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, useRef, useEffect } from 'react';
import { saveSetting, loadSetting } from '../src/services/settings';
import * as ImagePicker from 'expo-image-picker';
import { copyToAppStorage } from '../src/services/media';
import * as FileSystem from 'expo-file-system';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COVER_HEIGHT = 260;

export default function ProfileScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState(null);
  const [userBio, setUserBio] = useState('');
  const [userGender, setUserGender] = useState('');
  const [userAge, setUserAge] = useState('');
  const [coverBg, setCoverBg] = useState(null);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [previewCover, setPreviewCover] = useState(null);
  const [saved, setSaved] = useState(false);
  const savedOpacity = useRef(new Animated.Value(0)).current;
  const nameRef = useRef(null);
  const bioRef = useRef(null);
  const ageRef = useRef(null);

  useEffect(() => {
    if (saved) {
      Animated.sequence([
        Animated.timing(savedOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(savedOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setSaved(false));
    }
  }, [saved]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const data = await loadSetting('user_profile', {});
      if (data) {
        setUserName(data.name || '');
        setUserAvatar(data.avatar || null);
        setUserBio(data.bio || '');
        setUserGender(data.gender || '');
        setUserAge(data.age || '');
        setCoverBg(data.coverBg || null);
      }
    } catch (e) {}
  };

  const saveProfile = async () => {
    if (!userName.trim()) {
      Alert.alert('提示', '请输入昵称');
      return;
    }
    try {
      await saveSetting('user_profile', {
        name: userName.trim(),
        avatar: userAvatar,
        bio: userBio.trim(),
        gender: userGender,
        age: userAge,
        coverBg: coverBg,
      });
      setSaved(true);
    } catch (e) {}
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const tempUri = result.assets[0].uri;
      const permanentUri = await copyToAppStorage(tempUri, 'avatars');
      const newAvatar = permanentUri || tempUri;
      if (userAvatar) { try { await FileSystem.deleteAsync(userAvatar, { idempotent: true }); } catch (e) {} }
      setUserAvatar(newAvatar);
      const current = await loadSetting('user_profile', {});
      await saveSetting('user_profile', { ...current, avatar: newAvatar });
      setSaved(true);
    }
  };

  const pickCoverBg = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled) {
      const tempUri = result.assets[0].uri;
      const permanentUri = await copyToAppStorage(tempUri, 'covers');
      const newCover = permanentUri || tempUri;
      if (coverBg) { try { await FileSystem.deleteAsync(coverBg, { idempotent: true }); } catch (e) {} }
      setCoverBg(newCover);
      const current = await loadSetting('user_profile', {});
      await saveSetting('user_profile', { ...current, coverBg: newCover });
      setSaved(true);
    }
  };

  const genderLabel = userGender === 'male' ? '男' : userGender === 'female' ? '女' : '未设置';
  const genderIcon = userGender === 'male' ? 'male' : userGender === 'female' ? 'female' : 'person-outline';
  const genderColor = userGender === 'male' ? '#4A90D9' : userGender === 'female' ? '#F56C6C' : '#999';

  const saveGender = async (gender) => {
    const current = await loadSetting('user_profile', {});
    await saveSetting('user_profile', { ...current, gender });
    setSaved(true);
  };

  const saveBio = async () => {
    const current = await loadSetting('user_profile', {});
    await saveSetting('user_profile', { ...current, bio: userBio.trim() });
    setSaved(true);
  };

  const saveAge = async () => {
    const current = await loadSetting('user_profile', {});
    await saveSetting('user_profile', { ...current, age: userAge });
    setSaved(true);
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.toast, { opacity: savedOpacity }]}>
        <Ionicons name="checkmark-circle" size={16} color="#fff" />
        <Text style={styles.toastText}>已保存</Text>
      </Animated.View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => coverBg && setPreviewCover(coverBg)}>
            {coverBg ? (
              <Image source={{ uri: coverBg }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.coverOverlay} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.coverEditHint} onPress={pickCoverBg}>
            <Ionicons name="camera-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.coverEditHintText}>更换封面</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nameSection} onPress={() => nameRef.current?.focus()}>
              <TextInput
                ref={nameRef}
                style={styles.nameInput}
                value={userName}
                onChangeText={(v) => { setUserName(v); }}
                onBlur={saveProfile}
                placeholder="昵称"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
              <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => bioRef.current?.focus()}>
            <View style={[styles.rowIcon, { backgroundColor: '#4A90D915' }]}>
              <Ionicons name="chatbox-ellipses" size={20} color="#4A90D9" />
            </View>
            <Text style={styles.rowLabel}>签名</Text>
            <TextInput
              ref={bioRef}
              style={styles.rowInput}
              value={userBio}
              onChangeText={setUserBio}
              onBlur={saveBio}
              placeholder="写一句话介绍自己..."
              placeholderTextColor="#bbb"
            />
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => ageRef.current?.focus()}>
            <View style={[styles.rowIcon, { backgroundColor: '#9B59B615' }]}>
              <Ionicons name="calendar" size={20} color="#9B59B6" />
            </View>
            <Text style={styles.rowLabel}>年龄</Text>
            <TextInput
              ref={ageRef}
              style={styles.rowInput}
              value={userAge}
              onChangeText={setUserAge}
              onBlur={saveAge}
              placeholder="未设置"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
            />
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => setShowGenderPicker(true)}>
            <View style={[styles.rowIcon, { backgroundColor: '#E6A23C15' }]}>
              <Ionicons name={genderIcon} size={20} color={genderColor} />
            </View>
            <Text style={styles.rowLabel}>性别</Text>
            <Text style={[styles.rowValue, !userGender && { color: '#bbb' }]}>{genderLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => router.push({ pathname: '/moment-feed', params: { filterAuthor: 'user' } })}>
            <View style={[styles.rowIcon, { backgroundColor: '#67C23A15' }]}>
              <Ionicons name="images" size={20} color="#67C23A" />
            </View>
            <Text style={styles.rowLabel}>我的朋友圈</Text>
            <Ionicons name="chevron-forward" size={18} color="#ddd" />
          </TouchableOpacity>
        </View>

        <Modal visible={!!previewCover} transparent onRequestClose={() => setPreviewCover(null)}>
          <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewCover(null)}>
            {previewCover && <Image source={{ uri: previewCover }} style={styles.previewImage} resizeMode="contain" />}
          </TouchableOpacity>
        </Modal>

        <Modal visible={showGenderPicker} transparent animationType="none" onRequestClose={() => setShowGenderPicker(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGenderPicker(false)}>
            <View style={styles.genderSheet}>
              <Text style={styles.genderSheetTitle}>性别</Text>
            <TouchableOpacity style={styles.genderOption} onPress={() => { setUserGender('male'); setShowGenderPicker(false); saveGender('male'); }}>
              <Ionicons name="male" size={24} color="#4A90D9" />
              <Text style={styles.genderOptionText}>男</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.genderOption} onPress={() => { setUserGender('female'); setShowGenderPicker(false); saveGender('female'); }}>
              <Ionicons name="female" size={24} color="#F56C6C" />
              <Text style={styles.genderOptionText}>女</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.genderOption, { borderBottomWidth: 0 }]} onPress={() => { setUserGender(''); setShowGenderPicker(false); saveGender(''); }}>
              <Ionicons name="close-circle-outline" size={24} color="#999" />
              <Text style={styles.genderOptionText}>不显示</Text>
            </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f0f0f0' },
  container: { flex: 1 },
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
  },
  toastText: { color: '#fff', fontSize: 14 },

  header: { position: 'relative', height: COVER_HEIGHT, marginBottom: 12 },
  coverImage: { width: SCREEN_WIDTH, height: COVER_HEIGHT, resizeMode: 'cover' },
  coverPlaceholder: { width: SCREEN_WIDTH, height: COVER_HEIGHT, backgroundColor: '#3b82c4' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH, height: COVER_HEIGHT, backgroundColor: 'rgba(0,0,0,0.15)' },
  coverEditHint: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  coverEditHintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  headerContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 10, borderWidth: 3, borderColor: '#fff' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 10, borderWidth: 3, borderColor: '#fff', backgroundColor: '#67C23A', justifyContent: 'center', alignItems: 'center' },
  avatarBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  nameSection: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 6 },
  nameInput: { fontSize: 22, fontWeight: '700', color: '#fff', padding: 0, minWidth: 60, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

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
  rowInput: { flex: 1, fontSize: 15, color: '#333', padding: 0, textAlign: 'right' },
  rowValue: { flex: 1, fontSize: 15, color: '#999', textAlign: 'right' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  genderSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 36 },
  genderSheetTitle: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  genderOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  genderOptionText: { fontSize: 17, color: '#333' },
});
