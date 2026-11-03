import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    success,
    dataFound,
    noData,
    failed,
    invalidInput,
    sentData,
    servError
} from '../res.mjs';

function createMockResponse() {
    return {
        statusCode: null,
        jsonData: null,
        locals: { requestId: 'test-req-uuid-1234', startedAt: process.hrtime.bigint() },
        req: { method: 'POST', originalUrl: '/api/test', body: {} },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        }
    };
}

describe('Standard Response (res.mjs) Test Suite', () => {
    it('success() returns HTTP 200 with success: true and data array', () => {
        const res = createMockResponse();
        success(res, 'Operation completed', [{ id: 1 }], { meta: 'ok' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.success, true);
        assert.strictEqual(res.jsonData.message, 'Operation completed');
        assert.deepStrictEqual(res.jsonData.data, [{ id: 1 }]);
        assert.strictEqual(res.jsonData.others.meta, 'ok');
    });

    it('dataFound() returns HTTP 200 with success: true and default message', () => {
        const res = createMockResponse();
        dataFound(res, [1, 2, 3]);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.success, true);
        assert.strictEqual(res.jsonData.message, 'Data Found');
        assert.deepStrictEqual(res.jsonData.data, [1, 2, 3]);
    });

    it('noData() returns HTTP 200 with empty data array and success: true', () => {
        const res = createMockResponse();
        noData(res, 'Custom No Data');
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.jsonData.success, true);
        assert.strictEqual(res.jsonData.message, 'Custom No Data');
        assert.deepStrictEqual(res.jsonData.data, []);
    });

    it('failed() returns HTTP 400 with success: false', () => {
        const res = createMockResponse();
        failed(res, 'Validation error occurred');
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.success, false);
        assert.strictEqual(res.jsonData.message, 'Validation error occurred');
    });

    it('invalidInput() returns HTTP 400 with success: false', () => {
        const res = createMockResponse();
        invalidInput(res, 'Acc_Id is required');
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.jsonData.success, false);
        assert.strictEqual(res.jsonData.message, 'Acc_Id is required');
    });

    it('sentData() automatically routes to dataFound if array has items, or noData if empty', () => {
        const resWithData = createMockResponse();
        sentData(resWithData, ['item1', 'item2']);
        assert.strictEqual(resWithData.statusCode, 200);
        assert.strictEqual(resWithData.jsonData.data.length, 2);

        const resEmpty = createMockResponse();
        sentData(resEmpty, []);
        assert.strictEqual(resEmpty.statusCode, 200);
        assert.strictEqual(resEmpty.jsonData.message, 'No data');
        assert.strictEqual(resEmpty.jsonData.data.length, 0);
    });

    it('servError() returns HTTP 500 and redacts sensitive passwords and tokens', () => {
        const res = createMockResponse();
        res.req.body = {
            username: 'admin',
            password: 'SuperSecretPassword123!',
            token: 'secret-jwt-token-xyz',
            otp: '123456',
            regularField: 'allowed'
        };

        const error = new Error('Database connection failed');
        error.code = 'ETIMEDOUT';

        servError(error, res, 'Server Error Occurred');
        assert.strictEqual(res.statusCode, 500);
        assert.strictEqual(res.jsonData.success, false);
        assert.strictEqual(res.jsonData.message, 'Server Error Occurred');
        assert.strictEqual(res.jsonData.others.requestId, 'test-req-uuid-1234');
        assert.strictEqual(typeof res.jsonData.others.durationMs, 'number');
    });
});
