import sql from 'mssql';

const config = {
    server: "122.165.240.65",
    port: 1435,
    database: "ERP_LIVE_DB_SMT",
    user: "smtuser",
    password: "sas",
    driver: "SQL Server",
    options: {
        trustServerCertificate: true,
        enableArithAbort: true,
    },
};

async function run() {
    try {
        await sql.connect(config);
        console.log("Connected successfully!");

        // Query distinct particulars and voucher_name for a list of transactions where there is stock movement.
        // Let's run a query to get a sample of 100 rows with non-zero quantities.
        const request = new sql.Request();
        request.input('FromDate', sql.NVarChar(200), '2026-08-06');
        request.input('ToDate', sql.NVarChar(200), '2026-08-06');
        request.input('Product_Id', sql.Int, 69);
        request.input('Godown_Id', sql.Int, 10);
        request.input('Trip_No', sql.Int, 2);

        const result = await request.execute('SP_Pending_Sales_Arrival_Details');
        console.log("Columns:", Object.keys(result.recordset[0] || {}));
        console.log("First row details:", result.recordset[0]);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.close();
    }
}

run();
