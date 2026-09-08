export interface MonthlyBudget {
  yearMonth: string;
  payday?: number;
  displayMode?: 'remaining' | 'daily';
  totalIncome: number;
  allocations: {
    livingExpensePercent: number;
    savingsPercent: number;
    customPercent: number;
  };
}
