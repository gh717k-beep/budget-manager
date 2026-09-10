import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { MonthlyBudget } from '@/types/budget';
import { Transaction } from '@/types/transaction';

const makeBudget = (yearMonth: string): MonthlyBudget => ({
  yearMonth,
  totalIncome: 3000000,
  allocations: { livingExpensePercent: 50, savingsPercent: 30, customPercent: 20 },
});

export function useBudgetBook() {
  const database = useSQLiteContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, MonthlyBudget>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [lastPayday, setLastPayday] = useState(1);
  const [lastTotalIncome, setLastTotalIncome] = useState(3000000);
  const [displayMode, setDisplayMode] = useState<MonthlyBudget['displayMode']>('remaining');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const transactionRows = await database.getAllAsync<{ id: string; date: string; type: Transaction['type']; amount: number; category_tag: string; note: string | null }>('SELECT id, date, type, amount, category_tag, note FROM transactions ORDER BY date DESC');
        const budgetRows = await database.getAllAsync<{ year_month: string; payday: number | null; display_mode: MonthlyBudget['displayMode'] | null; total_income: number; living_percent: number; savings_percent: number; custom_percent: number }>('SELECT * FROM budgets');
        const settings = await database.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
        const settingsMap = Object.fromEntries(settings.map((row) => [row.key, row.value]));
        if (cancelled) return;
        if (transactionRows.length) {
          setTransactions(transactionRows.map((row) => ({ id: row.id, date: row.date, type: row.type, amount: row.amount, categoryTag: row.category_tag, note: row.note ?? undefined })));
        } else {
          setTransactions([]);
        }
        if (budgetRows.length) setBudgets(Object.fromEntries(budgetRows.map((row) => [row.year_month, { yearMonth: row.year_month, payday: row.payday ?? undefined, displayMode: row.display_mode ?? undefined, totalIncome: row.total_income, allocations: { livingExpensePercent: row.living_percent, savingsPercent: row.savings_percent, customPercent: row.custom_percent } }])));
        if (settingsMap.lastPayday) setLastPayday(Number(settingsMap.lastPayday));
        if (settingsMap.lastTotalIncome) setLastTotalIncome(Number(settingsMap.lastTotalIncome));
        if (settingsMap.displayMode) setDisplayMode(settingsMap.displayMode as MonthlyBudget['displayMode']);
      } catch (error) {
        console.warn('SQLite data load failed:', error);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [database, reloadKey]);

  const saveTransaction = (transaction: Transaction) => {
    setTransactions((current) => {
      const exists = current.some((item) => item.id === transaction.id);
      return exists ? current.map((item) => item.id === transaction.id ? transaction : item) : [transaction, ...current];
    });
    void database.runAsync('INSERT OR REPLACE INTO transactions (id, date, type, amount, category_tag, note) VALUES (?, ?, ?, ?, ?, ?)', transaction.id, transaction.date, transaction.type, transaction.amount, transaction.categoryTag, transaction.note ?? null);
  };

  const removeTransaction = (id: string) => { setTransactions((current) => current.filter((item) => item.id !== id)); void database.runAsync('DELETE FROM transactions WHERE id = ?', id); };

  const getBudget = (yearMonth: string) => ({
    ...budgets[yearMonth] ?? makeBudget(yearMonth),
    payday: budgets[yearMonth]?.payday ?? lastPayday,
    totalIncome: budgets[yearMonth]?.totalIncome ?? lastTotalIncome,
    displayMode,
  });

  const saveBudget = (budget: MonthlyBudget) => {
    setLastPayday(budget.payday ?? lastPayday);
    setLastTotalIncome(budget.totalIncome);
    setDisplayMode(budget.displayMode ?? displayMode);
    setBudgets((current) => ({ ...current, [budget.yearMonth]: budget }));
    void database.runAsync('INSERT OR REPLACE INTO budgets (year_month, payday, display_mode, total_income, living_percent, savings_percent, custom_percent) VALUES (?, ?, ?, ?, ?, ?, ?)', budget.yearMonth, budget.payday ?? null, budget.displayMode ?? displayMode ?? null, budget.totalIncome, budget.allocations.livingExpensePercent, budget.allocations.savingsPercent, budget.allocations.customPercent);
    void database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lastPayday', String(budget.payday ?? lastPayday));
    void database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lastTotalIncome', String(budget.totalIncome));
    void database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'displayMode', budget.displayMode ?? displayMode ?? 'remaining');
  };

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  return { transactions, saveTransaction, removeTransaction, getBudget, saveBudget, reload };
}
