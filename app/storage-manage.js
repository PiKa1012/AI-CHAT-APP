import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { useAppStore } from '../src/stores';
import { SafeAvatar } from '../src/components/SafeImage';

const STORAGE_FOLDERS = [
  { id: 'avatars', name: '头像', icon: 'person', color: '#4A90D9' },
  { id: 'emojis', name: '表情包', icon: 'happy', color: '#E6A23C' },
  { id: 'backgrounds', name: '聊天背景', icon: 'image', color: '#67C23A' },
  { id: 'chat_images', name: '聊天图片', icon: 'images', color: '#9B59B6' },
  { id: 'generated', name: 'AI生成缓存', icon: 'sparkles', color: '#FF6B6B' },
];

export default function StorageManageScreen() {
  const [storageInfo, setStorageInfo] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [dbSize, setDbSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);
  
  const clearAllMessages = useAppStore(s => s.clearAllMessages);
  const clearAllMoments = useAppStore(s => s.clearAllMoments);
  const clearAllDiaries = useAppStore(s => s.clearAllDiaries);
  const clearAllData = useAppStore(s => s.clearAllData);
  const getStorageInfo = useAppStore(s => s.getStorageInfo);
  const conversations = useAppStore(s => s.conversations);
  const clearConversationMessages = useAppStore(s => s.clearConversationMessages);
  const loadConversations = useAppStore(s => s.loadConversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [showChatList, setShowChatList] = useState(false);

  useEffect(() => {
    loadStorageInfo();
    loadDbInfo();
    loadConversations();
  }, []);

  const loadDbInfo = async () => {
    try {
      const info = await getStorageInfo();
      setDbInfo(info);
    } catch (e) {}
  };

  const loadStorageInfo = async () => {
    setLoading(true);
    let total = 0;
    const info = [];

    for (const folder of STORAGE_FOLDERS) {
      try {
        const dirPath = `${FileSystem.documentDirectory}${folder.id}/`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        
        if (dirInfo.exists) {
          const fileList = await FileSystem.readDirectoryAsync(dirPath);
          let folderSize = 0;
          
          for (const file of fileList) {
            const fileInfo = await FileSystem.getInfoAsync(`${dirPath}${file}`);
            if (fileInfo.exists) {
              folderSize += fileInfo.size || 0;
            }
          }
          
          total += folderSize;
          info.push({
            ...folder,
            count: fileList.length,
            size: folderSize,
          });
        } else {
          info.push({ ...folder, count: 0, size: 0 });
        }
      } catch (e) {
        info.push({ ...folder, count: 0, size: 0 });
      }
    }

    // 计算 SQLite 数据库文件大小
    let dbTotalSize = 0;
    const dbFiles = ['ai_companion.db', 'ai_companion.db-wal', 'ai_companion.db-shm'];
    for (const dbFile of dbFiles) {
      try {
        const dbPath = `${FileSystem.documentDirectory}SQLite/${dbFile}`;
        const dbInfo = await FileSystem.getInfoAsync(dbPath);
        if (dbInfo.exists) {
          dbTotalSize += dbInfo.size || 0;
        }
      } catch (e) {}
    }
    setDbSize(dbTotalSize);
    total += dbTotalSize;

    setStorageInfo(info);
    setTotalSize(total);
    setLoading(false);
  };

  const loadFiles = async (folderId) => {
    setSelectedFolder(folderId);
    try {
      const dirPath = `${FileSystem.documentDirectory}${folderId}/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      
      if (!dirInfo.exists) {
        setFiles([]);
        return;
      }

      const fileList = await FileSystem.readDirectoryAsync(dirPath);
      const fileDetails = [];

      for (const file of fileList) {
        const filePath = `${dirPath}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists) {
          const date = new Date(fileInfo.modificationTime * 1000);
          fileDetails.push({
            name: file,
            path: filePath,
            size: fileInfo.size || 0,
            date: date,
            dateStr: `${date.getMonth() + 1}月${date.getDate()}日`,
            isImage: file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg'),
          });
        }
      }

      fileDetails.sort((a, b) => b.date - a.date);
      setFiles(fileDetails);
    } catch (e) {
      setFiles([]);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const deleteFile = (filePath, folderId) => {
    Alert.alert(
      '删除文件',
      '确定要删除这个文件吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              loadFiles(folderId);
              loadStorageInfo();
            } catch (e) {
              Alert.alert('错误', '删除失败');
            }
          }
        },
      ]
    );
  };

  const clearFolder = (folderId, folderName) => {
    Alert.alert(
      `清空${folderName}`,
      `确定要删除所有${folderName}吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            try {
              const dirPath = `${FileSystem.documentDirectory}${folderId}/`;
              await FileSystem.deleteAsync(dirPath, { idempotent: true });
              setSelectedFolder(null);
              setFiles([]);
              loadStorageInfo();
              Alert.alert('成功', '已清空');
            } catch (e) {
              Alert.alert('错误', '清空失败');
            }
          }
        },
      ]
    );
  };

  const handleClearAllMessages = () => {
    Alert.alert(
      '清除所有聊天记录',
      '确定要删除所有聊天消息吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllMessages();
              await loadDbInfo();
              Alert.alert('成功', '聊天记录已清除');
            } catch (e) {
              Alert.alert('错误', '清除失败');
            }
          }
        },
      ]
    );
  };

  const handleClearAllMoments = () => {
    Alert.alert(
      '清除所有朋友圈',
      '确定要删除所有朋友圈和评论吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllMoments();
              await loadDbInfo();
              Alert.alert('成功', '朋友圈已清除');
            } catch (e) {
              Alert.alert('错误', '清除失败');
            }
          }
        },
      ]
    );
  };

  const handleClearAllDiaries = () => {
    Alert.alert(
      '清除所有日记',
      '确定要删除所有日记和评论吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllDiaries();
              await loadDbInfo();
              Alert.alert('成功', '日记已清除');
            } catch (e) {
              Alert.alert('错误', '清除失败');
            }
          }
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      '清除所有数据',
      '确定要删除所有聊天记录、朋友圈、日记和记忆吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除全部',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              await loadDbInfo();
              Alert.alert('成功', '所有数据已清除');
            } catch (e) {
              Alert.alert('错误', '清除失败');
            }
          }
        },
      ]
    );
  };

  const handleClearConversation = (conv) => {
    Alert.alert(
      '清除聊天记录',
      `确定要删除与"${conv.name}"的所有聊天消息吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearConversationMessages(conv.id);
              await loadDbInfo();
              Alert.alert('成功', `"${conv.name}"的聊天记录已清除`);
            } catch (e) {
              Alert.alert('错误', '清除失败');
            }
          }
        },
      ]
    );
  };

  const groupFilesByDate = () => {
    const groups = {};
    files.forEach(file => {
      const dateKey = file.dateStr;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(file);
    });
    return Object.entries(groups).map(([date, items]) => ({ date, items }));
  };

  const renderStorageItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.storageItem, selectedFolder === item.id && styles.storageItemActive]}
      onPress={() => loadFiles(item.id)}
    >
      <View style={[styles.storageIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={24} color={item.color} />
      </View>
      <View style={styles.storageInfo}>
        <Text style={styles.storageName}>{item.name}</Text>
        <Text style={styles.storageCount}>{item.count} 个文件</Text>
      </View>
      <Text style={styles.storageSize}>{formatSize(item.size)}</Text>
    </TouchableOpacity>
  );

  const renderFileItem = (file) => (
    <View key={file.name} style={styles.fileItem}>
      <TouchableOpacity
        onPress={() => file.isImage && setPreviewImage(file.path)}
        disabled={!file.isImage}
        style={styles.filePreviewBtn}
      >
        {file.isImage ? (
          <Image source={{ uri: file.path }} style={styles.filePreview} />
        ) : (
          <View style={[styles.filePreview, styles.filePreviewPlaceholder]}>
            <Ionicons name="document" size={20} color="#ccc" />
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
        <Text style={styles.fileSize}>{formatSize(file.size)}</Text>
      </View>
      <TouchableOpacity
        onPress={() => deleteFile(file.path, selectedFolder)}
        style={styles.deleteBtn}
      >
        <Ionicons name="trash-outline" size={18} color="#F56C6C" />
      </TouchableOpacity>
    </View>
  );

  const renderTimeline = () => {
    const groups = groupFilesByDate();
    
    return groups.map(({ date, items }) => (
      <View key={date} style={styles.timelineGroup}>
        <View style={styles.timelineHeader}>
          <View style={styles.timelineDot} />
          <Text style={styles.timelineDate}>{date}</Text>
          <Text style={styles.timelineCount}>{items.length} 个</Text>
        </View>
        {items.map(file => renderFileItem(file))}
      </View>
    ));
  };

  const selectedFolderInfo = STORAGE_FOLDERS.find(f => f.id === selectedFolder);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.totalSection}>
          <Ionicons name="folder" size={32} color="#4A90D9" />
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>总占用空间</Text>
            <Text style={styles.totalSize}>{formatSize(totalSize)}</Text>
          </View>
        </View>
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>图片及缓存</Text>
            <Text style={styles.breakdownValue}>{formatSize(totalSize - dbSize)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownLabel}>数据库（消息/日记等）</Text>
            <Text style={styles.breakdownValue}>{formatSize(dbSize)}</Text>
          </View>
        </View>

        {dbInfo && (
          <View style={styles.dbSection}>
            <Text style={styles.sectionTitle}>数据统计</Text>
            <View style={styles.dbGrid}>
              <View style={styles.dbItem}>
                <Text style={styles.dbCount}>{dbInfo.messages}</Text>
                <Text style={styles.dbLabel}>消息</Text>
              </View>
              <View style={styles.dbItem}>
                <Text style={styles.dbCount}>{dbInfo.conversations}</Text>
                <Text style={styles.dbLabel}>对话</Text>
              </View>
              <View style={styles.dbItem}>
                <Text style={styles.dbCount}>{dbInfo.moments}</Text>
                <Text style={styles.dbLabel}>朋友圈</Text>
              </View>
              <View style={styles.dbItem}>
                <Text style={styles.dbCount}>{dbInfo.diaries}</Text>
                <Text style={styles.dbLabel}>日记</Text>
              </View>
              <View style={styles.dbItem}>
                <Text style={styles.dbCount}>{dbInfo.aiCharacters}</Text>
                <Text style={styles.dbLabel}>AI角色</Text>
              </View>
            </View>

            <Text style={styles.clearSectionTitle}>数据清理</Text>
            
            <TouchableOpacity 
              style={styles.clearItem} 
              onPress={() => setShowChatList(!showChatList)}
            >
              <View style={styles.clearItemLeft}>
                <Ionicons name="chatbubbles-outline" size={20} color="#F56C6C" />
                <View style={styles.clearItemText}>
                  <Text style={styles.clearItemTitle}>清除聊天记录</Text>
                  <Text style={styles.clearItemDesc}>删除对话中的消息</Text>
                </View>
              </View>
              <Ionicons 
                name={showChatList ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#ccc" 
              />
            </TouchableOpacity>

            {showChatList && (
              <View style={styles.chatListContainer}>
                <TouchableOpacity 
                  style={styles.clearAllBtn}
                  onPress={handleClearAllMessages}
                >
                  <Text style={styles.clearAllBtnText}>清空所有聊天记录</Text>
                </TouchableOpacity>
                {conversations.map(conv => {
                  const ai = conv.type === 'private' 
                    ? aiCharacters.find(a => a.name === conv.name) 
                    : null;
                  
                  return (
                    <TouchableOpacity
                      key={conv.id}
                      style={styles.chatItem}
                      onPress={() => handleClearConversation(conv)}
                    >
                      <View style={styles.chatItemLeft}>
                        <SafeAvatar
                          uri={conv.avatar || ai?.avatar}
                          size={36}
                          name={conv.name}
                          color={conv.type === 'group' ? '#67C23A' : '#4A90D9'}
                        />
                        <Text style={styles.chatName}>{conv.name}</Text>
                      </View>
                      <Ionicons name="trash-outline" size={16} color="#F56C6C" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.clearItem} onPress={handleClearAllMoments}>
              <View style={styles.clearItemLeft}>
                <Ionicons name="images-outline" size={20} color="#F56C6C" />
                <View style={styles.clearItemText}>
                  <Text style={styles.clearItemTitle}>清除朋友圈</Text>
                  <Text style={styles.clearItemDesc}>删除所有朋友圈和评论</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearItem} onPress={handleClearAllDiaries}>
              <View style={styles.clearItemLeft}>
                <Ionicons name="book-outline" size={20} color="#F56C6C" />
                <View style={styles.clearItemText}>
                  <Text style={styles.clearItemTitle}>清除日记</Text>
                  <Text style={styles.clearItemDesc}>删除所有日记和评论</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.clearItem, styles.clearItemDanger]} onPress={handleClearAllData}>
              <View style={styles.clearItemLeft}>
                <Ionicons name="nuclear-outline" size={20} color="#F56C6C" />
                <View style={styles.clearItemText}>
                  <Text style={[styles.clearItemTitle, { color: '#F56C6C' }]}>清除所有数据</Text>
                  <Text style={styles.clearItemDesc}>删除所有聊天、朋友圈、日记、记忆</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#F56C6C" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.folderList}>
          {storageInfo.map(item => renderStorageItem(item))}
        </View>

        {selectedFolder && (
          <View style={styles.filesSection}>
            <View style={styles.filesHeader}>
              <Text style={styles.filesTitle}>{selectedFolderInfo?.name}</Text>
              <TouchableOpacity
                onPress={() => clearFolder(selectedFolder, selectedFolderInfo?.name)}
              >
                <Text style={styles.clearAllText}>清空</Text>
              </TouchableOpacity>
            </View>
            {files.length === 0 ? (
              <Text style={styles.emptyText}>暂无文件</Text>
            ) : (
              renderTimeline()
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!previewImage}
        transparent={true}
        onRequestClose={() => setPreviewImage(null)}
      >
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
        >
          <Image
            source={{ uri: previewImage }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  totalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    margin: 12,
    borderRadius: 12,
    gap: 16,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#999',
  },
  totalSize: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  breakdownSection: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: -8,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  dbSection: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  dbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  dbItem: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  dbCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  dbLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCCC7',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#F56C6C',
  },
  clearSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  clearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  clearItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearItemText: {
    flex: 1,
  },
  clearItemTitle: {
    fontSize: 15,
    color: '#333',
  },
  clearItemDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  clearItemDanger: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFCCC7',
  },
  chatListContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 8,
    padding: 8,
  },
  clearAllBtn: {
    backgroundColor: '#FFF5F5',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFCCC7',
  },
  clearAllBtnText: {
    color: '#F56C6C',
    fontSize: 14,
    fontWeight: '500',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 4,
  },
  chatItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  folderList: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  storageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  storageItemActive: {
    backgroundColor: '#f5f5f5',
  },
  storageIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  storageCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  storageSize: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  filesSection: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  filesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clearAllText: {
    fontSize: 14,
    color: '#F56C6C',
  },
  timelineGroup: {
    marginBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90D9',
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  timelineCount: {
    fontSize: 12,
    color: '#999',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 6,
    marginLeft: 18,
    gap: 10,
  },
  filePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  filePreviewPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  filePreviewBtn: {
    padding: 0,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    height: '70%',
  },
  previewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
});
