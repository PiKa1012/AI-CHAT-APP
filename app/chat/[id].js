import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Image, ScrollView, Alert, Pressable } from 'react-native';
import { styles } from '../../src/components/chat/styles';
import { useLocalSearchParams, useFocusEffect, useNavigation, router } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { getAIResponse, getGroupAIResponse, findMentionedAI, analyzeImage, aiAutoPostMoment } from '../../src/services/ai';
import { generateDiary } from '../../src/services/diary';
import { generateChatImage, isImageGenerationRequest, extractImageDescription } from '../../src/services/imageGen';
import { detectAndCreateTask, getTaskTypeName } from '../../src/services/taskDetector';
import { speakText, stopSpeaking, isSpeaking } from '../../src/services/voice';
import { sendLocalNotification } from '../../src/services/notification';
import { getEmojiPacks } from '../../src/services/emoji';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { HmacSHA256, enc } from 'crypto-js';
import { useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { loadSetting } from '../../src/services/settings';
import { getBubbleSkin } from '../../src/services/bubbleSkins';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { copyToAppStorage } from '../../src/services/media';
import { formatTime } from '../../src/utils/time';
import { SafeAvatar } from '../../src/components/SafeImage';
import { EmojiPanel } from '../../src/components/chat/EmojiPanel';
import { MusicSearchModal } from '../../src/components/chat/MusicSearchModal';
import { searchSongs, getSongUrl, extractMusicKeyword } from '../../src/services/netease';
import { useMusicPlayer } from '../../src/stores/musicPlayer';
import { detectMapIntent, searchNearby, searchByKeyword, getRoute, getWeather, getAddressFromLocation, getLocationFromAddress, getCurrentLocation, extractCity, extractLocation } from '../../src/services/map';
import { executeQuery } from '../../src/database';




const RECORDING_OPTIONS = {
  android: {
    extension: '.amr',
    outputFormat: Audio.AndroidOutputFormat.AMR_NB,
    audioEncoder: Audio.AndroidAudioEncoder.AMR_NB,
    sampleRate: 8000,
    numberOfChannels: 1,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const messages = useAppStore(s => s.messages);
  const loadMessages = useAppStore(s => s.loadMessages);
  const loadMoreMessages = useAppStore(s => s.loadMoreMessages);
  const sendMessage = useAppStore(s => s.sendMessage);
  const markConversationAsRead = useAppStore(s => s.markConversationAsRead);
  const conversations = useAppStore(s => s.conversations);
  const loadConversations = useAppStore(s => s.loadConversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiPacks, setEmojiPacks] = useState([]);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '我', avatar: null });
  const [chatBg, setChatBg] = useState({ id: 'default', color: '#f5f5f5', image: null });
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState(null);
  const [imageComment, setImageComment] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [bubbleSkin, setBubbleSkin] = useState('default');
  const [customBubble, setCustomBubble] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingEmoji, setPendingEmoji] = useState(null);
  const [showNewMessageHint, setShowNewMessageHint] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const playSong = useMusicPlayer(s => s.playSong);
  const flatListRef = useRef(null);
  const isAtBottom = useRef(true);
  const lastContentHeight = useRef(0);

  const conversation = conversations.find(c => c.id === parseInt(id));
  const [voiceCallEnabled, setVoiceCallEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const recordingRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const soundRef = useRef(null);
  const recStatusRef = useRef('idle');
  const startRecPromiseRef = useRef(null);

  useEffect(() => {
    (async () => {
      const settings = await loadSetting('api_settings', {});
      setVoiceCallEnabled(settings.enableVoiceCall || false);
    })();
  }, []);

  useLayoutEffect(() => {
    if (conversation) {
      navigation.setOptions({
        title: conversation.name || '聊天',
      });
    }
  }, [conversation, navigation]);

  useEffect(() => {
    if (id) {
      loadMessages(parseInt(id));
      markConversationAsRead(parseInt(id));
    }
    loadEmojiPacks();
    loadUserProfile();
    if (conversation?.type === 'group') {
      loadGroupMembers();
    }
  }, [id]);

  useEffect(() => {
    if (id && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender_type === 'ai' && lastMsg.conversation_id === parseInt(id) && !lastMsg.is_read) {
        markConversationAsRead(parseInt(id));
      }
    }
  }, [messages.length]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadChatBackground();
        loadConversations();
        loadUserProfile();
        loadEmojiPacks();
        loadBubbleSkin();
      }
    }, [id])
  );

  const handleLoadEarlier = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    setIsLoadingMore(true);
    try {
      const count = await loadMoreMessages(parseInt(id));
      if (count === 0) {
        setHasMoreMessages(false);
      }
    } catch (e) {}
    setIsLoadingMore(false);
  };

  const loadEmojiPacks = async () => {
    const packs = await getEmojiPacks();
    setEmojiPacks(packs);
  };

  const loadUserProfile = async () => {
    try {
      const data = await loadSetting('user_profile', {});
      if (data) {
        setUserProfile({
          name: data.name || '我',
          avatar: data.avatar || null,
        });
      }
    } catch (e) {}
  };

  const loadChatBackground = async () => {
    try {
      const data = await loadSetting(`chat_bg_${id}`, { id: 'default', color: '#f5f5f5', image: null });
      if (data) {
        setChatBg(data);
      }
    } catch (e) {}
  };

  const loadBubbleSkin = async () => {
    try {
      const skinId = await loadSetting('bubble_skin', 'default');
      setBubbleSkin(skinId);
      if (skinId === 'custom') {
        const c = await loadSetting('bubble_custom_colors', { userBg: '#95EC69', userText: '#000', userTime: 'rgba(0,0,0,0.4)', aiBg: '#fff', aiText: '#333', aiTime: '#999' });
        setCustomBubble(c);
      } else {
        setCustomBubble(null);
      }
    } catch (e) {}
  };

  const loadGroupMembers = async () => {
    const members = await executeQuery(
      'SELECT * FROM conversation_members WHERE conversation_id = ?',
      [parseInt(id)]
    );
    const memberAIs = members.map(m => {
      const ai = aiCharacters.find(a => a.id === m.member_id);
      return ai ? { ...ai, memberType: m.member_type } : null;
    }).filter(Boolean);
    setGroupMembers(memberAIs);
  };

  const handleScroll = (event) => {
    const { contentOffset } = event.nativeEvent;
    const atBottom = contentOffset.y <= 50;
    isAtBottom.current = atBottom;
    if (atBottom) setShowNewMessageHint(false);
  };

  const handleContentSizeChange = useCallback((_, height) => {
    if (height <= lastContentHeight.current) return;
    lastContentHeight.current = height;

    if (!isReady) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
          setIsReady(true);
        }, 150);
      });
      return;
    }

    if (isAtBottom.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;
    if (messages.length > 0 && !isAtBottom.current) {
      setShowNewMessageHint(true);
    }
  }, [messages.length, isReady]);

  const handleSendImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
      });

      if (result.canceled) return;

      const tempUri = result.assets[0].uri;
      const permanentUri = await copyToAppStorage(tempUri, 'chat_images');
      
      if (permanentUri) {
        setPendingImage(permanentUri);
      } else {
        setPendingImage(tempUri);
      }
      setPendingEmoji(null);
      setShowMoreMenu(false);
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '选择图片失败');
    }
  };

  const handleConfirmSendImage = async () => {
    if (!previewImageUri) return;

    await sendMessage(parseInt(id), 'user', 1, previewImageUri, 'image');
    setShowImagePreview(false);

    const commentText = imageComment.trim();
    if (commentText) {
      await sendMessage(parseInt(id), 'user', 1, commentText);
    }

    const settings = await loadSetting('api_settings', {});
    if (settings?.enableImageRecognition && settings?.visionModelName) {
      setIsTyping(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(previewImageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const description = await analyzeImage(base64, '请用中文描述这张图片的内容');
        
        if (conversation?.type === 'private') {
          const members = await getConversationMembers();
          if (members.length > 0) {
            const aiId = members[0].member_id;
            const prompt = commentText 
              ? `[用户发送了一张图片并说：${commentText}，图片内容：${description}]`
              : `[用户发送了一张图片，内容：${description}]`;
            const response = await getAIResponse(aiId, prompt);
            await sendAIResponse(aiId, response.text);
          }
        }
      } catch (error) {
        console.error('图片识别失败:', error.message || error);
        Alert.alert('图片识别失败', error.message || '请检查视觉模型配置');
      }
      setIsTyping(false);
    }

    setPreviewImageUri(null);
    setImageComment('');
  };

  const handleSend = async (text = null) => {
    const messageText = text || inputText.trim();
    
    if (pendingImage) {
      await sendMessage(parseInt(id), 'user', 1, pendingImage, 'image');
      if (messageText) {
        await sendMessage(parseInt(id), 'user', 1, messageText);
      }
      const imageUri = pendingImage;
      setPendingImage(null);
      setInputText('');
      
      const settings = await loadSetting('api_settings', {});
      setIsTyping(true);
      try {
        let imageDesc = '用户发送了一张图片';
        
        if (settings?.enableImageRecognition && settings?.visionModelName) {
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          imageDesc = await analyzeImage(base64, '请用中文描述这张图片的内容');
        }

        const prompt = messageText 
          ? `[用户发送了一张图片并说：${messageText}，图片内容：${imageDesc}]`
          : `[用户发送了一张图片，内容：${imageDesc}]`;

        if (conversation?.type === 'private') {
          const members = await getConversationMembers();
          if (members.length > 0) {
            const aiId = members[0].member_id;
            const recentMessages = messages.slice(-50);
            const response = await getAIResponse(aiId, prompt, recentMessages);
            await sendAIResponse(aiId, response.text);
          }
        } else {
          const members = await getConversationMembers();
          const memberAIs = members.map(m => aiCharacters.find(a => a.id === m.member_id)).filter(Boolean);
          if (memberAIs.length > 0) {
            const randomAI = memberAIs[Math.floor(Math.random() * memberAIs.length)];
            const recentMessages = messages.slice(-50);
            const response = await getGroupAIResponse(randomAI.id, [...recentMessages, { sender_type: 'user', sender_id: 1, content: prompt }], memberAIs);
            await sendAIResponse(randomAI.id, response.text);
          }
        }
      } catch (error) {
        console.error('图片处理失败:', error);
      }
      setIsTyping(false);
      return;
    }

    if (pendingEmoji) {
      await sendMessage(parseInt(id), 'user', 1, pendingEmoji, 'emoji');
      setPendingEmoji(null);
      
      const emojiText = messageText || '[表情]';
      if (messageText) {
        await sendMessage(parseInt(id), 'user', 1, messageText);
      }
      setInputText('');

      try {
        if (conversation?.type === 'private') {
          const members = await getConversationMembers();
          if (members.length > 0) {
            setIsTyping(true);
            const aiId = members[0].member_id;
            const recentMessages = messages.slice(-50);
            const response = await getAIResponse(aiId, emojiText, recentMessages);
            await sendAIResponse(aiId, response.text);
            setIsTyping(false);
          }
        } else {
          const members = await getConversationMembers();
          const memberAIs = members.map(m => aiCharacters.find(a => a.id === m.member_id)).filter(Boolean);
          if (memberAIs.length > 0) {
            setIsTyping(true);
            const randomAI = memberAIs[Math.floor(Math.random() * memberAIs.length)];
            const recentMessages = messages.slice(-20);
            const response = await getGroupAIResponse(randomAI.id, [...recentMessages, { sender_type: 'user', sender_id: 1, content: emojiText }], memberAIs);
            await sendAIResponse(randomAI.id, response.text);
            setIsTyping(false);
          }
        }
      } catch (error) {
        setIsTyping(false);
        console.error('AI回复失败:', error);
      }
      return;
    }

    if (!messageText) return;

    setInputText('');
    setShowEmoji(false);

    await sendMessage(parseInt(id), 'user', 1, messageText);

    const settings = await loadSetting('api_settings', {});

    const members = await getConversationMembers();
    const aiId = members[0]?.member_id;

    const musicKeyword = extractMusicKeyword(messageText);
    if (musicKeyword && settings?.enableMusic && aiId) {
      setIsTyping(true);
      try {
        const results = await searchSongs(musicKeyword, 5);
        if (results.length > 0) {
          await sendMessage(parseInt(id), 'ai', aiId, `找到以下「${musicKeyword}」相关歌曲：`);
          await sendMessage(parseInt(id), 'ai', aiId, JSON.stringify(results), 'music_list');
        } else {
          await sendMessage(parseInt(id), 'ai', aiId, `没找到「${musicKeyword}」相关歌曲`);
        }
      } catch (error) {
        await sendMessage(parseInt(id), 'ai', aiId, `搜索音乐失败：${error.message}`);
      }
      setIsTyping(false);
      return;
    }
    
    if (aiId) {
      try {
        const taskResult = await detectAndCreateTask(aiId, messageText);
        if (taskResult?.created) {
          const taskName = getTaskTypeName(taskResult.taskType);
          const repeatText = taskResult.repeatType === 'once' ? '' : '每天';
          await sendMessage(parseInt(id), 'ai', aiId, `好的，已设置${repeatText}${taskResult.scheduleTime}${taskName}~`);
          setIsTyping(false);
          return;
        }
      } catch (error) {
        console.warn('检测定时任务超时，跳过');
      }
    }
    
    if (messageText.match(/发.*朋友圈/) && aiId) {
      setIsTyping(true);
      try {
        const todayStart = new Date();
        todayStart.setHours(todayStart.getHours() + 8);
        const todayStr = todayStart.toISOString().slice(0, 10);
        const todayMessages = messages.filter(m => {
          const d = new Date(m.created_at);
          d.setHours(d.getHours() + 8);
          return d.toISOString().slice(0, 10) === todayStr;
        });
        const result = await aiAutoPostMoment(aiId, messageText, todayMessages);
        const ai = aiCharacters.find(a => a.id === aiId);
        const fallbacks = [
          '发了条朋友圈~',
          '去朋友圈看看吧，刚发的~',
          '发了一条新动态~',
          '发朋友圈啦，去看看~',
          '刚发了一条朋友圈，快来点赞~',
          '发朋友圈了，快来瞧瞧~',
        ];
        await sendMessage(parseInt(id), 'ai', aiId, result?.reply || fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      } catch (error) {
        await sendMessage(parseInt(id), 'ai', aiId, `发朋友圈失败了：${error.message}`);
      }
      setIsTyping(false);
      return;
    }

    if (messageText.match(/写.*日记|日记/) && aiId) {
      setIsTyping(true);
      try {
        await generateDiary(aiId);
        const ai = aiCharacters.find(a => a.id === aiId);
        await sendMessage(parseInt(id), 'ai', aiId, '写好今天的日记啦，去日记页看看吧~');
      } catch (error) {
        await sendMessage(parseInt(id), 'ai', aiId, `写日记失败了：${error.message}`);
      }
      setIsTyping(false);
      return;
    }

    const mapIntent = detectMapIntent(messageText);
    if (mapIntent && settings?.enableMap && settings?.amapApiKey) {
      setIsTyping(true);
      try {
        const ipInfo = await getCurrentLocation();
        let text = '';
        const senderId = aiId || 1;

        if (mapIntent === 'nearby_food' || mapIntent === 'nearby_place' || mapIntent === 'recommend') {
          const keyword = mapIntent === 'nearby_place' ? '厕所|医院|药店' : mapIntent === 'nearby_food' ? '美食|餐厅|小吃' : '景点|公园|好玩';
          const pois = ipInfo.location
            ? await searchNearby(ipInfo.location, keyword)
            : await searchByKeyword(keyword, ipInfo.city);
          if (pois.length > 0) {
            const names = pois.slice(0, 5).map((p, i) => `${i+1}. ${p.name}${p.distance ? `（${Math.round(parseInt(p.distance))}m）` : ''}`).join('\n');
            text = `附近找到以下地点：\n${names}`;
          } else {
            text = '附近没找到相关地点';
          }
        } else if (mapIntent === 'weather') {
          const city = extractCity(messageText) || ipInfo.city;
          const forecasts = await getWeather(city);
          if (forecasts.length > 0) {
            const f = forecasts[0];
            text = `${city}天气：\n白天：${f.dayWeather}，${f.dayTemp}°C\n夜间：${f.nightWeather}，${f.nightTemp}°C`;
          } else {
            text = '获取天气失败';
          }
        } else if (mapIntent === 'location') {
          if (ipInfo.location) {
            const addr = await getAddressFromLocation(ipInfo.location);
            text = `你当前在：${addr.address || ipInfo.city}`;
          } else if (ipInfo.city) {
            text = `你当前在：${ipInfo.province} ${ipInfo.city}`;
          } else {
            text = '获取位置失败';
          }
        } else if (mapIntent === 'route') {
          const locations = extractLocation(messageText);
          if (locations.length >= 2) {
            try {
              const [originName, destName] = locations;
              const [originGeo, destGeo] = await Promise.all([
                getLocationFromAddress(originName, ipInfo.city),
                getLocationFromAddress(destName, ipInfo.city),
              ]);
              const originLoc = originGeo.geocodes?.[0]?.location;
              const destLoc = destGeo.geocodes?.[0]?.location;
                if (originLoc && destLoc) {
                const route = await getRoute(originLoc, destLoc, 'driving', ipInfo.city);
                text = `从${originName}到${destName}：\n距离：${(route.distance / 1000).toFixed(1)}km\n预计：${Math.round(parseInt(route.duration) / 60)}分钟\n\n${route.steps.slice(0, 8).join('\n')}`;
              } else {
                text = '无法定位到起终点，请提供更具体的地名';
              }
            } catch (e) {
              text = `路线查询失败：${e.message}`;
            }
          } else {
            text = '请提供起终点，例如「从西湖到灵隐寺怎么走」';
          }
        }

        await sendMessage(parseInt(id), 'ai', senderId, text);
      } catch (e) {
        await sendMessage(parseInt(id), 'ai', aiId || 1, `地图查询失败：${e.message}`);
      }
      setIsTyping(false);
      return;
    }

    if (settings?.enableImageGen && settings?.enableChatImage && isImageGenerationRequest(messageText)) {
      setIsTyping(true);
      try {
        const imageDesc = extractImageDescription(messageText);
        const imagePath = await generateChatImage(imageDesc);
        if (imagePath) {
          const aiId = conversation?.type === 'private' 
            ? (await getConversationMembers())[0]?.member_id 
            : null;
          const senderId = aiId || 1;
          await sendMessage(parseInt(id), 'ai', senderId, imagePath, 'image');
          await sendMessage(parseInt(id), 'ai', senderId, `给你画了：${imageDesc}`);
        }
      } catch (error) {
        console.error('生图失败:', error);
        Alert.alert('生图失败', error.message || '请检查生图API配置');
      }
      setIsTyping(false);
      return;
    }

    try {
      if (conversation?.type === 'private') {
        const members = await getConversationMembers();
        if (members.length > 0) {
          setIsTyping(true);
          const aiId = members[0].member_id;
          const recentMessages = messages.slice(-50);
          const response = await getAIResponse(aiId, messageText, recentMessages);
          await sendAIResponse(aiId, response.text);
          if (response.emoji) {
            await sendMessage(parseInt(id), 'ai', aiId, response.emoji, 'emoji');
          }
          setIsTyping(false);

          setImmediate(async () => {
            const todayUserMsgs = messages.filter(m => {
              if (m.sender_type !== 'user') return false;
              const d = new Date(m.created_at);
              d.setHours(d.getHours() + 8);
              return d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
            });
            if (todayUserMsgs.length >= 5 && todayUserMsgs.length % 5 === 0) {
              try { await generateDiary(aiId); } catch (e) {}
            }
          });

          const ai = aiCharacters.find(a => a.id === aiId);
          await sendLocalNotification(
            ai?.name || 'AI',
            response.text,
            { type: 'message', conversationId: parseInt(id) }
          );
        }
      } else {
        const members = await getConversationMembers();
        const memberAIs = members.map(m => aiCharacters.find(a => a.id === m.member_id)).filter(Boolean);
        
        const mentionedAIs = findMentionedAI(messageText, memberAIs);
        const recentMessages = messages.slice(-20);
        
        setIsTyping(true);
        
        const getAIResponseWithDelay = async (ai, msgs) => {
          const delay = Math.random() * 1500 + 500;
          await new Promise(resolve => setTimeout(resolve, delay));
          const response = await getGroupAIResponse(ai.id, msgs, memberAIs);
          await sendAIResponse(ai.id, response.text);
          if (response.emoji) {
            await sendMessage(parseInt(id), 'ai', ai.id, response.emoji, 'emoji');
          }
          return response;
        };

        if (mentionedAIs.length > 0) {
          let allMessages = [...recentMessages, { sender_type: 'user', sender_id: 1, content: messageText }];
          
          for (const ai of mentionedAIs) {
            const response = await getAIResponseWithDelay(ai, allMessages);
            allMessages.push({ sender_type: 'ai', sender_id: ai.id, content: response.text });
          }
          
          if (mentionedAIs.length >= 2) {
            const shouldContinue = Math.random() < 0.6;
            if (shouldContinue) {
              const otherAIs = memberAIs.filter(ai => !mentionedAIs.find(m => m.id === ai.id));
              if (otherAIs.length > 0) {
                const randomAI = otherAIs[Math.floor(Math.random() * otherAIs.length)];
                const response = await getAIResponseWithDelay(randomAI, allMessages);
                allMessages.push({ sender_type: 'ai', sender_id: randomAI.id, content: response.text });
              }
            }
          }
        } else {
          const randomMember = memberAIs[Math.floor(Math.random() * memberAIs.length)];
          if (randomMember) {
            let allMessages = [...recentMessages, { sender_type: 'user', sender_id: 1, content: messageText }];
            const response = await getAIResponseWithDelay(randomMember, allMessages);
            allMessages.push({ sender_type: 'ai', sender_id: randomMember.id, content: response.text });
            
            const shouldContinue = Math.random() < 0.4;
            if (shouldContinue) {
              const otherAIs = memberAIs.filter(ai => ai.id !== randomMember.id);
              if (otherAIs.length > 0) {
                const nextAI = otherAIs[Math.floor(Math.random() * otherAIs.length)];
                await getAIResponseWithDelay(nextAI, allMessages);
              }
            }
          }
        }
        
        setIsTyping(false);
      }
    } catch (error) {
      setIsTyping(false);
      Alert.alert('发送失败', error.message || '无法获取AI回复，请检查API设置');
    }
  };

  const handleMusicPlay = async (song) => {
    if (!song.url) {
      try {
        const url = await getSongUrl(song.id);
        if (url) {
          song = { ...song, url };
        }
      } catch (e) {
        Alert.alert('播放失败', '无法获取播放链接');
        return;
      }
    }
    await playSong(song);
  };

  const handleSendMusicResult = async (results) => {
    if (results.length === 0) return;
    const convMembers = await getConversationMembers();
    const aiId = convMembers[0]?.member_id || aiCharacters[0]?.id || 1;
    await sendMessage(parseInt(id), 'ai', aiId, JSON.stringify(results), 'music_list');
    setShowMusicSearch(false);
  };

  const handleEmojiSelect = async (emoji) => {
    setPendingEmoji(emoji.image_uri);
    setPendingImage(null);
    setShowEmoji(false);
  };

  const startRecording = async () => {
    if (recStatusRef.current !== 'idle') return;
    recStatusRef.current = 'starting';
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        recStatusRef.current = 'idle';
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      recStatusRef.current = 'recording';
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      recStatusRef.current = 'idle';
      recordingRef.current = null;
      Alert.alert('录音失败', e.message);
    }
  };

  const stopRecording = async (send = true) => {
    if (recStatusRef.current !== 'recording') return;
    recStatusRef.current = 'stopping';
    const rec = recordingRef.current;
    recordingRef.current = null;
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    if (!send || recordingDuration < 1) {
      try { await rec.stopAndUnloadAsync(); } catch {}
      recStatusRef.current = 'idle';
      return;
    }
    try {
      const uri = rec.getURI();
      await rec.stopAndUnloadAsync();
      if (!uri) { recStatusRef.current = 'idle'; return; }
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('[语音] 录音原始文件:', uri, '存在:', fileInfo.exists, '大小:', fileInfo.size);
      const mins = Math.floor(recordingDuration / 60);
      const secs = recordingDuration % 60;
      const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      const fileName = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.amr`;
      const destPath = `${FileSystem.documentDirectory}voice_messages/${fileName}`;
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}voice_messages/`, { intermediates: true });
      await FileSystem.copyAsync({ from: uri, to: destPath });
      const destInfo = await FileSystem.getInfoAsync(destPath);
      console.log('[语音] 复制到:', destPath, '存在:', destInfo.exists, '大小:', destInfo.size);
      await sendMessage(parseInt(id), 'user', 1, durationStr, 'audio', destPath);

      const transcribed = await transcribeAudio(destPath);
      const userText = transcribed || '[语音消息]';

      setIsTyping(true);
      try {
        if (conversation?.type === 'private') {
          const members = await getConversationMembers();
          if (members.length > 0) {
            const aiId = members[0].member_id;
            const recentMessages = messages.slice(-50);
            const response = await getAIResponse(aiId, userText, recentMessages);
            await sendAIResponse(aiId, response.text);
          }
        } else {
          const members = await getConversationMembers();
          const memberAIs = members.map(m => aiCharacters.find(a => a.id === m.member_id)).filter(Boolean);
          if (memberAIs.length > 0) {
            const randomAI = memberAIs[Math.floor(Math.random() * memberAIs.length)];
            const recentMessages = messages.slice(-20);
            const prompt = transcribed ? userText : '[语音消息]';
            const response = await getGroupAIResponse(randomAI.id, [...recentMessages, { sender_type: 'user', sender_id: 1, content: prompt }], memberAIs);
            await sendAIResponse(randomAI.id, response.text);
          }
        }
      } catch (e) {
        console.error('AI回复语音失败:', e);
      }
      setIsTyping(false);
    } catch (e) {
      console.error('停止录音失败:', e?.message || e);
    }
    recStatusRef.current = 'idle';
  };

  const playVoiceMessage = async (messageId, uri) => {
    console.log('[播放] 请求播放, uri:', uri, 'messageId:', messageId);
    if (!uri) { console.log('[播放] uri为空'); return; }
    const info = await FileSystem.getInfoAsync(uri);
    console.log('[播放] 文件存在:', info.exists, '大小:', info.size);
    if (playingAudioId === messageId) {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlayingAudioId(null);
          return;
        }
      }
    }
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingAudioId(messageId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e) {
      console.error('播放语音失败:', e);
      Alert.alert('播放失败', '无法播放该语音消息');
    }
  };

  const sendAIResponse = async (aiId, text) => {
    if (!text) return;
    const settings = await loadSetting('api_settings', {});
    if (settings.enableAIVoiceMsg && Math.random() * 100 < (settings.aiVoiceMsgFrequency || 30)) {
      await generateAIVoiceMessage(aiId, text);
    } else {
      await sendMessage(parseInt(id), 'ai', aiId, text);
    }
  };

  const transcribeAudio = async (audioUri) => {
    try {
      const settings = await loadSetting('api_settings', {});
      const { xfAppId, xfApiKey, xfApiSecret } = settings;
      if (!xfAppId || !xfApiKey) return null;

      const base64 = await FileSystem.readAsStringAsync(audioUri, { encoding: FileSystem.EncodingType.Base64 });
      const binaryStr = atob(base64);
      const amrData = binaryStr.startsWith('#!AMR\n') ? binaryStr.slice(6) : binaryStr;
      const amrBase64 = btoa(amrData);
      console.log('[转写] AMR 数据长度:', amrBase64.length);

      const result = await new Promise((resolve) => {
        let fullText = '';
        const timer = setTimeout(() => { console.log('[转写] 超时'); resolve(fullText); }, 8000);

        const host = 'iat-api.xfyun.cn';
        const date = new Date().toUTCString();
        const signStr = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
        const sig = HmacSHA256(signStr, xfApiSecret).toString(enc.Base64);
        const auth = btoa(`api_key="${xfApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${sig}"`);
        const url = `wss://${host}/v2/iat?authorization=${encodeURIComponent(auth)}&date=${encodeURIComponent(date)}&host=${host}`;

        const ws = new WebSocket(url);
        ws.onopen = () => {
          ws.send(JSON.stringify({
            common: { app_id: xfAppId },
            business: { language: 'zh_cn', domain: 'iat', accent: 'mandarin', vad_eos: 2000, dwa: 'wpgs', pd: 'game', ptt: 1 },
            data: { status: 0, format: 'audio/amr;rate=8000', encoding: 'amr', audio: '' },
          }));
          const raw = atob(amrBase64);
          const chunkSize = 1280;
          for (let i = 0; i < raw.length; i += chunkSize) {
            const chunk = btoa(raw.slice(i, i + chunkSize));
            ws.send(JSON.stringify({ data: { status: 1, format: 'audio/amr;rate=8000', encoding: 'amr', audio: chunk } }));
          }
          ws.send(JSON.stringify({ data: { status: 2, format: 'audio/amr;rate=8000', encoding: 'amr', audio: '' } }));
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.code !== 0) { console.log('[转写] ASR错误:', msg.code, msg.message); clearTimeout(timer); resolve(fullText); return; }
            if (msg.data?.result) {
              const text = msg.data.result.ws?.map(w => w.cw?.map(c => c.w).join('')).join('') || '';
              fullText += text;
              if (msg.data.result.pgs === 'rpl') { clearTimeout(timer); resolve(fullText); ws.close(); }
            }
          } catch {}
        };
        ws.onerror = () => { clearTimeout(timer); resolve(fullText); };
      });
      console.log('[转写] 结果:', result);
      return result || null;
    } catch (e) { return null; }
  };

  const generateAIVoiceMessage = async (aiId, text) => {
    if (!text || text.length < 2) return;
    try {
      const settings = await loadSetting('api_settings', {});
      const voiceSettings = await loadSetting('voice_settings', {});
      const ai = aiCharacters.find(a => a.id === aiId);
      const { xfAppId, xfApiKey, xfApiSecret } = settings;
      if (!xfAppId || !xfApiKey || !xfApiSecret) return;

      const voiceId = ai?.voice_id || voiceSettings.voiceId || 'xiaoyan';
      const voiceMap = { 'edge-xiaoxiao': 'xiaoyan', 'edge-yunxi': 'aisjiuxu', 'xiaoyan': 'xiaoyan', 'aisjiuxu': 'aisjiuxu' };
      const voice = voiceMap[voiceId] || 'xiaoyan';

      const result = await new Promise((resolve, reject) => {
        const host = 'tts-api.xfyun.cn';
        const date = new Date().toUTCString();
        const signStr = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
        const sig = HmacSHA256(signStr, xfApiSecret).toString(enc.Base64);
        const auth = btoa(`api_key="${xfApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${sig}"`);
        const url = `wss://${host}/v2/tts?authorization=${encodeURIComponent(auth)}&date=${encodeURIComponent(date)}&host=${host}`;

        const ws = new WebSocket(url);
        const chunks = [];

        ws.onopen = () => {
          const textBase64 = btoa(unescape(encodeURIComponent(text)));
          ws.send(JSON.stringify({
            common: { app_id: xfAppId },
            business: { aue: 'lame', sfl: 1, auf: 'audio/L16;rate=16000', vcn: voice, speed: 50, volume: 50, pitch: 50, tte: 'utf8' },
            data: { text: textBase64, status: 2 },
          }));
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.code !== 0) { console.log('[AI语音] 讯飞错误:', msg.code, msg.message); ws.close(); resolve(null); return; }
            if (msg.data?.audio) {
              const audioBytes = atob(msg.data.audio);
              chunks.push(audioBytes);
            }
            if (msg.data?.status === 2) {
              ws.close();
              resolve(chunks.join(''));
            }
          } catch { ws.close(); resolve(null); }
        };

        ws.onerror = () => { resolve(null); };
        setTimeout(() => { ws.close(); resolve(chunks.join('') || null); }, 10000);
      });

      if (!result || result.length < 200) return;
      console.log('[AI语音] 成功,', result.length, 'bytes');
      const b64 = btoa(result);
      const fileName = `ai_voice_${Date.now()}.mp3`;
      const audioUri = `${FileSystem.documentDirectory}voice_messages/${fileName}`;
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}voice_messages/`, { intermediates: true });
      await FileSystem.writeAsStringAsync(audioUri, b64, { encoding: FileSystem.EncodingType.Base64 });
      const duration = Math.max(1, Math.ceil(text.length / 4));
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      await sendMessage(parseInt(id), 'ai', aiId, durationStr, 'audio', audioUri);
    } catch (e) {
      console.error('生成AI语音消息失败:', e);
    }
  };

  const handleVoicePlay = async (messageId, text, voiceId) => {
    const speaking = await isSpeaking();
    if (speaking) {
      await stopSpeaking();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(messageId);
    await speakText(text, voiceId);
    setSpeakingMessageId(null);
  };

  const getConversationMembers = async () => {
    return await executeQuery(
      'SELECT * FROM conversation_members WHERE conversation_id = ?',
      [parseInt(id)]
    );
  };

  const getAIVoice = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.voice_id || '默认';
  };

  const renderMusicCard = (song, index) => (
    <TouchableOpacity key={`${song.id}-${index}`} style={styles.musicCard} onPress={() => handleMusicPlay(song)}>
      <Image
        source={{ uri: song.cover || 'https://via.placeholder.com/44/4A90D9/fff?text=♫' }}
        style={styles.musicCardCover}
      />
      <View style={styles.musicCardInfo}>
        <Text style={styles.musicCardName} numberOfLines={1}>{song.name || '未知歌曲'}</Text>
        <Text style={styles.musicCardArtist} numberOfLines={1}>{song.artist || '未知歌手'}</Text>
      </View>
      <View style={styles.musicCardPlay}>
        <Ionicons name="play-circle" size={32} color="#4A90D9" />
      </View>
    </TouchableOpacity>
  );

  const renderMusicList = (songs) => {
    if (!songs || songs.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.musicCardScroll}>
        {songs.map((song, i) => renderMusicCard(song, i))}
      </ScrollView>
    );
  };

  const getBeijingDateLabel = (utcStr) => {
    const ts = new Date(utcStr).getTime();
    const bj = new Date(ts + 8 * 3600000);
    return `${bj.getUTCMonth() + 1}月${bj.getUTCDate()}日`;
  };

  const messagesWithDates = useMemo(() => {
    if (!messages.length) return [];
    const groups = [];
    let cur = { label: '', msgs: [] };
    for (const msg of [...messages].reverse()) {
      const label = getBeijingDateLabel(msg.created_at);
      if (label !== cur.label) {
        if (cur.msgs.length > 0) groups.push(cur);
        cur = { label, msgs: [msg] };
      } else {
        cur.msgs.push(msg);
      }
    }
    if (cur.msgs.length > 0) groups.push(cur);
    const result = [];
    for (const g of groups) {
      result.push(...g.msgs);
      if (g.label) result.push({ type: 'date', label: g.label });
    }
    return result;
  }, [messages]);

  const renderMessage = ({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSep}>
          <View style={styles.dateSepLine} />
          <Text style={styles.dateSepText}>{item.label}</Text>
          <View style={styles.dateSepLine} />
        </View>
      );
    }
    const isUser = item.sender_type === 'user';
    const isSpeakingThis = speakingMessageId === item.id;
    const isEmoji = item.message_type === 'emoji';
    const isImage = item.message_type === 'image';
    const isMusicList = item.message_type === 'music_list';
    const isAudio = item.message_type === 'audio';
    const ai = aiCharacters.find(a => a.id === item.sender_id);
    const aiAvatar = ai?.avatar;
    const aiName = ai?.name || 'AI';

    const skin = bubbleSkin === 'custom' && customBubble
      ? (isUser ? { bg: customBubble.userBg, text: customBubble.userText, time: customBubble.userTime }
               : { bg: customBubble.aiBg, text: customBubble.aiText, time: customBubble.aiTime })
      : (isUser ? getBubbleSkin(bubbleSkin).user : getBubbleSkin(bubbleSkin).ai);
    const bubbleBg = skin.bg;
    const textColor = skin.text;
    const timeColor = skin.time;

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        {!isUser && (
          <TouchableOpacity onPress={() => router.push({ pathname: '/ai-profile', params: { id: item.sender_id } })}>
            <SafeAvatar
              uri={aiAvatar}
              size={40}
              name={aiName}
              color="#4A90D9"
              style={{ marginRight: 8 }}
            />
          </TouchableOpacity>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble, { backgroundColor: bubbleBg }]}>
          {!isUser && conversation?.type === 'group' && (
            <Text style={styles.senderName}>{aiName}</Text>
          )}
          {isEmoji || isImage ? (
            <TouchableOpacity onPress={() => setPreviewImage(item.content)}>
              <Image source={{ uri: item.content }} style={styles.emojiMessage} />
            </TouchableOpacity>
          ) : isMusicList ? (
            (() => { try { const songs = JSON.parse(item.content || '[]'); return Array.isArray(songs) && songs.length > 0 ? renderMusicList(songs) : <Text style={styles.messageText}>暂无歌曲数据</Text>; } catch (e) { return <Text style={styles.messageText}>歌曲数据解析失败</Text>; }})()
          ) : isAudio ? (
            <TouchableOpacity
              style={styles.audioBubble}
              onPress={() => playVoiceMessage(item.id, item.media_url)}
            >
              <Ionicons
                name={playingAudioId === item.id ? 'pause-circle' : 'volume-high-outline'}
                size={24}
                color={isUser ? '#fff' : '#4A90D9'}
              />
              <View style={styles.audioWave}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.audioWaveBar,
                      {
                        height: 8 + i * 3,
                        backgroundColor: isUser
                          ? `rgba(255,255,255,${0.3 + i * 0.14})`
                          : `rgba(74,144,217,${0.3 + i * 0.14})`,
                      },
                      playingAudioId === item.id && styles.audioWaveBarActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.audioDuration, isUser && styles.audioDurationUser, { color: timeColor }]}>
                {item.content}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isUser && styles.userMessageText, { color: textColor }]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isUser && styles.userMessageTime, { color: timeColor }]}>
              {formatTime(item.created_at)}
            </Text>
            {!isUser && !isEmoji && !isImage && !isAudio && (
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={() => handleVoicePlay(item.id, item.content, getAIVoice(item.sender_id))}
              >
                <Ionicons
                  name={isSpeakingThis ? 'volume-high' : 'volume-low-outline'}
                  size={16}
                  color={isSpeakingThis ? '#4A90D9' : '#999'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isUser && (
          <TouchableOpacity onPress={() => userProfile.avatar && setPreviewAvatar({ uri: userProfile.avatar, name: userProfile.name })}>
            <SafeAvatar
              uri={userProfile.avatar}
              size={40}
              name={userProfile.name || '我'}
              color="#67C23A"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderGroupMembersModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={showGroupMembers}
      onRequestClose={() => setShowGroupMembers(false)}
    >
      <View style={styles.groupMembersContainer}>
        <View style={styles.groupMembersHeader}>
          <TouchableOpacity onPress={() => setShowGroupMembers(false)}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.groupMembersTitle}>群成员 ({groupMembers.length})</Text>
          <View style={{ width: 24 }} />
        </View>
        <FlatList
          data={groupMembers}
          keyExtractor={(item, i) => `${item?.id ?? i}-member-${i}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.memberItem}
              onPress={() => {
                setShowGroupMembers(false);
                router.push({ pathname: '/ai-profile', params: { id: item.id } });
              }}
            >
              <SafeAvatar
                uri={item.avatar}
                size={44}
                name={item.name || 'A'}
                color="#4A90D9"
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.name}</Text>
                <Text style={styles.memberPersonality}>{item.description || item.signature || ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.membersList}
        />
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: chatBg.color || '#f5f5f5' }]}>
      {chatBg.image && (
        <Image
          source={{ uri: chatBg.image }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      )}
      
      <FlatList
        ref={flatListRef}
        data={messagesWithDates}
        inverted
        renderItem={renderMessage}
        keyExtractor={(item, index) => `${item?.id ?? index}-msg-${index}`}
        contentContainerStyle={styles.messagesContent}
        style={[styles.messagesContainer, !isReady && { opacity: 0 }]}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleLoadEarlier}
        onEndReachedThreshold={0.5}
      />

      {showNewMessageHint && (
        <TouchableOpacity 
          style={styles.newMessageHint}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            setShowNewMessageHint(false);
          }}
        >
          <Ionicons name="chevron-down" size={16} color="#fff" />
          <Text style={styles.newMessageHintText}>有新消息</Text>
        </TouchableOpacity>
      )}

      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>AI正在输入...</Text>
        </View>
      )}
      {isRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>录音中 {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}</Text>
          </View>
          <TouchableOpacity onPress={() => stopRecording(false)}>
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {showMoreMenu && (
          <View style={styles.moreMenu}>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                router.push({ pathname: '/chat-detail-history', params: { id } });
              }}
            >
              <View style={[styles.moreMenuIcon, { backgroundColor: '#4A90D915' }]}>
                <Ionicons name="time-outline" size={22} color="#4A90D9" />
              </View>
              <Text style={styles.moreMenuText}>聊天记录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                router.push({ pathname: '/chat-background', params: { id } });
              }}
            >
              <View style={[styles.moreMenuIcon, { backgroundColor: '#67C23A15' }]}>
                <Ionicons name="image-outline" size={22} color="#67C23A" />
              </View>
              <Text style={styles.moreMenuText}>聊天背景</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                router.push('/bubble-skin');
              }}
            >
              <View style={[styles.moreMenuIcon, { backgroundColor: '#9B59B615' }]}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#9B59B6" />
              </View>
              <Text style={styles.moreMenuText}>聊天气泡</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                handleSendImage();
              }}
            >
              <View style={[styles.moreMenuIcon, { backgroundColor: '#E6A23C15' }]}>
                <Ionicons name="camera-outline" size={22} color="#E6A23C" />
              </View>
              <Text style={styles.moreMenuText}>发图片</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={() => {
                setShowMoreMenu(false);
                setShowMusicSearch(true);
              }}
            >
              <View style={[styles.moreMenuIcon, { backgroundColor: '#9B59B615' }]}>
                <Ionicons name="musical-notes" size={22} color="#9B59B6" />
              </View>
              <Text style={styles.moreMenuText}>搜音乐</Text>
            </TouchableOpacity>
            {voiceCallEnabled && conversation?.type !== 'group' && (
              <TouchableOpacity
                style={styles.moreMenuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  router.push({
                    pathname: `/voice-call/${id}`,
                  });
                }}
              >
                <View style={[styles.moreMenuIcon, { backgroundColor: '#4fc3f715' }]}>
                  <Ionicons name="call-outline" size={22} color="#4fc3f7" />
                </View>
                <Text style={styles.moreMenuText}>语音通话</Text>
              </TouchableOpacity>
            )}
            {conversation?.type === 'group' && (
              <>
                <TouchableOpacity
                  style={styles.moreMenuItem}
                  onPress={() => {
                    setShowMoreMenu(false);
                    setShowGroupMembers(true);
                  }}
                >
                  <View style={[styles.moreMenuIcon, { backgroundColor: '#E6A23C15' }]}>
                    <Ionicons name="people-outline" size={22} color="#E6A23C" />
                  </View>
                  <Text style={styles.moreMenuText}>群成员</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moreMenuItem}
                  onPress={() => {
                    setShowMoreMenu(false);
                    router.push({ pathname: '/group-settings', params: { id } });
                  }}
                >
                  <View style={[styles.moreMenuIcon, { backgroundColor: '#9B59B615' }]}>
                    <Ionicons name="settings-outline" size={22} color="#9B59B6" />
                  </View>
                  <Text style={styles.moreMenuText}>群设置</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        {(pendingImage || pendingEmoji) && (
          <View style={styles.pendingContainer}>
            <View style={styles.pendingPreview}>
              <Image source={{ uri: pendingImage || pendingEmoji }} style={styles.pendingImage} />
              <TouchableOpacity 
                style={styles.pendingClose}
                onPress={() => { setPendingImage(null); setPendingEmoji(null); }}
              >
                <Ionicons name="close-circle" size={22} color="#999" />
              </TouchableOpacity>
            </View>
            <Text style={styles.pendingHint}>输入文字可一起发送</Text>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              setShowEmoji(false);
              setShowMoreMenu(!showMoreMenu);
            }}
          >
            <Ionicons name={showMoreMenu ? "close-circle" : "add-circle-outline"} size={26} color="#4A90D9" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              setShowMoreMenu(false);
              setShowEmoji(!showEmoji);
            }}
          >
            <Ionicons name={showEmoji ? "close" : "happy-outline"} size={24} color="#4A90D9" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入消息..."
            placeholderTextColor="#999"
            multiline
            onFocus={() => {
              setShowEmoji(false);
            }}
          />
          <Pressable
            style={({ pressed }) => [styles.recordButton, pressed && styles.recordingActive]}
            onPressIn={startRecording}
            onPressOut={() => stopRecording(true)}
          >
            {({ pressed }) => (
              <Ionicons name={pressed ? 'mic' : 'mic-outline'} size={22} color="#666" />
            )}
          </Pressable>
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={24} color={inputText.trim() ? '#4A90D9' : '#ccc'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <EmojiPanel
        visible={showEmoji}
        emojiPacks={emojiPacks}
        onClose={() => setShowEmoji(false)}
        onSelectEmoji={handleEmojiSelect}
      />
      {renderGroupMembersModal()}

      <Modal
        visible={showImagePreview}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View style={styles.imagePreviewOverlay}>
          <View style={styles.imagePreviewContainer}>
            <View style={styles.imagePreviewHeader}>
              <TouchableOpacity onPress={() => setShowImagePreview(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.imagePreviewTitle}>发送图片</Text>
              <TouchableOpacity onPress={handleConfirmSendImage}>
                <Text style={styles.imagePreviewSend}>发送</Text>
              </TouchableOpacity>
            </View>
            <Image source={{ uri: previewImageUri }} style={styles.imagePreview} resizeMode="contain" />
            <View style={styles.imageCommentContainer}>
              <TextInput
                style={styles.imageCommentInput}
                value={imageComment}
                onChangeText={setImageComment}
                placeholder="说点什么..."
                placeholderTextColor="#999"
                multiline
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!previewAvatar}
        transparent={true}
        onRequestClose={() => setPreviewAvatar(null)}
      >
        <TouchableOpacity 
          style={styles.avatarPreviewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewAvatar(null)}
        >
          <View style={styles.avatarPreviewContainer}>
            {previewAvatar?.uri ? (
              <Image source={{ uri: previewAvatar.uri }} style={styles.avatarPreviewImage} />
            ) : (
              <View style={[styles.avatarPreviewPlaceholder, { backgroundColor: '#4A90D9' }]}>
                <Text style={styles.avatarPreviewText}>{previewAvatar?.name?.[0] || '?'}</Text>
              </View>
            )}
            <Text style={styles.avatarPreviewName}>{previewAvatar?.name}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      <MusicSearchModal
        visible={showMusicSearch}
        onClose={() => setShowMusicSearch(false)}
        onSendToChat={handleSendMusicResult}
        onPlaySong={handleMusicPlay}
      />

      <Modal
        visible={!!previewImage}
        transparent={true}
        onRequestClose={() => setPreviewImage(null)}
      >
        <TouchableOpacity 
          style={styles.imageOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
        >
          <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />
          <TouchableOpacity 
            style={styles.imageCloseBtn}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

