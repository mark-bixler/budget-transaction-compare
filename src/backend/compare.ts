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
    maximumFractionDigits: 2,
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
      originalIndex: record.originalIndex,
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
      amount = -Number(record.credit.toString().replace(/,/g, ''));
    }

    const transformedRecord = {
      name: record.name || record.description || '',
      envelope: '',
      formattedAmount: formatAmount(amount),
      date: formatDate(record.date),
      originalIndex: record.originalIndex,
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
      originalIndex: record.originalIndex,
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
      originalIndex: record.originalIndex,
    };
  }
}

const parserMap: Record<string, new () => CSVParserStrategy> = {
  goodBudget: GoodBudgetParser,
  citiBank: CitiBankParser,
  chase: ChaseParser,
  'us-checking': USBankParser,
  'us-credit': USBankParser,
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
    'ELECTRONIC DEPOSIT MINDBODY',
  ];

  return (
    name === 'Envelope Transfer' ||
    payments.some((payment) => name.includes(payment))
  );
}

// Helper function to normalize transaction names
function normalize(
  input: string,
  ignores: string[] = ['SQ', 'ELECTRONIC WITHDRAWAL', 'WEB AUTHORIZED PMT'],
): string {
  // First remove any known abbreviations from the start
  let processedString = input;
  for (const ignore of ignores) {
    // Remove abbreviation followed by a space or asterisk
    const pattern = new RegExp(`^${ignore}\\s+\\*?\\s*`, 'i');
    processedString = processedString.replace(pattern, '');
  }

  // Remove special characters and whitespaces
  processedString = processedString.replace(/[^\w]/g, '');

  // Now take the first 10 characters
  processedString = processedString.substring(0, 20);

  // Lowercase
  return processedString.toLowerCase();
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

  // Get similarity
  const similarity = StringUtils.compareSimilarityPercent(s1, s2);

  // Get longest common substring
  const consecutiveMatch = hasConsecutiveMatch(s1, s2);

  // Only true if similarity is greater than 20%
  const similarityCondition = similarity > 20;

  // Return true if either condition is met
  return consecutiveMatch || similarityCondition;
}

interface ComparisonResult {
  differencesFromGoodBudget: CSVRecord[];
  differencesFromBanks: CSVRecord[];
}

// Helper function to check if dates are within 1 day of each other
function areDatesWithinOneDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Get the difference in days
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 1;
}

// Helper function to group transactions by vendor and date
function groupTransactionsByVendorAndDate(records: CSVRecord[]): Map<string, CSVRecord[]> {
  const groups = new Map<string, CSVRecord[]>();
  
  for (const record of records) {
    const normalizedName = normalize(record.name);
    
    // Find an existing group with the same vendor and a date within 1 day
    let foundGroup = false;
    for (const [key, group] of groups.entries()) {
      const [groupName, groupDate] = key.split('|');
      if (groupName === normalizedName && areDatesWithinOneDay(groupDate, record.date)) {
        group.push(record);
        foundGroup = true;
        break;
      }
    }
    
    // If no matching group found, create a new one
    if (!foundGroup) {
      const key = `${normalizedName}|${record.date}`;
      groups.set(key, [record]);
    }
  }
  
  return groups;
}

// Helper function to sum amounts in a group
function sumGroupAmounts(group: CSVRecord[]): number {
  return group.reduce((sum, record) => sum + getAmount(record), 0);
}

export function findDifferences(
  source: CSVRecord[],
  target: CSVRecord[],
  key: string = '',
): CSVRecord[] {
  const differences: CSVRecord[] = [];
  
  // Group target records by vendor and date
  const targetGroups = groupTransactionsByVendorAndDate(target);
  
  for (const sourceRecord of source) {
    let found = false;
    const normalizedName = normalize(sourceRecord.name);
    
    // Check all groups for this vendor
    for (const [groupKey, group] of targetGroups.entries()) {
      const [groupName, groupDate] = groupKey.split('|');
      
      // If vendor matches and dates are within 1 day
      if (groupName === normalizedName && areDatesWithinOneDay(groupDate, sourceRecord.date)) {
        const sourceAmount = getAmount(sourceRecord);
        const groupAmount = sumGroupAmounts(group);
        
        // If amounts match, consider it a match
        if (Math.abs(sourceAmount - groupAmount) < 0.01) {
          found = true;
          break;
        }
      }
    }
    
    // If no group match found, check individual transactions
    if (!found) {
      for (const targetRecord of target) {
        const sourceAmount = getAmount(sourceRecord);
        const targetAmount = getAmount(targetRecord);
        const amountMatch = sourceAmount === targetAmount;

        if (amountMatch) {
          found = transactionsMatch(sourceRecord, targetRecord);
          if (found) {
            break;
          }
        }
      }
    }

    // If no match found and not ignored, add to differences
    if (!found && !shouldIgnoreTransaction(sourceRecord.name)) {
      if (key === 'goodBudget' && !sourceRecord.envelope) {
        sourceRecord.envelope = '--SPLIT--';
      }
      differences.push(sourceRecord);
    }
  }
  
  // Sort differences alphabetically by name
  return differences.sort((a, b) => a.name.localeCompare(b.name));
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
      return `${year}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
    }
  }

  // Try MM/DD/YYYY format
  const slashParts = dateString.split('/');
  if (slashParts.length === 3) {
    const month = parseInt(slashParts[0]);
    const day = parseInt(slashParts[1]);
    const year = parseInt(slashParts[2]);

    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return `${year}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
    }
  }

  return 'null';
}

/**
 * Checks if two strings have at least N consecutive characters in common
 * @param s1 First string to compare
 * @param s2 Second string to compare
 * @param minLength Minimum length of consecutive matching characters (default: 3)
 * @param caseSensitive Whether the comparison should be case sensitive (default: false)
 * @returns Boolean indicating whether a match of at least minLength was found
 */
export function hasConsecutiveMatch(
  s1: string,
  s2: string,
  minLength: number = 3,
  caseSensitive: boolean = false,
): boolean {
  // Normalize case if not case sensitive
  if (!caseSensitive) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
  }

  // Check every possible starting position in s1
  for (let i = 0; i <= s1.length - minLength; i++) {
    // Check every possible starting position in s2
    for (let j = 0; j <= s2.length - minLength; j++) {
      // Count how many consecutive characters match
      let matchLength = 0;
      while (
        i + matchLength < s1.length &&
        j + matchLength < s2.length &&
        s1[i + matchLength] === s2[j + matchLength]
      ) {
        matchLength++;

        // If we've found a match of the minimum length, return true immediately
        if (matchLength >= minLength) {
          return true;
        }
      }
    }
  }

  // No match of minimum length was found
  return false;
}