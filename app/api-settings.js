import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { saveSetting, loadSetting, clearAPISettingsCache } from '../src/services/settings';

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🤖', placeholder: 'sk-...' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔮', placeholder: 'sk-...' },
  { id: 'qwen', name: '通义千问', icon: '☁️', placeholder: 'sk-...' },
  { id: 'custom', name: '自定义', icon: '⚙️', placeholder: '输入API地址' },
];

const TTS_PROVIDERS = [
  { id: 'system', name: '系统语音', desc: '手机自带，无需联网' },
  { id: 'mimo', name: 'MiMo语音', desc: '小米MiMo TTS' },
  { id: 'edge', name: 'Edge语音', desc: '微软免费语音' },
  { id: 'openai', name: 'OpenAI语音', desc: '高质量但需付费' },
];

const VOICE_OPTIONS = {
  system: [
    { id: '默认', name: '默认' },
    { id: '甜美', name: '甜美' },
    { id: '磁性', name: '磁性' },
    { id: '可爱', name: '可爱' },
    { id: '成熟', name: '成熟' },
  ],
  mimo: [
    { id: 'mimo-zh_female', name: '中文女声' },
    { id: 'mimo-zh_male', name: '中文男声' },
    { id: 'mimo-en_female', name: '英文女声' },
    { id: 'mimo-en_male', name: '英文男声' },
  ],
  edge: [
    { id: 'edge-xiaoxiao', name: '晓晓(女)' },
    { id: 'edge-yunxi', name: '云希(男)' },
    { id: 'edge-xiaoyi', name: '晓伊(女)' },
    { id: 'edge-yunjian', name: '云健(男)' },
  ],
  openai: [
    { id: 'openai-alloy', name: 'Alloy(中性)' },
    { id: 'openai-echo', name: 'Echo(男)' },
    { id: 'openai-nova', name: 'Nova(女)' },
    { id: 'openai-shimmer', name: 'Shimmer(女)' },
  ],
};

const FREQUENCY_OPTIONS = [
  { value: 10, label: '低' },
  { value: 30, label: '中' },
  { value: 50, label: '高' },
  { value: 70, label: '很高' },
];

export default function APISettingsScreen() {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [enableSearch, setEnableSearch] = useState(false);
  const [searchApiKey, setSearchApiKey] = useState('');
  
  // TTS settings
  const [enableTTS, setEnableTTS] = useState(true);
  const [ttsProvider, setTtsProvider] = useState('system');
  const [ttsVoice, setTtsVoice] = useState('默认');
  const [ttsApiKey, setTtsApiKey] = useState('');
  const [ttsApiBaseUrl, setTtsApiBaseUrl] = useState('');
  
  // Emoji settings
  const [enableEmoji, setEnableEmoji] = useState(true);
  const [emojiFrequency, setEmojiFrequency] = useState(30);
  
  // Vision settings
  const [enableImageRecognition, setEnableImageRecognition] = useState(false);
  const [visionApiKey, setVisionApiKey] = useState('');
  const [visionApiBaseUrl, setVisionApiBaseUrl] = useState('');
  const [visionModelName, setVisionModelName] = useState('');
  
  // Image generation settings
  const [enableImageGen, setEnableImageGen] = useState(false);
  const [enableMomentImage, setEnableMomentImage] = useState(true);
  const [enableDiaryImage, setEnableDiaryImage] = useState(true);
  const [enableChatImage, setEnableChatImage] = useState(true);
  const [imageGenApiKey, setImageGenApiKey] = useState('');
  const [imageGenBaseUrl, setImageGenBaseUrl] = useState('');
  const [imageGenModel, setImageGenModel] = useState('');
  
  // NetEase Music settings
  const [enableMusic, setEnableMusic] = useState(false);
  const [neteaseApiBaseUrl, setNeteaseApiBaseUrl] = useState('');
  const [isTestingMusic, setIsTestingMusic] = useState(false);

  // Amap settings
  const [enableMap, setEnableMap] = useState(false);
  const [amapApiKey, setAmapApiKey] = useState('');
  const [isTestingAmap, setIsTestingAmap] = useState(false);

  // Voice call settings
  const [enableVoiceCall, setEnableVoiceCall] = useState(false);
  const [xfAppId, setXfAppId] = useState('');
  const [xfApiKey, setXfApiKey] = useState('');
  const [xfApiSecret, setXfApiSecret] = useState('');
  const [voiceServerUrl, setVoiceServerUrl] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isTestingVision, setIsTestingVision] = useState(false);
  const [isTestingTTS, setIsTestingTTS] = useState(false);
  const [isTestingImageGen, setIsTestingImageGen] = useState(false);
  const [isTestingSearch, setIsTestingSearch] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await loadSetting('api_settings', {});
      if (data) {
        setSelectedProvider(data.provider || 'openai');
        setApiKey(data.apiKey || '');
        setApiBaseUrl(data.apiBaseUrl || '');
        setModelName(data.modelName || '');
        setEnableSearch(data.enableSearch || false);
        setSearchApiKey(data.searchApiKey || '');
        setEnableTTS(data.enableTTS !== false);
        setTtsProvider(data.ttsProvider || 'system');
        setTtsVoice(data.ttsVoice || '默认');
        setTtsApiKey(data.ttsApiKey || '');
        setTtsApiBaseUrl(data.ttsApiBaseUrl || '');
        setEnableEmoji(data.enableEmoji !== false);
        setEmojiFrequency(data.emojiFrequency || 30);
        setEnableImageRecognition(data.enableImageRecognition || false);
        setVisionApiKey(data.visionApiKey || '');
        setVisionApiBaseUrl(data.visionApiBaseUrl || '');
        setVisionModelName(data.visionModelName || '');
        setEnableImageGen(data.enableImageGen || false);
        setEnableMomentImage(data.enableMomentImage !== false);
        setEnableDiaryImage(data.enableDiaryImage !== false);
        setEnableChatImage(data.enableChatImage !== false);
        setImageGenApiKey(data.imageGenApiKey || '');
        setImageGenBaseUrl(data.imageGenBaseUrl || '');
        setImageGenModel(data.imageGenModel || '');
        setNeteaseApiBaseUrl(data.neteaseApiBaseUrl || '');
        setEnableMusic(data.enableMusic !== false);
        setAmapApiKey(data.amapApiKey || '');
        setEnableMap(data.enableMap !== false);
        setEnableVoiceCall(data.enableVoiceCall || false);
        setXfAppId(data.xfAppId || '');
        setXfApiKey(data.xfApiKey || '');
        setXfApiSecret(data.xfApiSecret || '');
        setVoiceServerUrl(data.voiceServerUrl || '');
      }
    } catch (e) {}
  };

  const testMusicConnection = async () => {
    if (!neteaseApiBaseUrl) {
      Alert.alert('提示', '请先输入网易云API地址');
      return;
    }
    setIsTestingMusic(true);
    try {
      const response = await fetch(`${neteaseApiBaseUrl}/search?keywords=test&limit=1&randomCNIP=true`);
      if (response.ok) {
        Alert.alert('成功', 'API连接正常！');
      } else {
        const text = await response.text().catch(() => '');
        Alert.alert('失败', `连接错误 (${response.status}): ${text.substring(0, 100)}`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTestingMusic(false);
  };

  const testAmapConnection = async () => {
    if (!amapApiKey) {
      Alert.alert('提示', '请先输入高德 Web API Key');
      return;
    }
    setIsTestingAmap(true);
    try {
      const response = await fetch(`https://restapi.amap.com/v3/ip?key=${amapApiKey}&output=JSON`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === '1') {
          Alert.alert('成功', `API 连接正常！IP 归属：${data.city || data.province || '未知'}`);
        } else {
          Alert.alert('失败', `API 错误: ${data.info || '未知错误'}`);
        }
      } else {
        Alert.alert('失败', `连接错误 (${response.status})`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTestingAmap(false);
  };

  const testVoiceConnection = async () => {
    if (!voiceServerUrl) {
      Alert.alert('提示', '请先输入服务器地址');
      return;
    }
    setIsTestingVoice(true);
    try {
      // 测试服务器 WebSocket 是否可达
      const ws = new WebSocket(voiceServerUrl);
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('连接超时')), 5000);
        ws.onopen = () => { clearTimeout(t); ws.close(); resolve(); };
        ws.onerror = () => { clearTimeout(t); reject(new Error('无法连接')); };
      });
      Alert.alert('成功', '服务器连接正常');
    } catch (e) {
      Alert.alert('失败', `连接错误: ${e.message}`);
    }
    setIsTestingVoice(false);
  };

  const saveSettings = async () => {
    try {
      await saveSetting('api_settings', {
        provider: selectedProvider,
        apiKey,
        apiBaseUrl,
        modelName,
        enableSearch,
        searchApiKey,
        enableTTS,
        ttsProvider,
        ttsVoice,
        ttsApiKey,
        ttsApiBaseUrl,
        enableEmoji,
        emojiFrequency,
        enableImageRecognition,
        visionApiKey,
        visionApiBaseUrl,
        visionModelName,
        enableImageGen,
        enableMomentImage,
        enableDiaryImage,
        enableChatImage,
        imageGenApiKey,
        imageGenBaseUrl,
        imageGenModel,
        neteaseApiBaseUrl,
        enableMusic,
        amapApiKey,
        enableMap,
        enableVoiceCall,
        xfAppId,
        xfApiKey,
        xfApiSecret,
        voiceServerUrl,
      });
      clearAPISettingsCache();
      Alert.alert('成功', '设置已保存');
    } catch (e) {
      Alert.alert('错误', '保存失败');
    }
  };

  const testConnection = async () => {
    if (!apiKey) {
      Alert.alert('提示', '请先输入API Key');
      return;
    }
    setIsTesting(true);
    try {
      const provider = AI_PROVIDERS.find(p => p.id === selectedProvider);
      let baseUrl = apiBaseUrl || getDefaultBaseUrl(selectedProvider);
      
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName || getDefaultModel(selectedProvider),
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10,
        }),
      });
      
      if (response.ok) {
        Alert.alert('成功', 'API连接正常！');
      } else {
        const error = await response.text();
        Alert.alert('失败', `连接错误: ${error}`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTesting(false);
  };

  const testVisionConnection = async () => {
    if (!visionApiKey) {
      Alert.alert('提示', '请先输入视觉模型API Key');
      return;
    }
    setIsTestingVision(true);
    try {
      const baseUrl = visionApiBaseUrl || 'https://api.openai.com';
      const model = visionModelName || 'gpt-4o';
      
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${visionApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10,
        }),
      });
      
      if (response.ok) {
        Alert.alert('成功', '视觉模型API连接正常！');
      } else {
        const error = await response.text();
        Alert.alert('失败', `连接错误: ${error}`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTestingVision(false);
  };

  const testTTSConnection = async () => {
    if (ttsProvider === 'system') {
      Alert.alert('提示', '系统语音无需测试');
      return;
    }
    if (!ttsApiKey) {
      Alert.alert('提示', '请先输入语音API Key');
      return;
    }
    setIsTestingTTS(true);
    try {
      const baseUrl = ttsApiBaseUrl || 'https://api.example.com';
      
      const response = await fetch(`${baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ttsApiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: '你好',
          voice: 'alloy',
        }),
      });
      
      if (response.ok) {
        Alert.alert('成功', '语音API连接正常！');
      } else {
        const error = await response.text();
        Alert.alert('失败', `连接错误: ${error}`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTestingTTS(false);
  };

  const testSearchConnection = async () => {
    if (!searchApiKey?.trim()) {
      Alert.alert('提示', '请先输入搜索API Key');
      return;
    }
    setIsTestingSearch(true);
    try {
      const response = await fetch('https://api.bochaai.com/v1/web-search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${searchApiKey.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '测试', count: 1, summary: true }),
      });
      if (response.ok) {
        Alert.alert('成功', '搜索API连接正常！');
      } else {
        const text = await response.text();
        Alert.alert('失败', `搜索API错误 (${response.status}): ${text}`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTestingSearch(false);
  };

  const testImageGenConnection = async () => {
    const apiKey = imageGenApiKey || apiKey;
    if (!apiKey) {
      Alert.alert('提示', '请先生图API Key');
      return;
    }
    setIsTestingImageGen(true);
    try {
      const baseUrl = imageGenBaseUrl || 'https://api.siliconflow.cn/v1';
      const model = imageGenModel || 'stabilityai/stable-diffusion-xl-base-1.0';
      
      const response = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: 'a cute cat',
          image_size: '512x512',
        }),
      });
      
      if (response.ok) {
        Alert.alert('成功', '生图API连接正常！');
      } else {
        const error = await response.text();
        Alert.alert('失败', `连接错误: ${error}`);
      }
    } catch (e) {
      Alert.alert('失败', `网络错误: ${e.message}`);
    }
    setIsTestingImageGen(false);
  };

  const getDefaultBaseUrl = (provider) => {
    const urls = {
      openai: 'https://api.openai.com',
      deepseek: 'https://api.deepseek.com',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
      custom: '',
    };
    return urls[provider] || '';
  };

  const getDefaultModel = (provider) => {
    const models = {
      openai: 'gpt-3.5-turbo',
      deepseek: 'deepseek-chat',
      qwen: 'qwen-turbo',
      custom: '',
    };
    return models[provider] || '';
  };

  const renderProviderSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AI服务商</Text>
      <View style={styles.providerGrid}>
        {AI_PROVIDERS.map(provider => (
          <TouchableOpacity
            key={provider.id}
            style={[styles.providerItem, selectedProvider === provider.id && styles.providerItemActive]}
            onPress={() => {
              setSelectedProvider(provider.id);
              if (!apiBaseUrl) setApiBaseUrl('');
            }}
          >
            <Text style={styles.providerIcon}>{provider.icon}</Text>
            <Text style={[styles.providerName, selectedProvider === provider.id && styles.providerNameActive]}>
              {provider.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {renderProviderSelector()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API配置</Text>
        
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={AI_PROVIDERS.find(p => p.id === selectedProvider)?.placeholder}
          placeholderTextColor="#999"
          secureTextEntry
        />

        <Text style={styles.label}>API地址（可选）</Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrl}
          onChangeText={setApiBaseUrl}
          placeholder={getDefaultBaseUrl(selectedProvider)}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>模型名称（可选）</Text>
        <TextInput
          style={styles.input}
          value={modelName}
          onChangeText={setModelName}
          placeholder={getDefaultModel(selectedProvider)}
          placeholderTextColor="#999"
        />

        <TouchableOpacity style={styles.testButton} onPress={testConnection} disabled={isTesting}>
          <Text style={styles.testButtonText}>{isTesting ? '测试中...' : '测试连接'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>功能开关</Text>
        
        {/* 联网搜索 */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="search" size={20} color="#4A90D9" />
            <Text style={styles.switchLabel}>联网搜索</Text>
            <Text style={styles.switchDesc}>博查AI搜索最新信息</Text>
          </View>
          <Switch value={enableSearch} onValueChange={setEnableSearch} trackColor={{ true: '#4A90D9' }} />
        </View>
        {enableSearch && (
          <View style={styles.subSection}>
            <Text style={styles.label}>搜索API Key</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={searchApiKey}
                onChangeText={setSearchApiKey}
                placeholder="输入博查搜索API Key"
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.testSmallButton} onPress={testSearchConnection} disabled={isTestingSearch}>
                <Text style={styles.testSmallButtonText}>{isTestingSearch ? '测试中...' : '测试连接'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 语音回复 */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="volume-high" size={20} color="#67C23A" />
            <Text style={styles.switchLabel}>语音回复</Text>
            <Text style={styles.switchDesc}>AI消息自动朗读</Text>
          </View>
          <Switch value={enableTTS} onValueChange={setEnableTTS} trackColor={{ true: '#67C23A' }} />
        </View>
        {enableTTS && (
          <View style={styles.subSection}>
            <Text style={styles.label}>语音引擎</Text>
            <View style={styles.optionGrid}>
              {TTS_PROVIDERS.map(provider => (
                <TouchableOpacity
                  key={provider.id}
                  style={[styles.optionItem, ttsProvider === provider.id && styles.optionItemActive]}
                  onPress={() => { setTtsProvider(provider.id); setTtsVoice(VOICE_OPTIONS[provider.id][0].id); }}
                >
                  <Text style={[styles.optionName, ttsProvider === provider.id && styles.optionNameActive]}>{provider.name}</Text>
                  <Text style={styles.optionDesc}>{provider.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>音色选择</Text>
            <View style={styles.voiceGrid}>
              {VOICE_OPTIONS[ttsProvider]?.map(voice => (
                <TouchableOpacity
                  key={voice.id}
                  style={[styles.voiceItem, ttsVoice === voice.id && styles.voiceItemActive]}
                  onPress={() => setTtsVoice(voice.id)}
                >
                  <Text style={[styles.voiceName, ttsVoice === voice.id && styles.voiceNameActive]}>{voice.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {ttsProvider !== 'system' && (
              <>
                <Text style={styles.label}>语音API Key</Text>
                <TextInput
                  style={styles.input}
                  value={ttsApiKey}
                  onChangeText={setTtsApiKey}
                  placeholder="输入语音API Key"
                  placeholderTextColor="#999"
                  secureTextEntry
                />
                <Text style={styles.label}>语音API地址</Text>
                <TextInput
                  style={styles.input}
                  value={ttsApiBaseUrl}
                  onChangeText={setTtsApiBaseUrl}
                  placeholder="如 https://api.example.com"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.testSmallButton} onPress={testTTSConnection} disabled={isTestingTTS}>
                  <Text style={styles.testSmallButtonText}>{isTestingTTS ? '测试中...' : '测试语音连接'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 表情包 */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="happy" size={20} color="#E6A23C" />
            <Text style={styles.switchLabel}>AI发表情</Text>
            <Text style={styles.switchDesc}>根据心情发表情包</Text>
          </View>
          <Switch value={enableEmoji} onValueChange={setEnableEmoji} trackColor={{ true: '#E6A23C' }} />
        </View>
        {enableEmoji && (
          <View style={styles.subSection}>
            <Text style={styles.label}>发表情频率</Text>
            <View style={styles.optionGrid}>
              {FREQUENCY_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionItem, emojiFrequency === option.value && styles.optionItemActive]}
                  onPress={() => setEmojiFrequency(option.value)}
                >
                  <Text style={[styles.optionName, emojiFrequency === option.value && styles.optionNameActive]}>
                    {option.label} ({option.value}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 图像识别 */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="image" size={20} color="#9B59B6" />
            <Text style={styles.switchLabel}>图像识别</Text>
            <Text style={styles.switchDesc}>识别发送的图片内容</Text>
          </View>
          <Switch value={enableImageRecognition} onValueChange={setEnableImageRecognition} trackColor={{ true: '#9B59B6' }} />
        </View>
        {enableImageRecognition && (
          <View style={styles.subSection}>
            <Text style={styles.label}>视觉模型API Key</Text>
            <TextInput
              style={styles.input}
              value={visionApiKey}
              onChangeText={setVisionApiKey}
              placeholder="输入视觉模型API Key"
              placeholderTextColor="#999"
              secureTextEntry
            />
            <Text style={styles.label}>视觉模型API地址</Text>
            <TextInput
              style={styles.input}
              value={visionApiBaseUrl}
              onChangeText={setVisionApiBaseUrl}
              placeholder="如 https://api.moonshot.cn"
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>视觉模型名称</Text>
            <TextInput
              style={styles.input}
              value={visionModelName}
              onChangeText={setVisionModelName}
              placeholder="如 moonshot-v1-128k-vision-preview"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.testSmallButton} onPress={testVisionConnection} disabled={isTestingVision}>
              <Text style={styles.testSmallButtonText}>{isTestingVision ? '测试中...' : '测试视觉连接'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI生图 */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Ionicons name="brush" size={20} color="#FF69B4" />
            <Text style={styles.switchLabel}>AI生图</Text>
            <Text style={styles.switchDesc}>自动为内容配图</Text>
          </View>
          <Switch value={enableImageGen} onValueChange={setEnableImageGen} trackColor={{ true: '#FF69B4' }} />
        </View>
        {enableImageGen && (
          <View style={styles.subSection}>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="images" size={18} color="#E6A23C" />
                <Text style={styles.switchLabel}>朋友圈配图</Text>
              </View>
              <Switch value={enableMomentImage} onValueChange={setEnableMomentImage} trackColor={{ true: '#E6A23C' }} />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="book" size={18} color="#9B59B6" />
                <Text style={styles.switchLabel}>日记配图</Text>
              </View>
              <Switch value={enableDiaryImage} onValueChange={setEnableDiaryImage} trackColor={{ true: '#9B59B6' }} />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="chatbubble" size={18} color="#67C23A" />
                <Text style={styles.switchLabel}>聊天生图</Text>
                <Text style={styles.switchDesc}>说"画xxx"触发</Text>
              </View>
              <Switch value={enableChatImage} onValueChange={setEnableChatImage} trackColor={{ true: '#67C23A' }} />
            </View>

            <Text style={styles.label}>生图API Key</Text>
            <TextInput
              style={styles.input}
              value={imageGenApiKey}
              onChangeText={setImageGenApiKey}
              placeholder="输入硅基流动等API Key"
              placeholderTextColor="#999"
              secureTextEntry
            />
            <Text style={styles.label}>生图API地址</Text>
            <TextInput
              style={styles.input}
              value={imageGenBaseUrl}
              onChangeText={setImageGenBaseUrl}
              placeholder="https://api.siliconflow.cn/v1"
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>生图模型</Text>
            <TextInput
              style={styles.input}
              value={imageGenModel}
              onChangeText={setImageGenModel}
              placeholder="stabilityai/stable-diffusion-xl-base-1.0"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.testSmallButton} onPress={testImageGenConnection} disabled={isTestingImageGen}>
              <Text style={styles.testSmallButtonText}>{isTestingImageGen ? '测试中...' : '测试生图连接'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>🎵 网易云音乐</Text>
            <Text style={styles.switchDesc}>聊天搜歌播放</Text>
          </View>
          <Switch value={enableMusic} onValueChange={setEnableMusic} trackColor={{ true: '#E6A23C' }} />
        </View>
        {enableMusic && (
          <View style={styles.subSection}>
            <Text style={styles.label}>网易云API地址</Text>
        <TextInput
          style={styles.input}
          value={neteaseApiBaseUrl}
          onChangeText={setNeteaseApiBaseUrl}
          placeholder="https://netease-cloud-music-api-xxx.vercel.app"
          placeholderTextColor="#999"
        />
        <Text style={styles.hint}>部署 NeteaseCloudMusicApi Enhanced 后获得的地址</Text>

        <TouchableOpacity style={styles.testSmallButton} onPress={testMusicConnection} disabled={isTestingMusic}>
          <Text style={styles.testSmallButtonText}>{isTestingMusic ? '测试中...' : '测试连接'}</Text>
        </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>🗺️ 高德地图</Text>
            <Text style={styles.switchDesc}>位置天气路线查询</Text>
          </View>
          <Switch value={enableMap} onValueChange={setEnableMap} trackColor={{ true: '#4A90D9' }} />
        </View>
        {enableMap && (
          <View style={styles.subSection}>
            <Text style={styles.label}>高德 Web API Key</Text>
        <TextInput
          style={styles.input}
          value={amapApiKey}
          onChangeText={setAmapApiKey}
          placeholder="输入高德 Web 服务 API Key"
          placeholderTextColor="#999"
        />
        <Text style={styles.hint}>在控制台 → 应用管理 → 创建应用后获取 Key，启用「Web 服务」</Text>

        <TouchableOpacity style={styles.testSmallButton} onPress={testAmapConnection} disabled={isTestingAmap}>
          <Text style={styles.testSmallButtonText}>{isTestingAmap ? '测试中...' : '测试连接'}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>使用示例（在聊天中直接输入）</Text>
        <Text style={styles.featureItem}>🗺️ 附近搜索：<Text style={styles.exampleText}>"附近有什么好吃的"</Text></Text>
        <Text style={styles.featureItem}>🗺️ 地点查询：<Text style={styles.exampleText}>"帮我查一下天安门"</Text></Text>
        <Text style={styles.featureItem}>🗺️ 路线规划：<Text style={styles.exampleText}>"从王府井到故宫怎么走"</Text></Text>
        <Text style={styles.featureItem}>🗺️ 天气查询：<Text style={styles.exampleText}>"今天天气怎么样"</Text></Text>
        <Text style={styles.featureItem}>🗺️ 位置定位：<Text style={styles.exampleText}>"我现在在哪"</Text></Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>📞 语音通话</Text>
            <Text style={styles.switchDesc}>拨打电话式AI对话</Text>
          </View>
          <Switch value={enableVoiceCall} onValueChange={setEnableVoiceCall} trackColor={{ true: '#4fc3f7' }} />
        </View>
        {enableVoiceCall && (
          <View style={styles.subSection}>
            <Text style={styles.label}>讯飞ASR App ID</Text>
            <TextInput
              style={styles.input}
              value={xfAppId}
              onChangeText={setXfAppId}
              placeholder="去 https://www.xfyun.cn/service/voicedictation 注册"
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>讯飞ASR API Key</Text>
            <TextInput
              style={styles.input}
              value={xfApiKey}
              onChangeText={setXfApiKey}
              placeholder="讯飞 API Key"
              placeholderTextColor="#999"
              secureTextEntry
            />
            <Text style={styles.label}>讯飞ASR API Secret</Text>
            <TextInput
              style={styles.input}
              value={xfApiSecret}
              onChangeText={setXfApiSecret}
              placeholder="讯飞 API Secret"
              placeholderTextColor="#999"
              secureTextEntry
            />
            <Text style={styles.label}>服务器地址</Text>
            <TextInput
              style={styles.input}
              value={voiceServerUrl}
              onChangeText={setVoiceServerUrl}
              placeholder="ws://你的服务器IP:3001/voice"
              placeholderTextColor="#999"
            />
            <Text style={styles.hint}>运行 bridge 服务的服务器地址，端口 3001</Text>

            <TouchableOpacity style={styles.testSmallButton} onPress={testVoiceConnection} disabled={isTestingVoice}>
              <Text style={styles.testSmallButtonText}>{isTestingVoice ? '测试中...' : '测试连接'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
        <Text style={styles.saveButtonText}>保存设置</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  subSection: {
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  providerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  providerName: {
    fontSize: 14,
    color: '#666',
  },
  providerNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  testSmallButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  testSmallButtonText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontSize: 15,
    color: '#333',
  },
  switchDesc: {
    fontSize: 12,
    color: '#999',
    marginLeft: 'auto',
    marginRight: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  optionName: {
    fontSize: 14,
    color: '#666',
  },
  optionNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  optionDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  voiceItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voiceItemActive: {
    backgroundColor: '#4A90D915',
    borderColor: '#4A90D9',
  },
  voiceName: {
    fontSize: 13,
    color: '#666',
  },
  voiceNameActive: {
    color: '#4A90D9',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#67C23A',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  featureItem: {
    fontSize: 13,
    color: '#666',
    lineHeight: 22,
  },
  exampleText: {
    color: '#4A90D9',
    fontFamily: 'monospace',
  },
});
