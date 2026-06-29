import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { executeQuery, executeInsert, executeUpdate } from '../database';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: '消息通知',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return true;
}

export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null,
  });

  const persistableTypes = ['like', 'comment', 'reply', 'moment'];
  if (persistableTypes.includes(data.type)) {
    try {
      await executeInsert(
        'INSERT INTO notifications (title, body, type, data) VALUES (?, ?, ?, ?)',
        [title, body, data.type, JSON.stringify(data)]
      );
    } catch (e) {
      console.warn('保存通知失败:', e);
    }
  }
}

export async function getUnreadCount() {
  try {
    const result = await executeQuery('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
    return result[0]?.count || 0;
  } catch (e) {
    return 0;
  }
}

export async function getAllNotifications() {
  return await executeQuery('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
}

export async function markAllAsRead() {
  await executeUpdate('UPDATE notifications SET is_read = 1');
}

export async function clearAllNotifications() {
  await executeUpdate('DELETE FROM notifications');
}

export async function sendDelayedNotification(title, body, delaySeconds, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: {
      seconds: delaySeconds,
    },
  });
}

export function addNotificationListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
