import { CSVRecord } from '../compare';

export function generateSampleData(): { goodBudget: CSVRecord[], banks: CSVRecord[] } {
  const goodBudget: CSVRecord[] = [
    {
      name: 'Grocery Store',
      envelope: 'Groceries',
      formattedAmount: '$50.00',
      date: '2025-04-01'
    },
    {
      name: 'Split Transaction',
      envelope: '',
      formattedAmount: '$100.00',
      date: '2025-04-02'
    },
    {
      name: 'PAYMENT',
      envelope: 'Credit Card',
      formattedAmount: '$500.00',
      date: '2025-04-03'
    }
  ];

  const banks: CSVRecord[] = [
    {
      name: 'GROCERY STORE',
      envelope: '',
      formattedAmount: '$50.00',
      date: '2025-04-01'
    },
    {
      name: 'AMAZON.COM',
      envelope: '',
      formattedAmount: '$75.00',
      date: '2025-04-02'
    }
  ];

  return { goodBudget, banks };
} 