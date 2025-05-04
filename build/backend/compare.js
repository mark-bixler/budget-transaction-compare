"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareTransactions = exports.findDifferences = exports.compareCSVs = exports.USBankParser = exports.ChaseParser = exports.CitiBankParser = exports.GoodBudgetParser = void 0;
const Papa = __importStar(require("papaparse"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const turbocommons_ts_1 = require("turbocommons-ts");
// Helper function to format amount with dollar sign and decimals
function formatAmount(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}
class GoodBudgetParser {
    transformHeader(header) {
        return header.toLowerCase();
    }
    transformRecord(record) {
        var _a;
        const amount = Number(((_a = record.amount) === null || _a === void 0 ? void 0 : _a.toString().replace(/,/g, '')) || 0);
        return {
            name: record.name,
            envelope: record.envelope || '--SPLIT--',
            formattedAmount: formatAmount(amount),
            date: formatDate(record.date),
            originalIndex: record.originalIndex
        };
    }
}
exports.GoodBudgetParser = GoodBudgetParser;
class CitiBankParser {
    transformHeader(header) {
        if (header.toLowerCase() === 'description')
            return 'name';
        return header.toLowerCase();
    }
    transformRecord(record) {
        // Convert credit/debit to a single amount
        let amount = 0;
        if (record.debit) {
            amount = -Number(record.debit.toString().replace(/,/g, ''));
        }
        else if (record.credit) {
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
exports.CitiBankParser = CitiBankParser;
class ChaseParser {
    transformHeader(header) {
        if (header.toLowerCase() === 'description')
            return 'name';
        if (header.toLowerCase() === 'transaction date')
            return 'date';
        return header.toLowerCase();
    }
    transformRecord(record) {
        // Handle amount - Chase uses negative numbers for debits
        let amount = 0;
        if (record.amount) {
            amount = Number(record.amount.toString().replace(/,/g, ''));
        }
        else if (record.debit) {
            amount = -Number(record.debit.toString().replace(/,/g, ''));
        }
        else if (record.credit) {
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
exports.ChaseParser = ChaseParser;
class USBankParser {
    transformHeader(header) {
        return header.toLowerCase();
    }
    transformRecord(record) {
        var _a;
        const amount = Number(((_a = record.amount) === null || _a === void 0 ? void 0 : _a.toString().replace(/,/g, '')) || 0);
        return {
            name: record.name,
            envelope: '',
            formattedAmount: formatAmount(amount),
            date: formatDate(record.date),
            originalIndex: record.originalIndex
        };
    }
}
exports.USBankParser = USBankParser;
const parserMap = {
    'goodBudget': GoodBudgetParser,
    'citiBank': CitiBankParser,
    'chase': ChaseParser,
    'us-checking': USBankParser,
    'us-credit': USBankParser
};
function getParser(key) {
    const Parser = parserMap[key];
    if (!Parser) {
        throw new Error(`Unknown parser key: ${key}`);
    }
    return new Parser();
}
function compareCSVs(csv1, csv2, csv3, csv4, csv5) {
    return __awaiter(this, void 0, void 0, function* () {
        const csv1Records = yield parseCSV(csv1, 'goodBudget');
        const csv2Records = yield parseCSV(csv2, 'citiBank');
        const csv3Records = yield parseCSV(csv3, 'chase');
        const csv4Records = yield parseCSV(csv4, 'us-checking');
        const csv5Records = yield parseCSV(csv5, 'us-credit');
        // bank transactions
        const mergedRecords = [
            ...csv2Records,
            ...csv3Records,
            ...csv4Records,
            ...csv5Records,
        ];
        // Collect differences from both files
        const differencesFromGoodBudget = yield findDifferences(csv1Records, mergedRecords, 'goodBudget');
        const differencesFromBanks = yield findDifferences(mergedRecords, csv1Records, 'banks');
        // Combine differences from both files into one array
        return [...differencesFromGoodBudget, ...differencesFromBanks];
    });
}
exports.compareCSVs = compareCSVs;
function parseCSV(file, key) {
    return new Promise((resolve, reject) => {
        const results = [];
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
function getAmount(record) {
    // Remove currency symbol and commas, then parse as number
    return Number(record.formattedAmount.replace(/[$,]/g, ''));
}
// Helper function to check if transaction should be ignored
function shouldIgnoreTransaction(name) {
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
function normalize(input, abbreviations = ['SQ']) {
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
function transactionsMatch(source, target) {
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
    const distance = turbocommons_ts_1.StringUtils.compareByLevenshtein(s1, s2);
    const similarity = turbocommons_ts_1.StringUtils.compareSimilarityPercent(s1, s2);
    console.log('Comparing:', { s1, s2, distance, similarity, amountMatch });
    // Match if similarity is greater than 20%
    return similarity > 20;
}
function findDifferences(source, target, key = '') {
    const differences = [];
    const found = new Set();
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
                const similarity = turbocommons_ts_1.StringUtils.compareSimilarityPercent(s1, s2);
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
exports.findDifferences = findDifferences;
// Function to Standardize Transaction Dates
function formatDate(dateString) {
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
function compareTransactions(bankRecords, goodBudgetRecords) {
    const result = {
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
exports.compareTransactions = compareTransactions;
