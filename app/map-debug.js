import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { loadSetting } from '../src/services/settings';
import { detectMapIntent, searchNearby, searchByKeyword, getWeather, getAddressFromLocation, getLocationFromAddress, getCurrentLocation, extractCity, extractLocation, getRoute } from '../src/services/map';

export default function MapDebugScreen() {
  const [query, setQuery] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [amapKey, setAmapKey] = useState('');

  useEffect(() => {
    loadSetting('api_settings', {}).then(s => setAmapKey(s.amapApiKey || ''));
  }, []);

  const addLog = (label, data) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${label}:\n${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
    setLogs(prev => [entry, ...prev]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testDetectIntent = () => {
    const intent = detectMapIntent(query);
    addLog('意图检测', intent || '未匹配到地图意图');
  };

  const testLocationByIP = async () => {
    setLoading(true);
    try {
      const info = await getCurrentLocation();
      addLog('IP定位', info);
    } catch (e) {
      addLog('IP定位失败', e.message);
    }
    setLoading(false);
  };

  const testAddressFromLocation = async () => {
    setLoading(true);
    try {
      const ipInfo = await getCurrentLocation();
      if (ipInfo.location) {
        const addr = await getAddressFromLocation(ipInfo.location);
        addLog('逆地理编码', addr);
      } else {
        addLog('逆地理编码', 'IP定位无坐标');
      }
    } catch (e) {
      addLog('逆地理编码失败', e.message);
    }
    setLoading(false);
  };

  const testSearchNearby = async () => {
    setLoading(true);
    try {
      const ipInfo = await getCurrentLocation();
      if (ipInfo.location) {
        const pois = await searchNearby(ipInfo.location, '美食|餐厅|小吃');
        if (pois.length > 0) {
          addLog(`附近搜索（共${pois.length}条）`, pois.slice(0, 5).map(p => `${p.name}（${p.distance || '?'}m）`));
        } else {
          addLog('附近搜索', '未找到结果');
        }
      } else {
        addLog('附近搜索', 'IP定位无坐标');
      }
    } catch (e) {
      addLog('附近搜索失败', e.message);
    }
    setLoading(false);
  };

  const testSearchByKeyword = async () => {
    setLoading(true);
    try {
      const data = await searchByKeyword(query || '景点');
      addLog('关键词搜索', data.slice(0, 5));
    } catch (e) {
      addLog('关键词搜索失败', e.message);
    }
    setLoading(false);
  };

  const testWeather = async () => {
    setLoading(true);
    try {
      const city = extractCity(query) || (await getCurrentLocation()).city;
      const forecasts = await getWeather(city);
      addLog(`天气查询（${city}）`, forecasts);
    } catch (e) {
      addLog('天气查询失败', e.message);
    }
    setLoading(false);
  };

  const runFullTest = async () => {
    setLoading(true);
    setLogs([]);
    try {
      const intent = detectMapIntent(query);
      addLog('步骤1: 意图检测', intent || '未匹配');
      if (!intent) { setLoading(false); return; }

      const ipInfo = await getCurrentLocation();
      addLog('步骤2: IP定位', ipInfo);

      if (intent === 'location') {
        if (ipInfo.location) {
          const addr = await getAddressFromLocation(ipInfo.location);
          addLog('步骤3: 逆地理', addr);
        }
      } else if (intent === 'nearby_food' || intent === 'nearby_place' || intent === 'recommend') {
        const keyword = intent === 'nearby_place' ? '厕所|医院|药店' : intent === 'nearby_food' ? '美食|餐厅|小吃' : '景点|公园|好玩';
        const pois = ipInfo.location ? await searchNearby(ipInfo.location, keyword) : await searchByKeyword(keyword, ipInfo.city);
        addLog('步骤3: POI搜索', pois.slice(0, 5));
      } else if (intent === 'weather') {
        const city = extractCity(query) || ipInfo.city;
        const forecasts = await getWeather(city);
        addLog('步骤3: 天气', forecasts);
      } else if (intent === 'route') {
        const locations = extractLocation(query);
        if (locations.length >= 2) {
          try {
            const [originName, destName] = locations;
            addLog('步骤3: 解析起终点', { origin: originName, dest: destName });
            const [originGeo, destGeo] = await Promise.all([
              getLocationFromAddress(originName, ipInfo.city),
              getLocationFromAddress(destName, ipInfo.city),
            ]);
            const originLoc = originGeo.geocodes?.[0]?.location;
            const destLoc = destGeo.geocodes?.[0]?.location;
            if (originLoc && destLoc) {
              addLog('步骤4: 地理编码', { originLoc, destLoc });
              const route = await getRoute(originLoc, destLoc, 'driving', ipInfo.city);
              addLog('步骤5: 路线结果', { distance: route.distance, duration: route.duration, steps: route.steps.slice(0, 5) });
            } else {
              addLog('步骤4: 地理编码失败', { originLoc, destLoc });
            }
          } catch (e) {
            addLog('路线查询失败', e.message);
          }
        } else {
          addLog('步骤3: 路线', '未识别出起终点，请用「从A到B」格式');
        }
      }
    } catch (e) {
      addLog('全流程失败', e.message);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map" size={24} color="#4A90D9" />
        <Text style={styles.title}>地图接口调试</Text>
        {amapKey ? (
          <Text style={styles.keyBadge}>密钥已配置</Text>
        ) : (
          <Text style={styles.keyBadgeWarn}>未配置密钥</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>测试查询语句</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="输入测试语句，如：附近有什么好吃的"
          placeholderTextColor="#999"
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.btn} onPress={testDetectIntent}>
            <Text style={styles.btnText}>检测意图</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={runFullTest} disabled={loading}>
            <Text style={styles.btnPrimaryText}>{loading ? '运行中...' : '全流程测试'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>单独测试</Text>
        <View style={styles.soloRow}>
          <TouchableOpacity style={styles.soloBtn} onPress={testLocationByIP} disabled={loading}>
            <Ionicons name="location" size={16} color="#4A90D9" />
            <Text style={styles.soloBtnText}>IP定位</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.soloBtn} onPress={testAddressFromLocation} disabled={loading}>
            <Ionicons name="home" size={16} color="#67C23A" />
            <Text style={styles.soloBtnText}>逆地理</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.soloBtn} onPress={testSearchNearby} disabled={loading}>
            <Ionicons name="search" size={16} color="#E6A23C" />
            <Text style={styles.soloBtnText}>附近搜索</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.soloBtn} onPress={testWeather} disabled={loading}>
            <Ionicons name="partly-sunny" size={16} color="#F56C6C" />
            <Text style={styles.soloBtnText}>天气</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.soloBtn} onPress={testSearchByKeyword} disabled={loading}>
            <Ionicons name="text" size={16} color="#9B59B6" />
            <Text style={styles.soloBtnText}>关键词</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.logHeader}>
          <Text style={styles.label}>调试日志</Text>
          <TouchableOpacity onPress={clearLogs}>
            <Text style={styles.clearText}>清空</Text>
          </TouchableOpacity>
        </View>
        {logs.map((log, i) => (
          <Text key={i} style={styles.logEntry}>{log}</Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.logEmpty}>点击按钮开始测试</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  keyBadge: {
    fontSize: 12,
    color: '#67C23A',
    backgroundColor: '#67C23A15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  keyBadgeWarn: {
    fontSize: 12,
    color: '#F56C6C',
    backgroundColor: '#F56C6C15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  btnText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '500',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  soloRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soloBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  soloBtnText: {
    fontSize: 13,
    color: '#666',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearText: {
    fontSize: 13,
    color: '#4A90D9',
  },
  logEntry: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 18,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  logEmpty: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
