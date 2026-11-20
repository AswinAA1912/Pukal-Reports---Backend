import sql from 'mssql';
import { servError, success, invalidInput } from '../../res.mjs';
import { checkIsNumber } from '../../helper_functions.mjs';

// Physical stock count vs ERP closing stock (tbl_Stock_Difference), in BAGS:
// System_Qty = ERP Act_Bal_Qty / Pack_Qty (godown wise stock API), Actual_Qty = bags counted.
// Rows are only added; the latest row (highest SD_Id) per Stock_Date + Godown_Id + Product_Id is the current count.

const REMARKS_MAX = 150;

const isValidDateText = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !isNaN(new Date(value).getTime());

const toQty = (value) => Math.round(Number(value) * 100) / 100;

// today's date (server local time) as YYYY-MM-DD
const localToday = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};


/**
 * GET inventory/stockDifference/report?Fromdate=YYYY-MM-DD&Todate=YYYY-MM-DD&Godown_Id=n (one godown, required)
 * Latest count per date + godown + item.
 */
export const getStockDifferenceReport = async (req, res) => {
    try {
        const Fromdate = isValidDateText(req.query.Fromdate) ? req.query.Fromdate : localToday();
        const Todate = isValidDateText(req.query.Todate) ? req.query.Todate : localToday();
        const Godown_Id = checkIsNumber(req.query.Godown_Id) ? Number(req.query.Godown_Id) : -1;

        if (Godown_Id < 0) return invalidInput(res, 'Select a godown');

        const result = await new sql.Request()
            .input('Fromdate', sql.Date, Fromdate)
            .input('Todate', sql.Date, Todate)
            .input('Godown_Id', sql.BigInt, Godown_Id)
            .query(`
                WITH latest AS (
                    SELECT
                        s.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY s.Stock_Date, s.Godown_Id, s.Product_Id
                            ORDER BY s.SD_Id DESC
                        ) AS rn
                    FROM tbl_Stock_Difference AS s
                    WHERE s.Stock_Date BETWEEN @Fromdate AND @Todate
                      AND (@Godown_Id = 0 OR s.Godown_Id = @Godown_Id)
                )
                SELECT
                    l.SD_Id, l.Stock_Date, l.Godown_Id,
                    COALESCE(g.Godown_Name, '-') AS Godown_Name,
                    l.Product_Id,
                    COALESCE(p.Product_Name, '') AS Item_Name,
                    COALESCE(los.Stock_Group, '-') AS Stock_Group,
                    COALESCE(los.Grade_Item_Group, '-') AS Grade_Item_Group,
                    l.System_Qty, l.Actual_Qty,
                    l.Actual_Qty - l.System_Qty AS Difference_Qty,
                    COALESCE(l.Remarks, '') AS Remarks,
                    l.Created_By,
                    COALESCE(u.Name, '') AS Created_By_Name,
                    l.Created_At
                FROM latest AS l
                LEFT JOIN tbl_Product_Master AS p ON p.Product_Id = l.Product_Id
                LEFT JOIN tbl_Stock_LOS AS los ON los.Pro_Id = l.Product_Id
                LEFT JOIN tbl_Users AS u ON u.UserId = l.Created_By
                LEFT JOIN tbl_Godown_Master AS g ON g.Godown_Id = l.Godown_Id
                WHERE l.rn = 1
                ORDER BY l.Stock_Date DESC, Godown_Name, Stock_Group, Item_Name;`
            );

        success(res, 'Data Found', result.recordset);
    } catch (e) {
        servError(e, res);
    }
};

