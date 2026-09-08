import { MonthlyBudget } from '@/types/budget';
import { Transaction } from '@/types/transaction';

export const sumTransactions = (transactions: Transaction[], type: Transaction['type'], yearMonth?: string) =>
  transactions
    .filter((transaction) => transaction.type === type && (!yearMonth || transaction.date.startsWith(yearMonth)))
    .reduce((sum, transaction) => sum + transaction.amount, 0);

export const sumTransactionsInRange = (transactions: Transaction[], type: Transaction['type'], startDate: string, endDate: string) =>
  transactions
    .filter((transaction) => transaction.type === type && transaction.date >= startDate && transaction.date <= endDate)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

export const getBudgetAmounts = (budget: MonthlyBudget) => ({
  living: budget.totalIncome * budget.allocations.livingExpensePercent / 100,
  savings: budget.totalIncome * budget.allocations.savingsPercent / 100,
  custom: budget.totalIncome * budget.allocations.customPercent / 100,
});

export const getUsageRatio = (spent: number, target: number) => target > 0 ? spent / target : 0;

export const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('ko-KR')}원`;
