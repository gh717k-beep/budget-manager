export interface MonthlyBudget {
  yearMonth: string;
  payday?: number;
  totalIncome: number;
  allocations: {
    livingExpensePercent: number;
    savingsPercent: number;
    customPercent: number;
  };
}
