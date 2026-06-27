import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';

const TASK_TYPES = [
  { id: 'post_moment', name: '发朋友圈', icon: 'images' },
  { id: 'auto_chat', name: '群聊发言', icon: 'chatbubbles' },
  { id: 'send_message', name: '私聊消息', icon: 'chatbubble' },
  { id: 'write_diary', name: '写日记', icon: 'book' },
];

const QUICK_TIMES = [
  { label: '每天 8:00', time: '08:00' },
  { label: '每天 12:00', time: '12:00' },
  { label: '每天 18:00', time: '18:00' },
  { label: '每天 22:00', time: '22:00' },
  { label: '每小时', time: 'every_hour' },
];

export default function ScheduledTasksScreen() {
  const router = useRouter();
  const scheduledTasks = useAppStore(s => s.scheduledTasks);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const loadScheduledTasks = useAppStore(s => s.loadScheduledTasks);
  const addScheduledTask = useAppStore(s => s.addScheduledTask);
  const deleteScheduledTask = useAppStore(s => s.deleteScheduledTask);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({
    ai_id: null,
    task_type: 'post_moment',
    content: '',
    schedule_time: '08:00',
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadScheduledTasks();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadScheduledTasks();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (newTask.task_type === 'send_message' && !newTask.ai_id) {
      Alert.alert('提示', '请选择AI角色');
      return;
    }
    await addScheduledTask(newTask);
    setNewTask({ ai_id: null, task_type: 'post_moment', content: '', schedule_time: '08:00' });
    setModalVisible(false);
    Alert.alert('成功', '定时任务创建成功！');
  };

  const handleDelete = (task) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个定时任务吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => deleteScheduledTask(task.id) },
      ]
    );
  };

  const getTaskTypeName = (type) => {
    const taskType = TASK_TYPES.find(t => t.id === type);
    return taskType?.name || type;
  };

  const getTaskTypeIcon = (type) => {
    const taskType = TASK_TYPES.find(t => t.id === type);
    return taskType?.icon || 'time';
  };

  const getAIName = (aiId) => {
    if (!aiId) return '随机AI';
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.name || '未知AI';
  };

  const renderTaskItem = ({ item }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskIcon}>
        <Ionicons name={getTaskTypeIcon(item.task_type)} size={24} color="#4A90D9" />
      </View>
      <View style={styles.taskInfo}>
        <Text style={styles.taskType}>{getTaskTypeName(item.task_type)}</Text>
        <Text style={styles.taskTime}>{item.schedule_time}</Text>
        {item.ai_id && <Text style={styles.taskAI}>{getAIName(item.ai_id)}</Text>}
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={20} color="#F56C6C" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={scheduledTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无定时任务</Text>
            <Text style={styles.emptySubText}>点击下方按钮添加任务</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加定时任务</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>任务类型</Text>
              <View style={styles.taskTypeContainer}>
                {TASK_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.taskTypeTag, newTask.task_type === type.id && styles.taskTypeTagActive]}
                    onPress={() => setNewTask({ ...newTask, task_type: type.id })}
                  >
                    <Ionicons name={type.icon} size={16} color={newTask.task_type === type.id ? '#fff' : '#666'} />
                    <Text style={[styles.taskTypeTagText, newTask.task_type === type.id && styles.taskTypeTagTextActive]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newTask.task_type === 'send_message' && (
                <>
                  <Text style={styles.label}>选择AI</Text>
                  <View style={styles.taskTypeContainer}>
                    {aiCharacters.map(ai => (
                      <TouchableOpacity
                        key={ai.id}
                        style={[styles.taskTypeTag, newTask.ai_id === ai.id && styles.taskTypeTagActive]}
                        onPress={() => setNewTask({ ...newTask, ai_id: ai.id })}
                      >
                        <Text style={[styles.taskTypeTagText, newTask.ai_id === ai.id && styles.taskTypeTagTextActive]}>
                          {ai.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>执行时间</Text>
              <View style={styles.quickTimeContainer}>
                {QUICK_TIMES.map(qt => (
                  <TouchableOpacity
                    key={qt.time}
                    style={[styles.quickTimeBtn, newTask.schedule_time === qt.time && styles.quickTimeBtnActive]}
                    onPress={() => setNewTask({ ...newTask, schedule_time: qt.time })}
                  >
                    <Text style={[styles.quickTimeText, newTask.schedule_time === qt.time && styles.quickTimeTextActive]}>
                      {qt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>自定义时间 (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={newTask.schedule_time}
                onChangeText={(text) => setNewTask({ ...newTask, schedule_time: text })}
                placeholder="08:00"
                placeholderTextColor="#999"
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleAdd}>
                <Text style={styles.submitButtonText}>添加任务</Text>
              </TouchableOpacity>
            </ScrollView>
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
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  taskIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4A90D915',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  taskType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  taskTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginTop: 2,
  },
  taskAI: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
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
  taskTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  taskTypeTagActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  taskTypeTagText: {
    fontSize: 14,
    color: '#666',
  },
  taskTypeTagTextActive: {
    color: '#fff',
  },
  quickTimeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickTimeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  quickTimeBtnActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  quickTimeText: {
    fontSize: 14,
    color: '#666',
  },
  quickTimeTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
  },
  timeColumn: {
    flex: 1,
    maxHeight: 150,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  timeItem: {
    padding: 12,
    alignItems: 'center',
  },
  timeItemActive: {
    backgroundColor: '#4A90D915',
    borderRadius: 8,
  },
  timeItemText: {
    fontSize: 18,
    color: '#333',
  },
  timeItemTextActive: {
    color: '#4A90D9',
    fontWeight: 'bold',
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
});
