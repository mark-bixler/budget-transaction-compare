import { findDifferences, CSVRecord } from '../compare';
import { generateSampleData } from './sample-data';

describe('Transaction Comparison', () => {
  test('should find differences between GoodBudget and bank transactions', async () => {
    const { goodBudget, banks } = generateSampleData();
    
    console.log('Testing with sample data...');
    const differences = findDifferences(goodBudget, banks, 'goodBudget');
    
    // Log the differences for debugging
    console.log('\nDifferences found:', differences);
    
    // Verify we found the expected differences
    expect(differences.length).toBeGreaterThan(0);
    
    // Verify we found the split transaction
    const splitTransaction = differences.find((d: CSVRecord) => d.envelope === '--SPLIT--');
    expect(splitTransaction).toBeDefined();
    
    // Verify we found the payment
    const payment = differences.find((d: CSVRecord) => d.name.includes('PAYMENT'));
    expect(payment).toBeDefined();
    
    // Verify we found the Amazon transaction
    const amazonTransaction = differences.find((d: CSVRecord) => d.name.includes('Amazon'));
    expect(amazonTransaction).toBeDefined();
  });
}); 