import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAvatar } from '../src/components/SafeImage';
import { syncScheduledTasksToNotifications } from '../src/services/scheduler';

const TASK_TYPES = [
  { id: 'post_moment', name: '发朋友圈', icon: 'images', color: '#E6A23C' },
  { id: 'write_diary', name: '写日记', icon: 'book', color: '#9B59B6' },
  { id: 'auto_chat', name: '群聊发言', icon: 'chatbubbles', color: '#67C23A' },
  { id: 'send_message', name: '私聊消息', icon: 'chatbubble', color: '#4A90D9' },
];

const REPEAT_TYPES = [
  { id: 'daily', name: '每天', icon: 'repeat' },
  { id: 'once', name: '仅一次', icon: 'flash' },
];

const QUICK_TIMES = [
  { label: '08:00', time: '08:00' },
  { label: '12:00', time: '12:00' },
  { label: '18:00', time: '18:00' },
  { label: '22:00', time: '22:00' },
];

export default function ScheduledTasksScreen() {
  const router = useRouter();
  const scheduledTasks = useAppStore(s => s.scheduledTasks);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const conversations = useAppStore(s => s.conversations);
  const loadScheduledTasks = useAppStore(s => s.loadScheduledTasks);
  const addScheduledTask = useAppStore(s => s.addScheduledTask);
  const deleteScheduledTask = useAppStore(s => s.deleteScheduledTask);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({
    ai_id: null,
    task_type: 'post_moment',
    content: '',
    schedule_time: '08:00',
    repeat_type: 'daily',
    execute_date: '',
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [groupMembers, setGroupMembers] = useState([]);

  useEffect(() => {
    loadScheduledTasks();
  }, []);

  useEffect(() => {
    if (newTask.task_type === 'auto_chat' && newTask.content) {
      loadGroupMembers(parseInt(newTask.content));
    }
  }, [newTask.content, newTask.task_type]);

  const loadGroupMembers = async (conversationId) => {
    const { executeQuery } = require('../src/database');
    const members = await executeQuery(
      'SELECT * FROM conversation_members WHERE conversation_id = ?',
      [conversationId]
    );
    const memberAIs = members.map(m => {
      const ai = aiCharacters.find(a => a.id === m.member_id);
      return ai || null;
    }).filter(Boolean);
    setGroupMembers(memberAIs);
  };

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
    if (newTask.task_type === 'auto_chat' && !newTask.content) {
      Alert.alert('提示', '请选择群聊');
      return;
    }
    if (newTask.repeat_type === 'once' && !newTask.execute_date) {
      Alert.alert('提示', '请选择执行日期');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(newTask.schedule_time)) {
      Alert.alert('提示', '请选择有效的执行时间');
      return;
    }
    await addScheduledTask(newTask);
    await syncScheduledTasksToNotifications();
    setNewTask({ ai_id: null, task_type: 'post_moment', content: '', schedule_time: '08:00', repeat_type: 'daily', execute_date: '' });
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

  const getTaskTypeColor = (type) => {
    const taskType = TASK_TYPES.find(t => t.id === type);
    return taskType?.color || '#4A90D9';
  };

  const getAvatarColor = (id) => {
    const colors = ['#4A90D9', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#E74C3C'];
    return colors[(id - 1) % colors.length];
  };

  const getConversationName = (convId) => {
    const conv = conversations.find(c => c.id === parseInt(convId));
    return conv?.name || '未知群聊';
  };

  const getConversationAvatar = (convId) => {
    const conv = conversations.find(c => c.id === parseInt(convId));
    return conv?.avatar || null;
  };

  const getAIName = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.name || '随机';
  };

  const renderTaskItem = ({ item }) => {
    const taskColor = getTaskTypeColor(item.task_type);
    const ai = item.ai_id ? aiCharacters.find(a => a.id === item.ai_id) : null;
    
    return (
      <View style={styles.taskItem}>
        <View style={[styles.taskIconContainer, { backgroundColor: taskColor + '20' }]}>
          <Ionicons name={TASK_TYPES.find(t => t.id === item.task_type)?.icon || 'time'} size={22} color={taskColor} />
        </View>
        <View style={styles.taskInfo}>
          <Text style={styles.taskType}>{getTaskTypeName(item.task_type)}</Text>
          <View style={styles.taskDetailRow}>
            <Ionicons name="time-outline" size={14} color="#999" />
            <Text style={styles.taskTime}>{item.schedule_time}</Text>
            <View style={[styles.repeatBadge, { backgroundColor: item.repeat_type === 'once' ? '#FFF3E0' : '#E3F2FD' }]}>
              <Text style={[styles.repeatText, { color: item.repeat_type === 'once' ? '#E6A23C' : '#4A90D9' }]}>
                {item.repeat_type === 'once' ? '仅一次' : '每天'}
              </Text>
            </View>
          </View>
          {item.execute_date && (
            <View style={styles.taskDetailRow}>
              <Ionicons name="calendar-outline" size={14} color="#999" />
              <Text style={styles.taskDate}>{item.execute_date}</Text>
            </View>
          )}
          {item.task_type === 'send_message' && item.content && (
            <View style={styles.taskContentRow}>
              <Ionicons name="chatbubble-outline" size={14} color="#999" />
              <Text style={styles.taskContentText} numberOfLines={1}>{item.content}</Text>
            </View>
          )}
          {item.task_type === 'auto_chat' && item.content && (
            <View style={styles.taskAIOffset}>
              <SafeAvatar uri={getConversationAvatar(item.content)} size={20} name={getConversationName(item.content)} color="#67C23A" />
              <Text style={styles.taskAIName}>{getConversationName(item.content)}</Text>
              {item.ai_id && (
                <>
                  <Text style={styles.taskDot}>·</Text>
                  <Text style={styles.taskAIName}>{getAIName(item.ai_id)}</Text>
                </>
              )}
            </View>
          )}
          {ai && item.task_type !== 'auto_chat' && (
            <View style={styles.taskAIOffset}>
              <SafeAvatar uri={ai.avatar} size={18} name={ai.name} color={getAvatarColor(ai.id)} />
              <Text style={styles.taskAIName}>{ai.name}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={18} color="#F56C6C" />
        </TouchableOpacity>
      </View>
    );
  };

  const groupConversations = conversations.filter(c => c.type === 'group');

  return (
    <View style={styles.container}>
      <View style={styles.taskSectionHeader}>
        <Text style={styles.taskSectionTitle}>定时任务</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color="#4A90D9" />
        </TouchableOpacity>
      </View>

      {scheduledTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>暂无定时任务</Text>
          <Text style={styles.emptySubText}>点击上方按钮添加</Text>
        </View>
      ) : (
        <FlatList
          data={scheduledTasks}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

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
                    style={[styles.taskTypeTag, newTask.task_type === type.id && { backgroundColor: type.color, borderColor: type.color }]}
                    onPress={() => setNewTask({ ...newTask, task_type: type.id, content: '', ai_id: null })}
                  >
                    <Ionicons name={type.icon} size={16} color={newTask.task_type === type.id ? '#fff' : '#666'} />
                    <Text style={[styles.taskTypeTagText, newTask.task_type === type.id && styles.taskTypeTagTextActive]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(newTask.task_type === 'post_moment' || newTask.task_type === 'write_diary') && (
                <>
                  <Text style={styles.label}>选择AI</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiScroll}>
                    <TouchableOpacity
                      style={[styles.aiChip, !newTask.ai_id && styles.aiChipActive]}
                      onPress={() => setNewTask({ ...newTask, ai_id: null })}
                    >
                      <Ionicons name="shuffle" size={20} color={!newTask.ai_id ? '#fff' : '#666'} />
                      <Text style={[styles.aiChipText, !newTask.ai_id && styles.aiChipTextActive]}>随机</Text>
                    </TouchableOpacity>
                    {aiCharacters.map(ai => (
                      <TouchableOpacity
                        key={ai.id}
                        style={[styles.aiChip, newTask.ai_id === ai.id && styles.aiChipActive]}
                        onPress={() => setNewTask({ ...newTask, ai_id: ai.id })}
                      >
                        <SafeAvatar uri={ai.avatar} size={28} name={ai.name} color={getAvatarColor(ai.id)} />
                        <Text style={[styles.aiChipText, newTask.ai_id === ai.id && styles.aiChipTextActive]}>{ai.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {newTask.task_type === 'send_message' && (
                <>
                  <Text style={styles.label}>选择AI</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiScroll}>
                    {aiCharacters.map(ai => (
                      <TouchableOpacity
                        key={ai.id}
                        style={[styles.aiChip, newTask.ai_id === ai.id && styles.aiChipActive]}
                        onPress={() => setNewTask({ ...newTask, ai_id: ai.id })}
                      >
                        <SafeAvatar uri={ai.avatar} size={28} name={ai.name} color={getAvatarColor(ai.id)} />
                        <Text style={[styles.aiChipText, newTask.ai_id === ai.id && styles.aiChipTextActive]}>{ai.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.label}>提醒内容</Text>
                  <TextInput
                    style={styles.input}
                    value={newTask.content}
                    onChangeText={(text) => setNewTask({ ...newTask, content: text })}
                    placeholder="如：提醒我吃饭、该喝水了..."
                    placeholderTextColor="#999"
                  />
                </>
              )}

              {newTask.task_type === 'auto_chat' && (
                <>
                  <Text style={styles.label}>选择群聊</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiScroll}>
                    {groupConversations.map(conv => (
                      <TouchableOpacity
                        key={conv.id}
                        style={[styles.aiChip, newTask.content === conv.id.toString() && styles.aiChipActive]}
                        onPress={() => setNewTask({ ...newTask, content: conv.id.toString(), ai_id: null })}
                      >
                        <SafeAvatar uri={conv.avatar} size={28} name={conv.name} color="#67C23A" />
                        <Text style={[styles.aiChipText, newTask.content === conv.id.toString() && styles.aiChipTextActive]}>{conv.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {newTask.content && (
                    <>
                      <Text style={styles.label}>选择AI（群成员）</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiScroll}>
                        <TouchableOpacity
                          style={[styles.aiChip, !newTask.ai_id && styles.aiChipActive]}
                          onPress={() => setNewTask({ ...newTask, ai_id: null })}
                        >
                          <Ionicons name="shuffle" size={20} color={!newTask.ai_id ? '#fff' : '#666'} />
                          <Text style={[styles.aiChipText, !newTask.ai_id && styles.aiChipTextActive]}>随机</Text>
                        </TouchableOpacity>
                        {groupMembers.map(ai => (
                          <TouchableOpacity
                            key={ai.id}
                            style={[styles.aiChip, newTask.ai_id === ai.id && styles.aiChipActive]}
                            onPress={() => setNewTask({ ...newTask, ai_id: ai.id })}
                          >
                            <SafeAvatar uri={ai.avatar} size={28} name={ai.name} color={getAvatarColor(ai.id)} />
                            <Text style={[styles.aiChipText, newTask.ai_id === ai.id && styles.aiChipTextActive]}>{ai.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
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
              <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={20} color="#4A90D9" />
                <Text style={styles.timePickerText}>{newTask.schedule_time}</Text>
                <Text style={styles.timePickerHint}>自定义时间</Text>
              </TouchableOpacity>

              <Text style={styles.label}>执行频率</Text>
              <View style={styles.repeatContainer}>
                {REPEAT_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.repeatBtn, newTask.repeat_type === type.id && styles.repeatBtnActive]}
                    onPress={() => setNewTask({ ...newTask, repeat_type: type.id })}
                  >
                    <Ionicons name={type.icon} size={20} color={newTask.repeat_type === type.id ? '#fff' : '#666'} />
                    <Text style={[styles.repeatText, newTask.repeat_type === type.id && styles.repeatTextActive]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newTask.repeat_type === 'once' && (
                <>
                  <Text style={styles.label}>执行日期</Text>
                  <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color="#4A90D9" />
                    <Text style={styles.timePickerText}>{newTask.execute_date || '选择日期'}</Text>
                    <Text style={styles.timePickerHint}>点击选择</Text>
                  </TouchableOpacity>
                </>
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (date) {
                      setSelectedTime(date);
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      setNewTask({ ...newTask, schedule_time: `${hours}:${minutes}` });
                    }
                  }}
                />
              )}

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setSelectedDate(date);
                      const year = date.getFullYear();
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const day = date.getDate().toString().padStart(2, '0');
                      setNewTask({ ...newTask, execute_date: `${year}-${month}-${day}` });
                    }
                  }}
                />
              )}

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
    backgroundColor: '#f8f9fa',
  },
  taskSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taskSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listContent: {
    padding: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  taskIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  taskType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  taskDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  taskTime: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  repeatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  repeatText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskDate: {
    fontSize: 12,
    color: '#E6A23C',
    fontWeight: '500',
  },
  taskContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  taskContentText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  taskAIOffset: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
    gap: 6,
  },
  taskAIName: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '500',
  },
  taskDot: {
    fontSize: 14,
    color: '#ccc',
  },
  deleteButton: {
    padding: 10,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalBody: {
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 18,
    marginBottom: 10,
  },
  taskTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  taskTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#eee',
    gap: 7,
  },
  taskTypeTagText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  taskTypeTagTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  aiScroll: {
    marginBottom: 8,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    gap: 7,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  aiChipActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  aiChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  aiChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  quickTimeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickTimeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  quickTimeBtnActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  quickTimeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  quickTimeTextActive: {
    color: '#fff',
  },
  timePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  timePickerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  timePickerHint: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  repeatContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  repeatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  repeatBtnActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  repeatText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  repeatTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
