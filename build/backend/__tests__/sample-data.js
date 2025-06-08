"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSampleData = void 0;
function generateSampleData() {
    const goodBudget = [
        {
            name: 'Grocery Store',
            envelope: 'Groceries',
            formattedAmount: '$50.00',
            date: '2025-04-01'
        },
        {
            name: 'Split Transaction',
            envelope: '',
            formattedAmount: '$100.00',
            date: '2025-04-02'
        },
        {
            name: 'PAYMENT',
            envelope: 'Credit Card',
            formattedAmount: '$500.00',
            date: '2025-04-03'
        }
    ];
    const banks = [
        {
            name: 'GROCERY STORE',
            envelope: '',
            formattedAmount: '$50.00',
            date: '2025-04-01'
        },
        {
            name: 'AMAZON.COM',
            envelope: '',
            formattedAmount: '$75.00',
            date: '2025-04-02'
        }
    ];
    return { goodBudget, banks };
}
exports.generateSampleData = generateSampleData;
