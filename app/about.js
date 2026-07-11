import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const GITHUB_REPO = 'PiKa1012/AI-CHAT-APP';
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const APP_NAME = Constants.expoConfig?.name || '恋语';

export default function AboutScreen() {
  const router = useRouter();

  const checkForUpdates = async () => {
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AI-CHAT-APP',
        },
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error('仓库或发行版不存在');
        if (response.status === 403) throw new Error('GitHub API 请求超限，请稍后重试');
        throw new Error(`请求失败 (HTTP ${response.status})`);
      }
      const data = await response.json();
      const latestVersion = data.tag_name.replace(/^v/, '');
      const currentVersion = APP_VERSION;

      if (compareVersions(latestVersion, currentVersion) > 0) {
        const apkAsset = data.assets?.find(a => a.name.endsWith('.apk'));
        const downloadUrl = apkAsset?.browser_download_url || data.html_url;
        const buttons = [
          { text: '稍后再说', style: 'cancel' },
          { text: apkAsset ? '下载 APK' : '查看详情', onPress: () => Linking.openURL(downloadUrl) },
        ];
        Alert.alert(
          '发现新版本',
          `最新版本: v${latestVersion}\n当前版本: v${currentVersion}\n\n${data.body?.slice(0, 500) || ''}`,
          buttons
        );
      } else {
        Alert.alert('已是最新版', `当前已是最新版本 v${currentVersion}`);
      }
    } catch (error) {
      Alert.alert(
        '检查失败',
        error.message || '无法连接到 GitHub，请检查网络后重试',
        [
          { text: '知道了', style: 'cancel' },
          { text: '去 Releases 页', onPress: () => Linking.openURL(`https://github.com/${GITHUB_REPO}/releases`) },
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerCard}>
        <View style={styles.iconWrapper}>
          <Image source={require('../assets/icon.png')} style={styles.appIcon} />
        </View>
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.tagline}>在数字世界里，遇见懂你的那个TA</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>v{APP_VERSION}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle" size={18} color="#4A90D9" />
          <Text style={styles.cardTitle}>版本信息</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>版本号</Text>
            <Text style={styles.infoValue}>v{APP_VERSION}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>构建版本</Text>
            <Text style={styles.infoValue}>{Constants.expoConfig?.android?.versionCode || '1'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person" size={18} color="#4A90D9" />
          <Text style={styles.cardTitle}>开发者</Text>
        </View>
        <View style={styles.cardBody}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL(`https://github.com/${GITHUB_REPO}`)}
            activeOpacity={0.6}
          >
            <Ionicons name="code-slash" size={20} color="#333" />
            <Text style={styles.linkLabel}>PiKa1012</Text>
            <Ionicons name="open-outline" size={16} color="#999" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => Linking.openURL(`https://github.com/${GITHUB_REPO}`)}
            activeOpacity={0.6}
          >
            <Ionicons name="logo-github" size={20} color="#333" />
            <Text style={styles.linkLabel}>GitHub 仓库</Text>
            <Ionicons name="open-outline" size={16} color="#999" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.updateButton} onPress={checkForUpdates} activeOpacity={0.8}>
        <Ionicons name="refresh" size={20} color="#fff" />
        <Text style={styles.updateButtonText}>检查更新</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        © {new Date().getFullYear()} PiKa1012
      </Text>
    </ScrollView>
  );
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EBF2FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  appIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  tagline: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: '#EBF2FC',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    color: '#4A90D9',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
  },
  infoValue: {
    fontSize: 15,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  linkLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 12,
    marginTop: 28,
  },
});
