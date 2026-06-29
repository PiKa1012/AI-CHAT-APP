import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getUsageStats, getBalance, formatBalanceInfo } from '../src/services/usage';
import { loadSetting } from '../src/services/settings';

export default function UsageStatsScreen() {
  const [stats, setStats] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    const s = await getUsageStats();
    setStats(s);
    return s;
  };

  const loadBalance = async (provider) => {
    const apiSettings = await loadSetting('api_settings', {});
    const key = apiSettings.apiKey;
    if (!key) { setBalance('no_key'); return; }
    const currentProvider = provider || apiSettings.provider;
    if (currentProvider !== 'deepseek') {
      setBalance('unsupported');
      return;
    }
    const raw = await getBalance(currentProvider, key);
    setBalance(raw ? formatBalanceInfo(currentProvider, raw) : 'error');
  };

  useEffect(() => {
    (async () => {
      const s = await loadStats();
      await loadBalance(s.provider);
      setLoading(false);
    })();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const s = await loadStats();
    await loadBalance(s.provider);
    setRefreshing(false);
  };

  const formatNum = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {balance && balance !== 'no_key' && balance !== 'unsupported' && balance !== 'error' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API 余额</Text>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceAmount}>¥{balance.total}</Text>
            <Text style={styles.balanceLabel}>可用余额</Text>
            {balance.details?.length > 1 && (
              <Text style={styles.balanceDetail}>
                {balance.details.map(d => `¥${d.total_balance}`).join(' + ')}
              </Text>
            )}
          </View>
        </View>
      ) : balance === 'unsupported' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API 余额</Text>
          <Text style={styles.hint}>当前服务商 ({stats?.provider || '未知'}) 不支持余额查询</Text>
        </View>
      ) : balance === 'error' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API 余额</Text>
          <Text style={styles.hint}>余额查询失败，请检查 API Key 是否正确</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>今日用量</Text>
        <View style={styles.row}>
          <StatBox icon="chatbubbles" label="调用次数" value={stats.todayCalls.toString()} color="#4A90D9" />
          <StatBox icon="text" label="消耗 Token" value={formatNum(stats.todayTokens)} color="#67C23A" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>累计用量</Text>
        <View style={styles.grid}>
          <StatBox icon="chatbubbles" label="总调用" value={formatNum(stats.totalCalls)} color="#9B59B6" />
          <StatBox icon="text" label="总 Token" value={formatNum(stats.totalTokens)} color="#E6A23C" />
          <StatBox icon="arrow-up" label="输入 Token" value={formatNum(stats.totalPrompt)} color="#4A90D9" />
          <StatBox icon="arrow-down" label="输出 Token" value={formatNum(stats.totalCompletion)} color="#67C23A" />
        </View>
        {stats.estimatedCost ? (
          <View style={styles.costRow}>
            <Ionicons name="cash" size={16} color="#999" />
            <Text style={styles.costText}>
              预估费用 {stats.estimatedCost.currency === 'CNY' ? '¥' : '$'}{stats.estimatedCost.amount}
            </Text>
            <Text style={styles.costHint}>（按 {stats.estimatedCost.label} 定价估算）</Text>
          </View>
        ) : (
          <View style={styles.costRow}>
            <Text style={styles.costHint}>无法估算费用（未知服务商）</Text>
          </View>
        )}
        <View style={styles.providerRow}>
          <Text style={styles.providerText}>服务商：{stats.provider || '未知'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
        <Ionicons name="refresh" size={18} color="#4A90D9" />
        <Text style={styles.refreshText}>{refreshing ? '刷新中...' : '刷新数据'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  hint: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 16 },
  balanceCard: { alignItems: 'center', paddingVertical: 8 },
  balanceAmount: { fontSize: 36, fontWeight: '700', color: '#67C23A' },
  balanceLabel: { fontSize: 13, color: '#999', marginTop: 4 },
  balanceDetail: { fontSize: 12, color: '#ccc', marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#f8f8f8', borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 4 },
  statLabel: { fontSize: 12, color: '#999' },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 4 },
  costText: { fontSize: 13, color: '#666' },
  costHint: { fontSize: 11, color: '#ccc' },
  providerRow: { alignItems: 'center', marginTop: 4 },
  providerText: { fontSize: 12, color: '#bbb' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6, padding: 12 },
  refreshText: { fontSize: 14, color: '#4A90D9' },
});
