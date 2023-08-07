import * as Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

// create interface for records
interface CSVRecord {
  name: string;
  envelope: string;
  amount: number;
  debit: number;
  credit: number;
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

    const filePath = path.join(__dirname, '../..', file);
    const fileStream = fs.createReadStream(filePath);

    Papa.parse<CSVRecord>(fileStream, {
      header: true,
      transformHeader: function (h) {
        if (h.toLowerCase() === 'description') {
          return 'name';
        }
        return h.toLowerCase();
      },
      step: (result) => {
        // invert data amount for citiBank
        if (key === 'citiBank') {
          result.data.debit = -result.data.debit;
          result.data.credit = -result.data.credit;
        }

        results.push(result.data);
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

// Compare csvs for differences
async function findDifferences(
  source: CSVRecord[],
  target: CSVRecord[],
  key: string,
) {
  const differences: CSVRecord[] = [];

  for (const sourceRecord of source) {
    let found = false;

    for (const targetRecord of target) {
      // convert amounts for better comparison

      // initialize comparison numbers
      let sourceAmount: Number = 0;
      let targetAmount: Number = 0;

      // convert source records with have header "amount"
      if (sourceRecord.amount) {
        sourceAmount = Number(sourceRecord.amount.toString().replace(/,/g, ''));
      }

      // convert target records with have header "amount"
      if (targetRecord.amount) {
        targetAmount = Number(targetRecord.amount.toString().replace(/,/g, ''));
      }

      // merge potential source credit or debit to amount.
      if (sourceRecord.credit) {
        sourceAmount = Number(sourceRecord.credit.toString().replace(/,/g, ''));
        sourceRecord.amount = sourceRecord.credit;
      } else if (sourceRecord.debit) {
        sourceAmount = Number(sourceRecord.debit.toString().replace(/,/g, ''));
        sourceRecord.debit = sourceRecord.debit;
      }

      // merge potential target credit or debit to amount.
      if (targetRecord.credit) {
        targetAmount = Number(targetRecord.credit.toString().replace(/,/g, ''));
        targetRecord.amount = targetRecord.credit;
      } else if (targetRecord.debit) {
        targetAmount = Number(targetRecord.debit.toString().replace(/,/g, ''));
        targetRecord.amount = targetRecord.debit;
      }

      if (sourceAmount === targetAmount) {
        found = true;
        break;
      }
    }

    // return our missing transactions
    let payments = [
      'PAYMENT',
      'Payment Thank You - Web',
      'WEB AUTHORIZED PMT CHASE CREDIT CRD',
      'WEB AUTHORIZED PMT CITI CARD ONLINE',
      'MONTHLY MAINTENANCE FEE',
    ];

    if (
      !found &&
      sourceRecord.name != 'Envelope Transfer' &&
      !payments.some((payment) => sourceRecord.name.includes(payment))
    ) {
      // if the envelope is null, most like it's a split transaction
      if (key == 'goodBudget' && !sourceRecord.envelope) {
        sourceRecord.envelope = '--SPLIT--';
      }
      differences.push(sourceRecord);
    }
  }
  return differences;
}
