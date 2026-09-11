import { NativeModules, Platform } from 'react-native';
import { ParsedNotificationTransaction } from '@/types/installedApp';
import type { AiPaymentResult } from '@/services/aiParser';

interface NotificationNativeModule {
  getLogs: () => Promise<string>;
  removeNonFinancialLogs?: () => Promise<void>;
  getPendingTransactions: () => Promise<string>;
  clearPendingTransactions: (idsJson: string) => Promise<void>;
  openNotificationAccessSettings: () => void;
  setBackgroundAiApiKey?: (apiKey: string) => Promise<void>;
}

const nativeModule = NativeModules.NotificationLogModule as NotificationNativeModule | undefined;

export interface NotificationLogRecord {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  postedAt: number;
  aiResult?: AiPaymentResult;
}

export async function readNotificationLogs(): Promise<NotificationLogRecord[]> {
  if (Platform.OS !== 'android' || !nativeModule) return [];
  const raw = await nativeModule.getLogs();
  return JSON.parse(raw) as NotificationLogRecord[];
}

export async function readPendingTransactions(): Promise<ParsedNotificationTransaction[]> {
  if (Platform.OS !== 'android' || !nativeModule) return [];
  const raw = await nativeModule.getPendingTransactions();
  return JSON.parse(raw) as ParsedNotificationTransaction[];
}

export async function acknowledgeTransactions(ids: string[]): Promise<void> {
  if (Platform.OS === 'android' && ids.length) await nativeModule?.clearPendingTransactions(JSON.stringify(ids));
}

export function openNotificationAccessSettings(): void {
  if (Platform.OS === 'android') nativeModule?.openNotificationAccessSettings();
}

export async function removeNonFinancialLogs(): Promise<void> {
  if (Platform.OS === 'android') await nativeModule?.removeNonFinancialLogs?.();
}