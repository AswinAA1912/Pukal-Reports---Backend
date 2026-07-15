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

        // Run query to see cash accounts and group names
        const result = await sql.query(`
            EXEC Reporting_Cash_List_VW '2026-05-01', '2026-05-31'
        `);
        // Recordset[2] is Cash
        console.log("Cash accounts dataset (Cash):");
        console.log(result.recordsets[2]);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.close();
    }
}

run();
