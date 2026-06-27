import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getAllLogs, clearLogs } from '../src/utils/logger';

const LEVEL_COLORS = {
  info: '#4A90D9',
  warn: '#E6A23C',
  error: '#F56C6C',
  debug: '#909399',
};

const LEVEL_ICONS = {
  info: 'information-circle',
  warn: 'warning',
  error: 'close-circle',
  debug: 'bug',
};

export default function LogViewerScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const allLogs = await getAllLogs();
    setLogs(allLogs);
  };

  const handleClearLogs = () => {
    Alert.alert(
      '清除日志',
      '确定要清除所有日志吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            await clearLogs();
            setLogs([]);
          }
        },
      ]
    );
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  const renderLogItem = ({ item }) => {
    const isExpanded = expandedLog === item.id;
    const color = LEVEL_COLORS[item.level] || '#999';
    const icon = LEVEL_ICONS[item.level] || 'information-circle';

    return (
      <TouchableOpacity
        style={styles.logItem}
        onPress={() => setExpandedLog(isExpanded ? null : item.id)}
      >
        <View style={styles.logHeader}>
          <View style={styles.logLeft}>
            <Ionicons name={icon} size={16} color={color} />
            <Text style={[styles.logTag, { color }]}>{item.tag}</Text>
          </View>
          <Text style={styles.logTime}>{item.time}</Text>
        </View>
        <Text style={styles.logMessage} numberOfLines={isExpanded ? undefined : 2}>
          {item.message}
        </Text>
        {isExpanded && item.data && (
          <ScrollView style={styles.logDataContainer} horizontal={false}>
            <Text style={styles.logData} selectable>{item.data}</Text>
          </ScrollView>
        )}
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (value, label, count) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;
  const infoCount = logs.filter(l => l.level === 'info').length;
  const debugCount = logs.filter(l => l.level === 'debug').length;

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterButton('all', '全部', logs.length)}
          {renderFilterButton('error', '错误', errorCount)}
          {renderFilterButton('warn', '警告', warnCount)}
          {renderFilterButton('info', '信息', infoCount)}
          {renderFilterButton('debug', '调试', debugCount)}
        </ScrollView>
      </View>

      <FlatList
        data={filteredLogs}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.logList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>暂无日志</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.refreshButton} onPress={loadLogs}>
          <Ionicons name="refresh" size={20} color="#4A90D9" />
          <Text style={styles.refreshText}>刷新</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearLogs}>
          <Ionicons name="trash-outline" size={20} color="#F56C6C" />
          <Text style={styles.clearText}>清除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#4A90D9',
  },
  filterText: {
    fontSize: 13,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  logList: {
    padding: 12,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90D9',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 11,
    color: '#999',
  },
  logMessage: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  logDataContainer: {
    marginTop: 8,
    maxHeight: 150,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 8,
  },
  logData: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  refreshText: {
    fontSize: 15,
    color: '#4A90D9',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  clearText: {
    fontSize: 15,
    color: '#F56C6C',
  },
});
