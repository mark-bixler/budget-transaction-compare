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
exports.compareCSVs = void 0;
const Papa = __importStar(require("papaparse"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
        const filePath = path.join(__dirname, '../..', file);
        const fileStream = fs.createReadStream(filePath);
        Papa.parse(fileStream, {
            header: true,
            transformHeader: function (h) {
                if (h.toLowerCase() === 'description') {
                    return 'name';
                }
                if (h.toLowerCase() === 'transaction date') {
                    return 'date';
                }
                return h.toLowerCase();
            },
            step: (result) => {
                // invert data amount for citiBank
                if (key === 'citiBank') {
                    result.data.debit = -result.data.debit;
                    result.data.credit = -result.data.credit;
                }
                // standardize date format
                result.data.date = formatDate(result.data.date);
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
function findDifferences(source, target, key) {
    return __awaiter(this, void 0, void 0, function* () {
        const differences = [];
        for (const sourceRecord of source) {
            let found = false;
            for (const targetRecord of target) {
                // convert amounts for better comparison
                // initialize comparison numbers
                let sourceAmount = 0;
                let targetAmount = 0;
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
                }
                else if (sourceRecord.debit) {
                    sourceAmount = Number(sourceRecord.debit.toString().replace(/,/g, ''));
                    sourceRecord.debit = sourceRecord.debit;
                }
                // merge potential target credit or debit to amount.
                if (targetRecord.credit) {
                    targetAmount = Number(targetRecord.credit.toString().replace(/,/g, ''));
                    targetRecord.amount = targetRecord.credit;
                }
                else if (targetRecord.debit) {
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
            if (!found &&
                sourceRecord.name != 'Envelope Transfer' &&
                !payments.some((payment) => sourceRecord.name.includes(payment))) {
                // if the envelope is null, most like it's a split transaction
                if (key == 'goodBudget' && !sourceRecord.envelope) {
                    sourceRecord.envelope = '--SPLIT--';
                }
                differences.push(sourceRecord);
            }
        }
        return differences;
    });
}
// Function to Standardize Transaction Dates
function formatDate(dateString) {
    const dashParts = dateString.split('-');
    const slashParts = dateString.split('/');
    if (dashParts.length === 3) {
        const year = parseInt(dashParts[0]);
        const month = parseInt(dashParts[1]);
        const day = parseInt(dashParts[2]);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
    }
    else if (slashParts.length === 3) {
        const month = parseInt(slashParts[0]);
        const day = parseInt(slashParts[1]);
        const year = parseInt(slashParts[2]);
        if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
    }
    return "null"; // Invalid date format
}
