export type TransactionType = 'income' | 'expense';

export type CategoryType = {
  id: string;
  name: string;
  type: TransactionType;
};

export type Transaction = {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description?: string;
};

export type UserProfile = {
  id: string;
  username: string;
};