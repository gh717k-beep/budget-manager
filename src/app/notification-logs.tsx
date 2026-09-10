import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  AppState,
  NativeModules,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Palette } from '@/constants/colors';
import { getNotificationPaymentSummary } from '@/utils/universalPaymentParser';

interface NotificationLog {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  postedAt: number;
}

const notificationLogModule = NativeModules.NotificationLogModule as {
  getLogs: () => Promise<string>;
  getBannedNames: () => Promise<string>;
  banName: (name: string) => Promise<void>;
  unbanName: (name: string) => Promise<void>;
  openNotificationAccessSettings: () => void;
} | undefined;

export default function NotificationLogsScreen() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [detailLog, setDetailLog] = useState<NotificationLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);

  const loadLogs = async () => {
    if (!notificationLogModule || loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      const rawLogs = await notificationLogModule.getLogs();
      const parsedLogs = JSON.parse(rawLogs) as NotificationLog[];
      const uniqueLogs = parsedLogs.filter((log, index, items) => (
        items.findIndex((item) => item.id === log.id) === index
      ));
      setLogs(uniqueLogs);
    } catch (error) {
      console.warn('Notification logs load failed:', error);
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!notificationLogModule) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      if (interval || AppState.currentState !== 'active') return;
      void loadLogs();
      interval = setInterval(() => void loadLogs(), 15000);
    };
    const stopPolling = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = undefined;
    };
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') startPolling();
      else stopPolling();
    });
    startPolling();
    return () => {
      stopPolling();
      appStateSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLogs} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>알림 로그</Text>
            <Text style={styles.subtitle}>수집된 알림을 확인하고 기록할 항목을 선택하세요.</Text>
          </View>
          <Pressable onPress={() => notificationLogModule?.openNotificationAccessSettings()} style={styles.settingsButton}>
            <Text style={styles.settingsButtonText}>권한 설정</Text>
          </Pressable>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>선택 앱 알림을 모두 저장합니다</Text>
          <Text style={styles.noticeText}>입금, 결제, 출금, 취소가 감지되면 수입 또는 지출 태그와 금액을 함께 표시합니다.</Text>
        </View>

        <View style={styles.countRow}>
          <Text style={styles.count}>{logs.length}건</Text>
        </View>

        {logs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>아직 수집된 알림이 없습니다</Text>
            <Text style={styles.emptyText}>권한을 허용한 뒤 은행이나 카드 알림을 받아보세요.</Text>
          </View>
        ) : logs.map((log, index) => {
          const summary = getNotificationPaymentSummary(log.title, log.text);
          const summaryLabel = summary?.label === '입금' || summary?.label === '취소' ? '수입' : summary?.label;
          const typeColor = summaryLabel === '수입' ? Palette.blue : summaryLabel ? Palette.coral : Palette.muted;
          return (
            <Pressable key={`${log.id}-${index}`} onPress={() => setDetailLog(log)} style={styles.log}>
              <View style={styles.logBody}>
                <View style={styles.logMeta}>
                  <View style={styles.appNameRow}>
                    <Text style={styles.appName}>{log.appName}</Text>
                  </View>
                  <Text style={styles.date}>{new Date(log.postedAt).toLocaleString('ko-KR')}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.typeLabel, { color: typeColor }]}>{summary ? `${summaryLabel} - ${summary.amount !== undefined ? `${summary.amount.toLocaleString('ko-KR')}원` : '금액 미감지'}` : '금융 키워드 미감지'}</Text>
                </View>
                <Text style={styles.merchant}>{summary ? log.title || log.text || '알림 내용 확인' : '내용을 눌러 알림 전문 확인'}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal visible={detailLog !== null} animationType="slide" transparent onRequestClose={() => setDetailLog(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>알림 전문</Text>
              <Pressable onPress={() => setDetailLog(null)}><Text style={styles.close}>닫기</Text></Pressable>
            </View>
            {detailLog && <>
              <Text style={styles.detailApp}>{detailLog.appName}</Text>
              <Text style={styles.detailDate}>{new Date(detailLog.postedAt).toLocaleString('ko-KR')}</Text>
              <View style={styles.rawNotice}>
                {!!detailLog.title && <Text style={styles.rawTitle}>{detailLog.title}</Text>}
                <Text style={styles.rawText}>{detailLog.text || '(본문 없음)'}</Text>
              </View>
              <Text style={styles.packageName}>{detailLog.packageName}</Text>
            </>}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.canvas },
  content: { padding: 20, paddingTop: 28, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { color: Palette.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: Palette.muted, fontSize: 13, marginTop: 6 },
  settingsButton: { backgroundColor: Palette.sageDark, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  settingsButtonText: { color: Palette.white, fontSize: 12, fontWeight: '800' },
  notice: { backgroundColor: Palette.mint, borderRadius: 16, padding: 14, gap: 5 },
  noticeTitle: { color: Palette.sageDark, fontWeight: '900' },
  noticeText: { color: Palette.ink, fontSize: 12, lineHeight: 18 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  count: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  bannedSection: { backgroundColor: Palette.paper, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: Palette.line },
  bannedTitle: { color: Palette.ink, fontSize: 14, fontWeight: '900' },
  bannedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bannedName: { flex: 1, color: Palette.muted, fontSize: 13 },
  unbanButton: { paddingHorizontal: 10, paddingVertical: 6 },
  unbanText: { color: Palette.sageDark, fontSize: 12, fontWeight: '900' },
  log: { flexDirection: 'row', gap: 12, backgroundColor: Palette.paper, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Palette.line },
  logBody: { flex: 1, gap: 5 },
  logMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  appNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  appName: { color: Palette.sageDark, fontSize: 12, fontWeight: '900' },
  banButton: { paddingHorizontal: 8, paddingVertical: 4 },
  banText: { color: Palette.coral, fontSize: 10, fontWeight: '900' },
  date: { color: Palette.muted, fontSize: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  typeLabel: { fontSize: 15, fontWeight: '900' },
  amount: { color: Palette.ink, fontSize: 17, fontWeight: '900' },
  merchant: { color: Palette.muted, fontSize: 12 },
  packageName: { color: Palette.muted, fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,34,27,0.38)' },
  detailModal: { backgroundColor: Palette.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 10 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { color: Palette.ink, fontSize: 20, fontWeight: '900' },
  close: { color: Palette.sageDark, fontSize: 13, fontWeight: '800' },
  detailApp: { color: Palette.sageDark, fontSize: 15, fontWeight: '900' },
  detailDate: { color: Palette.muted, fontSize: 11 },
  rawNotice: { backgroundColor: Palette.canvas, borderRadius: 14, padding: 15, gap: 8, marginTop: 6 },
  rawTitle: { color: Palette.ink, fontSize: 15, fontWeight: '800' },
  rawText: { color: Palette.ink, fontSize: 14, lineHeight: 21 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  emptyText: { color: Palette.muted, fontSize: 12, textAlign: 'center' },
});
