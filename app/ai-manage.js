import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { SafeAvatar } from '../src/components/SafeImage';
import { copyToAppStorage } from '../src/services/media';

const PERSONALITIES = ['友好', '可爱', '高冷', '幽默', '温柔', '傲娇', '元气', '成熟'];
const VOICES = ['默认', '甜美', '磁性', '可爱', '成熟'];
const GENDERS = ['男', '女', '其他'];
const RELATIONSHIPS = ['朋友', '恋人', '家人', '老师', '同事'];

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
    personality: '友好',
    description: '',
    voice_id: '默认',
    avatar: null,
    age: '',
    gender: '',
    background: '',
    likes: '',
    speaking_style: '',
    relationship: '朋友',
    greeting: '',
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
      age: newAI.age ? parseInt(newAI.age) : null,
    });
    setNewAI({ 
      name: '', personality: '友好', description: '', voice_id: '默认', avatar: null,
      age: '', gender: '', background: '', likes: '', speaking_style: '', relationship: '朋友', greeting: ''
    });
    setModalVisible(false);
    Alert.alert('成功', 'AI角色创建成功！');
  };

  const handleEdit = (ai) => {
    setEditingAI({
      ...ai,
      personality: ai.personality || '友好',
      voice_id: ai.voice_id || '默认',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAI.name.trim()) {
      Alert.alert('提示', '请输入AI名称');
      return;
    }
    await updateAICharacter(editingAI.id, {
      name: editingAI.name,
      personality: editingAI.personality,
      description: editingAI.description,
      voice_id: editingAI.voice_id,
      avatar: editingAI.avatar || editingAI.name[0],
      age: editingAI.age ? parseInt(editingAI.age) : null,
      gender: editingAI.gender,
      background: editingAI.background,
      likes: editingAI.likes,
      speaking_style: editingAI.speaking_style,
      relationship: editingAI.relationship,
      greeting: editingAI.greeting,
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
        <View style={styles.aiNameRow}>
          <Text style={styles.aiName}>{item.name}</Text>
          {item.gender && (
            <View style={styles.genderBadge}>
              <Text style={styles.genderText}>{item.gender}</Text>
            </View>
          )}
          {item.age && (
            <Text style={styles.aiAge}>{item.age}岁</Text>
          )}
        </View>
        <Text style={styles.aiPersonality}>性格：{item.personality || '友好'}</Text>
        {item.relationship && (
          <Text style={styles.aiRelationship}>关系：{item.relationship}</Text>
        )}
        {item.description ? (
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

  const renderPersonalitySelector = (selected, onSelect) => (
    <View style={styles.personalityContainer}>
      {PERSONALITIES.map(p => (
        <TouchableOpacity
          key={p}
          style={[styles.personalityTag, selected === p && styles.personalityTagSelected]}
          onPress={() => onSelect(p)}
        >
          <Text style={[styles.personalityTagText, selected === p && styles.personalityTagTextSelected]}>
            {p}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderVoiceSelector = (selected, onSelect) => (
    <View style={styles.personalityContainer}>
      {VOICES.map(v => (
        <TouchableOpacity
          key={v}
          style={[styles.personalityTag, selected === v && styles.personalityTagSelected]}
          onPress={() => onSelect(v)}
        >
          <Text style={[styles.personalityTagText, selected === v && styles.personalityTagTextSelected]}>
            {v}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

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
              <TextInput
                style={styles.input}
                value={newAI.name}
                onChangeText={(text) => setNewAI({ ...newAI, name: text })}
                placeholder="给AI起个名字"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>年龄</Text>
              <TextInput
                style={styles.input}
                value={newAI.age}
                onChangeText={(text) => setNewAI({ ...newAI, age: text })}
                placeholder="输入年龄"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              <Text style={styles.label}>性别</Text>
              <View style={styles.personalityContainer}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.personalityTag, newAI.gender === g && styles.personalityTagSelected]}
                    onPress={() => setNewAI({ ...newAI, gender: g })}
                  >
                    <Text style={[styles.personalityTagText, newAI.gender === g && styles.personalityTagTextSelected]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>性格</Text>
              {renderPersonalitySelector(newAI.personality, (p) => setNewAI({ ...newAI, personality: p }))}

              <Text style={styles.label}>与你的关系</Text>
              <View style={styles.personalityContainer}>
                {RELATIONSHIPS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.personalityTag, newAI.relationship === r && styles.personalityTagSelected]}
                    onPress={() => setNewAI({ ...newAI, relationship: r })}
                  >
                    <Text style={[styles.personalityTagText, newAI.relationship === r && styles.personalityTagTextSelected]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>声音</Text>
              {renderVoiceSelector(newAI.voice_id, (v) => setNewAI({ ...newAI, voice_id: v }))}

              <Text style={styles.label}>说话风格</Text>
              <TextInput
                style={styles.input}
                value={newAI.speaking_style}
                onChangeText={(text) => setNewAI({ ...newAI, speaking_style: text })}
                placeholder="如：温柔、活泼、成熟稳重..."
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>打招呼语</Text>
              <TextInput
                style={styles.input}
                value={newAI.greeting}
                onChangeText={(text) => setNewAI({ ...newAI, greeting: text })}
                placeholder="第一次见面时说的话..."
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>兴趣爱好</Text>
              <TextInput
                style={styles.input}
                value={newAI.likes}
                onChangeText={(text) => setNewAI({ ...newAI, likes: text })}
                placeholder="如：看书、听音乐、玩游戏..."
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>背景故事</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newAI.background}
                onChangeText={(text) => setNewAI({ ...newAI, background: text })}
                placeholder="AI的背景故事..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>描述</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={newAI.description}
                onChangeText={(text) => setNewAI({ ...newAI, description: text })}
                placeholder="描述一下这个AI..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />

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
                <TextInput
                  style={styles.input}
                  value={editingAI.name}
                  onChangeText={(text) => setEditingAI({ ...editingAI, name: text })}
                  placeholder="给AI起个名字"
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>年龄</Text>
                <TextInput
                  style={styles.input}
                  value={editingAI.age?.toString() || ''}
                  onChangeText={(text) => setEditingAI({ ...editingAI, age: text })}
                  placeholder="输入年龄"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />

                <Text style={styles.label}>性别</Text>
                <View style={styles.personalityContainer}>
                  {GENDERS.map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.personalityTag, editingAI.gender === g && styles.personalityTagSelected]}
                      onPress={() => setEditingAI({ ...editingAI, gender: g })}
                    >
                      <Text style={[styles.personalityTagText, editingAI.gender === g && styles.personalityTagTextSelected]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>性格</Text>
                {renderPersonalitySelector(editingAI.personality, (p) => setEditingAI({ ...editingAI, personality: p }))}

                <Text style={styles.label}>与你的关系</Text>
                <View style={styles.personalityContainer}>
                  {RELATIONSHIPS.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.personalityTag, editingAI.relationship === r && styles.personalityTagSelected]}
                      onPress={() => setEditingAI({ ...editingAI, relationship: r })}
                    >
                      <Text style={[styles.personalityTagText, editingAI.relationship === r && styles.personalityTagTextSelected]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>声音</Text>
                {renderVoiceSelector(editingAI.voice_id, (v) => setEditingAI({ ...editingAI, voice_id: v }))}

                <Text style={styles.label}>说话风格</Text>
                <TextInput
                  style={styles.input}
                  value={editingAI.speaking_style || ''}
                  onChangeText={(text) => setEditingAI({ ...editingAI, speaking_style: text })}
                  placeholder="如：温柔、活泼、成熟稳重..."
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>打招呼语</Text>
                <TextInput
                  style={styles.input}
                  value={editingAI.greeting || ''}
                  onChangeText={(text) => setEditingAI({ ...editingAI, greeting: text })}
                  placeholder="第一次见面时说的话..."
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>兴趣爱好</Text>
                <TextInput
                  style={styles.input}
                  value={editingAI.likes || ''}
                  onChangeText={(text) => setEditingAI({ ...editingAI, likes: text })}
                  placeholder="如：看书、听音乐、玩游戏..."
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>背景故事</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editingAI.background || ''}
                  onChangeText={(text) => setEditingAI({ ...editingAI, background: text })}
                  placeholder="AI的背景故事..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>描述</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editingAI.description}
                  onChangeText={(text) => setEditingAI({ ...editingAI, description: text })}
                  placeholder="描述一下这个AI..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />

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
  aiNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  genderBadge: {
    backgroundColor: '#FFE6F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  genderText: {
    fontSize: 12,
    color: '#FF69B4',
  },
  aiAge: {
    fontSize: 13,
    color: '#666',
  },
  aiPersonality: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  aiRelationship: {
    fontSize: 12,
    color: '#4A90D9',
    marginTop: 2,
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
  personalityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personalityTag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  personalityTagSelected: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  personalityTagText: {
    fontSize: 14,
    color: '#666',
  },
  personalityTagTextSelected: {
    color: '#fff',
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
