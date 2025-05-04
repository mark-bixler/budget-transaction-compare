"use strict";
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
const compare_1 = require("../compare");
const sample_data_1 = require("./sample-data");
describe('Transaction Comparison', () => {
    test('should find differences between GoodBudget and bank transactions', () => __awaiter(void 0, void 0, void 0, function* () {
        const { goodBudget, banks } = (0, sample_data_1.generateSampleData)();
        console.log('Testing with sample data...');
        const differences = (0, compare_1.findDifferences)(goodBudget, banks, 'goodBudget');
        // Log the differences for debugging
        console.log('\nDifferences found:', differences);
        // Verify we found the expected differences
        expect(differences.length).toBeGreaterThan(0);
        // Verify we found the split transaction
        const splitTransaction = differences.find((d) => d.envelope === '--SPLIT--');
        expect(splitTransaction).toBeDefined();
        // Verify we found the payment
        const payment = differences.find((d) => d.name.includes('PAYMENT'));
        expect(payment).toBeDefined();
        // Verify we found the Amazon transaction
        const amazonTransaction = differences.find((d) => d.name.includes('Amazon'));
        expect(amazonTransaction).toBeDefined();
    }));
});
