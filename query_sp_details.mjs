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
        const result = await sql.query(`
            SELECT TOP 100 Particulars, voucher_name, invoice_no, In_Qty, Out_Qty
            FROM Transaction_Stock_Report_Fn_By_Pro_Id_and_Godown_Id(1, '2026-05-01', '2026-05-01', '2026-07-31', 531, 1, '2026-04-30')
            WHERE In_Qty > 0 OR Out_Qty > 0
        `);
        console.log("Sample transactions with quantities:");
        result.recordset.forEach(r => {
            console.log(`- Particulars: ${r.Particulars} | Vch Name: ${r.voucher_name} | Vch No: ${r.invoice_no} | In: ${r.In_Qty} | Out: ${r.Out_Qty}`);
        });
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.close();
    }
}

run();
