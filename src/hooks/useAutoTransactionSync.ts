import { useSQLiteContext } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { readNotificationLogs } from '@/services/notificationListener';
import { normalizeNotificationMemo, parsePaymentWithAI, readAiClassifications, readManualTags, saveAiClassifications } from '@/services/aiParser';
import { ParsedNotificationTransaction } from '@/types/installedApp';
import { toDateString } from '@/utils/dateUtils';
import { parsePaymentNotification } from '@/utils/universalPaymentParser';

const processedNotificationIdsKey = '@project1/processed-notification-ids';
const maxProcessedNotificationIds = 2000;

interface SyncTransaction extends ParsedNotificationTransaction {
  categoryTag?: string;
}

function getAutomaticCategory(transaction: ParsedNotificationTransaction): string {
  if (transaction.sourceText.includes('취소')) return '입금';
  if (transaction.sourceText.includes('입금')) return '입금';
  if (transaction.sourceText.includes('출금')) return '출금';
  if (transaction.sourceText.includes('결제')) return '결제';
  return '기타';
}

export function useAutoTransactionSync(onSynced?: () => void): void {
  const database = useSQLiteContext();
  const onSyncedRef = useRef(onSynced);
  const syncingRef = useRef(false);
  const processedLogIdsRef = useRef(new Set<string>());
  onSyncedRef.current = onSynced;

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelled = false;
    let processedIdsLoaded = false;
    const loadProcessedIds = async () => {
      if (processedIdsLoaded) return;
      const raw = await AsyncStorage.getItem(processedNotificationIdsKey);
      if (raw) {
        const ids = (JSON.parse(raw) as string[]).slice(-maxProcessedNotificationIds);
        ids.forEach((id) => processedLogIdsRef.current.add(id));
      }
      processedIdsLoaded = true;
    };
    const sync = async () => {
      if (cancelled || AppState.currentState !== 'active' || syncingRef.current) return;
      syncingRef.current = true;
      try {
        await loadProcessedIds();
        if (cancelled) return;
        const logTransactions: SyncTransaction[] = [];
        const completedLogIds: string[] = [];
        const classifications = await readAiClassifications();
        const manualTags = await readManualTags();
        const logs = await readNotificationLogs();
        for (const log of logs.filter((item) => !processedLogIdsRef.current.has(item.id))) {
          const manualTag = manualTags[normalizeNotificationMemo(log)];
          const aiResult = log.aiResult ?? (manualTag && !classifications[log.id]
            ? null
            : await parsePaymentWithAI(log));
          if (aiResult) {
            classifications[log.id] = { result: aiResult, source: 'ai' };
            completedLogIds.push(log.id);
          }
          if (aiResult?.isPayment && aiResult.type !== 'IGNORE' && aiResult.amount > 0) {
            logTransactions.push({
              id: log.id,
              date: toDateString(new Date(log.postedAt)),
              type: aiResult.type,
              amount: aiResult.amount,
              merchant: aiResult.place,
              packageName: log.packageName,
              appName: log.appName,
              sourceText: `${log.title} ${log.text}`,
              categoryTag: manualTag || aiResult.categoryTag,
            });
          } else {
            const fallback = parsePaymentNotification(log);
            if (fallback) {
              if (!aiResult) completedLogIds.push(log.id);
              classifications[log.id] = {
                result: {
                  isPayment: true,
                  amount: fallback.amount,
                  type: fallback.type,
                  transactionKind: 'PAYMENT',
                  place: fallback.merchant || '',
                  categoryTag: getAutomaticCategory(fallback),
                },
                source: 'fallback',
              };
              logTransactions.push({ ...fallback, categoryTag: manualTag || getAutomaticCategory(fallback) });
            }
          }
        }
        if (completedLogIds.length) await saveAiClassifications(classifications);
        const transactions: SyncTransaction[] = logTransactions;
        if (cancelled) return;
        for (const transaction of transactions) {
          if (cancelled) return;
          await database.runAsync(
            'INSERT OR IGNORE INTO transactions (id, date, type, amount, category_tag, note) VALUES (?, ?, ?, ?, ?, ?)',
            transaction.id,
            transaction.date,
            transaction.type,
            transaction.amount,
            transaction.categoryTag || getAutomaticCategory(transaction),
            transaction.merchant || null,
          );
        }
        if (cancelled) return;
        completedLogIds.forEach((id) => processedLogIdsRef.current.add(id));
        if (completedLogIds.length) {
          const processedIds = [...processedLogIdsRef.current].slice(-maxProcessedNotificationIds);
          processedLogIdsRef.current = new Set(processedIds);
          await AsyncStorage.setItem(
            processedNotificationIdsKey,
            JSON.stringify(processedIds),
          );
        }
        DeviceEventEmitter.emit('budget-book-transactions-synced');
        onSyncedRef.current?.();
      } catch (error) {
        console.warn('Automatic notification transaction sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    };
    const syncRequestSubscription = DeviceEventEmitter.addListener('budget-book-sync-requested', () => {
      if (AppState.currentState === 'active') void sync();
    });
    return () => {
      cancelled = true;
      syncRequestSubscription.remove();
    };
  }, [database]);
}