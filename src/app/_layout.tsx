import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <SQLiteProvider databaseName="budget-book.db" onInit={initializeDatabase}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <AppTabs />
        </ThemeProvider>
      </SafeAreaProvider>
    </SQLiteProvider>
  );
}

async function initializeDatabase(database: { execAsync: (source: string) => Promise<void> }) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, category_tag TEXT NOT NULL, note TEXT);
    CREATE TABLE IF NOT EXISTS budgets (year_month TEXT PRIMARY KEY NOT NULL, payday INTEGER, display_mode TEXT, total_income REAL NOT NULL, living_percent REAL NOT NULL, savings_percent REAL NOT NULL, custom_percent REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);
}
