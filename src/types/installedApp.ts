export interface InstalledApp {
  appName: string;
  packageName: string;
  isSystemApp: boolean;
  iconUri?: string;
}

export type ParsedTransactionType = 'INCOME' | 'EXPENSE';

export interface ParsedNotificationTransaction {
  id: string;
  date: string;
  type: ParsedTransactionType;
  amount: number;
  merchant: string;
  packageName: string;
  appName: string;
  sourceText: string;
}