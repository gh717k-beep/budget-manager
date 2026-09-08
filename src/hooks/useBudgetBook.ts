import { useMemo, useState } from 'react';
import { MonthlyBudget } from '@/types/budget';
import { Transaction } from '@/types/transaction';
import { toDateString, toYearMonth } from '@/utils/dateUtils';

const today = new Date();
const currentMonth = toYearMonth(today);
const currentDate = toDateString(today);

const initialTransactions: Transaction[] = [
  { id: '1', date: currentDate, type: 'EXPENSE', amount: 12500, categoryTag: '식비', note: '점심 식사' },
  { id: '2', date: currentDate, type: 'EXPENSE', amount: 4200, categoryTag: '교통', note: '버스 충전' },
  { id: '3', date: `${currentMonth}-01`, type: 'INCOME', amount: 3000000, categoryTag: '월급', note: '월급' },
];

const makeBudget = (yearMonth: string): MonthlyBudget => ({
  yearMonth,
  totalIncome: 3000000,
  allocations: { livingExpensePercent: 50, savingsPercent: 30, customPercent: 20 },
});

export function useBudgetBook() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [budgets, setBudgets] = useState<Record<string, MonthlyBudget>>({});
  const [lastPayday, setLastPayday] = useState(1);
  const [lastTotalIncome, setLastTotalIncome] = useState(3000000);

  const saveTransaction = (transaction: Transaction) => {
    setTransactions((current) => {
      const exists = current.some((item) => item.id === transaction.id);
      return exists ? current.map((item) => item.id === transaction.id ? transaction : item) : [transaction, ...current];
    });
  };

  const removeTransaction = (id: string) => setTransactions((current) => current.filter((item) => item.id !== id));

  const getBudget = (yearMonth: string) => ({
    ...budgets[yearMonth] ?? makeBudget(yearMonth),
    payday: budgets[yearMonth]?.payday ?? lastPayday,
    totalIncome: budgets[yearMonth]?.totalIncome ?? lastTotalIncome,
  });

  const saveBudget = (budget: MonthlyBudget) => {
    setLastPayday(budget.payday ?? lastPayday);
    setLastTotalIncome(budget.totalIncome);
    setBudgets((current) => ({ ...current, [budget.yearMonth]: budget }));
  };

  const transactionsByMonth = useMemo(() => transactions, [transactions]);

  return { transactions: transactionsByMonth, saveTransaction, removeTransaction, getBudget, saveBudget };
}
