import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BUBBLE_SKINS } from '../src/services/bubbleSkins';
import { saveSetting, loadSetting } from '../src/services/settings';
import { useState, useCallback } from 'react';

const PRE_COLORS = [
  '#95EC69', '#FF9A56', '#61C7F5', '#FF85B3', '#5EC4B0', '#4A4A6A',
  '#F56C6C', '#E6A23C', '#1ABC9C', '#8B5CF6', '#3B82F6', '#EF4444',
];

export default function BubbleSkinScreen() {
  const [selected, setSelected] = useState('default');
  const [showCustom, setShowCustom] = useState(false);
  const [userColor, setUserColor] = useState('#95EC69');
  const [aiColor, setAiColor] = useState('#ffffff');
  const skins = Object.entries(BUBBLE_SKINS);

  useFocusEffect(useCallback(() => {
    (async () => {
      const s = await loadSetting('bubble_skin', 'default');
      setSelected(s);
      if (s === 'custom') {
        const c = await loadSetting('bubble_custom_colors', { userBg: '#95EC69', aiBg: '#ffffff' });
        setUserColor(c.userBg);
        setAiColor(c.aiBg);
        setShowCustom(true);
      }
    })();
  }, []));

  const handleSelect = async (id) => {
    if (id !== 'custom') setShowCustom(false);
    setSelected(id);
    await saveSetting('bubble_skin', id);
  };

  const applyCustom = async () => {
    setSelected('custom');
    const userText = isLightColor(userColor) ? '#000' : '#fff';
    const aiText = isLightColor(aiColor) ? '#333' : '#eee';
    await saveSetting('bubble_skin', 'custom');
    await saveSetting('bubble_custom_colors', {
      userBg: userColor, userText, userTime: isLightColor(userColor) ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)',
      aiBg: aiColor, aiText, aiTime: isLightColor(aiColor) ? '#999' : 'rgba(255,255,255,0.5)',
    });
  };

  const isLightColor = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  };

  const renderColorDots = (selectedColor, onSelect) => (
    <View style={s.colorRow}>
      {PRE_COLORS.map(c => (
        <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, selectedColor === c && s.colorDotSel]} onPress={() => onSelect(c)} />
      ))}
    </View>
  );

  const renderItem = ({ item: [id, skin] }) => (
    <TouchableOpacity style={[s.row, selected === id && s.rowActive]} onPress={() => handleSelect(id)}>
      <View style={s.preview}>
        <View style={[s.bubU, { backgroundColor: skin.user.bg }]}>
          <Text style={[s.bubText, { color: skin.user.text }]}>你好啊</Text>
        </View>
        <View style={[s.bubA, { backgroundColor: skin.ai.bg }]}>
          <Text style={[s.bubText, { color: skin.ai.text || '#333' }]}>嗨~</Text>
        </View>
      </View>
      <View style={s.info}>
        <Text style={s.name}>{skin.name}</Text>
      </View>
      {selected === id && <Ionicons name="checkmark-circle" size={22} color="#4A90D9" />}
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={skins}
      renderItem={renderItem}
      keyExtractor={([id]) => id}
      style={s.ctn}
      contentContainerStyle={s.list}
      ListFooterComponent={
        <View>
          <TouchableOpacity style={[s.row, selected === 'custom' && s.rowActive]} onPress={() => { setShowCustom(!showCustom); setSelected('custom'); }}>
            <View style={s.preview}>
              <View style={[s.bubU, { backgroundColor: userColor }]}>
                <Text style={[s.bubText, { color: isLightColor(userColor) ? '#000' : '#fff' }]}>自定义</Text>
              </View>
              <View style={[s.bubA, { backgroundColor: aiColor }]}>
                <Text style={[s.bubText, { color: isLightColor(aiColor) ? '#333' : '#eee' }]}>AI</Text>
              </View>
            </View>
            <View style={s.info}>
              <Text style={s.name}>自定义</Text>
            </View>
            {selected === 'custom' && <Ionicons name="checkmark-circle" size={22} color="#4A90D9" />}
          </TouchableOpacity>

          {showCustom && selected === 'custom' && (
            <View style={s.customPanel}>
              <Text style={s.customTitle}>用户气泡颜色</Text>
              {renderColorDots(userColor, setUserColor)}
              <View style={s.hexRow}>
                <Text style={s.hexLabel}>#</Text>
                <TextInput style={s.hexInput} value={userColor.replace('#', '')} onChangeText={t => setUserColor('#' + t.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))} maxLength={6} />
                <View style={[s.hexPreview, { backgroundColor: userColor }]} />
              </View>

              <Text style={[s.customTitle, { marginTop: 16 }]}>AI气泡颜色</Text>
              {renderColorDots(aiColor, setAiColor)}
              <View style={s.hexRow}>
                <Text style={s.hexLabel}>#</Text>
                <TextInput style={s.hexInput} value={aiColor.replace('#', '')} onChangeText={t => setAiColor('#' + t.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))} maxLength={6} />
                <View style={[s.hexPreview, { backgroundColor: aiColor }]} />
              </View>

              <TouchableOpacity style={s.applyBtn} onPress={applyCustom}>
                <Text style={s.applyBtnText}>应用</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10, gap: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  rowActive: { borderColor: '#4A90D9' },
  preview: { gap: 6 },
  bubU: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderTopRightRadius: 4 },
  bubA: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  bubText: { fontSize: 13 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: '#333' },

  customPanel: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  customTitle: { fontSize: 14, fontWeight: '500', color: '#666', marginBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#eee' },
  colorDotSel: { borderColor: '#333', borderWidth: 3 },
  hexRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  hexLabel: { fontSize: 15, color: '#999' },
  hexInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, fontSize: 14, color: '#333' },
  hexPreview: { width: 32, height: 32, borderRadius: 8 },
  applyBtn: { backgroundColor: '#4A90D9', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 16 },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
