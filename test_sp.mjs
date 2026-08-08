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

const getItemWeight = (item) => {
    const bagWeightStr = String(item.Bag || item.bag || "").replace(/[^0-9.]/g, '');
    const bagWeight = parseFloat(bagWeightStr) || 0;
    if (bagWeight > 0) return bagWeight;
    const match = String(item.stock_item_name || item.Stock_Item || "").match(/(\d+(?:\.\d+)?)\s*(?:KG|kg)/);
    if (match) return parseFloat(match[1]);
    return 1;
};

async function run() {
    try {
        await sql.connect(config);
        console.log("Connected successfully!");

        const request = new sql.Request();
        request.input('Fromdate', sql.VarChar(50), '2026-08-01');
        request.input('Todate', sql.VarChar(50), '2026-08-07');
        request.input('Godown_Id', sql.Int, 10);
        request.input('Filter_1', sql.VarChar(50), '');
        request.input('Filter_1_Value', sql.NVarChar('max'), '');
        request.input('Filter_2', sql.VarChar(50), '');
        request.input('Filter_2_Value', sql.NVarChar('max'), '');
        request.input('Filter_3', sql.VarChar(50), '');
        request.input('Filter_3_Value', sql.NVarChar('max'), '');
        const result = await request.execute('Stock_Summarry_Godown_IN_OUT_Process');
        
        console.log("ITEM WEIGHT RESOLUTION RESULTS:");
        result.recordset.forEach(r => {
            const weight = getItemWeight(r);
            if (r.stock_item_name.includes("1kg") || r.stock_item_name.includes("1Kg") || r.Bag.includes("1")) {
                console.log(`Name: "${r.stock_item_name}", Bag: "${r.Bag}", Resolved Weight: ${weight}`);
            }
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sql.close();
    }
}

run();
