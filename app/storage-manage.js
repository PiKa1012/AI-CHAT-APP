import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, Image, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import { useAppStore } from '../src/stores';
import { executeQuery, executeUpdate } from '../src/database';
import { SafeAvatar } from '../src/components/SafeImage';

const OTHER_FOLDERS = [
  { id: 'avatars', name: '头像', icon: 'person', color: '#4A90D9' },
  { id: 'moments', name: '朋友圈图片', icon: 'images', color: '#3b82c4' },
  { id: 'emojis', name: '表情包', icon: 'happy', color: '#E6A23C' },
  { id: 'covers', name: '朋友圈封面', icon: 'image', color: '#3b82c4' },
  { id: 'backgrounds', name: '聊天背景', icon: 'image-outline', color: '#67C23A' },
];

export default function StorageManageScreen() {
  const [charStorage, setCharStorage] = useState([]);
  const [otherStorage, setOtherStorage] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(true);

  const [fileModal, setFileModal] = useState(null);
  const [fileModalTitle, setFileModalTitle] = useState('');
  const [fileList, setFileList] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [fileModalTab, setFileModalTab] = useState('chat');

  const clearAllMessages = useAppStore(s => s.clearAllMessages);
  const clearAllMoments = useAppStore(s => s.clearAllMoments);
  const clearAllDiaries = useAppStore(s => s.clearAllDiaries);
  const clearAllData = useAppStore(s => s.clearAllData);
  const conversations = useAppStore(s => s.conversations);
  const clearConversationMessages = useAppStore(s => s.clearConversationMessages);
  const loadConversations = useAppStore(s => s.loadConversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);

  useEffect(() => { loadCharStorage(); }, []);

  useFocusEffect(useCallback(() => {
    loadCharStorage();
    loadConversations();
  }, []));

  const loadCharStorage = async () => {
    setLoading(true);
    try {
      const chars = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
      const convMembers = await executeQuery('SELECT * FROM conversation_members WHERE member_type = ?', ['ai']);

      const charMap = {};
      for (const char of chars) {
        charMap[char.id] = { id: char.id, name: char.name, avatar: char.avatar, chatImages: [], genImages: [], chatImageCount: 0, chatImageSize: 0, genImageCount: 0, genImageSize: 0, totalSize: 0 };
      }

      const genDir = `${FileSystem.documentDirectory}generated/`;
      const genDirInfo = await FileSystem.getInfoAsync(genDir);
      const genFiles = genDirInfo.exists ? await FileSystem.readDirectoryAsync(genDir) : [];

      const moments = await executeQuery("SELECT images, author_id FROM moments WHERE author_type = ? AND images IS NOT NULL AND images != '[]'", ['ai']);
      const diaries = await executeQuery("SELECT images, ai_id FROM diaries WHERE images IS NOT NULL AND images != '[]'");
      const chatGenImages = await executeQuery("SELECT content, conversation_id FROM messages WHERE message_type = ? AND content LIKE ? AND content IS NOT NULL", ['image', '%generated%']);

      const genPathToCharId = {};
      for (const m of moments) { try { JSON.parse(m.images).forEach(p => genPathToCharId[p] = m.author_id); } catch (e) {} }
      for (const d of diaries) { try { JSON.parse(d.images).forEach(p => genPathToCharId[p] = d.ai_id); } catch (e) {} }
      for (const img of chatGenImages) { const cm = convMembers.find(m => m.conversation_id === img.conversation_id); if (cm) genPathToCharId[img.content] = cm.member_id; }

      const genFileToChar = {};
      for (const f of genFiles) { const charId = genPathToCharId[`${genDir}${f}`]; if (charId) genFileToChar[f] = charId; }

      for (const char of chars) {
        const convIds = convMembers.filter(m => m.member_id === char.id).map(m => m.conversation_id);
        if (convIds.length === 0) continue;

        const ph = convIds.map(() => '?').join(',');
        const chatImages = await executeQuery(`SELECT content FROM messages WHERE conversation_id IN (${ph}) AND message_type = ? AND content NOT LIKE ?`, [...convIds, 'image', '%generated%']);

        const chatItems = [];
        let chatSize = 0;
        for (const img of chatImages) {
          try {
            const info = await FileSystem.getInfoAsync(img.content);
            if (info.exists) { chatSize += info.size || 0; chatItems.push({ path: img.content, size: info.size || 0, date: info.modificationTime || 0 }); }
          } catch (e) {}
        }
        charMap[char.id].chatImages = chatItems;
        charMap[char.id].chatImageCount = chatItems.length;
        charMap[char.id].chatImageSize = chatSize;

        const charGenFilesList = genFiles.filter(f => genFileToChar[f] === char.id);
        const genItems = [];
        let genSize = 0;
        for (const f of charGenFilesList) {
          try {
            const info = await FileSystem.getInfoAsync(`${genDir}${f}`);
            if (info.exists) { genSize += info.size || 0; genItems.push({ path: `${genDir}${f}`, size: info.size || 0, date: info.modificationTime || 0 }); }
          } catch (e) {}
        }
        charMap[char.id].genImages = genItems;
        charMap[char.id].genImageCount = genItems.length;
        charMap[char.id].genImageSize = genSize;
        charMap[char.id].totalSize = chatSize + genSize;
      }

      const list = Object.values(charMap).filter(c => c.totalSize > 0).sort((a, b) => b.totalSize - a.totalSize);
      setCharStorage(list);
      let allSize = list.reduce((s, c) => s + c.totalSize, 0);

      const otherList = [];
      for (const folder of OTHER_FOLDERS) {
        let count = 0, size = 0;
        try {
          const dirPath = `${FileSystem.documentDirectory}${folder.id}/`;
          const dirInfo = await FileSystem.getInfoAsync(dirPath);
          if (dirInfo.exists) {
            const files = await FileSystem.readDirectoryAsync(dirPath);
            for (const f of files) { const info = await FileSystem.getInfoAsync(`${dirPath}${f}`); if (info.exists) size += info.size || 0; }
            count = files.length;
          }
        } catch (e) {}
        otherList.push({ ...folder, count, size });
        allSize += size;
      }
      setOtherStorage(otherList);
      setTotalSize(allSize);
    } catch (e) { console.error('加载存储信息失败:', e); }
    setLoading(false);
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const openOtherFolder = async (folder) => {
    try {
      const dirPath = `${FileSystem.documentDirectory}${folder.id}/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) { setFileList([]); setFileModalTitle(folder.name); setFileModal({ isOther: true, folder }); return; }
      const files = await FileSystem.readDirectoryAsync(dirPath);
      const items = [];
      for (const f of files) {
        const info = await FileSystem.getInfoAsync(`${dirPath}${f}`);
        if (info.exists) items.push({ path: `${dirPath}${f}`, size: info.size || 0, date: info.modificationTime || 0 });
      }
      items.sort((a, b) => b.date - a.date);
      setFileList(items);
      setSelectedFiles(new Set());
      setSelectMode(false);
      setFileModalTitle(folder.name);
      setFileModal({ isOther: true, folder });
    } catch (e) {
      setFileList([]);
      setFileModalTitle(folder.name);
      setFileModal({ isOther: true, folder });
    }
  };

  const deleteOtherFile = async (path) => {
    try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch (e) {}
    await clearDbRef(path);
    setFileList(prev => prev.filter(f => f.path !== path));
    loadCharStorage();
  };

  const deleteSelectedOther = async () => {
    if (selectedFiles.size === 0) return;
    Alert.alert('删除文件', `确定删除选中的 ${selectedFiles.size} 个文件？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          for (const path of selectedFiles) {
            try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch (e) {}
            await clearDbRef(path);
          }
          setFileList(prev => prev.filter(f => !selectedFiles.has(f.path)));
          setSelectedFiles(new Set());
          setSelectMode(false);
          loadCharStorage();
        },
      },
    ]);
  };

  const deleteAllOther = async (folder) => {
    Alert.alert(`清空${folder.name}`, `确定删除所有 ${fileList.length} 个文件？${folder.id === 'moments' ? '\n\n同时会清除朋友圈中的相关图片记录。' : ''}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          const dirPath = `${FileSystem.documentDirectory}${folder.id}/`;
          if (folder.id === 'moments') {
            await executeUpdate("UPDATE moments SET images = '[]' WHERE author_type = ?", ['user']);
          }
          try { await FileSystem.deleteAsync(dirPath, { idempotent: true }); } catch (e) {}
          setFileList([]);
          setSelectedFiles(new Set());
          loadCharStorage();
        },
      },
    ]);
  };

  const clearDbRef = async (filePath) => {
    try {
      const moments = await executeQuery("SELECT id, images FROM moments WHERE images LIKE ?", [`%${filePath}%`]);
      for (const m of moments) {
        try {
          const arr = JSON.parse(m.images).filter(p => p !== filePath);
          await executeUpdate('UPDATE moments SET images = ? WHERE id = ?', [JSON.stringify(arr), m.id]);
        } catch (e) {}
      }
      await executeUpdate("UPDATE messages SET content = NULL WHERE content = ? AND message_type = ?", [filePath, 'image']);
    } catch (e) {}
  };

  const [showChatList, setShowChatList] = useState(false);

  const handleClearChat = (conv) => {
    Alert.alert('清除聊天记录', `确定删除与"${conv.name}"的所有消息？`, [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: async () => { await clearConversationMessages(conv.id); loadCharStorage(); } },
    ]);
  };

  const handleClearAllMessages = () => {
    Alert.alert('清除所有聊天记录', '确定删除所有消息？', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: async () => { await clearAllMessages(); loadCharStorage(); } },
    ]);
  };

  const handleClearAllMoments = () => {
    Alert.alert('清除所有朋友圈', '确定删除所有朋友圈和评论？', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: async () => { await clearAllMoments(); loadCharStorage(); } },
    ]);
  };

  const handleClearAllDiaries = () => {
    Alert.alert('清除所有日记', '确定删除所有日记？', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: async () => { await clearAllDiaries(); loadCharStorage(); } },
    ]);
  };

  const handleClearAllData = () => {
    Alert.alert('清除所有数据', '将删除所有聊天、朋友圈、日记、记忆，不可恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '清除全部', style: 'destructive', onPress: async () => { await clearAllData(); loadCharStorage(); } },
    ]);
  };

  const openCharModal = (char) => {
    setFileModal({ char });
    setFileModalTab('chat');
    setSelectedFiles(new Set());
    setSelectMode(false);
  };

  const toggleSelect = (path) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    Alert.alert('删除图片', `确定删除选中的 ${selectedFiles.size} 张图片？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          for (const path of selectedFiles) {
            try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch (e) {}
            await clearDbRef(path);
          }
          if (fileModal.isOther) {
            setFileList(prev => prev.filter(f => !selectedFiles.has(f.path)));
          } else if (fileModal.char) {
            const key = fileModalTab === 'chat' ? 'chatImages' : 'genImages';
            const countKey = fileModalTab === 'chat' ? 'chatImageCount' : 'genImageCount';
            const sizeKey = fileModalTab === 'chat' ? 'chatImageSize' : 'genImageSize';
            const newChar = { ...fileModal.char, [key]: fileModal.char[key].filter(i => !selectedFiles.has(i.path)) };
            newChar[countKey] = newChar[key].length;
            newChar[sizeKey] = newChar[key].reduce((s, i) => s + i.size, 0);
            newChar.totalSize = newChar.chatImageSize + newChar.genImageSize;
            setFileModal({ char: newChar });
          }
          setSelectedFiles(new Set());
          setSelectMode(false);
          loadCharStorage();
        },
      },
    ]);
  };

  const deleteAll = () => {
    if (fileModal.isOther) {
      deleteAllOther(fileModal.folder);
      return;
    }
    if (fileModal.char) {
      const items = fileModalTab === 'chat' ? fileModal.char.chatImages : fileModal.char.genImages;
      if (items.length === 0) return;
      const label = fileModalTab === 'chat' ? '聊天图片' : '生成图片';
      Alert.alert(`删除所有${label}`, `将删除 ${fileModal.char.name} 的 ${items.length} 张${label}，此操作不可恢复。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '删除', style: 'destructive',
          onPress: async () => {
            for (const item of items) {
              try { await FileSystem.deleteAsync(item.path, { idempotent: true }); } catch (e) {}
              await clearDbRef(item.path);
            }
            const key = fileModalTab === 'chat' ? 'chatImages' : 'genImages';
            const countKey = fileModalTab === 'chat' ? 'chatImageCount' : 'genImageCount';
            const sizeKey = fileModalTab === 'chat' ? 'chatImageSize' : 'genImageSize';
            const newChar = { ...fileModal.char, [key]: [], [countKey]: 0, [sizeKey]: 0 };
            newChar.totalSize = 0;
            setFileModal({ char: newChar });
            loadCharStorage();
          },
        },
      ]);
      return;
    }
  };

  const renderFileItem = ({ item }) => (
    <TouchableOpacity
      style={styles.fileItem}
      onPress={() => selectMode ? toggleSelect(item.path) : toggleSelect(item.path)}
      onLongPress={() => { setSelectMode(true); toggleSelect(item.path); }}
    >
      <Image source={{ uri: item.path }} style={styles.fileThumb} />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.path.split('/').pop()}</Text>
        <Text style={styles.fileMeta}>{formatSize(item.size)} · {formatDate(item.date)}</Text>
      </View>
      {selectMode && (
        <Ionicons name={selectedFiles.has(item.path) ? 'checkbox' : 'square-outline'} size={22} color={selectedFiles.has(item.path) ? '#4A90D9' : '#ccc'} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingWrap}><Text style={{ color: '#999', fontSize: 15 }}>计算存储中...</Text></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.totalSection}>
          <Ionicons name="folder" size={28} color="#4A90D9" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.totalLabel}>图片占用</Text>
            <Text style={styles.totalSize}>{formatSize(totalSize)}</Text>
          </View>
        </View>

        {charStorage.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="images-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>暂无图片数据</Text>
          </View>
        ) : (
          charStorage.map(char => (
            <TouchableOpacity key={char.id} style={styles.charRow} onPress={() => openCharModal(char)}>
              <SafeAvatar uri={char.avatar} size={40} name={char.name} color="#4A90D9" />
              <View style={styles.charRowInfo}>
                <Text style={styles.charRowName}>{char.name}</Text>
                <Text style={styles.charRowDetail}>
                  聊天 {char.chatImageCount} 张 · 生成 {char.genImageCount} 张
                </Text>
              </View>
              <Text style={styles.charRowSize}>{formatSize(char.totalSize)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ))
        )}

        {otherStorage.length > 0 && (
          <View style={styles.otherSection}>
            <Text style={styles.otherTitle}>其他</Text>
            {otherStorage.map(item => (
              <TouchableOpacity key={item.id} style={styles.otherRow} onPress={() => openOtherFolder(item)}>
                <View style={[styles.otherIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.otherName}>{item.name}</Text>
                <Text style={styles.otherSize}>{item.count > 0 ? `${item.count} 个 · ${formatSize(item.size)}` : '暂无'}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.otherSection}>
          <Text style={styles.otherTitle}>数据清理</Text>

          <TouchableOpacity style={styles.clearItem} onPress={() => setShowChatList(!showChatList)}>
            <View style={styles.clearItemLeft}>
              <Ionicons name="chatbubbles-outline" size={20} color="#F56C6C" />
              <View>
                <Text style={styles.clearItemTitle}>清除聊天记录</Text>
                <Text style={styles.clearItemDesc}>删除对话中的消息</Text>
              </View>
            </View>
            <Ionicons name={showChatList ? "chevron-up" : "chevron-down"} size={20} color="#ccc" />
          </TouchableOpacity>

          {showChatList && (
            <View style={styles.chatListContainer}>
              <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAllMessages}>
                <Text style={styles.clearAllBtnText}>清空所有聊天记录</Text>
              </TouchableOpacity>
              {conversations.length > 0 && conversations.map(conv => {
                const convAi = conv.type === 'private' ? aiCharacters.find(a => a.name === conv.name) : null;
                return (
                <TouchableOpacity key={conv.id} style={styles.chatItem} onPress={() => handleClearChat(conv)}>
                  <SafeAvatar uri={conv.avatar || convAi?.avatar} size={32} name={conv.name} color={conv.type === 'group' ? '#67C23A' : '#4A90D9'} />
                  <Text style={styles.chatName}>{conv.name}</Text>
                  <Ionicons name="trash-outline" size={16} color="#F56C6C" />
                </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={styles.clearItem} onPress={handleClearAllMoments}>
            <View style={styles.clearItemLeft}>
              <Ionicons name="images-outline" size={20} color="#F56C6C" />
              <View>
                <Text style={styles.clearItemTitle}>清除朋友圈</Text>
                <Text style={styles.clearItemDesc}>删除所有朋友圈和评论</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearItem} onPress={handleClearAllDiaries}>
            <View style={styles.clearItemLeft}>
              <Ionicons name="book-outline" size={20} color="#F56C6C" />
              <View>
                <Text style={styles.clearItemTitle}>清除日记</Text>
                <Text style={styles.clearItemDesc}>删除所有日记和评论</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.clearItem, { borderBottomWidth: 0 }]} onPress={handleClearAllData}>
            <View style={styles.clearItemLeft}>
              <Ionicons name="nuclear-outline" size={20} color="#F56C6C" />
              <View>
                <Text style={[styles.clearItemTitle, { color: '#F56C6C' }]}>清除所有数据</Text>
                <Text style={styles.clearItemDesc}>删除所有聊天、朋友圈、日记</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F56C6C" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={!!fileModal} animationType="slide" onRequestClose={() => { setFileModal(null); setSelectMode(false); }}>
        {fileModal && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setFileModal(null); setSelectMode(false); }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{fileModal.isOther ? fileModalTitle : fileModal.char.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {selectMode && selectedFiles.size > 0 && (
                  <TouchableOpacity onPress={deleteSelected}>
                    <Ionicons name="trash" size={22} color="#F56C6C" />
                  </TouchableOpacity>
                )}
                {!selectMode && (
                  <TouchableOpacity onPress={() => setSelectMode(true)}>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#4A90D9" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {selectMode && (
              <View style={styles.selectionBar}>
                <Text style={styles.selectionText}>已选 {selectedFiles.size} 项</Text>
                <TouchableOpacity onPress={() => { setSelectedFiles(new Set()); setSelectMode(false); }}>
                  <Text style={{ color: '#4A90D9', fontSize: 14 }}>取消</Text>
                </TouchableOpacity>
              </View>
            )}

            {!fileModal.isOther && (
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tab, fileModalTab === 'chat' && styles.tabActive]}
                  onPress={() => { setFileModalTab('chat'); setSelectedFiles(new Set()); setSelectMode(false); }}
                >
                  <Ionicons name="chatbubbles-outline" size={16} color={fileModalTab === 'chat' ? '#9B59B6' : '#999'} />
                  <Text style={[styles.tabText, fileModalTab === 'chat' && styles.tabTextActive]}>
                    聊天图片 ({fileModal.char.chatImageCount})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, fileModalTab === 'gen' && styles.tabActive]}
                  onPress={() => { setFileModalTab('gen'); setSelectedFiles(new Set()); setSelectMode(false); }}
                >
                  <Ionicons name="sparkles-outline" size={16} color={fileModalTab === 'gen' ? '#FF6B6B' : '#999'} />
                  <Text style={[styles.tabText, fileModalTab === 'gen' && styles.tabTextActive]}>
                    AI生成图片 ({fileModal.char.genImageCount})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <FlatList
              data={fileModal.isOther ? fileList : (fileModalTab === 'chat' ? fileModal.char.chatImages : fileModal.char.genImages)}
              renderItem={renderFileItem}
              keyExtractor={item => item.path}
              contentContainerStyle={styles.fileList}
              ListEmptyComponent={<View style={styles.emptyWrap}><Text style={styles.emptyText}>暂无文件</Text></View>}
            />

            <TouchableOpacity style={styles.deleteAllBtn} onPress={deleteAll}>
              <Ionicons name="trash-outline" size={16} color="#F56C6C" />
              <Text style={styles.deleteAllText}>
                删除全部 ({fileModal.isOther ? fileList.length : (fileModalTab === 'chat' ? fileModal.char.chatImages.length : fileModal.char.genImages.length)} 张)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  totalSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, margin: 12, borderRadius: 12 },
  totalLabel: { fontSize: 13, color: '#999' },
  totalSize: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 2 },
  charRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 6, padding: 14, borderRadius: 12 },
  charRowInfo: { flex: 1, marginLeft: 12 },
  charRowName: { fontSize: 15, fontWeight: '500', color: '#333' },
  charRowDetail: { fontSize: 13, color: '#999', marginTop: 2 },
  charRowSize: { fontSize: 14, color: '#4A90D9', fontWeight: '500' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#4A90D9' },
  tabText: { fontSize: 14, color: '#999' },
  tabTextActive: { fontSize: 14, color: '#333', fontWeight: '500' },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#ccc', fontSize: 15, marginTop: 12 },
  otherSection: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12, borderRadius: 12, padding: 14 },
  otherTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  otherRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  otherIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  otherName: { fontSize: 14, color: '#333', flex: 1 },
  otherSize: { fontSize: 13, color: '#999' },
  modalContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1, textAlign: 'center' },
  selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EBF5FF' },
  selectionText: { fontSize: 14, color: '#4A90D9', fontWeight: '500' },
  fileList: { padding: 12 },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 10, marginBottom: 6, gap: 10 },
  fileThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#f0f0f0' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, color: '#333' },
  fileMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  deleteAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, margin: 12, marginBottom: 30, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#FFCCC7' },
  deleteAllText: { color: '#F56C6C', fontSize: 14, fontWeight: '500' },
  clearItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  clearItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  clearItemTitle: { fontSize: 15, color: '#333' },
  clearItemDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  chatListContainer: { backgroundColor: '#f9f9f9', borderRadius: 8, marginTop: 8, padding: 8 },
  clearAllBtn: { backgroundColor: '#FFF5F5', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#FFCCC7' },
  clearAllBtnText: { color: '#F56C6C', fontSize: 14, fontWeight: '500' },
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderRadius: 8, marginBottom: 4, gap: 10 },
  chatName: { fontSize: 14, color: '#333', flex: 1 },
});
