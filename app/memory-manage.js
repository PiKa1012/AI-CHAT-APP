import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getAllMemories, deleteMemory, clearAllMemories, saveMemory } from '../src/services/memory';
import { SafeAvatar } from '../src/components/SafeImage';

const MEMORY_TYPES = [
  { id: 'fact', name: '事实', icon: 'information-circle', color: '#4A90D9' },
  { id: 'preference', name: '喜好', icon: 'heart', color: '#F56C6C' },
  { id: 'event', name: '事件', icon: 'calendar', color: '#67C23A' },
  { id: 'summary', name: '摘要', icon: 'document-text', color: '#E6A23C' },
  { id: 'conversation', name: '对话', icon: 'chatbubble', color: '#9B59B6' },
  { id: 'emotion', name: '情绪', icon: 'heart-circle', color: '#FF69B4' },
];

export default function MemoryManageScreen() {
  const router = useRouter();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [selectedAI, setSelectedAI] = useState(null);
  const [memories, setMemories] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [newMemory, setNewMemory] = useState({ type: 'fact', content: '', importance: 5 });
  const [editingMemory, setEditingMemory] = useState(null);

  useEffect(() => {
    if (aiCharacters.length > 0 && !selectedAI) {
      setSelectedAI(aiCharacters[0]);
    }
  }, [aiCharacters]);

  useEffect(() => {
    if (selectedAI) {
      loadMemories();
    }
  }, [selectedAI]);

  const loadMemories = async () => {
    if (!selectedAI) return;
    const data = await getAllMemories(selectedAI.id);
    setMemories(data);
  };

  const handleDelete = (memory) => {
    Alert.alert(
      '删除记忆',
      '确定要删除这条记忆吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteMemory(memory.id);
            await loadMemories();
          }
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      '清空所有记忆',
      `确定要清空${selectedAI.name}的所有记忆吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            await clearAllMemories(selectedAI.id);
            await loadMemories();
          }
        },
      ]
    );
  };

  const handleSaveMemory = async () => {
    if (!newMemory.content.trim()) {
      Alert.alert('提示', '请输入记忆内容');
      return;
    }
    await saveMemory(selectedAI.id, newMemory.type, newMemory.content.trim(), newMemory.importance);
    setModalVisible(false);
    setNewMemory({ type: 'fact', content: '', importance: 5 });
    setEditingMemory(null);
    await loadMemories();
  };

  const getTypeInfo = (type) => {
    return MEMORY_TYPES.find(t => t.id === type) || MEMORY_TYPES[0];
  };

  const filteredMemories = filterType === 'all' 
    ? memories 
    : memories.filter(m => m.memory_type === filterType);

  const getAvatarColor = (id) => {
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  const renderMemoryItem = ({ item }) => {
    const typeInfo = getTypeInfo(item.memory_type);
    
    return (
      <View style={styles.memoryItem}>
        <View style={[styles.memoryTypeIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon} size={18} color={typeInfo.color} />
        </View>
        <View style={styles.memoryContent}>
          <Text style={styles.memoryText}>{item.content}</Text>
          <View style={styles.memoryMeta}>
            <Text style={[styles.memoryType, { color: typeInfo.color }]}>{typeInfo.name}</Text>
            <Text style={styles.memoryImportance}>重要性: {item.importance}/10</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#F56C6C" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.aiSelector}>
        <FlatList
          horizontal
          data={aiCharacters}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.aiList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.aiChip, selectedAI?.id === item.id && styles.aiChipActive]}
              onPress={() => setSelectedAI(item)}
            >
              <SafeAvatar
                uri={item.avatar}
                size={28}
                name={item.name}
                color={getAvatarColor(item.id)}
              />
              <Text style={[styles.aiChipText, selectedAI?.id === item.id && styles.aiChipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
            全部 ({memories.length})
          </Text>
        </TouchableOpacity>
        {MEMORY_TYPES.map(type => {
          const count = memories.filter(m => m.memory_type === type.id).length;
          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.filterChip, filterType === type.id && styles.filterChipActive]}
              onPress={() => setFilterType(type.id)}
            >
              <Ionicons name={type.icon} size={14} color={filterType === type.id ? '#fff' : type.color} />
              <Text style={[styles.filterText, filterType === type.id && styles.filterTextActive]}>
                {type.name} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredMemories}
        renderItem={renderMemoryItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.memoryList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bulb-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>暂无记忆</Text>
            <Text style={styles.emptySubText}>AI会在聊天中自动积累记忆</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>添加记忆</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
          <Ionicons name="trash-outline" size={20} color="#F56C6C" />
        </TouchableOpacity>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>添加记忆</Text>
              <TouchableOpacity onPress={handleSaveMemory}>
                <Text style={styles.saveText}>保存</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>记忆类型</Text>
              <View style={styles.typeGrid}>
                {MEMORY_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeItem, newMemory.type === type.id && styles.typeItemActive]}
                    onPress={() => setNewMemory({ ...newMemory, type: type.id })}
                  >
                    <Ionicons name={type.icon} size={20} color={newMemory.type === type.id ? '#fff' : type.color} />
                    <Text style={[styles.typeText, newMemory.type === type.id && styles.typeTextActive]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>记忆内容</Text>
              <TextInput
                style={styles.input}
                value={newMemory.content}
                onChangeText={(text) => setNewMemory({ ...newMemory, content: text })}
                placeholder="如：用户喜欢吃火锅"
                placeholderTextColor="#999"
                multiline
              />

              <Text style={styles.label}>重要性 ({newMemory.importance}/10)</Text>
              <View style={styles.importanceContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.importanceDot, newMemory.importance >= val && styles.importanceDotActive]}
                    onPress={() => setNewMemory({ ...newMemory, importance: val })}
                  />
                ))}
              </View>
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
  aiSelector: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  aiList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    gap: 6,
  },
  aiChipActive: {
    backgroundColor: '#4A90D9',
  },
  aiChipText: {
    fontSize: 14,
    color: '#666',
  },
  aiChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: '#4A90D9',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  memoryList: {
    padding: 12,
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memoryTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryContent: {
    flex: 1,
    marginLeft: 10,
  },
  memoryText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  memoryMeta: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 12,
  },
  memoryType: {
    fontSize: 12,
    fontWeight: '500',
  },
  memoryImportance: {
    fontSize: 12,
    color: '#999',
  },
  deleteBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    color: '#ccc',
    marginTop: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCCC7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelText: {
    fontSize: 16,
    color: '#999',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeItemActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  typeText: {
    fontSize: 14,
    color: '#666',
  },
  typeTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  importanceContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  importanceDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  importanceDotActive: {
    backgroundColor: '#4A90D9',
  },
});
