import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    encryptPasswordFun,
    decryptPasswordFun,
    toArray,
    isArray,
    checkIsNumber,
    isEqualNumber,
    isValidNumber,
    toNumber,
    ISOString,
    getDaysBetween,
    getIndianTime,
    addFiveThirty,
    LocalDateTime,
    stringCompare,
    Multiplication,
    Addition,
    Division
} from '../helper_functions.mjs';

describe('Helper Functions & Cryptography Test Suite', () => {
    describe('AES Cryptography', () => {
        it('should encrypt and decrypt strings accurately preserving identical plaintext', () => {
            const raw = 'PukalERP_SecurePassword_2026!#$';
            const ciphertext = encryptPasswordFun(raw);
            assert.notStrictEqual(ciphertext, raw, 'Ciphertext must not be plaintext');
            const decrypted = decryptPasswordFun(ciphertext);
            assert.strictEqual(decrypted, raw, 'Decrypted text must match original plaintext');
        });

        it('should handle special characters, numbers, and spaces in passwords', () => {
            const complex = 'Admin @ 1234 %^&*()_+~|}{[]:;?><,./';
            const cipher = encryptPasswordFun(complex);
            const plain = decryptPasswordFun(cipher);
            assert.strictEqual(plain, complex);
        });

        it('should safely return empty string or handle corrupted ciphertext', () => {
            const corrupted = 'InvalidCiphertextNotBase64_XYZ';
            const result = decryptPasswordFun(corrupted);
            assert.strictEqual(typeof result, 'string');
        });
    });

    describe('Date & Time Utilities', () => {
        it('should compute exact days between dates normalized to UTC midnight', () => {
            const days = getDaysBetween('2026-10-01', '2026-10-22');
            assert.strictEqual(days, 21, 'Difference between Oct 1 and Oct 22 must be 21 days');
        });

        it('should return 0 when start date and end date are identical', () => {
            const days = getDaysBetween('2026-10-22', '2026-10-22');
            assert.strictEqual(days, 0);
        });

        it('should format date to YYYY-MM-DD using ISOString helper', () => {
            const d = new Date(2026, 9, 22); // Note: month is 0-indexed in JS (9 = Oct)
            const iso = ISOString(d);
            assert.match(iso, /^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format');
            assert.strictEqual(iso.startsWith('2026-10'), true);
        });

        it('should apply +05:30 IST offset correctly in addFiveThirty', () => {
            const utcTime = '2026-10-22 04:00:00';
            const istTime = addFiveThirty(utcTime);
            // 04:00 + 5.5 hours = 09:30
            assert.strictEqual(istTime.includes('09:30:00'), true);
        });

        it('should generate valid ISO string in LocalDateTime', () => {
            const local = LocalDateTime();
            assert.strictEqual(typeof local, 'string');
            assert.match(local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('Type Checking & Array Helpers', () => {
        it('should ensure toArray converts non-arrays to empty array and preserves arrays', () => {
            assert.deepStrictEqual(toArray([1, 2, 3]), [1, 2, 3]);
            assert.deepStrictEqual(toArray(null), []);
            assert.deepStrictEqual(toArray(undefined), []);
            assert.deepStrictEqual(toArray('string'), []);
            assert.deepStrictEqual(toArray({ a: 1 }), []);
        });

        it('should correctly identify arrays with isArray', () => {
            assert.strictEqual(isArray([1]), true);
            assert.strictEqual(isArray([]), true);
            assert.strictEqual(isArray(null), false);
            assert.strictEqual(isArray({}), false);
        });

        it('should check numeric validity with checkIsNumber', () => {
            assert.strictEqual(checkIsNumber(42), true);
            assert.strictEqual(checkIsNumber('42'), true);
            assert.strictEqual(checkIsNumber(0), true);
            assert.strictEqual(checkIsNumber(null), false);
            assert.strictEqual(checkIsNumber(undefined), false);
            assert.strictEqual(checkIsNumber('abc'), false);
            assert.strictEqual(checkIsNumber(NaN), false);
        });

        it('should compare numbers accurately with isEqualNumber', () => {
            assert.strictEqual(isEqualNumber(10, '10'), true);
            assert.strictEqual(isEqualNumber('10', 10), true);
            assert.strictEqual(isEqualNumber(10, 10), true);
            assert.strictEqual(isEqualNumber(10, 20), false);
            assert.strictEqual(isEqualNumber(null, 10), false);
        });

        it('should perform safe arithmetic without NaN crashes', () => {
            assert.strictEqual(Multiplication(10, 5), 50);
            assert.strictEqual(Addition(10, 5), 15);
            assert.strictEqual(Division(50, 5), 10);
            assert.strictEqual(Division(50, 0), 0); // division by zero protection
        });
    });
});
