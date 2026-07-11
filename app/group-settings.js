import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { copyToAppStorage } from '../src/services/media';
import * as FileSystem from 'expo-file-system';
import { executeQuery } from '../src/database';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const conversations = useAppStore(s => s.conversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const updateConversation = useAppStore(s => s.updateConversation);
  const loadConversations = useAppStore(s => s.loadConversations);
  
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [members, setMembers] = useState([]);

  const conversation = conversations.find(c => c.id === parseInt(id));

  useEffect(() => {
    if (conversation) {
      setGroupName(conversation.name || '');
      setGroupAvatar(conversation.avatar || null);
      loadMembers();
    }
  }, [conversation]);

  const loadMembers = async () => {
    const memberList = await executeQuery(
      'SELECT * FROM conversation_members WHERE conversation_id = ?',
      [parseInt(id)]
    );
    setMembers(memberList);
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
      if (groupAvatar) { try { await FileSystem.deleteAsync(groupAvatar, { idempotent: true }); } catch (e) {} }
      setGroupAvatar(permanentUri || tempUri);
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      Alert.alert('提示', '请输入群聊名称');
      return;
    }
    const oldConv = await executeQuery('SELECT avatar FROM conversations WHERE id = ?', [parseInt(id)]);
    const oldAvatar = oldConv[0]?.avatar;
    if (oldAvatar && oldAvatar.length > 1 && oldAvatar !== groupAvatar) {
      try { await FileSystem.deleteAsync(oldAvatar, { idempotent: true }); } catch (e) {}
    }
    await updateConversation(parseInt(id), {
      name: groupName.trim(),
      avatar: groupAvatar,
    });
    Alert.alert('成功', '群聊设置已保存');
  };

  const getAIMember = (memberId) => {
    return aiCharacters.find(a => a.id === memberId);
  };

  const renderMember = ({ item }) => {
    const ai = getAIMember(item.member_id);
    if (!ai) return null;

    return (
      <View style={styles.memberItem}>
        {ai.avatar && ai.avatar.length > 1 ? (
          <Image source={{ uri: ai.avatar }} style={styles.memberAvatar} />
        ) : (
          <View style={[styles.memberAvatarPlaceholder, { backgroundColor: '#4A90D9' }]}>
            <Text style={styles.memberAvatarText}>{ai.name?.[0]}</Text>
          </View>
        )}
        <Text style={styles.memberName}>{ai.name}</Text>
        <Text style={styles.memberPersonality}>{ai.description || ai.signature || ''}</Text>
      </View>
    );
  };

  if (!conversation) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>群聊不存在</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>群聊头像</Text>
        <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar}>
          {groupAvatar ? (
            <Image source={{ uri: groupAvatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="people" size={40} color="#fff" />
            </View>
          )}
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>群聊名称</Text>
        <TextInput
          style={styles.input}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="输入群聊名称"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>群成员 ({members.length})</Text>
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>保存设置</Text>
      </TouchableOpacity>
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
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#67C23A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  memberPersonality: {
    fontSize: 13,
    color: '#999',
  },
  saveButton: {
    backgroundColor: '#67C23A',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 50,
  },
});
