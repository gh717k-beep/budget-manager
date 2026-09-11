import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { useAutoTransactionSync } from '@/hooks/useAutoTransactionSync';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <SQLiteProvider databaseName="budget-book.db" onInit={initializeDatabase}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="dark" />
          <AutomaticTransactionSync />
          <AppTabs />
        </ThemeProvider>
      </SafeAreaProvider>
    </SQLiteProvider>
  );
}

function AutomaticTransactionSync() {
  useAutoTransactionSync();
  return null;
}

async function initializeDatabase(database: { execAsync: (source: string) => Promise<void> }) {
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, category_tag TEXT NOT NULL, note TEXT);
      CREATE TABLE IF NOT EXISTS budgets (year_month TEXT PRIMARY KEY NOT NULL, payday INTEGER, display_mode TEXT, total_income REAL NOT NULL, living_percent REAL NOT NULL, savings_percent REAL NOT NULL, custom_percent REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
      UPDATE transactions
      SET note = substr(note, instr(note, ' · ') + 3)
      WHERE note LIKE '% 알림 자동 기록 · %';
      DELETE FROM transactions WHERE (id = '1' AND note = '점심 식사') OR (id = '2' AND note = '버스 충전') OR (id = '3' AND note = '월급');
    `);
  } catch (error) {
    console.warn('SQLite initialization failed:', error);
  }
}
