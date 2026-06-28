import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Modal, Image, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useAppStore } from '../../src/stores';
import { getAIResponse, getGroupAIResponse, findMentionedAI, analyzeImage } from '../../src/services/ai';
import { generateChatImage, isImageGenerationRequest, extractImageDescription } from '../../src/services/imageGen';
import { detectAndCreateTask, getTaskTypeName } from '../../src/services/taskDetector';
import { speakText, stopSpeaking, isSpeaking } from '../../src/services/voice';
import { sendLocalNotification } from '../../src/services/notification';
import { getAllEmojis, getEmojiPacks, getPackEmojis } from '../../src/services/emoji';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { loadSetting } from '../../src/services/settings';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { copyToAppStorage } from '../../src/services/media';
import { formatTime } from '../../src/utils/time';
import { SafeAvatar } from '../../src/components/SafeImage';


const QUICK_REPLIES = ['好的', '没问题', '哈哈哈', '嗯嗯', '知道了', '谢谢', '不客气', '加油', '晚安', '在干嘛'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const messages = useAppStore(s => s.messages);
  const loadMessages = useAppStore(s => s.loadMessages);
  const sendMessage = useAppStore(s => s.sendMessage);
  const conversations = useAppStore(s => s.conversations);
  const loadConversations = useAppStore(s => s.loadConversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiPacks, setEmojiPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [packEmojis, setPackEmojis] = useState([]);
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
    }
    loadEmojiPacks();
    loadUserProfile();
    if (conversation?.type === 'group') {
      loadGroupMembers();
    }
  }, [id]);

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
    if (packs.length > 0 && !selectedPack) {
      setSelectedPack(packs[0]);
      const emojis = await getPackEmojis(packs[0].id);
      setPackEmojis(emojis);
    }
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
    const { executeQuery } = require('../../src/database');
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

  const handleSelectPack = async (pack) => {
    setSelectedPack(pack);
    const emojis = await getPackEmojis(pack.id);
    setPackEmojis(emojis);
  };

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
    const { executeQuery } = require('../../src/database');
    return await executeQuery(
      'SELECT * FROM conversation_members WHERE conversation_id = ?',
      [parseInt(id)]
    );
  };

  const getAIName = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.name || 'AI';
  };

  const getAIAvatar = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.avatar || ai?.name?.[0] || 'A';
  };

  const getAIVoice = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.voice_id || '默认';
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender_type === 'user';
    const isSpeakingThis = speakingMessageId === item.id;
    const isEmoji = item.message_type === 'emoji';
    const isImage = item.message_type === 'image';
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

  const renderEmojiPanel = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showEmoji}
      onRequestClose={() => setShowEmoji(false)}
    >
      <View style={styles.emojiPanel}>
        <View style={styles.emojiHeader}>
          <Text style={styles.emojiTitle}>表情包</Text>
          <View style={styles.emojiHeaderActions}>
            <TouchableOpacity
              style={styles.emojiSettingsBtn}
              onPress={() => {
                setShowEmoji(false);
                router.push('/emoji-manage');
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emojiCloseBtn}
              onPress={() => setShowEmoji(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.emojiTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {emojiPacks.map((pack) => (
              <TouchableOpacity
                key={pack.id}
                style={[styles.emojiTab, selectedPack?.id === pack.id && styles.emojiTabActive]}
                onPress={() => handleSelectPack(pack)}
              >
                <Text style={[styles.emojiTabText, selectedPack?.id === pack.id && styles.emojiTabTextActive]}>
                  {pack.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <FlatList
          data={packEmojis}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.emojiItem}
              onPress={() => handleEmojiSelect(item)}
            >
              <Image source={{ uri: item.image_uri }} style={styles.emojiImage} />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          numColumns={5}
          contentContainerStyle={styles.emojiGrid}
          ListEmptyComponent={
            <View style={styles.emptyEmojiContainer}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.emptyEmojiText}>暂无表情</Text>
              <TouchableOpacity
                style={styles.goManageBtn}
                onPress={() => {
                  setShowEmoji(false);
                  router.push('/emoji-manage');
                }}
              >
                <Text style={styles.goManageBtnText}>去添加</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </Modal>
  );

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
          keyExtractor={(item) => item.id.toString()}
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
        keyExtractor={(item) => item.id.toString()}
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

      {renderEmojiPanel()}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aiAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aiAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#67C23A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
  },
  messageBubble: {
    maxWidth: '72%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#4A90D9',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
  },
  senderName: {
    fontSize: 12,
    color: '#4A90D9',
    marginBottom: 4,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  emojiMessage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  userMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  voiceButton: {
    marginLeft: 8,
    padding: 2,
  },
  typingContainer: {
    padding: 8,
    paddingHorizontal: 16,
  },
  typingText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  moreMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 16,
  },
  moreMenuItem: {
    alignItems: 'center',
    width: 64,
  },
  moreMenuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMenuText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  attachButton: {
    padding: 6,
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emojiPanel: {
    backgroundColor: '#fff',
    height: 320,
  },
  emojiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emojiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emojiHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiSettingsBtn: {
    padding: 4,
  },
  emojiCloseBtn: {
    padding: 4,
  },
  emojiTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 8,
  },
  emojiTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emojiTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4A90D9',
  },
  emojiTabText: {
    fontSize: 13,
    color: '#666',
  },
  emojiTabTextActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  addPackBtn: {
    padding: 8,
    marginLeft: 'auto',
  },
  emojiGrid: {
    padding: 8,
  },
  emojiItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  emojiImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emojiClose: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyEmojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyEmojiText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  goManageBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#4A90D9',
    borderRadius: 16,
  },
  goManageBtnText: {
    color: '#fff',
    fontSize: 14,
  },
  quickRepliesPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
  },
  quickRepliesTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  quickRepliesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickReplyItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  quickReplyText: {
    fontSize: 14,
    color: '#333',
  },
  quickReplyClose: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersList: {
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  memberPersonality: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  groupMembersContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  groupMembersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  groupMembersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  avatarPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreviewContainer: {
    alignItems: 'center',
  },
  avatarPreviewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  avatarPreviewPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPreviewText: {
    color: '#fff',
    fontSize: 64,
    fontWeight: 'bold',
  },
  avatarPreviewName: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '500',
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  imageCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    color: '#999',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  imagePreviewContainer: {
    flex: 1,
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  imagePreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  imagePreviewSend: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '600',
  },
  imagePreview: {
    flex: 1,
    width: '100%',
  },
  imageCommentContainer: {
    backgroundColor: '#fff',
    padding: 16,
  },
  imageCommentInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 80,
  },
  pendingContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pendingPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  pendingClose: {
    padding: 4,
  },
  pendingHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  newMessageHint: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90D9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  newMessageHintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
