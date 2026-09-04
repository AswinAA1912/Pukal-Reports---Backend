import sql from 'mssql';
import { servError, sentData } from '../../res.mjs';

const VoucherType = () => {

    const getVoucherTypes = async (req, res) => {
        try {
            const { GodownId } = req.query;

            let query = `
                SELECT TOP (1000) 
                    vt.[Vocher_Type_Id] as [Value],
                    vt.[Voucher_Type] as [label],
                    vt.[Vocher_Type_Id],
                    vt.[Voucher_Type],
                    vt.[Voucher_Code],
                    vt.[Branch_Id],
                    vt.[Type],
                    vt.[Tally_Id],
                    vt.[Alter_Id],
                    vt.[Created_By],
                    vt.[Created_Time],
                    vt.[Alter_By],
                    vt.[Alter_Time],
                    vt.[tally_sync],
                    vt.[deleteFlag],
                    vt.[GodownId],
                    vt.[crLimit],
                    vt.[drLimit],
                    vt.[tallyModule],
                    gm.[Godown_Name]
                FROM [dbo].[tbl_Voucher_Type] vt
                LEFT JOIN [dbo].[tbl_Godown_Master] gm ON vt.[GodownId] = gm.[Godown_Id]
                WHERE ISNULL(vt.[deleteFlag], 0) = 0
            `;

            const request = new sql.Request();

            if (GodownId !== undefined && GodownId !== null && GodownId !== '') {
                request.input('GodownId', sql.Int, Number(GodownId));
                query += ` AND vt.[GodownId] = @GodownId`;
            }

            query += ` ORDER BY vt.[Voucher_Type] ASC`;

            const result = await request.query(query);

            sentData(res, result.recordset);

        } catch (e) {
            servError(e, res);
        }
    };

    const getVoucherTypeDetails = async (req, res) => {
        try {
            const { GodownId } = req.query;

            let query = `
                SELECT TOP (1000) 
                    vt.[Vocher_Type_Id],
                    vt.[Voucher_Type],
                    vt.[Voucher_Code],
                    vt.[Branch_Id],
                    vt.[Type],
                    vt.[Tally_Id],
                    vt.[Alter_Id],
                    vt.[Created_By],
                    vt.[Created_Time],
                    vt.[Alter_By],
                    vt.[Alter_Time],
                    vt.[tally_sync],
                    vt.[deleteFlag],
                    vt.[GodownId],
                    vt.[crLimit],
                    vt.[drLimit],
                    vt.[tallyModule],
                    gm.[Godown_Name]
                FROM [dbo].[tbl_Voucher_Type] vt
                LEFT JOIN [dbo].[tbl_Godown_Master] gm ON vt.[GodownId] = gm.[Godown_Id]
                WHERE ISNULL(vt.[deleteFlag], 0) = 0
            `;

            const request = new sql.Request();

            if (GodownId !== undefined && GodownId !== null && GodownId !== '') {
                request.input('GodownId', sql.Int, Number(GodownId));
                query += ` AND vt.[GodownId] = @GodownId`;
            }

            query += ` ORDER BY vt.[Voucher_Type] ASC`;

            const result = await request.query(query);

            sentData(res, result.recordset);

        } catch (e) {
            servError(e, res);
        }
    };

    const getGodownsWithVoucherTypes = async (req, res) => {
        try {
            const request = new sql.Request();
            const result = await request.query(`
                SELECT 
                    gm.[Godown_Id],
                    gm.[Godown_Name],
                    COUNT(vt.[Vocher_Type_Id]) as [VoucherCount]
                FROM [dbo].[tbl_Godown_Master] gm
                INNER JOIN [dbo].[tbl_Voucher_Type] vt ON gm.[Godown_Id] = vt.[GodownId]
                WHERE ISNULL(vt.[deleteFlag], 0) = 0 
                  AND gm.[Godown_Name] IS NOT NULL 
                  AND LTRIM(RTRIM(gm.[Godown_Name])) <> ''
                GROUP BY gm.[Godown_Id], gm.[Godown_Name]
                ORDER BY gm.[Godown_Name] ASC
            `);

            sentData(res, result.recordset);
        } catch (e) {
            servError(e, res);
        }
    };

    return {
        getVoucherTypes,
        getVoucherTypeDetails,
        getGodownsWithVoucherTypes
    };
};

export default VoucherType();