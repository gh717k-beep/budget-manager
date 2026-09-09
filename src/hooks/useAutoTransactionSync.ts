import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { acknowledgeTransactions, readNotificationLogs, readPendingTransactions } from '@/services/notificationListener';
import { ParsedNotificationTransaction } from '@/types/installedApp';
import { parsePaymentNotification } from '@/utils/universalPaymentParser';

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
    let cancelled = false;
    const sync = async () => {
      if (cancelled || syncingRef.current) return;
      syncingRef.current = true;
      try {
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
        await acknowledgeTransactions(pending.map((transaction) => transaction.id));
        DeviceEventEmitter.emit('budget-book-transactions-synced');
        onSyncedRef.current?.();
      } catch (error) {
        console.warn('Automatic notification transaction sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    };
    void sync();
    const interval = setInterval(() => void sync(), 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [database]);
}