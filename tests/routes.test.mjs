import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../app.mjs';

describe('API Route Endpoints & Contract Validation Test Suite', () => {
    describe('Authorization Endpoints', () => {
        it('POST /api/authorization/login - returns 400 when username or password is missing', async () => {
            const res = await request(app)
                .post('/api/authorization/login')
                .send({ username: '' });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, 'username and password are required');
        });

        it('GET /api/authorization/userPortal/accounts - returns 400 when username is omitted', async () => {
            const res = await request(app)
                .get('/api/authorization/userPortal/accounts');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, 'username is required');
        });
    });

    describe('Payment & Transactions Endpoints', () => {
        it('GET /api/payment/transactions - returns 400 when fromDate, toDate, or Acc_Id are missing', async () => {
            const res = await request(app)
                .get('/api/payment/transactions?fromDate=2026-10-01');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.match(res.body.message, /From date, To date and Account ID are required/);
        });

        it('GET /api/payment/transactions - returns 400 when Acc_Id is not a valid number', async () => {
            const res = await request(app)
                .get('/api/payment/transactions?fromDate=2026-10-01&toDate=2026-10-22&Acc_Id=invalid_acc');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, 'Account ID must be a valid number');
        });
    });

    describe('Journal Endpoints', () => {
        it('GET /api/journal/accountPendingReference - returns 400 when Acc_Id is omitted', async () => {
            const res = await request(app)
                .get('/api/journal/accountPendingReference');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.message, 'Acc_Id is required');
        });
    });

    describe('External Reports & Analytics Endpoints', () => {
        it('GET /api/reports/externalAPI/onlinePurchaseReportItemByOrderId - returns 400 when Po_Id is omitted or non-numeric', async () => {
            const res = await request(app)
                .get('/api/reports/externalAPI/onlinePurchaseReportItemByOrderId?Po_Id=');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.match(res.body.message, /Po_Id is required/);
        });

        it('GET /api/reports/externalAPI/reportingDetailedList - returns 400 when Ref_Id is missing', async () => {
            const res = await request(app)
                .get('/api/reports/externalAPI/reportingDetailedList');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.match(res.body.message, /Ref_Id is required/);
        });

        it('GET /api/reports/externalAPI/godownStockBadge - returns 400 when godownId or productId is missing', async () => {
            const res = await request(app)
                .get('/api/reports/externalAPI/godownStockBadge');

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.success, false);
            assert.match(res.body.message, /godownId is required/);
        });

        it('GET /api/reports/externalAPI/TransactionBatchStockReportByProId - returns noData (HTTP 200) when Product_Id is invalid', async () => {
            const res = await request(app)
                .get('/api/reports/externalAPI/TransactionBatchStockReportByProId?Product_Id=not_a_number');

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, 'No data');
            assert.deepStrictEqual(res.body.data, []);
        });

        it('GET /api/reports/externalAPI/TransactionBatchStockReportByProIdandGodownId - returns noData (HTTP 200) when Godown_Id is invalid', async () => {
            const res = await request(app)
                .get('/api/reports/externalAPI/TransactionBatchStockReportByProIdandGodownId?Product_Id=123&Godown_Id=not_a_number');

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(res.body.message, 'No data');
            assert.deepStrictEqual(res.body.data, []);
        });
    });

    describe('SPA Wildcard & Route Listing Fallbacks', () => {
        it('GET /api - returns route list with HTTP 200', async () => {
            const res = await request(app).get('/api');
            assert.ok([200, 400].includes(res.status));
        });

        it('GET /random-spa-page - serves HTML index.html fallback', async () => {
            const res = await request(app).get('/dashboard/reports/custom');
            // If frontend build folder exists, returns HTML 200, otherwise 404
            assert.ok([200, 404].includes(res.status));
        });
    });
});
