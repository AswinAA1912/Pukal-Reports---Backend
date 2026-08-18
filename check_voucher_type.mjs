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
        console.log("Connected to database successfully.");

        console.log("\n--- tbl_Voucher_Type Columns ---");
        const vtRes = await sql.query(`SELECT TOP 1 * FROM tbl_Voucher_Type`);
        console.log(Object.keys(vtRes.recordset[0] || {}));

        console.log("\n--- tbl_Report_OverAll_Group Columns/Rows ---");
        const ogRes = await sql.query(`SELECT * FROM tbl_Report_OverAll_Group`);
        console.log(ogRes.recordset);

        console.log("\n--- tbl_Repots_EmployeeReport_Group Columns/Rows ---");
        const ergRes = await sql.query(`SELECT TOP 5 * FROM tbl_Repots_EmployeeReport_Group`);
        console.log(ergRes.recordset);

    } catch (err) {
        console.error("Database query error:", err);
    } finally {
        await sql.close();
    }
}

run();
