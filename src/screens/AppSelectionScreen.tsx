import { Palette } from '@/constants/colors';
import { loadInstalledApps, loadSelectedApps, saveSelectedPackages } from '@/services/appScanner';
import { InstalledApp } from '@/types/installedApp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const selectedAppsKey = '@project1/selected-notification-apps';

export default function AppSelectionScreen() {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(selectedAppsKey);
        const storedPackages = stored ? JSON.parse(stored) as string[] : [];
        setSelected(storedPackages);
        setApps(storedPackages.map((packageName) => ({ appName: packageName, packageName, isSystemApp: false })));
        await saveSelectedPackages(storedPackages);
        const selectedApps = await loadSelectedApps(storedPackages);
        if (selectedApps.length) setApps(selectedApps);
        const installed = await loadInstalledApps();
        setApps(installed);
      } catch (error) {
        console.warn('Installed apps load failed:', error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredApps = useMemo(() => apps
    .filter((app) => !app.isSystemApp && `${app.appName} ${app.packageName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((first, second) => {
      const firstIndex = selected.indexOf(first.packageName);
      const secondIndex = selected.indexOf(second.packageName);
      if (firstIndex >= 0 && secondIndex < 0) return -1;
      if (firstIndex < 0 && secondIndex >= 0) return 1;
      if (firstIndex >= 0 && secondIndex >= 0) return firstIndex - secondIndex;
      return first.appName.localeCompare(second.appName);
    }), [apps, query, selected]);
  const toggle = async (packageName: string, value: boolean) => {
    const next = value ? [...selected, packageName] : selected.filter((item) => item !== packageName);
    setSelected(next);
    await Promise.all([AsyncStorage.setItem(selectedAppsKey, JSON.stringify(next)), saveSelectedPackages(next)]);
  };

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Text style={styles.title}>알림 받을 앱</Text><Text style={styles.subtitle}>선택한 앱의 금융 알림만 자동 기록합니다.</Text></View>
    {Platform.OS !== 'android' && <Text style={styles.notice}>설치된 앱 조회는 Android Development Build에서 사용할 수 있습니다.</Text>}
    <TextInput value={query} onChangeText={setQuery} placeholder="앱 이름 또는 패키지명 검색" placeholderTextColor={Palette.muted} style={styles.search} />
    <FlatList data={filteredApps} keyExtractor={(item) => item.packageName} contentContainerStyle={styles.list} ListHeaderComponent={loading ? <ActivityIndicator color={Palette.sageDark} style={styles.listLoader} /> : null} renderItem={({ item }) => <View style={styles.row}><Image source={item.iconUri ? { uri: item.iconUri } : require('@/assets/images/icon.png')} style={styles.icon} /><View style={styles.appCopy}><View style={styles.nameRow}><Text style={styles.appName}>{item.appName}</Text></View><Text style={styles.package}>{item.packageName}</Text></View><Switch value={selected.includes(item.packageName)} onValueChange={(value) => void toggle(item.packageName, value)} trackColor={{ false: Palette.line, true: Palette.mint }} thumbColor={selected.includes(item.packageName) ? Palette.sageDark : Palette.muted} /></View>} ListEmptyComponent={<Text style={styles.empty}>{loading ? '선택한 앱을 불러오는 중입니다.' : '표시할 사용자 설치 앱이 없습니다.'}</Text>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas, padding: 20 },
  header: { paddingTop: 24, paddingBottom: 16 },
  title: { color: Palette.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: Palette.muted, fontSize: 13, marginTop: 6 },
  notice: { color: Palette.sageDark, backgroundColor: Palette.mint, borderRadius: 14, padding: 13, lineHeight: 18 },
  search: { backgroundColor: Palette.paper, borderColor: Palette.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: Palette.ink },
  loader: { marginTop: 40 },
  listLoader: { marginVertical: 8 },
  list: { paddingVertical: 12, gap: 8 },
  row: { backgroundColor: Palette.paper, borderColor: Palette.line, borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 10, backgroundColor: Palette.mint },
  appCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appName: { color: Palette.ink, fontSize: 15, fontWeight: '800' },
  systemBadge: { color: Palette.muted, borderColor: Palette.line, borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, fontSize: 9, fontWeight: '700' },
  package: { color: Palette.muted, fontSize: 11, marginTop: 4 },
  empty: { color: Palette.muted, textAlign: 'center', paddingTop: 40 },
});