import { useSQLiteContext } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AppState, DeviceEventEmitter, Platform } from 'react-native';
import { acknowledgeTransactions, readNotificationLogs, readPendingTransactions } from '@/services/notificationListener';
import { ParsedNotificationTransaction } from '@/types/installedApp';
import { parsePaymentNotification } from '@/utils/universalPaymentParser';

const processedNotificationIdsKey = '@project1/processed-notification-ids';
const maxProcessedNotificationIds = 2000;

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
    let interval: ReturnType<typeof setInterval> | undefined;
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
        const pending = await readPendingTransactions();
        const logTransactions: ParsedNotificationTransaction[] = pending.length ? [] : (await readNotificationLogs())
          .filter((log) => !processedLogIdsRef.current.has(log.id))
          .map((log) => parsePaymentNotification(log))
          .filter((transaction): transaction is ParsedNotificationTransaction => transaction !== null);
        const transactions = [...pending, ...logTransactions];
        if (cancelled || !transactions.length) return;
        for (const transaction of transactions) {
          if (cancelled) return;
          await database.runAsync(
            'INSERT OR IGNORE INTO transactions (id, date, type, amount, category_tag, note) VALUES (?, ?, ?, ?, ?, ?)',
            transaction.id,
            transaction.date,
            transaction.type,
            transaction.amount,
            getAutomaticCategory(transaction),
            `${transaction.appName} 알림 자동 기록${transaction.merchant ? ` · ${transaction.merchant}` : ''}`,
          );
        }
        if (cancelled) return;
        pending.forEach((transaction) => processedLogIdsRef.current.add(transaction.id));
        logTransactions.forEach((transaction) => processedLogIdsRef.current.add(transaction.id));
        if (logTransactions.length) {
          const processedIds = [...processedLogIdsRef.current].slice(-maxProcessedNotificationIds);
          processedLogIdsRef.current = new Set(processedIds);
          await AsyncStorage.setItem(
            processedNotificationIdsKey,
            JSON.stringify(processedIds),
          );
        }
        await acknowledgeTransactions(pending.map((transaction) => transaction.id));
        DeviceEventEmitter.emit('budget-book-transactions-synced');
        onSyncedRef.current?.();
      } catch (error) {
        console.warn('Automatic notification transaction sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    };
    const startPolling = () => {
      if (interval || AppState.currentState !== 'active') return;
      void sync();
      interval = setInterval(() => void sync(), 15000);
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
      cancelled = true;
      stopPolling();
      appStateSubscription.remove();
    };
  }, [database]);
}