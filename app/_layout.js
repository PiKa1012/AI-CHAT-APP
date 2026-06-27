import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { getDatabase } from '../src/database';
import { useAppStore } from '../src/stores';
import { registerForPushNotifications, addNotificationListener, addNotificationResponseListener } from '../src/services/notification';
import { startScheduler } from '../src/services/scheduler';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setupGlobalErrorHandler, logInfo } from '../src/utils/logger';

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
    });

    addNotificationResponseListener(response => {
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
        <Stack.Screen name="api-settings" options={{ title: 'API设置' }} />
        <Stack.Screen name="scheduled-tasks" options={{ title: '定时任务' }} />
        <Stack.Screen name="emoji-manage" options={{ title: '表情包管理' }} />
        <Stack.Screen name="profile" options={{ title: '我的资料' }} />
        <Stack.Screen name="chat-background" options={{ title: '聊天背景' }} />
        <Stack.Screen name="voice-settings" options={{ title: '语音设置' }} />
        <Stack.Screen name="chat-history" options={{ title: '聊天记录搜索' }} />
        <Stack.Screen name="chat-detail-history" options={{ title: '聊天历史' }} />
        <Stack.Screen name="auto-post-settings" options={{ title: '自动发布设置' }} />
        <Stack.Screen name="group-settings" options={{ title: '群聊设置' }} />
        <Stack.Screen name="log-viewer" options={{ title: '操作日志' }} />
        <Stack.Screen name="storage-manage" options={{ title: '存储管理' }} />
        <Stack.Screen name="emoji-settings" options={{ title: '表情设置' }} />
        <Stack.Screen name="ai-mood" options={{ title: 'AI情绪' }} />
        <Stack.Screen name="ai-profile" options={{ title: 'AI资料' }} />
        <Stack.Screen name="memory-manage" options={{ title: '记忆管理' }} />
      </Stack>
    </View>
  );
}
