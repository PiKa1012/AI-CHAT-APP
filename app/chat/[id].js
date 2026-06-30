import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { styles } from '../../src/components/chat/styles';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { getAIResponse, getGroupAIResponse, findMentionedAI, analyzeImage, aiAutoPostMoment } from '../../src/services/ai';
import { generateDiary } from '../../src/services/diary';
import { generateChatImage, isImageGenerationRequest, extractImageDescription } from '../../src/services/imageGen';
import { detectAndCreateTask, getTaskTypeName } from '../../src/services/taskDetector';
import { speakText, stopSpeaking, isSpeaking } from '../../src/services/voice';
import { sendLocalNotification } from '../../src/services/notification';
import { getEmojiPacks } from '../../src/services/emoji';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { loadSetting } from '../../src/services/settings';
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



export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
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
            await sendMessage(parseInt(id), 'ai', aiId, response.text);
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
            await sendMessage(parseInt(id), 'ai', aiId, response.text);
          }
        } else {
          const members = await getConversationMembers();
          const memberAIs = members.map(m => aiCharacters.find(a => a.id === m.member_id)).filter(Boolean);
          if (memberAIs.length > 0) {
            const randomAI = memberAIs[Math.floor(Math.random() * memberAIs.length)];
            const recentMessages = messages.slice(-50);
            const response = await getGroupAIResponse(randomAI.id, [...recentMessages, { sender_type: 'user', sender_id: 1, content: prompt }], memberAIs);
            await sendMessage(parseInt(id), 'ai', randomAI.id, response.text);
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
            await sendMessage(parseInt(id), 'ai', aiId, response.text);
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
            await sendMessage(parseInt(id), 'ai', randomAI.id, response.text);
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
        console.error('检测定时任务失败:', error);
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
        const content = await aiAutoPostMoment(aiId, messageText, todayMessages);
        const ai = aiCharacters.find(a => a.id === aiId);
        await sendMessage(parseInt(id), 'ai', aiId, `发了条朋友圈~${content ? '\n\n' + content : ''}`);
      } catch (error) {
        await sendMessage(parseInt(id), 'ai', aiId, `发朋友圈失败了：${error.message}`);
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
          await sendMessage(parseInt(id), 'ai', aiId, response.text);
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
          await sendMessage(parseInt(id), 'ai', ai.id, response.text);
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

  const renderMessage = ({ item }) => {
    const isUser = item.sender_type === 'user';
    const isSpeakingThis = speakingMessageId === item.id;
    const isEmoji = item.message_type === 'emoji';
    const isImage = item.message_type === 'image';
    const isMusicList = item.message_type === 'music_list';
    const ai = aiCharacters.find(a => a.id === item.sender_id);
    const aiAvatar = ai?.avatar;
    const aiName = ai?.name || 'AI';

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
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {!isUser && conversation?.type === 'group' && (
            <Text style={styles.senderName}>{aiName}</Text>
          )}
          {isEmoji || isImage ? (
            <TouchableOpacity onPress={() => setPreviewImage(item.content)}>
              <Image source={{ uri: item.content }} style={styles.emojiMessage} />
            </TouchableOpacity>
          ) : isMusicList ? (
            (() => { try { const songs = JSON.parse(item.content || '[]'); return Array.isArray(songs) && songs.length > 0 ? renderMusicList(songs) : <Text style={styles.messageText}>暂无歌曲数据</Text>; } catch (e) { return <Text style={styles.messageText}>歌曲数据解析失败</Text>; }})()
          ) : (
            <Text style={[styles.messageText, isUser && styles.userMessageText]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
              {formatTime(item.created_at)}
            </Text>
            {!isUser && !isEmoji && !isImage && (
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
                <Text style={styles.memberPersonality}>{item.personality || '友好'}</Text>
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
        data={[...messages].reverse()}
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

