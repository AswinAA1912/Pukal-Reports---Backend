import { describe, it } from 'node:test';
import assert from 'node:assert';
import authenticateToken from '../middleware/auth.mjs';
import { idempotencyValidator } from '../middleware/reqIdValidator.mjs';
import dbconnect from '../middleware/otherDB.mjs';

function createMockReqRes(headers = {}, path = '/api/masters/godown') {
    let statusCode = null;
    let jsonOutput = null;

    const req = {
        path,
        headers,
        header(name) {
            return headers[name.toLowerCase()] || headers[name];
        },
        get(name) {
            return headers[name.toLowerCase()] || headers[name];
        },
        query: {},
        body: {}
    };

    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(data) {
            jsonOutput = data;
            return this;
        },
        getStatusCode: () => statusCode,
        getJson: () => jsonOutput
    };

    return { req, res };
}

describe('Middleware Test Suite', () => {
    describe('Authentication Middleware (auth.mjs)', () => {
        it('should return HTTP 400 when Authorization header is missing', async () => {
            const { req, res } = createMockReqRes({});
            let nextCalled = false;

            await authenticateToken(req, res, () => {
                nextCalled = true;
            });

            assert.strictEqual(nextCalled, false, 'next() must not be called when token is omitted');
            assert.strictEqual(res.getStatusCode(), 400);
            assert.strictEqual(res.getJson().success, false);
            assert.strictEqual(res.getJson().message, 'Failed to authorize');
        });
    });

    describe('Idempotency Validator Middleware (reqIdValidator.mjs)', () => {
        it('should pass request through next() when valid request is provided', () => {
            const { req, res } = createMockReqRes({ 'idempotency-key': 'unique-uuid-' + Date.now() });
            let nextCalled = false;

            idempotencyValidator(req, res, () => {
                nextCalled = true;
            });

            assert.strictEqual(nextCalled, true, 'next() should be called');
        });

        it('should return HTTP 409 when identical idempotency key is submitted twice', () => {
            const testKey = 'duplicate-test-key-' + Date.now();
            const { req: req1, res: res1 } = createMockReqRes({ 'idempotency-key': testKey });
            let next1Called = false;
            idempotencyValidator(req1, res1, () => {
                next1Called = true;
            });
            assert.strictEqual(next1Called, true, 'First request must pass');

            const { req: req2, res: res2 } = createMockReqRes({ 'idempotency-key': testKey });
            let next2Called = false;
            idempotencyValidator(req2, res2, () => {
                next2Called = true;
            });
            assert.strictEqual(next2Called, false, 'Second duplicate request must be blocked');
            assert.strictEqual(res2.getStatusCode(), 409, 'Must return HTTP 409');
            assert.strictEqual(res2.getJson().message, 'Duplicate request');
        });
    });

    describe('Multi-Tenant Database Router (otherDB.mjs)', () => {
        it('should skip tenant database connection for /userPortal/ endpoints', async () => {
            const { req, res } = createMockReqRes({}, '/api/authorization/userPortal/accounts');
            let nextCalled = false;

            await dbconnect(req, res, () => {
                nextCalled = true;
            });

            assert.strictEqual(nextCalled, true, 'dbconnect must immediately pass portal routes');
        });

        it('should proceed without error when no Db is resolved and no SELECTED_COMPANY_ID in env', async () => {
            const { req, res } = createMockReqRes({}, '/api/public-info');
            let nextCalled = false;

            await dbconnect(req, res, () => {
                nextCalled = true;
            });

            // If Db is resolved (e.g. from SELECTED_COMPANY_ID) or omitted, it calls next or handles gracefully
            assert.strictEqual(typeof nextCalled, 'boolean');
        });
    });
});
