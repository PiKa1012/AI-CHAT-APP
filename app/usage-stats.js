import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getUsageStats, getBalance, formatBalanceInfo, SUPPORTS_BALANCE } from '../src/services/usage';
import { loadSetting } from '../src/services/settings';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 150;

export default function UsageStatsScreen() {
  const [stats, setStats] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('today');

  const loadData = async () => {
    const s = await getUsageStats();
    setStats(s);
    if (s.hasData && SUPPORTS_BALANCE.includes(s.provider)) {
      const apiSettings = await loadSetting('api_settings', {});
      const raw = await getBalance(s.provider, apiSettings.apiKey);
      setBalance(raw ? formatBalanceInfo(s.provider, raw) : null);
    } else {
      setBalance(null);
    }
    return s;
  };

  useEffect(() => {
    (async () => { await loadData(); setLoading(false); })();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
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

  if (!stats.hasData) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.emptyCard}>
          <Ionicons name="stats-chart" size={48} color="#ddd" />
          <Text style={styles.emptyTitle}>暂无用量数据</Text>
          <Text style={styles.emptyDesc}>使用 AI 聊天后，用量会自动记录</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
          <Ionicons name="refresh" size={18} color="#4A90D9" />
          <Text style={styles.refreshText}>{refreshing ? '刷新中...' : '刷新数据'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const daily = stats.dailyStats || [];
  const todayStats = tab === 'today' ? {
    prompt: stats.todayPrompt,
    completion: stats.todayCompletion,
    calls: stats.todayCalls,
    cost: stats.todayCost,
  } : {
    prompt: stats.totalPrompt,
    completion: stats.totalCompletion,
    calls: stats.totalCalls,
    cost: stats.estimatedCost,
  };

  return (
    <ScrollView style={styles.container}>
      {balance && (
        <View style={styles.balanceRow}>
          <Ionicons name="wallet" size={14} color="#67C22A" />
          <Text style={styles.balanceText}>DeepSeek 余额 ¥{balance.total}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === 'today' && styles.tabActive]} onPress={() => setTab('today')}>
            <Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>今日</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'total' && styles.tabActive]} onPress={() => setTab('total')}>
            <Text style={[styles.tabText, tab === 'total' && styles.tabTextActive]}>累计</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tokenBreakdown}>
          <View style={styles.breakdownItem}>
            <View style={[styles.dot, { backgroundColor: '#93C5FD' }]} />
            <Text style={styles.breakdownLabel}>输入</Text>
            <Text style={styles.breakdownValue}>{formatNum(todayStats.prompt)}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.breakdownLabel}>输出</Text>
            <Text style={styles.breakdownValue}>{formatNum(todayStats.completion)}</Text>
          </View>
        </View>

        <View style={styles.costRow}>
          <Text style={styles.costText}>费用 ¥{todayStats.cost.amount}</Text>
          <Text style={styles.costHint}>（DeepSeek V4 Flash 定价）</Text>
        </View>
        <View style={styles.providerRow}>
          <Text style={styles.providerText}>调用 {todayStats.calls} 次 · 服务商 {stats.provider}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>每日趋势</Text>
        {daily.length === 0 ? (
          <Text style={styles.emptySmall}>暂无数据</Text>
        ) : (
          <DailyChart data={daily} formatNum={formatNum} />
        )}
      </View>

      <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
        <Ionicons name="refresh" size={18} color="#4A90D9" />
        <Text style={styles.refreshText}>{refreshing ? '刷新中...' : '刷新数据'}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DailyChart({ data, formatNum }) {
  const [tip, setTip] = useState(null);
  const chartData = [...data].reverse();
  const maxVal = Math.max(...chartData.map(d => d.prompt + d.completion), 1);
  const barW = Math.max(28, Math.min(52, (SCREEN_WIDTH - 64) / Math.min(chartData.length, 7)));

  const dismiss = () => setTip(null);

  return (
    <Pressable onPress={dismiss}>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}><View style={[styles.ld, { backgroundColor: '#93C5FD' }]} /><Text style={styles.lt}>输入</Text></View>
        <View style={styles.legendItem}><View style={[styles.ld, { backgroundColor: '#2563EB' }]} /><Text style={styles.lt}>输出</Text></View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} nestedScrollEnabled>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 4, minWidth: chartData.length * (barW + 6) }}>
            {chartData.map((d, i) => {
              const ih = Math.max((d.prompt / maxVal) * CHART_HEIGHT, d.prompt > 0 ? 2 : 0);
              const oh = Math.max((d.completion / maxVal) * CHART_HEIGHT, d.completion > 0 ? 2 : 0);
              const isToday = i === chartData.length - 1;

              return (
                <View key={d.day} style={{ alignItems: 'center', width: barW + 12 }}>
                  <View style={{ height: CHART_HEIGHT, width: barW, justifyContent: 'flex-end', position: 'relative' }}>
                    {tip?.day === d.day && (
                      <View style={{ position: 'absolute', zIndex: 10, alignItems: 'center',
                        top: tip.type === 'output'
                          ? Math.max(-24, CHART_HEIGHT - ih - oh - 24)
                          : Math.max(-24, CHART_HEIGHT - ih - 24),
                        left: 0, right: 0
                      }}>
                        <View style={{ backgroundColor: tip.type === 'input' ? '#93C5FD' : '#2563EB', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: tip.type === 'input' ? '#1e3a5f' : '#fff', fontSize: 11, fontWeight: '600' }}>
                            {tip.type === 'input' ? `输入 ${formatNum(d.prompt)}` : `输出 ${formatNum(d.completion)}`}
                          </Text>
                        </View>
                        <View style={{ width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 4, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: tip.type === 'input' ? '#93C5FD' : '#2563EB' }} />
                      </View>
                    )}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={(e) => { e.stopPropagation(); setTip(tip?.day === d.day && tip?.type === 'output' ? null : { day: d.day, type: 'output' }); }}
                      style={{ height: oh, width: barW, backgroundColor: '#2563EB', borderTopLeftRadius: 3, borderTopRightRadius: 3 }}
                    />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={(e) => { e.stopPropagation(); setTip(tip?.day === d.day && tip?.type === 'input' ? null : { day: d.day, type: 'input' }); }}
                      style={{ height: ih, width: barW, backgroundColor: '#93C5FD', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }}
                    />
                  </View>
                  <Text style={{ fontSize: 10, color: isToday ? '#666' : '#aaa', fontWeight: isToday ? '600' : '400', marginTop: 2 }}>
                    {d.day.slice(5)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#999' },
  emptyDesc: { fontSize: 14, color: '#ccc' },
  emptySmall: { textAlign: 'center', color: '#ccc', paddingVertical: 20 },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, marginTop: 4 },
  balanceText: { fontSize: 12, color: '#999' },

  tabRow: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 8, padding: 2, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#333', fontWeight: '600' },

  tokenBreakdown: { gap: 8, marginBottom: 12 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  breakdownLabel: { flex: 1, fontSize: 14, color: '#666' },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#333' },

  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  costText: { fontSize: 13, color: '#666' },
  costHint: { fontSize: 11, color: '#ccc' },
  providerRow: { alignItems: 'center', marginTop: 4 },
  providerText: { fontSize: 12, color: '#bbb' },

  chartLegend: { flexDirection: 'row', gap: 20, marginBottom: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ld: { width: 10, height: 10, borderRadius: 5 },
  lt: { fontSize: 12, color: '#666' },

  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6, padding: 12 },
  refreshText: { fontSize: 14, color: '#4A90D9' },
});
