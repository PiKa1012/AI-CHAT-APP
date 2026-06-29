import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getAllNotifications, markAllAsRead, clearAllNotifications } from '../src/services/notification';
import { formatTime, formatDate } from '../src/utils/time';

const NOTIFICATION_TYPES = {
  like: { icon: 'heart', color: '#F56C6C', label: '点赞' },
  comment: { icon: 'chatbubble', color: '#4A90D9', label: '评论' },
  reply: { icon: 'return-down-back', color: '#67C23A', label: '回复' },
  moment: { icon: 'camera', color: '#FF69B4', label: '新朋友圈' },
};

export default function NotificationCenter() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
    markAllAsRead();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await getAllNotifications();
      setNotifications(data);
    } catch (e) {}
  };

  const handleClearAll = () => {
    Alert.alert(
      '清空通知',
      '确定要清空所有通知吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清空',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
            setNotifications([]);
          }
        },
      ]
    );
  };

  const getTypeInfo = (type) => {
    return NOTIFICATION_TYPES[type] || { icon: 'notifications', color: '#999', label: '通知' };
  };

  const renderNotificationItem = ({ item }) => {
    const typeInfo = getTypeInfo(item.type);
    let data = {};
    try {
      data = item.data ? JSON.parse(item.data) : {};
    } catch (e) {}
    
    return (
      <TouchableOpacity 
        style={styles.notificationItem}
        onPress={() => {
          if (data.momentId) {
            router.push({ 
              pathname: '/(tabs)/moments', 
              params: { 
                scrollToMoment: data.momentId.toString(),
                commentId: data.commentId?.toString() || ''
              } 
            });
          } else {
            router.push('/(tabs)/moments');
          }
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{formatTime(item.created_at)} · {formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {notifications.length > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerCount}>{notifications.length} 条通知</Text>
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearText}>清空</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无通知</Text>
            <Text style={styles.emptySubText}>当AI回复你或点赞时会在这里显示</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerCount: {
    fontSize: 14,
    color: '#666',
  },
  clearText: {
    fontSize: 14,
    color: '#F56C6C',
  },
  list: {
    padding: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
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
});
