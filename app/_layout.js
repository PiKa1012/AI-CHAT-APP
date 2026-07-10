import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { getDatabase } from '../src/database';
import { useAppStore } from '../src/stores';
import { registerForPushNotifications, addNotificationListener, addNotificationResponseListener } from '../src/services/notification';
import { startScheduler, executeScheduledTask } from '../src/services/scheduler';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setupGlobalErrorHandler, logInfo } from '../src/utils/logger';
import MusicPlayer from '../src/components/MusicPlayer';

export default function RootLayout() {
  const router = useRouter();
  const loadAICharacters = useAppStore(s => s.loadAICharacters);
  const loadConversations = useAppStore(s => s.loadConversations);
  const loadMoments = useAppStore(s => s.loadMoments);
  const loadScheduledTasks = useAppStore(s => s.loadScheduledTasks);

  useEffect(() => {
    initApp();
    return () => {
    };
  }, []);

  async function initApp() {
    setupGlobalErrorHandler();
    logInfo('App', '应用启动');
    
    await getDatabase();
    await loadAICharacters();
    await loadConversations();
    await loadMoments();
    await loadScheduledTasks();

    await registerForPushNotifications();
    startScheduler();

    addNotificationListener(notification => {
      // console.log('通知收到:', notification);
    });

    addNotificationResponseListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.taskId) {
        await executeScheduledTask(data.taskId);
      }
    });
    
    logInfo('App', '应用初始化完成');
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#333',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="chat/[id]" 
          options={{ 
            title: '聊天',
            headerShown: true,
          }} 
        />
        <Stack.Screen name="ai-manage" options={{ title: 'AI管理' }} />
        <Stack.Screen name="api-settings/index" options={{ title: 'API 设置' }} />
        <Stack.Screen name="api-settings/model" options={{ title: 'AI 模型' }} />
        <Stack.Screen name="api-settings/features" options={{ title: 'AI 功能' }} />
        <Stack.Screen name="api-settings/voice" options={{ title: '语音' }} />
        <Stack.Screen name="api-settings/services" options={{ title: '第三方服务' }} />
        <Stack.Screen name="scheduled-tasks" options={{ title: '定时任务' }} />
        <Stack.Screen name="emoji-manage" options={{ title: '表情包管理' }} />
        <Stack.Screen name="profile" options={{ title: '我的资料' }} />
        <Stack.Screen name="chat-background" options={{ title: '聊天背景' }} />
        <Stack.Screen name="chat-history" options={{ title: '聊天记录搜索' }} />
        <Stack.Screen name="chat-detail-history" options={{ title: '聊天历史' }} />
        <Stack.Screen name="group-settings" options={{ title: '群聊设置' }} />
        <Stack.Screen name="log-viewer" options={{ title: '操作日志' }} />
        <Stack.Screen name="storage-manage" options={{ title: '存储管理' }} />
        <Stack.Screen name="emoji-settings" options={{ title: '表情设置' }} />
        <Stack.Screen name="ai-mood" options={{ title: 'AI情绪' }} />
        <Stack.Screen name="ai-profile" options={{ title: 'AI资料' }} />
        <Stack.Screen name="memory-manage" options={{ title: '记忆管理' }} />
        <Stack.Screen name="notifications" options={{ title: '通知中心' }} />
        <Stack.Screen name="moment-detail" options={{ title: '动态详情' }} />
        <Stack.Screen name="diary-detail" options={{ title: '日记详情' }} />
        <Stack.Screen name="moment-feed" options={{ title: '动态' }} />
        <Stack.Screen name="map-debug" options={{ title: '地图调试' }} />
        <Stack.Screen name="usage-stats" options={{ title: 'API用量' }} />
        <Stack.Screen name="about" options={{ title: '关于' }} />
        <Stack.Screen name="wechat-connect" options={{ title: '微信绑定' }} />
      </Stack>
      <MusicPlayer />
    </View>
  );
}
