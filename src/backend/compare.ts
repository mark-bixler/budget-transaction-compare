import * as Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';
import { StringUtils } from 'turbocommons-ts';

// create interface for records
export interface CSVRecord {
  name: string;
  envelope: string;
  formattedAmount: string;
  date: string;
  originalIndex?: number;
}

// Add new interface for amount matches
export interface AmountMatch {
  source: CSVRecord;
  target: CSVRecord;
  similarity: number;
}

// Define CSV parser strategies
interface CSVParserStrategy {
  transformHeader(header: string): string;
  transformRecord(record: any): CSVRecord;
}

// Helper function to format amount with dollar sign and decimals
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export class GoodBudgetParser implements CSVParserStrategy {
  transformHeader(header: string): string {
    return header.toLowerCase();
  }

  transformRecord(record: any): CSVRecord {
    const amount = Number(record.amount?.toString().replace(/,/g, '') || 0);
    return {
      name: record.name,
      envelope: record.envelope || '--SPLIT--',
      formattedAmount: formatAmount(amount),
      date: formatDate(record.date),
      originalIndex: record.originalIndex
    };
  }
}

export class CitiBankParser implements CSVParserStrategy {
  transformHeader(header: string): string {
    if (header.toLowerCase() === 'description') return 'name';
    return header.toLowerCase();
  }

  transformRecord(record: any): CSVRecord {
    
    // Convert credit/debit to a single amount
    let amount = 0;
    if (record.debit) {
      amount = -Number(record.debit.toString().replace(/,/g, ''));
    } else if (record.credit) {
      amount = Number(record.credit.toString().replace(/,/g, ''));
    }

    const transformedRecord = {
      name: record.name || record.description || '',
      envelope: '',
      formattedAmount: formatAmount(amount),
      date: formatDate(record.date),
      originalIndex: record.originalIndex
    };

    return transformedRecord;
  }
}

export class ChaseParser implements CSVParserStrategy {
  transformHeader(header: string): string {
    if (header.toLowerCase() === 'description') return 'name';
    if (header.toLowerCase() === 'transaction date') return 'date';
    return header.toLowerCase();
  }

  transformRecord(record: any): CSVRecord {
    
    // Handle amount - Chase uses negative numbers for debits
    let amount = 0;
    if (record.amount) {
      amount = Number(record.amount.toString().replace(/,/g, ''));
    } else if (record.debit) {
      amount = -Number(record.debit.toString().replace(/,/g, ''));
    } else if (record.credit) {
      amount = Number(record.credit.toString().replace(/,/g, ''));
    }

    const transformedRecord = {
      name: record.name || record.description || '',
      envelope: '',
      formattedAmount: formatAmount(amount),
      date: formatDate(record.date),
      originalIndex: record.originalIndex
    };

    return transformedRecord;
  }
}

export class USBankParser implements CSVParserStrategy {
  transformHeader(header: string): string {
    return header.toLowerCase();
  }

  transformRecord(record: any): CSVRecord {
    const amount = Number(record.amount?.toString().replace(/,/g, '') || 0);
    return {
      name: record.name,
      envelope: '',
      formattedAmount: formatAmount(amount),
      date: formatDate(record.date),
      originalIndex: record.originalIndex
    };
  }
}

const parserMap: Record<string, new () => CSVParserStrategy> = {
  'goodBudget': GoodBudgetParser,
  'citiBank': CitiBankParser,
  'chase': ChaseParser,
  'us-checking': USBankParser,
  'us-credit': USBankParser
};

function getParser(key: string): CSVParserStrategy {
  const Parser = parserMap[key];
  if (!Parser) {
    throw new Error(`Unknown parser key: ${key}`);
  }
  return new Parser();
}

export async function compareCSVs(
  csv1: string,
  csv2: string,
  csv3: string,
  csv4: string,
  csv5: string,
) {
  const csv1Records: CSVRecord[] = await parseCSV(csv1, 'goodBudget');
  const csv2Records: CSVRecord[] = await parseCSV(csv2, 'citiBank');
  const csv3Records: CSVRecord[] = await parseCSV(csv3, 'chase');
  const csv4Records: CSVRecord[] = await parseCSV(csv4, 'us-checking');
  const csv5Records: CSVRecord[] = await parseCSV(csv5, 'us-credit');

  // bank transactions
  const mergedRecords = [
    ...csv2Records,
    ...csv3Records,
    ...csv4Records,
    ...csv5Records,
  ];

  // Collect differences from both files
  const differencesFromGoodBudget = await findDifferences(
    csv1Records,
    mergedRecords,
    'goodBudget',
  );
  const differencesFromBanks = await findDifferences(
    mergedRecords,
    csv1Records,
    'banks',
  );

  // Combine differences from both files into one array
  return [...differencesFromGoodBudget, ...differencesFromBanks];
}

function parseCSV(file: string, key: string): Promise<CSVRecord[]> {
  return new Promise((resolve, reject) => {
    const results: CSVRecord[] = [];
    const parser = getParser(key);
    const filePath = path.join(__dirname, '../..', file);
    const fileStream = fs.createReadStream(filePath);

    Papa.parse(fileStream, {
      header: true,
      transformHeader: parser.transformHeader.bind(parser),
      step: (result) => {
        results.push(parser.transformRecord(result.data));
      },
      complete: () => {
        resolve(results);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

// Helper function to get amount from record
function getAmount(record: CSVRecord): number {
  // Remove currency symbol and commas, then parse as number
  return Number(record.formattedAmount.replace(/[$,]/g, ''));
}

// Helper function to check if transaction should be ignored
function shouldIgnoreTransaction(name: string): boolean {
  const payments = [
    'PAYMENT',
    'Payment Thank You - Web',
    'WEB AUTHORIZED PMT CHASE CREDIT CRD',
    'WEB AUTHORIZED PMT CITI CARD ONLINE',
    'MONTHLY MAINTENANCE FEE',
  ];
  
  return name === 'Envelope Transfer' || 
         payments.some(payment => name.includes(payment));
}

// Helper function to normalize transaction names
function normalize(input: string, abbreviations: string[] = ['SQ']): string {
  // First remove any known abbreviations from the start
  let processedString = input;
  for (const abbr of abbreviations) {
    // Remove abbreviation followed by a space or asterisk
    const pattern = new RegExp(`^${abbr}\\s+\\*?\\s*`, 'i');
    processedString = processedString.replace(pattern, '');
  }

  // Now take the first 10 characters
  processedString = processedString.substring(0, 10);

  // Lowercase and remove all white spaces
  return processedString.toLowerCase().replace(/\s+/g, '');
}

// Helper function to check if transactions match
function transactionsMatch(source: CSVRecord, target: CSVRecord): boolean {
  const sourceAmount = getAmount(source);
  const targetAmount = getAmount(target);
  
  // check if amounts match
  const amountMatch = sourceAmount === targetAmount;
  
  if (!amountMatch) {
    return false;
  }

  const s1 = normalize(source.name);
  const s2 = normalize(target.name);

  // Get Levenshtein distance
  const distance = StringUtils.compareByLevenshtein(s1, s2);
  const similarity = StringUtils.compareSimilarityPercent(s1, s2);
  console.log('Comparing:', { s1, s2, distance, similarity, amountMatch });

  // Match if similarity is greater than 20%
  return similarity > 20;
}

interface ComparisonResult {
  differencesFromGoodBudget: CSVRecord[];
  differencesFromBanks: CSVRecord[];
}

export function findDifferences(source: CSVRecord[], target: CSVRecord[], key: string = ''): CSVRecord[] {
  const differences: CSVRecord[] = [];
  const found = new Set<number>();

  for (const sourceRecord of source) {
    let found = false;

    // Check all target records
    target.forEach(targetRecord => {
      const sourceAmount = getAmount(sourceRecord);
      const targetAmount = getAmount(targetRecord);
      const amountMatch = sourceAmount === targetAmount;

      if (amountMatch) {
        // Normalize strings
        const s1 = normalize(sourceRecord.name);
        const s2 = normalize(targetRecord.name);
        
        // Get similarity
        const similarity = StringUtils.compareSimilarityPercent(s1, s2);

        // Check if this is a match
        if (similarity > 20) {
          found = true;
        }
      }
    });

    // If no match found and not ignored, add to differences
    if (!found && !shouldIgnoreTransaction(sourceRecord.name)) {
      if (key === 'goodBudget' && !sourceRecord.envelope) {
        sourceRecord.envelope = '--SPLIT--';
      }
      differences.push(sourceRecord);
    }
  }
  
  return differences;
}

// Function to Standardize Transaction Dates
function formatDate(dateString: string | undefined | null): string {
  if (!dateString) {
    return 'null';
  }

  // Handle Chase's double date format (take the first date)
  if (dateString.includes(',')) {
    dateString = dateString.split(',')[0];
  }

  // Try YYYY-MM-DD format first
  const dashParts = dateString.split('-');
  if (dashParts.length === 3) {
    const year = parseInt(dashParts[0]);
    const month = parseInt(dashParts[1]);
    const day = parseInt(dashParts[2]);

    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  // Try MM/DD/YYYY format
  const slashParts = dateString.split('/');
  if (slashParts.length === 3) {
    const month = parseInt(slashParts[0]);
    const day = parseInt(slashParts[1]);
    const year = parseInt(slashParts[2]);

    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }

  return 'null';
}

export function compareTransactions(bankRecords: CSVRecord[], goodBudgetRecords: CSVRecord[]): ComparisonResult {
  const result: ComparisonResult = {
    differencesFromGoodBudget: [],
    differencesFromBanks: []
  };

  // Find differences in both directions
  const goodBudgetDifferences = findDifferences(goodBudgetRecords, bankRecords, 'goodBudget');
  const bankDifferences = findDifferences(bankRecords, goodBudgetRecords, 'banks');

  // Add differences to result
  result.differencesFromGoodBudget = goodBudgetDifferences;
  result.differencesFromBanks = bankDifferences;

  return result;
}
