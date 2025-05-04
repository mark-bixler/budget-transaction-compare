import * as Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

// create interface for records
export interface CSVRecord {
  name: string;
  envelope: string;
  formattedAmount: string;
  date: string;
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
      date: formatDate(record.date)
    };
  }
}

export class CitiBankParser implements CSVParserStrategy {
  transformHeader(header: string): string {
    if (header.toLowerCase() === 'description') return 'name';
    return header.toLowerCase();
  }

  transformRecord(record: any): CSVRecord {
    console.log('Citi record before transform:', record);
    
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
      date: formatDate(record.date)
    };

    console.log('Citi record after transform:', transformedRecord);
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
    console.log('Chase record before transform:', record);
    
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
      date: formatDate(record.date)
    };

    console.log('Chase record after transform:', transformedRecord);
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
      date: formatDate(record.date)
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

// Helper function to calculate string similarity (0 to 1)
function calculateSimilarity(str1: string, str2: string): number {
  // Debug logging for NFHS
  if (str1.toLowerCase().includes('nfhs') || str2.toLowerCase().includes('nfhs')) {
    console.log('\nNFHS comparison:');
    console.log('Original:', { str1, str2 });
  }

  // Normalize strings: lowercase, remove special chars, replace spaces with empty
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Remove special chars
    .replace(/\s+/g, '');       // Remove spaces
  
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  // Debug logging for NFHS
  if (str1.toLowerCase().includes('nfhs') || str2.toLowerCase().includes('nfhs')) {
    console.log('Normalized:', { s1, s2 });
  }
  
  // Exact match after normalization
  if (s1 === s2) return 1;
  
  // One string contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Check for common abbreviations
  const commonAbbrs: Record<string, string[]> = {
    'network': ['net', 'netwrk', 'networ'],
    'service': ['svc', 'serv'],
    'payment': ['pmt', 'pay'],
    'purchase': ['purch', 'pur'],
    'transaction': ['trans', 'txn'],
    'transfer': ['xfer', 'transf'],
    'credit': ['cred', 'cr'],
    'debit': ['deb', 'db']
  };
  
  // Try expanding abbreviations
  let expanded1 = s1;
  let expanded2 = s2;
  
  for (const [full, abbrs] of Object.entries(commonAbbrs)) {
    for (const abbr of abbrs) {
      if (s1.includes(abbr)) expanded1 = expanded1.replace(abbr, full);
      if (s2.includes(abbr)) expanded2 = expanded2.replace(abbr, full);
    }
  }

  // Debug logging for NFHS
  if (str1.toLowerCase().includes('nfhs') || str2.toLowerCase().includes('nfhs')) {
    console.log('After abbreviation expansion:', { expanded1, expanded2 });
  }
  
  if (expanded1 === expanded2) return 0.95;
  if (expanded1.includes(expanded2) || expanded2.includes(expanded1)) return 0.9;
  
  // Calculate Levenshtein distance with adjusted weights
  const matrix = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(0));
  
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      // Lower cost for similar characters (like 'o' and '0', 'i' and '1')
      let cost = 1;
      if (s1[i - 1] === s2[j - 1]) {
        cost = 0;
      } else if (
        (s1[i - 1] === 'o' && s2[j - 1] === '0') ||
        (s1[i - 1] === '0' && s2[j - 1] === 'o') ||
        (s1[i - 1] === 'i' && s2[j - 1] === '1') ||
        (s1[i - 1] === '1' && s2[j - 1] === 'i') ||
        (s1[i - 1] === 'l' && s2[j - 1] === '1') ||
        (s1[i - 1] === '1' && s2[j - 1] === 'l')
      ) {
        cost = 0.5;
      }
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = 1 - (matrix[s1.length][s2.length] / maxLength);

  // Debug logging for NFHS
  if (str1.toLowerCase().includes('nfhs') || str2.toLowerCase().includes('nfhs')) {
    console.log('Final similarity:', similarity);
  }
  
  // Adjust threshold based on string lengths and content
  const minLength = Math.min(s1.length, s2.length);
  if (minLength <= 4) {
    return similarity > 0.5 ? similarity : 0;
  }
  
  // Be more lenient with longer strings that have high similarity
  if (similarity > 0.8) {
    return similarity;
  }
  
  return similarity;
}

// Helper function to check if transactions match
function transactionsMatch(source: CSVRecord, target: CSVRecord): boolean {
  const sourceAmount = getAmount(source);
  const targetAmount = getAmount(target);
  const amountMatch = sourceAmount === targetAmount;
  
  if (!amountMatch) {
    return false;
  }
  
  const similarity = calculateSimilarity(source.name, target.name);
  // Lower threshold for shorter names, higher for longer names
  const minLength = Math.min(source.name.length, target.name.length);
  const threshold = minLength <= 4 ? 0.5 : 0.7;
  
  // Debug logging for NFHS
  if (source.name.toLowerCase().includes('nfhs') || target.name.toLowerCase().includes('nfhs')) {
    console.log('NFHS match result:', { similarity, threshold, matches: similarity > threshold });
  }
  
  return similarity > threshold;
}

// Compare csvs for differences
export async function findDifferences(
  source: CSVRecord[],
  target: CSVRecord[],
  key: string,
) {
  const differences: CSVRecord[] = [];

  for (const sourceRecord of source) {
    const found = target.some(targetRecord => 
      transactionsMatch(sourceRecord, targetRecord)
    );

    if (!found && !shouldIgnoreTransaction(sourceRecord.name)) {
      // Handle split transactions for GoodBudget
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
