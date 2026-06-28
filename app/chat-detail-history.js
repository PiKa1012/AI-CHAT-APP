import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../src/stores';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { formatTime, getBeijingNow } from '../src/utils/time';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function ChatDetailHistoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const conversations = useAppStore(s => s.conversations);
  const aiCharacters = useAppStore(s => s.aiCharacters);
  const getMessageDates = useAppStore(s => s.getMessageDates);
  const getMessagesByDate = useAppStore(s => s.getMessagesByDate);
  
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateMessages, setDateMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentYear, setCurrentYear] = useState(getBeijingNow().year);
  const [currentMonth, setCurrentMonth] = useState(getBeijingNow().month);

  const conversation = conversations.find(c => c.id === parseInt(id));

  useEffect(() => {
    if (id) {
      loadDateList();
    }
  }, [id]);

  const loadDateList = async () => {
    try {
      const dateList = await getMessageDates(parseInt(id));
      setDates(dateList);
    } catch (error) {
      console.error('加载日期列表失败:', error);
    }
  };

  const loadMessagesForDate = async (date) => {
    setLoading(true);
    setSelectedDate(date);
    try {
      const msgs = await getMessagesByDate(parseInt(id), date);
      setDateMessages(msgs);
    } catch (error) {
      console.error('加载消息失败:', error);
    }
    setLoading(false);
  };

  const getAIName = (aiId) => {
    const ai = aiCharacters.find(a => a.id === aiId);
    return ai?.name || 'AI';
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const hasMessages = (dateKey) => {
    return dates.some(d => d.date === dateKey);
  };

  const getMessageCount = (dateKey) => {
    const dateEntry = dates.find(d => d.date === dateKey);
    return dateEntry ? dateEntry.count : 0;
  };

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
    setDateMessages([]);
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
    setDateMessages([]);
  };

  const formatDateDisplay = (dateKey) => {
    if (!dateKey) return '';
    const parts = dateKey.split('-');
    return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const today = getBeijingNow();
    const todayStr = formatDateKey(today.year, today.month, today.day);

    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentYear, currentMonth, day);
      const hasMsg = hasMessages(dateKey);
      const msgCount = getMessageCount(dateKey);
      const isToday = dateKey === todayStr;
      const isSelected = selectedDate === dateKey;

      days.push(
        <TouchableOpacity
          key={day}
          style={styles.dayCell}
          onPress={() => hasMsg && loadMessagesForDate(dateKey)}
          disabled={!hasMsg}
          activeOpacity={0.7}
        >
          <View style={[
            styles.dayInner,
            isSelected && styles.dayInnerSelected,
            isToday && styles.dayInnerToday,
            hasMsg && styles.dayInnerHasMsg,
          ]}>
            <Text style={[
              styles.dayText,
              isSelected && styles.dayTextSelected,
              isToday && styles.dayTextToday,
              !hasMsg && styles.dayTextDisabled,
            ]}>
              {day}
            </Text>
            {hasMsg && !isSelected && (
              <View style={styles.msgDot} />
            )}
            {hasMsg && isSelected && (
              <Text style={styles.msgCountText}>{msgCount}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return days;
  };

  const renderMessageItem = (msg) => {
    const isUser = msg.sender_type === 'user';
    const senderName = isUser ? '我' : getAIName(msg.sender_id);

    return (
      <View key={msg.id} style={styles.messageItem}>
        <View style={styles.messageHeader}>
          <View style={styles.senderRow}>
            <View style={[styles.senderDot, isUser ? styles.userDot : styles.aiDot]} />
            <Text style={[styles.senderName, isUser && styles.userName]}>{senderName}</Text>
          </View>
          <Text style={styles.messageTime}>{formatTime(msg.created_at)}</Text>
        </View>
        <Text style={styles.messageContent}>{msg.content}</Text>
      </View>
    );
  };

  const renderMessages = () => {
    if (!selectedDate) {
      return (
        <View style={styles.emptyHint}>
          <Ionicons name="calendar-outline" size={40} color="#ddd" />
          <Text style={styles.emptyHintText}>选择日期查看聊天</Text>
        </View>
      );
    }

    if (loading) {
      return <ActivityIndicator size="large" color="#4A90D9" style={styles.loading} />;
    }

    return (
      <View style={styles.messagesSection}>
        <View style={styles.messagesSectionHeader}>
          <Text style={styles.messagesSectionTitle}>{formatDateDisplay(selectedDate)}</Text>
          <Text style={styles.messagesSectionCount}>{dateMessages.length} 条</Text>
        </View>
        {dateMessages.length === 0 ? (
          <Text style={styles.emptyText}>该日期没有消息</Text>
        ) : (
          dateMessages.map(msg => renderMessageItem(msg))
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.monthBtn}>
            <Ionicons name="chevron-back" size={22} color="#4A90D9" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {currentYear}年{currentMonth}月
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthBtn}>
            <Ionicons name="chevron-forward" size={22} color="#4A90D9" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map(day => (
            <Text key={day} style={styles.weekdayText}>{day}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {renderCalendar()}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>有消息</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotSelected]} />
            <Text style={styles.legendText}>已选中</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotToday]} />
            <Text style={styles.legendText}>今天</Text>
          </View>
        </View>
      </View>

      {renderMessages()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  calendarCard: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 3,
  },
  dayInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
  },
  dayInnerSelected: {
    backgroundColor: '#4A90D9',
  },
  dayInnerToday: {
    borderWidth: 2,
    borderColor: '#4A90D9',
  },
  dayInnerHasMsg: {
    backgroundColor: '#EBF5FF',
  },
  dayText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: '#4A90D9',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#ccc',
  },
  msgDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4A90D9',
    marginTop: 2,
  },
  msgCountText: {
    fontSize: 10,
    color: '#fff',
    marginTop: 1,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EBF5FF',
    borderWidth: 2,
    borderColor: '#4A90D9',
  },
  legendDotSelected: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  legendDotToday: {
    backgroundColor: '#fff',
    borderColor: '#4A90D9',
  },
  legendText: {
    fontSize: 12,
    color: '#999',
  },
  messagesSection: {
    marginHorizontal: 12,
  },
  messagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  messagesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  messagesSectionCount: {
    fontSize: 14,
    color: '#999',
  },
  messageItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userDot: {
    backgroundColor: '#67C23A',
  },
  aiDot: {
    backgroundColor: '#4A90D9',
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90D9',
  },
  userName: {
    color: '#67C23A',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  messageContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  emptyHint: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 12,
  },
  emptyHintText: {
    fontSize: 15,
    color: '#ccc',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 30,
  },
  loading: {
    padding: 30,
  },
});
