export interface Transaction {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  categoryTag: string;
  note?: string;
}
