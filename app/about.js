import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const GITHUB_REPO = 'PiKa1012/AI-CHAT-APP'; // 改仓库名时记得同步更新这里
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

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

  const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="heart-circle" size={72} color="#FF6B81" />
        </View>
        <Text style={styles.appName}>AI陪伴</Text>
        <Text style={styles.tagline}>一个 AI 社交陪伴应用</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>版本信息</Text>
        <InfoRow label="版本号" value={`v${APP_VERSION}`} />
        <InfoRow label="构建版本" value={`${Constants.expoConfig?.android?.versionCode || '1'}`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>作者</Text>
        <InfoRow label="开发者" value="PiKa1012" />
        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => Linking.openURL(`https://github.com/${GITHUB_REPO}`)}
        >
          <Ionicons name="logo-github" size={20} color="#333" />
          <Text style={styles.linkText}>GitHub 仓库</Text>
          <Ionicons name="open-outline" size={16} color="#999" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.updateButton} onPress={checkForUpdates}>
        <Ionicons name="refresh" size={20} color="#fff" />
        <Text style={styles.updateButtonText}>检查更新</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        © {new Date().getFullYear()} PiKa1012. All rights reserved.
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    padding: 12,
    paddingBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
  },
  infoValue: {
    fontSize: 15,
    color: '#666',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  linkText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    color: '#ccc',
    fontSize: 12,
    marginTop: 32,
    marginBottom: 40,
  },
});
