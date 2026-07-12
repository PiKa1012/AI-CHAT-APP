import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { SafeAvatar } from '../src/components/SafeImage';
import { copyToAppStorage } from '../src/services/media';
import { executeQuery } from '../src/database';

export default function AIManageScreen() {
  const router = useRouter();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const addAICharacter = useAppStore(s => s.addAICharacter);
  const updateAICharacter = useAppStore(s => s.updateAICharacter);
  const deleteAICharacter = useAppStore(s => s.deleteAICharacter);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAI, setEditingAI] = useState(null);
  const [newAI, setNewAI] = useState({
    name: '',
    avatar: null,
    description: '',
    signature: '',
  });

  const pickImage = async (isEdit = false) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const tempUri = result.assets[0].uri;
      const permanentUri = await copyToAppStorage(tempUri, 'avatars');
      const finalUri = permanentUri || tempUri;

      if (isEdit) {
        if (editingAI.avatar && editingAI.avatar.length > 1) {
          try { await FileSystem.deleteAsync(editingAI.avatar, { idempotent: true }); } catch (e) {}
        }
        setEditingAI({ ...editingAI, avatar: finalUri });
      } else {
        setNewAI({ ...newAI, avatar: finalUri });
      }
    }
  };

  const handleAdd = async () => {
    if (!newAI.name.trim()) {
      Alert.alert('提示', '请输入AI名称');
      return;
    }
    await addAICharacter({
      ...newAI,
      avatar: newAI.avatar || newAI.name[0],
    });
    setNewAI({ name: '', avatar: null, description: '', signature: '' });
    setModalVisible(false);
    Alert.alert('成功', 'AI角色创建成功！');
  };

  const handleEdit = (ai) => {
    setEditingAI({ ...ai });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAI.name.trim()) {
      Alert.alert('提示', '请输入AI名称');
      return;
    }
    const oldChars = await executeQuery('SELECT avatar FROM ai_characters WHERE id = ?', [editingAI.id]);
    const oldAvatar = oldChars[0]?.avatar;
    const newAvatar = editingAI.avatar || editingAI.name[0];
    if (oldAvatar && oldAvatar.length > 1 && oldAvatar !== newAvatar) {
      try { await FileSystem.deleteAsync(oldAvatar, { idempotent: true }); } catch (e) {}
    }
    await updateAICharacter(editingAI.id, {
      name: editingAI.name,
      description: editingAI.description,
      signature: editingAI.signature,
      avatar: editingAI.avatar || editingAI.name[0],
    });
    setEditModalVisible(false);
    setEditingAI(null);
    Alert.alert('成功', 'AI角色更新成功！');
  };

  const handleDelete = (ai) => {
    Alert.alert(
      '确认删除',
      `确定要删除 ${ai.name} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => deleteAICharacter(ai.id) },
      ]
    );
  };

  const renderAIItem = ({ item }) => (
    <View style={styles.aiItem}>
      <SafeAvatar
        uri={item.avatar}
        size={50}
        name={item.name || 'A'}
        color={getAvatarColor(item.id)}
      />
      <View style={styles.aiInfo}>
        <Text style={styles.aiName}>{item.name}</Text>
        {item.signature ? (
          <Text style={styles.aiDescription} numberOfLines={1}>{item.signature}</Text>
        ) : item.description ? (
          <Text style={styles.aiDescription} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </View>
      <View style={styles.aiActions}>
        <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editButton}>
          <Ionicons name="create-outline" size={20} color="#4A90D9" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={20} color="#FF4D4F" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getAvatarColor = (id) => {
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={aiCharacters}
        renderItem={renderAIItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无AI角色</Text>
            <Text style={styles.emptySubText}>点击下方按钮创建AI</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* 新增AI弹窗 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>创建AI角色</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <TouchableOpacity style={styles.avatarPicker} onPress={() => pickImage(false)}>
                {newAI.avatar ? (
                  <Image source={{ uri: newAI.avatar }} style={styles.avatarPreview} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera" size={32} color="#999" />
                    <Text style={styles.avatarPlaceholderText}>选择头像</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>名称 *</Text>
              <TextInput style={styles.input} value={newAI.name} onChangeText={(text) => setNewAI({ ...newAI, name: text })} placeholderTextColor="#999" />

              <Text style={styles.label}>角色设定</Text>
              <TextInput style={[styles.input, styles.textArea]} value={newAI.description} onChangeText={(text) => setNewAI({ ...newAI, description: text })} placeholderTextColor="#999" multiline numberOfLines={5} />

              <Text style={styles.label}>个性签名</Text>
              <TextInput style={styles.input} value={newAI.signature} onChangeText={(text) => setNewAI({ ...newAI, signature: text })} placeholderTextColor="#999" />

              <TouchableOpacity style={styles.submitButton} onPress={handleAdd}>
                <Text style={styles.submitButtonText}>创建</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 编辑AI弹窗 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>编辑AI角色</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {editingAI && (
              <ScrollView style={styles.modalBody}>
                <TouchableOpacity style={styles.avatarPicker} onPress={() => pickImage(true)}>
                  {editingAI.avatar && editingAI.avatar.length > 1 ? (
                    <Image source={{ uri: editingAI.avatar }} style={styles.avatarPreview} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="camera" size={32} color="#999" />
                      <Text style={styles.avatarPlaceholderText}>选择头像</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.label}>名称 *</Text>
                <TextInput style={styles.input} value={editingAI.name} onChangeText={(text) => setEditingAI({ ...editingAI, name: text })} placeholderTextColor="#999" />

                <Text style={styles.label}>角色设定</Text>
                <TextInput style={[styles.input, styles.textArea]} value={editingAI.description || ''} onChangeText={(text) => setEditingAI({ ...editingAI, description: text })} placeholderTextColor="#999" multiline numberOfLines={5} />

                <Text style={styles.label}>个性签名</Text>
                <TextInput style={styles.input} value={editingAI.signature || ''} onChangeText={(text) => setEditingAI({ ...editingAI, signature: text })} placeholderTextColor="#999" />

                <TouchableOpacity style={styles.submitButton} onPress={handleSaveEdit}>
                  <Text style={styles.submitButtonText}>保存</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  aiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  aiAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  aiInfo: {
    flex: 1,
    marginLeft: 12,
  },
  aiName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  aiDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  aiActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aiAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPicker: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  avatarPlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
