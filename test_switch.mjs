import { connectDB, portalPool } from './config/dbconfig.mjs';
import dbconnect from './middleware/otherDB.mjs';
import sql from 'mssql';

async function runTest() {
    try {
        console.log("Starting connectDB()...");
        await connectDB();

        const createMockReqRes = (dbHeader) => {
            return {
                req: {
                    get: (name) => name === 'Db' ? dbHeader : null,
                    header: (name) => name === 'Db' ? dbHeader : null,
                    body: {},
                    query: { Fromdate: '2026-01-01', Todate: '2026-07-06' },
                    path: '/api/reports/salesReport/ledger'
                },
                res: {
                    status: (code) => ({
                        json: (data) => console.log(`[Response ${dbHeader}] code: ${code}, success: ${data.success}, message: ${data.message}`)
                    })
                }
            };
        };

        // Call dbconnect with Db = 1 (Company 1)
        console.log("\n--- Request 1: Company 1 (SM TRADERS) ---");
        const mock1 = createMockReqRes("1");
        await dbconnect(mock1.req, mock1.res, async () => {
            console.log("[Route Handler 1] Active DB Name:", (await new sql.Request().query("SELECT DB_NAME() AS db")).recordset[0].db);
        });

        // Call dbconnect with Db = 3 (PUKAL TECHNOLOGIES)
        console.log("\n--- Request 2: Company 3 (PUKAL TECHNOLOGIES) ---");
        const mock2 = createMockReqRes("3");
        await dbconnect(mock2.req, mock2.res, async () => {
            console.log("[Route Handler 2] Active DB Name:", (await new sql.Request().query("SELECT DB_NAME() AS db")).recordset[0].db);
        });

        await portalPool.close();
    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTest();
