import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { formatTime } from '../src/utils/time';
import { SafeAvatar } from '../src/components/SafeImage';
import { loadSetting } from '../src/services/settings';
import { getBubbleSkin } from '../src/services/bubbleSkins';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function ChatDetailHistoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const getMessagesByDate = useAppStore(s => s.getMessagesByDate);
  const getMessageDates = useAppStore(s => s.getMessageDates);

  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateMessages, setDateMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [expandCal, setExpandCal] = useState(false);
  const [userProfile, setUserProfile] = useState({});
  const [bubbleSkin, setBubbleSkin] = useState('default');
  const [customBubble, setCustomBubble] = useState(null);

  useFocusEffect(useCallback(() => {
    if (id) loadDates();
    (async () => { const p = await loadSetting('user_profile', {}); setUserProfile(p); const s = await loadSetting('bubble_skin', 'default'); setBubbleSkin(s); if (s === 'custom') { const c = await loadSetting('bubble_custom_colors', { userBg: '#95EC69', userText: '#000', userTime: 'rgba(0,0,0,0.4)', aiBg: '#fff', aiText: '#333', aiTime: '#999' }); setCustomBubble(c); } })();
  }, [id]));

  const loadDates = async () => {
    try { setDates(await getMessageDates(parseInt(id))); } catch (e) {}
  };

  const loadMessages = async (date) => {
    setSelectedDate(date); setLoading(true);
    try { setDateMessages(await getMessagesByDate(parseInt(id), date)); } catch (e) {}
    setLoading(false);
  };

  const formatDateKey = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const hasMessages = (k) => dates.some(d => d.date === k);
  const getMsgCount = (k) => dates.find(d => d.date === k)?.count || 0;
  const formatDateLabel = (d) => { const p = d?.split('-'); return p ? `${parseInt(p[1])}月${parseInt(p[2])}日` : ''; };

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); }
    else setCalMonth(calMonth + 1);
  };

  const renderCalendar = () => {
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const today = new Date();
    const todayStr = formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<View key={`e${i}`} style={st.cell} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = formatDateKey(calYear, calMonth, d);
      const active = hasMessages(dk);
      const sel = selectedDate === dk;
      const isToday = dk === todayStr;
      cells.push(
        <TouchableOpacity key={d} style={st.cell} onPress={() => active && loadMessages(dk)} disabled={!active}>
          <View style={[st.day, sel && st.daySel, isToday && st.dayToday]}>
            <Text style={[st.dayNum, sel && st.dayNumSel, isToday && st.dayNumToday, !active && st.dayNumOff]}>
              {d}
            </Text>
            {active && <Text style={[st.dayCount, sel && st.dayCountSel]}>{getMsgCount(dk)}</Text>}
          </View>
        </TouchableOpacity>
      );
    }
    return cells;
  };

  const renderItem = ({ item }) => {
    const isUser = item.sender_type === 'user';
    const isImage = item.message_type === 'image';
    const isAudio = item.message_type === 'audio';
    const isEmoji = item.message_type === 'emoji';
    const isMusic = item.message_type === 'music_list';
    const ai = aiCharacters.find(a => a.id === item.sender_id);
    const skin = bubbleSkin === 'custom' && customBubble
      ? (isUser ? { bg: customBubble.userBg, text: customBubble.userText, time: customBubble.userTime }
               : { bg: customBubble.aiBg, text: customBubble.aiText, time: customBubble.aiTime })
      : (isUser ? getBubbleSkin(bubbleSkin).user : getBubbleSkin(bubbleSkin).ai);
    const bubbleBg = skin.bg;
    const textColor = skin.text || '#333';
    const timeColor = skin.time || '#999';

    return (
      <View style={[st.row, isUser ? st.rowUser : st.rowAI]}>
        {!isUser && (
          <SafeAvatar uri={ai?.avatar} size={40} name={ai?.name || 'AI'} color="#4A90D9" style={{ marginRight: 8 }} />
        )}
        <View style={[st.bubble, isUser ? st.bubUser : st.bubAI, { backgroundColor: bubbleBg }]}>
          {isImage || isEmoji ? (
            <Image source={{ uri: item.content }} style={st.bubImg} />
          ) : isAudio ? (
            <View style={st.bubAudio}>
              <Ionicons name="volume-high-outline" size={20} color={isUser ? '#fff' : '#4A90D9'} />
              <View style={st.audioWave}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View key={i} style={[st.waveBar, { height: 6 + i * 2, backgroundColor: isUser ? 'rgba(255,255,255,0.5)' : 'rgba(74,144,217,0.5)' }]} />
                ))}
              </View>
              <Text style={[st.bubAudioDur, isUser && { color: timeColor }]}>{item.content}</Text>
            </View>
          ) : isMusic ? (
            (() => {
              try {
                const songs = JSON.parse(item.content || '[]');
                if (Array.isArray(songs) && songs.length > 0) {
                  return (
                    <View style={st.musicWrap}>
                      {songs.map((s, i) => (
                        <View key={i} style={st.musicItem}>
                          <Ionicons name="musical-note" size={14} color="#4A90D9" />
                          <Text style={st.musicName} numberOfLines={1}>{s.name || s.title || '未知'}</Text>
                          <Text style={st.musicArtist} numberOfLines={1}>{s.artist || ''}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }
              } catch (e) {}
              return <Text style={[st.bubText, isUser && st.bubTextUser]}>[音乐]</Text>;
            })()
          ) : (
            <Text style={[st.bubText, isUser && st.bubTextUser, { color: textColor }]}>{item.content}</Text>
          )}
          <Text style={[st.bubTime, isUser && st.bubTimeUser, { color: timeColor }]}>{formatTime(item.created_at)}</Text>
        </View>
        {isUser && (
          userProfile.avatar ? (
            <Image source={{ uri: userProfile.avatar }} style={[st.av, { marginLeft: 8 }]} />
          ) : (
            <View style={[st.av, st.avUser, { marginLeft: 8 }]}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
          )
        )}
      </View>
    );
  };

  return (
    <View style={st.ctn}>
      <TouchableOpacity style={st.calToggle} onPress={() => setExpandCal(!expandCal)}>
        <View style={st.calToggleInfo}>
          <Ionicons name="calendar-outline" size={16} color="#4A90D9" />
          <Text style={st.calToggleTitle}>
            {selectedDate ? formatDateLabel(selectedDate) : `${calYear}年${calMonth}月`}
          </Text>
        </View>
        <Ionicons name={expandCal ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
      </TouchableOpacity>

      {expandCal && (
        <View style={st.calCard}>
          <View style={st.calHead}>
            <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={18} color="#4A90D9" /></TouchableOpacity>
            <Text style={st.calTitle}>{calYear}年{calMonth}月</Text>
            <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={18} color="#4A90D9" /></TouchableOpacity>
          </View>
          <View style={st.weekRow}>{WEEKDAYS.map(d => <Text key={d} style={st.weekDay}>{d}</Text>)}</View>
          <View style={st.calGrid}>{renderCalendar()}</View>
        </View>
      )}

      {!selectedDate ? (
        <View style={st.empty}>
          <Ionicons name="chatbubbles-outline" size={36} color="#ddd" />
          <Text style={st.emptyText}>点击日期查看消息</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator size="small" color="#4A90D9" style={{ padding: 30 }} />
      ) : (
        <FlatList
          data={dateMessages}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={st.list}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={st.empty}><Text style={st.emptyText}>该日期没有消息</Text></View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  ctn: { flex: 1, backgroundColor: '#f5f5f5' },

  calToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  calToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calToggleTitle: { fontSize: 15, fontWeight: '500', color: '#333' },

  calCard: { backgroundColor: '#fff', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  calTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  weekRow: { flexDirection: 'row', paddingHorizontal: 10, marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, color: '#bbb' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6 },
  cell: { width: '14.28%', aspectRatio: 1, padding: 3 },
  day: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  daySel: { backgroundColor: '#4A90D9' },
  dayToday: { borderWidth: 1.5, borderColor: '#4A90D9' },
  dayNum: { fontSize: 15, color: '#333', fontWeight: '500' },
  dayNumSel: { color: '#fff' },
  dayNumToday: { color: '#4A90D9', fontWeight: '700' },
  dayNumOff: { color: '#ddd' },
  dayCount: { fontSize: 9, color: '#4A90D9', position: 'absolute', bottom: 4 },
  dayCountSel: { color: '#fff' },

  av: { width: 40, height: 40, borderRadius: 20 },
  avUser: { backgroundColor: '#67C23A', justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  rowUser: { justifyContent: 'flex-end' },
  rowAI: { justifyContent: 'flex-start' },

  bubble: { maxWidth: '80%', padding: 12, borderRadius: 14 },
  bubUser: { backgroundColor: '#95EC69', borderTopRightRadius: 4 },
  bubAI: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
  bubText: { fontSize: 15, color: '#333', lineHeight: 22 },
  bubTextUser: { color: '#000' },
  bubImg: { width: 160, height: 160, borderRadius: 8 },
  bubAudio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioWave: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  waveBar: { width: 3, borderRadius: 2 },
  bubAudioDur: { fontSize: 13, color: '#4A90D9' },

  musicWrap: { gap: 4 },
  musicItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  musicName: { fontSize: 14, color: '#333', flex: 1 },
  musicArtist: { fontSize: 12, color: '#999', maxWidth: 80 },

  bubTime: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 4 },
  bubTimeUser: { color: 'rgba(0,0,0,0.4)' },

  empty: { alignItems: 'center', justifyContent: 'center', padding: 50, gap: 8 },
  emptyText: { fontSize: 14, color: '#999' },
});
