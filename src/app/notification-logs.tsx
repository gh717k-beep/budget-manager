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
  TextInput,
  View,
} from 'react-native';

import { Palette } from '@/constants/colors';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import AppSelectionScreen from '@/screens/AppSelectionScreen';
import { getAiRetryAfterSeconds, getGeminiApiKey, normalizeNotificationMemo, parsePaymentWithAI, readAiClassifications, readManualTags, saveAiClassifications, saveGeminiApiKey, saveManualTag, type AiClassificationRecord } from '@/services/aiParser';
import { getNotificationPaymentSummary } from '@/utils/universalPaymentParser';
import { removeNonFinancialLogs } from '@/services/notificationListener';

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
  const [classifications, setClassifications] = useState<Record<string, AiClassificationRecord>>({});
  const [manualTags, setManualTags] = useState<Record<string, string>>({});
  const [detailLog, setDetailLog] = useState<NotificationLog | null>(null);
  const [showAppSelection, setShowAppSelection] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState('');
  const [manualTagLog, setManualTagLog] = useState<NotificationLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);

  const loadLogs = async () => {
    if (!notificationLogModule || loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);
    try {
      await removeNonFinancialLogs();
      const rawLogs = await notificationLogModule.getLogs();
      const parsedLogs = JSON.parse(rawLogs) as NotificationLog[];
      const uniqueLogs = parsedLogs.filter((log, index, items) => (
        items.findIndex((item) => item.id === log.id) === index
      ));
      setLogs(uniqueLogs);
      setClassifications(await readAiClassifications());
      setManualTags(await readManualTags());
    } catch (error) {
      console.warn('Notification logs load failed:', error);
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  };

  const chooseManualTag = async (tag: string) => {
    if (!manualTagLog) return;
    const memoKey = normalizeNotificationMemo(manualTagLog);
    await saveManualTag(memoKey, tag);
    setManualTags((current) => ({ ...current, [memoKey]: tag }));
    setManualTagLog(null);
  };

  const reanalyzeLog = async (log: NotificationLog) => {
    if (reanalyzingId) return;
    const retrySeconds = getAiRetryAfterSeconds();
    if (retrySeconds > 0) {
      setAiNotice(`AI 요청 한도 초과. ${retrySeconds}초 후 다시 시도하세요.`);
      return;
    }
    setReanalyzingId(log.id);
    setAiNotice('');
    try {
      const nextClassifications = { ...classifications };
      const result = await parsePaymentWithAI(log);
      if (!result) {
        setAiNotice('AI 분석에 실패했거나 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.');
        return;
      }
      nextClassifications[log.id] = { result, source: 'ai' };
      await saveAiClassifications(nextClassifications);
      setClassifications(nextClassifications);
    } catch (error) {
      setAiNotice('AI 재분석 결과를 저장하지 못했습니다.');
    } finally {
      setReanalyzingId(null);
    }
  };

  useEffect(() => {
    void getGeminiApiKey().then((key) => setApiKeyConfigured(Boolean(key)));
  }, []);

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
          <View style={styles.headerCopy}>
            <Text style={styles.title}>알림 로그</Text>
            <Text style={styles.subtitle}>수집된 알림을 확인하고 기록할 항목을 선택하세요.</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => { setApiKeyInput(''); setShowApiKey(true); }} style={styles.apiButton}>
              <Text style={styles.settingsButtonText}>{apiKeyConfigured ? 'API 키 설정됨' : 'API 키'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowAppSelection(true)} style={styles.appButton}>
              <Text style={styles.settingsButtonText}>앱 선택</Text>
            </Pressable>
            <Pressable onPress={() => notificationLogModule?.openNotificationAccessSettings()} style={styles.settingsButton}>
              <Text style={styles.settingsButtonText}>권한 설정</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>선택 앱 알림을 모두 저장합니다</Text>
          <Text style={styles.noticeText}>입금, 결제, 출금, 취소가 감지되면 수입 또는 지출 태그와 금액을 함께 표시합니다.</Text>
        </View>

        <View style={styles.countRow}>
          <Text style={styles.count}>{logs.length}건</Text>
        </View>
        {!!aiNotice && <Text style={styles.aiNotice}>{aiNotice}</Text>}

        {logs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>아직 수집된 알림이 없습니다</Text>
            <Text style={styles.emptyText}>권한을 허용한 뒤 은행이나 카드 알림을 받아보세요.</Text>
          </View>
        ) : logs.map((log, index) => {
          const summary = getNotificationPaymentSummary(log.title, log.text);
          const classification = classifications[log.id]?.result;
          const manualTag = manualTags[normalizeNotificationMemo(log)];
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
                {classification && <View style={styles.aiClassification}><Text style={styles.aiLabel}>{classifications[log.id].source === 'ai' ? 'AI 분석' : '자동 분석'}</Text><Text style={styles.aiText}>태그 : {manualTag || classification.categoryTag}</Text><Text style={styles.aiText}>금액 : {classification.amount.toLocaleString('ko-KR')}원</Text><Text style={styles.aiText}>메모 : {classification.place || '내용 없음'}</Text></View>}
                <View style={styles.logActions}><Pressable onPress={(event) => { event.stopPropagation(); setManualTagLog(log); }} style={styles.manualTagButton}><Text style={styles.manualTagText}>{manualTag ? `수동 태그: ${manualTag}` : '수동 태그'}</Text></Pressable><Pressable disabled={reanalyzingId !== null} onPress={(event) => { event.stopPropagation(); void reanalyzeLog(log); }} style={[styles.logReanalyzeButton, reanalyzingId === log.id && styles.logReanalyzeDisabled]}><Text style={styles.logReanalyzeText}>{reanalyzingId === log.id ? '분석 중' : 'AI 재분석'}</Text></Pressable></View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal visible={showAppSelection} animationType="slide" onRequestClose={() => setShowAppSelection(false)}>
        <View style={styles.appSelectionModal}>
          <View style={styles.appSelectionHeader}>
            <Text style={styles.appSelectionTitle}>앱 선택</Text>
            <Pressable onPress={() => setShowAppSelection(false)} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <AppSelectionScreen />
        </View>
      </Modal>
      <Modal visible={manualTagLog !== null} animationType="fade" transparent onRequestClose={() => setManualTagLog(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.tagModal}>
            <View style={styles.detailHeader}><Text style={styles.detailTitle}>수동 태그 지정</Text><Pressable onPress={() => setManualTagLog(null)}><Text style={styles.close}>닫기</Text></Pressable></View>
            <Text style={styles.apiDescription}>같은 알림 내용에 앞으로 우선 적용됩니다.</Text>
            <View style={styles.tagGrid}>{[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])].map((tag) => <Pressable key={tag} onPress={() => void chooseManualTag(tag)} style={styles.tagOption}><Text style={styles.tagOptionText}>{tag}</Text></Pressable>)}</View>
          </View>
        </View>
      </Modal>
      <Modal visible={showApiKey} animationType="fade" transparent onRequestClose={() => setShowApiKey(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.apiModal}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Gemini API 키</Text>
              <Pressable onPress={() => setShowApiKey(false)}><Text style={styles.close}>닫기</Text></Pressable>
            </View>
            <Text style={styles.apiDescription}>입력한 키는 이 기기의 보안 저장소에 저장됩니다.</Text>
            <TextInput value={apiKeyInput} onChangeText={setApiKeyInput} placeholder="API 키를 입력하세요" placeholderTextColor={Palette.muted} secureTextEntry style={styles.apiInput} autoCapitalize="none" autoCorrect={false} />
            <View style={styles.apiActions}>
              <Pressable onPress={() => { void saveGeminiApiKey(''); setApiKeyConfigured(false); setApiKeyInput(''); }} style={styles.clearApiButton}><Text style={styles.clearApiText}>키 삭제</Text></Pressable>
              <Pressable onPress={() => { void saveGeminiApiKey(apiKeyInput).then(() => { setApiKeyConfigured(Boolean(apiKeyInput.trim())); setApiKeyInput(''); setShowApiKey(false); }); }} style={styles.saveApiButton}><Text style={styles.saveApiText}>저장</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
              {classifications[detailLog.id] && <View style={styles.detailClassification}><Text style={styles.aiLabel}>{classifications[detailLog.id].source === 'ai' ? 'AI 분석' : '자동 분석'}</Text><Text style={styles.detailClassificationText}>태그 : {classifications[detailLog.id].result.categoryTag}</Text><Text style={styles.detailClassificationText}>금액 : {classifications[detailLog.id].result.amount.toLocaleString('ko-KR')}원</Text><Text style={styles.detailClassificationText}>메모 : {classifications[detailLog.id].result.place || '내용 없음'}</Text></View>}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: Palette.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: Palette.muted, fontSize: 13, marginTop: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, flexShrink: 1, flexWrap: 'wrap', maxWidth: 190 },
  apiButton: { backgroundColor: Palette.blue, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 8, flexShrink: 1 },
  appButton: { backgroundColor: Palette.amber, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 8, flexShrink: 1 },
  settingsButton: { backgroundColor: Palette.sageDark, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 8, flexShrink: 1 },
  settingsButtonText: { color: Palette.white, fontSize: 10, fontWeight: '800' },
  appSelectionModal: { flex: 1, backgroundColor: Palette.canvas },
  appSelectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  appSelectionTitle: { color: Palette.ink, fontSize: 20, fontWeight: '900' },
  apiModal: { backgroundColor: Palette.paper, borderRadius: 24, padding: 22, margin: 20, gap: 14 },
  apiDescription: { color: Palette.muted, fontSize: 12, lineHeight: 18 },
  apiInput: { backgroundColor: Palette.canvas, borderColor: Palette.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: Palette.ink },
  apiActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  clearApiButton: { paddingHorizontal: 12, paddingVertical: 10 },
  clearApiText: { color: Palette.coral, fontWeight: '800', fontSize: 12 },
  saveApiButton: { backgroundColor: Palette.sageDark, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  saveApiText: { color: Palette.white, fontWeight: '800', fontSize: 12 },
  notice: { backgroundColor: Palette.mint, borderRadius: 16, padding: 14, gap: 5 },
  noticeTitle: { color: Palette.sageDark, fontWeight: '900' },
  noticeText: { color: Palette.ink, fontSize: 12, lineHeight: 18 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  count: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  aiNotice: { color: Palette.coral, backgroundColor: Palette.coralSoft, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: '800' },
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
  aiClassification: { backgroundColor: Palette.canvas, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, gap: 2 },
  aiLabel: { color: Palette.sageDark, fontSize: 10, fontWeight: '900' },
  aiText: { color: Palette.ink, fontSize: 11, lineHeight: 16 },
  logReanalyzeButton: { alignSelf: 'flex-start', backgroundColor: Palette.mint, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, marginTop: 3 },
  logReanalyzeDisabled: { opacity: 0.5 },
  logReanalyzeText: { color: Palette.sageDark, fontSize: 10, fontWeight: '900' },
  logActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  manualTagButton: { alignSelf: 'flex-start', backgroundColor: Palette.amber, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  manualTagText: { color: Palette.ink, fontSize: 10, fontWeight: '900' },
  tagModal: { backgroundColor: Palette.paper, borderRadius: 24, padding: 22, margin: 20, gap: 14 },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagOption: { backgroundColor: Palette.mint, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  tagOptionText: { color: Palette.sageDark, fontSize: 12, fontWeight: '800' },
  packageName: { color: Palette.muted, fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,34,27,0.38)' },
  detailModal: { backgroundColor: Palette.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 10 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { color: Palette.ink, fontSize: 20, fontWeight: '900' },
  close: { color: Palette.sageDark, fontSize: 13, fontWeight: '800' },
  detailApp: { color: Palette.sageDark, fontSize: 15, fontWeight: '900' },
  detailDate: { color: Palette.muted, fontSize: 11 },
  detailClassification: { backgroundColor: Palette.mint, borderRadius: 12, padding: 11, gap: 4 },
  detailClassificationText: { color: Palette.ink, fontSize: 13, lineHeight: 19 },
  rawNotice: { backgroundColor: Palette.canvas, borderRadius: 14, padding: 15, gap: 8, marginTop: 6 },
  rawTitle: { color: Palette.ink, fontSize: 15, fontWeight: '800' },
  rawText: { color: Palette.ink, fontSize: 14, lineHeight: 21 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { color: Palette.ink, fontSize: 15, fontWeight: '900' },
  emptyText: { color: Palette.muted, fontSize: 12, textAlign: 'center' },
});
