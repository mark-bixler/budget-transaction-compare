import { GoodBudgetParser, CitiBankParser, ChaseParser, USBankParser } from '../compare';

describe('CSV Parsers', () => {
  describe('GoodBudgetParser', () => {
    const parser = new GoodBudgetParser();

    test('transforms headers to lowercase', () => {
      expect(parser.transformHeader('Name')).toBe('name');
      expect(parser.transformHeader('Date')).toBe('date');
      expect(parser.transformHeader('Amount')).toBe('amount');
      expect(parser.transformHeader('Envelope')).toBe('envelope');
    });

    test('transforms record correctly', () => {
      const record = {
        name: 'Grocery Store',
        envelope: 'Groceries',
        amount: '100.50',
        date: '2024-03-15'
      };

      const result = parser.transformRecord(record);
      expect(result).toEqual({
        name: 'Grocery Store',
        envelope: 'Groceries',
        amount: 100.50,
        date: '2024-03-15'
      });
    });

    test('handles split transactions', () => {
      const record = {
        name: 'Split Transaction',
        envelope: '',
        amount: '200.00',
        date: '2024-03-15'
      };

      const result = parser.transformRecord(record);
      expect(result.envelope).toBe('--SPLIT--');
    });
  });

  describe('CitiBankParser', () => {
    const parser = new CitiBankParser();

    test('transforms headers correctly', () => {
      expect(parser.transformHeader('Description')).toBe('name');
      expect(parser.transformHeader('Amount')).toBe('amount');
    });

    test('inverts debit and credit amounts', () => {
      const record = {
        name: 'Citi Transaction',
        debit: '100.50',
        credit: '50.25',
        date: '2024-03-15'
      };

      const result = parser.transformRecord(record);
      expect(result).toEqual({
        name: 'Citi Transaction',
        envelope: '',
        amount: 0,
        debit: -100.50,
        credit: -50.25,
        date: '2024-03-15'
      });
    });
  });

  describe('ChaseParser', () => {
    const parser = new ChaseParser();

    test('transforms headers correctly', () => {
      expect(parser.transformHeader('Description')).toBe('name');
      expect(parser.transformHeader('Amount')).toBe('amount');
    });

    test('transforms record correctly', () => {
      const record = {
        name: 'Chase Transaction',
        amount: '150.75',
        date: '2024-03-15'
      };

      const result = parser.transformRecord(record);
      expect(result).toEqual({
        name: 'Chase Transaction',
        envelope: '',
        amount: 150.75,
        date: '2024-03-15'
      });
    });
  });

  describe('USBankParser', () => {
    const parser = new USBankParser();

    test('transforms headers correctly', () => {
      expect(parser.transformHeader('Name')).toBe('name');
      expect(parser.transformHeader('Amount')).toBe('amount');
    });

    test('transforms record correctly', () => {
      const record = {
        name: 'US Bank Transaction',
        amount: '75.25',
        date: '2024-03-15'
      };

      const result = parser.transformRecord(record);
      expect(result).toEqual({
        name: 'US Bank Transaction',
        envelope: '',
        amount: 75.25,
        date: '2024-03-15'
      });
    });

    test('handles credit transactions', () => {
      const record = {
        name: 'US Bank Credit',
        amount: '50.00',
        debit: '',
        credit: '50.00',
        date: '2024-03-15'
      };

      const result = parser.transformRecord(record);
      expect(result).toEqual({
        name: 'US Bank Credit',
        envelope: '',
        amount: 50.00,
        debit: 0,
        credit: 50.00,
        date: '2024-03-15'
      });
    });
  });
}); 