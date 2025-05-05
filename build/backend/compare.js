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
exports.hasConsecutiveMatch = exports.findDifferences = exports.compareCSVs = exports.USBankParser = exports.ChaseParser = exports.CitiBankParser = exports.GoodBudgetParser = void 0;
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
        maximumFractionDigits: 2,
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
            originalIndex: record.originalIndex,
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
            originalIndex: record.originalIndex,
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
            originalIndex: record.originalIndex,
        };
    }
}
exports.USBankParser = USBankParser;
const parserMap = {
    goodBudget: GoodBudgetParser,
    citiBank: CitiBankParser,
    chase: ChaseParser,
    'us-checking': USBankParser,
    'us-credit': USBankParser,
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
    return (name === 'Envelope Transfer' ||
        payments.some((payment) => name.includes(payment)));
}
// Helper function to normalize transaction names
function normalize(input, ignores = ['SQ', 'ELECTRONIC WITHDRAWAL', 'WEB AUTHORIZED PMT']) {
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
    // Get similarity
    const similarity = turbocommons_ts_1.StringUtils.compareSimilarityPercent(s1, s2);
    // Get longest common substring
    const consecutiveMatch = hasConsecutiveMatch(s1, s2);
    // Only true if similarity is greater than 20%
    const similarityCondition = similarity > 20;
    // Return true if either condition is met
    return consecutiveMatch || similarityCondition;
}
// Helper function to check if dates are within 1 day of each other
function areDatesWithinOneDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    // Get the difference in days
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
}
// Helper function to group transactions by vendor and date
function groupTransactionsByVendorAndDate(records) {
    const groups = new Map();
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
function sumGroupAmounts(group) {
    return group.reduce((sum, record) => sum + getAmount(record), 0);
}
function findDifferences(source, target, key = '') {
    const differences = [];
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
function hasConsecutiveMatch(s1, s2, minLength = 3, caseSensitive = false) {
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
            while (i + matchLength < s1.length &&
                j + matchLength < s2.length &&
                s1[i + matchLength] === s2[j + matchLength]) {
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
exports.hasConsecutiveMatch = hasConsecutiveMatch;
