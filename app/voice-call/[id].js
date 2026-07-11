import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { executeQuery } from '../../src/database';
import { loadSetting } from '../../src/services/settings';
import { VoiceCallService } from '../../src/services/voice-call';
import { SafeAvatar } from '../../src/components/SafeImage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useRef } from 'react';

export default function VoiceCallScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const aiCharacters = useAppStore((s) => s.aiCharacters);

  const [charName, setCharName] = useState('');
  const [charAvatar, setCharAvatar] = useState('');
  const charInfoRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const serviceRef = useRef(null);
  const timerRef = useRef(null);

  const startCall = () => {
    try {
      const service = new VoiceCallService();
      serviceRef.current = service;

      setState('dialing');
      setErrorMsg(null);

      service.connect(id, {
        onStateChange: (newState) => {
          setState(newState);
          if (newState === 'connected') {
            timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
          }
          if (newState === 'hungup') {
            clearInterval(timerRef.current);
            setTimeout(() => router.back(), 1500);
          }
        },
        onError: (msg) => {
          setErrorMsg(msg);
        },
        charInfo: charInfoRef.current,
      });
    } catch (e) {
      setErrorMsg('加载失败: ' + e.message);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const members = await executeQuery(
          'SELECT member_id FROM conversation_members WHERE conversation_id = ? AND member_type = ?',
          [parseInt(id), 'ai']
        );
        if (members.length > 0) {
          const aiId = members[0].member_id;
          const char = aiCharacters.find(c => c.id === aiId);
          if (char) {
            setCharName(char.name || 'AI伙伴');
            const rawAvatar = char.avatar || '';
            setCharAvatar(rawAvatar.length > 1 ? rawAvatar : '');
            charInfoRef.current = {
              name: char.name || 'AI伙伴',
              description: char.description || '',
              signature: char.signature || '',
            };
          } else {
            setCharName('AI伙伴');
          }
        } else {
          setCharName('AI伙伴');
        }
      } catch (e) {
        console.error('[通话] 加载角色失败:', e);
      }

      const userProfile = await loadSetting('user_profile', {});
      charInfoRef.current = {
        ...(charInfoRef.current || {}),
        userName: userProfile.name || '',
        userGender: userProfile.gender || '',
        userAge: userProfile.age || '',
      };
      setLoaded(true);
    })();
    return () => {
      clearInterval(timerRef.current);
      serviceRef.current?.cleanup();
    };
  }, []);

  const endCall = () => {
    serviceRef.current?.hangup();
    router.back();
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', top: 50, left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
          <Ionicons name="close" size={22} color="#333" />
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <SafeAvatar
            uri={charAvatar}
            size={100}
            name={charName}
            color="#4A90D9"
          />

          <Text style={{ color: '#333', fontSize: 22, fontWeight: '600', marginTop: 16, marginBottom: 4 }}>
            {charName || 'AI伙伴'}
          </Text>

          {state === 'idle' && (
            <Text style={{ color: '#999', fontSize: 14, marginTop: 8, marginBottom: 40, textAlign: 'center' }}>
              点击下方按钮开始语音通话
            </Text>
          )}
          {state === 'dialing' && (
            <Text style={{ color: '#999', fontSize: 15, marginBottom: 40 }}>拨号中...</Text>
          )}
          {state === 'ringing' && (
            <>
              <Ionicons name="phone-portrait-outline" size={28} color="#4A90D9" style={{ marginBottom: 8 }} />
              <Text style={{ color: '#4A90D9', fontSize: 15, marginBottom: 40 }}>等待对方接听...</Text>
            </>
          )}
          {state === 'connected' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#67C23A', marginRight: 6 }} />
                <Text style={{ color: '#67C23A', fontSize: 14 }}>已连接</Text>
              </View>
              <Text style={{ color: '#333', fontSize: 36, fontWeight: '300', fontVariant: ['tabular-nums'], marginBottom: 40 }}>
                {formatTime(duration)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 36 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <View key={i} style={{
                    width: 4, height: 14 + Math.sin(Date.now() / 200 + i * 1.5) * 10,
                    borderRadius: 2, backgroundColor: '#4A90D9',
                  }} />
                ))}
              </View>
            </>
          )}
          {errorMsg && (
            <View style={{ marginTop: 20, padding: 16, backgroundColor: '#fef0f0', borderRadius: 12, alignItems: 'center', maxWidth: 280 }}>
              <Ionicons name="warning" size={22} color="#F56C6C" />
              <Text style={{ color: '#F56C6C', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{errorMsg}</Text>
              <TouchableOpacity
                onPress={startCall}
                style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 24, backgroundColor: '#4A90D9', borderRadius: 20 }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>重试</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ paddingBottom: 50, alignItems: 'center' }}>
          {state === 'idle' ? (
            <TouchableOpacity
              onPress={startCall}
              style={{
                width: 68, height: 68, borderRadius: 34,
                backgroundColor: '#67C23A', justifyContent: 'center', alignItems: 'center',
                shadowColor: '#67C23A', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
              }}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={endCall}
              style={{
                width: 68, height: 68, borderRadius: 34,
                backgroundColor: '#F56C6C', justifyContent: 'center', alignItems: 'center',
                shadowColor: '#F56C6C', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
              }}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          )}
          <Text style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            {state === 'idle' ? '拨号' : '挂断'}
          </Text>
        </View>
      </View>
    </>
  );
}
