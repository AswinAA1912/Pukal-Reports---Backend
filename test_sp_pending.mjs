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

        const request = new sql.Request();
        request.input('FromDate', sql.NVarChar(200), '2026-08-01');
        request.input('ToDate', sql.NVarChar(200), '2026-08-15');
        request.input('Product_Id', sql.Int, 12176);
        request.input('Godown_Id', sql.Int, 1);
        request.input('Trip_No', sql.Int, null);

        const result = await request.execute('SP_Pending_Sales_Delivery_Details');
        console.log("COLUMNS:");
        if (result.recordset && result.recordset.length > 0) {
            console.log(Object.keys(result.recordset[0]));
            console.log("SAMPLE RECORD:");
            console.log(result.recordset[0]);
        } else {
            console.log("No records returned.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.close();
    }
}

run();
