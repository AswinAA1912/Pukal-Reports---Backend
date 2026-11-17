import sql from 'mssql';
import { Division, isEqualNumber, ISOString, Subraction, toArray, toNumber } from '../../helper_functions.mjs';
import { servError, dataFound, noData } from '../../res.mjs';
import getImage from '../../middleware/getImageIfExist.mjs';

export const lrReportUploadgetMobile = async (req, res) => {
    try {
        const rawFromDate = req.query.fromDate || req.query.Fromdate || req.query.FromDate;
        const rawToDate = req.query.Todate || req.query.toDate || req.query.ToDate;

        const fromDate = rawFromDate ? ISOString(rawFromDate) : ISOString();
        const toDate = rawToDate ? ISOString(rawToDate) : fromDate;
        const status = req.query.staffStatus;

        const getSalesInvoice = new sql.Request()
            .input('allDetails', sql.Bit, req.query.allDetails === 'true')
            .input('Fromdate', sql.Date, fromDate)
            .input('Todate', sql.Date, toDate)
            .input('status', sql.Int, toNumber(status))
            .query(`
    -- filtered invoices ids temp table
        DECLARE @FilteredInvoice TABLE (Do_Id BIGINT);
    -- inserting data to temp table
        INSERT INTO @FilteredInvoice (Do_Id)
        SELECT Do_Id
        FROM tbl_Sales_Delivery_Gen_Info
        WHERE 
           (@allDetails = 1 OR (Do_Date >= @Fromdate
           AND Do_Date < DATEADD(DAY, 1, @toDate)))
           ${isEqualNumber(status, 0) ? ' AND ISNULL(staffInvolvedStatus, 0) = 0 ' : ''}
       SELECT 
    gen.Do_Id,
    gen.Do_Inv_No,
    gen.Voucher_Type,
    vt.Voucher_Type AS voucherTypeGet,
    gen.Do_Date,
    gen.Retailer_Id,
    s.Status AS Delivery_Status, 
    s.Status_Id AS Delivery_Status_Id,
    CASE  
        WHEN gen.Cancel_status = 0 THEN 'Canceled Invoice' 
        ELSE r.Retailer_Name
    END AS retailerNameGet,
    gen.Branch_Id,
    b.BranchName AS branchNameGet,
    gen.Total_Invoice_value,
    gen.Cancel_status,
    gen.Created_by,
    gen.Created_on,
    ISNULL(gen.staffInvolvedStatus, 0) staffInvolvedStatus,
    CONVERT(DATETIME, gen.Created_on) AS createdOn,
    COALESCE(lr.Narration, gen.Narration) AS Narration,
    COALESCE(cb.Name, 'unknown') AS Created_BY_Name,
    lr.ImageUrl,
    lr.Image_Name,
    lr.Id AS LrId,
    lr.Pending_Bags,
    COALESCE(lr.Status, 'pending') AS Status,
    lr.Remarks,
    lr.Follow_up AS Follow_Up,
    lr.Uploaded_By AS LR_Uploaded_By,
    COALESCE(lu.Name, '') AS LR_Uploaded_By_Name
FROM tbl_Sales_Delivery_Gen_Info AS gen
LEFT JOIN tbl_Voucher_Type AS vt ON vt.Vocher_Type_Id = gen.Voucher_Type
LEFT JOIN tbl_Retailers_Master AS r ON r.Retailer_Id = gen.Retailer_Id
LEFT JOIN tbl_Branch_Master AS b ON b.BranchId = gen.Branch_Id
LEFT JOIN tbl_Status AS s ON s.Status_Id = gen.Delivery_Status
LEFT JOIN tbl_Users AS cb ON cb.UserId = gen.Created_by
LEFT JOIN (
    SELECT 
        Id,
        Do_Id,
        ImageUrl,
        Image_Name,
        Uploaded_By,
        Pending_Bags,
        Status,
        Remarks,
        Follow_up,
        Narration,
        ROW_NUMBER() OVER (PARTITION BY Do_Id ORDER BY Id DESC) as rn
    FROM tbl_LrReport
) AS lr ON CAST(lr.Do_Id AS BIGINT) = gen.Do_Id AND lr.rn = 1
LEFT JOIN tbl_Users AS lu ON lu.UserId = lr.Uploaded_By
WHERE gen.Do_Id IN (SELECT Do_Id FROM @FilteredInvoice)
ORDER BY Do_Id;
    -- involved staffs
        SELECT 
            stf.*,
            e.Cost_Center_Name AS Emp_Name,
            cc.Cost_Category AS Involved_Emp_Type
        FROM tbl_Sales_Delivery_Staff_Info AS stf
        LEFT JOIN tbl_ERP_Cost_Center AS e
            ON e.Cost_Center_Id = stf.Emp_Id
        LEFT JOIN tbl_ERP_Cost_Category AS cc
            ON cc.Cost_Category_Id = stf.Emp_Type_Id
        WHERE stf.Do_Id IN (SELECT DISTINCT Do_Id FROM @FilteredInvoice)
        ORDER BY stf.Do_Id;
    -- Unique Cost Category IDs
        SELECT DISTINCT Emp_Type_Id
        FROM tbl_Sales_Delivery_Staff_Info
        WHERE Do_Id IN (SELECT Do_Id FROM @FilteredInvoice);
    -- Cost Types
        SELECT Cost_Category_Id, Cost_Category
        FROM tbl_ERP_Cost_Category
        ORDER BY Cost_Category;
    -- Stock Details
        SELECT 
            sdsi.Do_Date,
            sdsi.Delivery_Order_Id,
            sdsi.Item_Id,
            sdsi.S_No,
            gm.Godown_Name,
            COALESCE(p.Product_Name, 'not available') AS Product_Name,
            COALESCE(p.Product_Image_Name, 'not available') AS Product_Image_Name,
            COALESCE(u.Units, 'not available') AS UOM,
            COALESCE(br.Brand_Name, 'not available') AS Brand_Name,
            COALESCE(sdsi.Bill_Qty, 0) AS Bill_Qty,
            COALESCE(sdsi.Act_Qty, 0) AS Act_Qty,
            CASE 
                WHEN TRY_CAST(pck.Pack AS DECIMAL(18,2)) IS NULL
                     OR TRY_CAST(pck.Pack AS DECIMAL(18,2)) = 0
                THEN 0
                ELSE CONVERT(
                    DECIMAL(18,2),
                    COALESCE(sdsi.Bill_Qty, 0) / TRY_CAST(pck.Pack AS DECIMAL(18,2))
                )
            END AS Alt_Act_Qty,
            TRY_CAST(pck.Pack AS DECIMAL(18,2)) AS unitValue,
            COALESCE(p.Product_Rate, 0) AS itemRate,
            COALESCE(sdsi.Item_Rate, 0) AS billedRate
        FROM tbl_Sales_Delivery_Stock_Info sdsi
        LEFT JOIN tbl_Product_Master AS p ON p.Product_Id = sdsi.Item_Id
        LEFT JOIN tbl_UOM AS u ON u.Unit_Id = sdsi.Unit_Id
        LEFT JOIN tbl_Brand_Master AS br ON br.Brand_Id = p.Brand
        LEFT JOIN tbl_Pack_Master AS pck ON pck.Pack_Id = p.Pack_Id
        LEFT JOIN tbl_Godown_Master As gm ON gm.Godown_Id =sdsi.GoDown_Id
        WHERE sdsi.Delivery_Order_Id IN (SELECT Do_Id FROM @FilteredInvoice)
        ORDER BY sdsi.Delivery_Order_Id, sdsi.S_No;
    -- Trip numbers are a separate result set to avoid duplicating invoice rows.
        SELECT DISTINCT td.Delivery_Id, tm.Trip_No
        FROM tbl_Trip_Details AS td
        INNER JOIN tbl_Trip_Master AS tm ON tm.Trip_Id = td.Trip_Id
        WHERE td.Delivery_Id IN (SELECT Do_Id FROM @FilteredInvoice)
        ORDER BY td.Delivery_Id, tm.Trip_No`
            );

        const result = await getSalesInvoice;

        const [invoices = [], staffs = [], uniqeInvolvedStaffs = [], costTypes = [], stockDetails = [], trips = []] = result.recordsets;

        if (!invoices.length) {
            return noData(res);
        }

        const calculatedStockDetails = stockDetails.map(stock => ({
            ...stock,
            Alt_Act_Qty: Division(stock.Act_Qty, stock.unitValue),
            quantityDifference: Subraction(stock.Bill_Qty, stock.Act_Qty)
        }));



        const tripNumbers = new Map();
        trips.forEach(trip => {
            const key = String(trip.Delivery_Id);
            const number = String(trip.Trip_No ?? '').trim();
            if (!number) return;
            if (!tripNumbers.has(key)) tripNumbers.set(key, new Set());
            tripNumbers.get(key).add(number);
        });

        const invoicesWithStaffs = invoices.map(invoice => {
            const involvedStaffs = staffs.filter(stf =>
                isEqualNumber(stf.Do_Id, invoice.Do_Id)
            );

            const invoiceStockDetails = calculatedStockDetails.filter(stk =>
                isEqualNumber(stk.Delivery_Order_Id, invoice.Do_Id)
            );


            const transformedImageUrl = getImage('LRReport', invoice.Image_Name);

            const hasImage = invoice.Image_Name && invoice.Image_Name.trim() !== '';
            const imageStatus = hasImage ? 'uploaded' : 'pending';

            const { ImageUrl, Image_Name, LrId, ...invoiceWithoutImageUrl } = invoice;

            const transformedInvoice = {
                ...invoiceWithoutImageUrl,
                trip_no: [...(tripNumbers.get(String(invoice.Do_Id)) || [])].join(', '),
                Id: LrId,
                Imageurl: transformedImageUrl,
                Image_Name: Image_Name || '',
                imageStatus: imageStatus,
                involvedStaffs,
                stockDetails: invoiceStockDetails
            };

            return transformedInvoice;
        });

        dataFound(res, invoicesWithStaffs, {
            costTypes: toArray(costTypes),
            uniqeInvolvedStaffs: toArray(uniqeInvolvedStaffs).map(i => i.Emp_Type_Id)
        });

    } catch (e) {
        servError(e, res);
    }
};

export default {
    lrReportUploadgetMobile
};
