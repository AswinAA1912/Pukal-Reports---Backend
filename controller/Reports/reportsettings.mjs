import sql from "mssql";
import { servError, noData, dataFound } from "../../res.mjs";

export const MenuSettings = async (req, res) => {
    try {

        const result = await new sql.Request()

            .query("EXEC Reporting_Online_Menu_Settings_SP")

        const recordset = result.recordset ?? [];
        if (!recordset.length) return noData(res);

        dataFound(res, recordset);
    } catch (error) {
        servError(error, res);
    }

};

export const executeSP = async (req, res) => {
    try {
        const { spName, params } = req.body;

        if (!spName) {
            return res.status(400).json({
                success: false,
                message: "Stored Procedure name is required"
            });
        }

        const request = new sql.Request();

        /* ================= GET SP PARAMS ================= */

        const paramMeta = await new sql.Request()
            .input("spName", sql.NVarChar, spName)
            .query(`
                SELECT name 
                FROM sys.parameters 
                WHERE object_id = OBJECT_ID(@spName)
            `);

        const spParams = paramMeta.recordset.map(p =>
            p.name.replace("@", "")
        );

        /* ================= MAP PARAMS ================= */

        spParams.forEach((paramName) => {
            let value = undefined;

            // ðŸ”¥ case-insensitive match
            if (params && typeof params === "object") {
                const normalize = (str) => str.replace(/_/g, "").toLowerCase();

                const matchKey = Object.keys(params || {}).find(
                    k => normalize(k) === normalize(paramName)
                );


                if (matchKey) {
                    value = params[matchKey];
                }
            }

            if (value !== undefined) {
                request.input(paramName, value);
            } else {
                /* ðŸ”¥ DEFAULT HANDLING (customize if needed) */
                if (paramName.toLowerCase() === "ledger_id") {
                    request.input("Ledger_Id", 0); // default fallback
                }
                // ðŸ‘‰ You can add more defaults here if needed
            }
        });

        /* ================= EXECUTE ================= */

        const result = await request.execute(spName);

        const recordset = result.recordset ?? [];

        if (!recordset.length) return noData(res);

        return dataFound(res, recordset);

    } catch (error) {
        console.error("Execute SP Error:", error);
        return servError(error, res);
    }
};

export const saveReportSettings = async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const {
            reportName,
            parentReport,
            abstractColumns,
            expandedColumns,
            abstractSP,
            expandedSP,
            createdBy
        } = req.body;

        if (
            !reportName ||
            !parentReport ||
            !abstractColumns?.length ||
            !expandedColumns?.length ||
            !abstractSP ||
            !expandedSP
        ) {
            return res.status(400).json({ message: "Invalid payload" });
        }

        await transaction.begin();

        const reportResult = await new sql.Request(transaction)
            .input("Report_Name", sql.VarChar, reportName)
            .input("Parent_Report", sql.VarChar, parentReport)
            .input("CreatedBy", sql.Int, createdBy || 0)
            .query(`
                INSERT INTO tbl_ERP_Report
                (Report_Name, Parent_Report, CreatedBy, CreatedAt)
                OUTPUT INSERTED.Report_Id
                VALUES
                (@Report_Name, @Parent_Report, @CreatedBy, GETDATE())
            `);

        if (!reportResult.recordset?.length) {
            await transaction.rollback();
            return res.status(500).json({ message: "Report insert failed" });
        }

        const reportId = reportResult.recordset[0].Report_Id;

        /* ================= INSERT REPORT TYPES (FIXED 1 & 2) ================= */

        await new sql.Request(transaction)
            .input("Report_Id", sql.Int, reportId)
            .input("AbstractSP", sql.VarChar, abstractSP)
            .input("ExpandedSP", sql.VarChar, expandedSP)
            .query(`
        SET IDENTITY_INSERT tbl_ERP_ReportType ON;

        INSERT INTO tbl_ERP_ReportType (Type_Id, Report_Id, Report_Type)
        VALUES (1, @Report_Id, @AbstractSP);

        INSERT INTO tbl_ERP_ReportType (Type_Id, Report_Id, Report_Type)
        VALUES (2, @Report_Id, @ExpandedSP);

        SET IDENTITY_INSERT tbl_ERP_ReportType OFF;
    `);

        const abstractTypeId = 1;
        const expandedTypeId = 2;

        /* ================= INSERT FIELDS ================= */

        const insertFields = async (cols, typeId) => {
            let fieldIndex = 1;

            const normalizeType = (type = "") => {
                const t = type.toLowerCase();

                if (t === "qty" || t === "count") return t;
                if (t.includes("int")) return "int";
                if (t.includes("decimal") || t.includes("numeric")) return "decimal";
                if (t.includes("date") || t.includes("time")) return "datetime";
                if (t.includes("bit")) return "bit";

                return "nvarchar";
            };

            for (let col of cols) {
                if (!col.enabled) continue;

                await new sql.Request(transaction)
                    .input("Report_Id", sql.Int, reportId)
                    .input("Type_Id", sql.Int, typeId) // âœ… FIXED ID
                    .input("Field_Id", sql.Int, fieldIndex++)
                    .input("Field_Name", sql.VarChar, col.key)
                    .input("Fied_Data", sql.VarChar, normalizeType(col.dataType))
                    .input("Enable_By", sql.Int, 1)
                    .input("Order_By", sql.Int, col.order ?? 0)
                    .input("Group_By", sql.Int, col.groupBy ?? 0)
                    .query(`
                        INSERT INTO tbl_ERP_Report_Fileds
                        (Report_Id, Type_Id, Field_Id, Field_Name, Fied_Data, Enable_By, Order_By, Group_By)
                        VALUES
                        (@Report_Id, @Type_Id, @Field_Id, @Field_Name, @Fied_Data, @Enable_By, @Order_By, @Group_By)
                    `);
            }
        };

        await insertFields(abstractColumns, abstractTypeId);
        await insertFields(expandedColumns, expandedTypeId);

        /* ================= COMMIT ================= */

        await transaction.commit();

        return res.json({
            success: true,
            message: "Report saved successfully",
            reportId
        });

    } catch (error) {
        console.error("SAVE ERROR:", error);

        try {
            await transaction.rollback();
        } catch { }

        return res.status(500).json({
            success: false,
            message: "Error saving report"
        });
    }

};

export const getReportList = async (req, res) => {
    try {
        const result = await new sql.Request().query(`
            SELECT 
                r.Report_Id,
                r.Report_Name,
                r.Parent_Report,
                r.CreatedBy,
                u.Name AS CreatedByName,
                r.CreatedAt,
                rt.Type_Id,
                rt.Report_Type
            FROM tbl_ERP_Report r
            LEFT JOIN tbl_ERP_ReportType rt 
                ON r.Report_Id = rt.Report_Id
            LEFT JOIN tbl_Users u
                ON r.CreatedBy = u.UserId
            ORDER BY r.Parent_Report, r.Report_Name
        `);

        const rows = result.recordset || [];

        const grouped = {};

        rows.forEach((row) => {
            const parent = row.Parent_Report || "Others";

            if (!grouped[parent]) {
                grouped[parent] = [];
            }

            let report = grouped[parent].find(
                (r) => r.Report_Id === row.Report_Id
            );

            if (!report) {
                report = {
                    Report_Id: row.Report_Id,
                    Report_Name: row.Report_Name,
                    Parent_Report: row.Parent_Report,
                    CreatedBy: row.CreatedBy,
                    CreatedByName: row.CreatedByName || "-",
                    CreatedAt: row.CreatedAt,
                    templates: []
                };

                grouped[parent].push(report);
            }

            if (row.Type_Id) {
                report.templates.push({
                    Type_Id: row.Type_Id,
                    Report_Type: row.Report_Type
                });
            }
        });

        return res.json({
            success: true,
            data: grouped
        });

    } catch (error) {
        console.error("LIST ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching reports"
        });
    }
};

export const getReportEditData = async (req, res) => {
    try {
        const { reportId, typeId } = req.query;

        if (!reportId || !typeId) {
            return res.status(400).json({ message: "Missing params" });
        }

        /* ================= REPORT INFO ================= */

        const reportResult = await sql.query`
            SELECT Report_Id, Report_Name, Parent_Report
            FROM tbl_ERP_Report
            WHERE Report_Id = ${reportId}
        `;

        if (!reportResult.recordset.length) {
            return res.status(404).json({ message: "Report not found" });
        }

        const reportInfo = reportResult.recordset[0];

        /* ================= TYPE NAME ================= */

        const typeResult = await sql.query`
            SELECT Report_Type
            FROM tbl_ERP_ReportType
            WHERE Report_Id = ${reportId}
            AND Type_Id = ${typeId}
        `;

        const reportType = typeResult.recordset[0]?.Report_Type;

        /* ================= CALL MASTER SP ================= */

        const spResult = await new sql.Request()
            .input("Report_Id", sql.Int, reportId)
            .input("Type_Id", sql.Int, typeId)
            .input("Source_Name", sql.VarChar, reportType) // SP expects this
            .query(`
                EXEC Reporting_Online_Menu_Settings_SP_1 
                @Report_Id, 
                @Type_Id, 
                @Source_Name
            `);

        const rows = spResult.recordset || [];

        if (!rows.length) {
            return res.json({
                success: true,
                data: { reportInfo, columns: [] }
            });
        }

        /* ================= MAP DIRECTLY FROM SP ================= */

        const columns = rows.map((row, index) => ({
            key: row.Field_Name,
            label: row.Field_Name,

            // âœ… MAIN REQUIREMENT
            enabled: row.Enable_By === 1,

            order: row.Order_By ?? index + 1,
            groupBy: row.Group_By ?? 0,

            dataType: row.Fied_Data || "nvarchar"
        }));

        return res.json({
            success: true,
            data: {
                reportInfo,
                type: reportType, // optional (for UI)
                columns
            }
        });

    } catch (error) {
        console.error("EDIT LOAD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Error loading edit data"
        });
    }
};
export const updateReportSettings = async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const { reportId, typeId, columns, reportName } = req.body;

        if (!reportId || !typeId) {
            return res.status(400).json({ message: "Invalid payload" });
        }

        await transaction.begin();

        /* ðŸ”¥ UPDATE REPORT NAME IF PROVIDED */
        if (reportName) {
            await new sql.Request(transaction)
                .input("Report_Id", sql.Int, reportId)
                .input("Report_Name", sql.VarChar, reportName)
                .query(`
                    UPDATE tbl_ERP_Report
                    SET Report_Name = @Report_Name
                    WHERE Report_Id = @Report_Id
                `);
        }

        /* ðŸ”¥ DELETE OLD */
        await new sql.Request(transaction)
            .input("Report_Id", sql.Int, reportId)
            .input("Type_Id", sql.Int, typeId)
            .query(`
                DELETE FROM tbl_ERP_Report_Fileds
                WHERE Report_Id = @Report_Id AND Type_Id = @Type_Id
            `);

        /* ðŸ”¥ INSERT NEW */
        let fieldIndex = 1;

        for (let col of columns) {
            if (!col.enabled) continue;

            await new sql.Request(transaction)
                .input("Report_Id", sql.Int, reportId)
                .input("Type_Id", sql.Int, typeId)
                .input("Field_Id", sql.Int, fieldIndex++)
                .input("Field_Name", sql.VarChar, col.key)
                .input("Fied_Data", sql.VarChar, col.dataType)
                .input("Enable_By", sql.Int, 1)
                .input("Order_By", sql.Int, col.order ?? 0)
                .input("Group_By", sql.Int, col.groupBy ?? 0)
                .query(`
                    INSERT INTO tbl_ERP_Report_Fileds
                    (Report_Id, Type_Id, Field_Id, Field_Name, Fied_Data, Enable_By, Order_By, Group_By)
                    VALUES
                    (@Report_Id, @Type_Id, @Field_Id, @Field_Name, @Fied_Data, @Enable_By, @Order_By, @Group_By)
                `);
        }

        await transaction.commit();

        return res.json({ success: true });

    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({ success: false });
    }
};

export const getReportsByParent = async (req, res) => {
    try {
        const { parentReport } = req.query;

        if (!parentReport) {
            return res.status(400).json({ message: "Parent report required" });
        }

        const result = await sql.query`
            SELECT Report_Id, Report_Name
            FROM tbl_ERP_Report
            WHERE Parent_Report = ${parentReport}
        `;

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("GET REPORTS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching reports"
        });
    }
};

export const executeReportByTemplate = async (req, res) => {
    try {
        const { reportId, typeId } = req.query;

        if (!reportId || !typeId) {
            return res.status(400).json({ message: "Missing params" });
        }

        /* ===== GET SP NAME ===== */
        const typeResult = await sql.query`
            SELECT Report_Type
            FROM tbl_ERP_ReportType
            WHERE Report_Id = ${reportId}
            AND Type_Id = ${typeId}
        `;

        const spName = typeResult.recordset[0]?.Report_Type;

        if (!spName) {
            return res.status(400).json({ message: "SP not found" });
        }

        /* ===== EXECUTE SP ===== */
        const result = await new sql.Request()
            .input("Report_Id", sql.Int, reportId)
            .input("Type_Id", sql.Int, typeId)
            .input("Source_Name", sql.VarChar, spName)
            .query(`
                EXEC Reporting_Online_Menu_Settings_SP_1
                @Report_Id,
                @Type_Id,
                @Source_Name
            `);

        return res.json({
            success: true,
            data: result.recordset || []
        });

    } catch (error) {
        console.error("EXEC REPORT ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Error executing report"
        });
    }
};

export const deleteReport = async (req, res) => {
    const { reportId } = req.params;

    try {
        await new sql.Request()
            .input("Report_Id", sql.Int, reportId)
            .query(`
                DELETE FROM tbl_ERP_Report_Fileds
                WHERE Report_Id = @Report_Id;

                DELETE FROM tbl_ERP_ReportType
                WHERE Report_Id = @Report_Id;

                DELETE FROM tbl_ERP_Report
                WHERE Report_Id = @Report_Id;
            `);

        return res.json({
            success: true,
            message: "Template deleted successfully"
        });

    } catch (e) {
        console.error("DELETE ERROR:", e);

        return res.status(500).json({
            success: false,
            message: "Delete failed"
        });
    }
};



export const getEmployeeReportGroups = async (req, res) => {
    try {
        const { overallGroupId, groupName } = req.query;

        let query = `
            SELECT 
                erg.Id,
                erg.Group_Name,
                erg.Overall_GroupId,
                og.GroupName AS Overall_GroupName,
                erg.VoucherId,
                vt.Voucher_Type AS Voucher_Type_Name,
                erg.Created_By,
                erg.Created_At,
                erg.Updated_By,
                erg.Updated_At
            FROM tbl_Repots_EmployeeReport_Group erg
            LEFT JOIN tbl_Report_OverAll_Group og ON og.Id = erg.Overall_GroupId
            LEFT JOIN tbl_Voucher_Type vt ON vt.Vocher_Type_Id = erg.VoucherId
            WHERE 1 = 1
        `;

        const request = new sql.Request();

        if (overallGroupId) {
            query += ` AND erg.Overall_GroupId = @overallGroupId`;
            request.input("overallGroupId", sql.Int, overallGroupId);
        }

        if (groupName) {
            query += ` AND erg.Group_Name = @groupName`;
            request.input("groupName", sql.NVarChar, groupName);
        }

        query += ` ORDER BY erg.Group_Name, erg.VoucherId`;

        const result = await request.query(query);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("GET EMPLOYEE REPORT GROUPS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching employee report groups"
        });
    }
};


export const createEmployeeReportGroup = async (req, res) => {
    try {
        const { groupName, overallGroupId, voucherId, createdBy } = req.body;

        if (!groupName || !overallGroupId || !voucherId) {
            return res.status(400).json({
                success: false,
                message: "groupName, overallGroupId and voucherId are required"
            });
        }

        const result = await sql.query`
            INSERT INTO tbl_Repots_EmployeeReport_Group
                (Group_Name, Overall_GroupId, VoucherId, Created_By, Created_At)
            OUTPUT INSERTED.Id
            VALUES
                (${groupName}, ${overallGroupId}, ${voucherId}, ${createdBy || null}, GETDATE())
        `;

        return res.status(201).json({
            success: true,
            message: "Employee report group created successfully",
            data: { Id: result.recordset[0].Id }
        });

    } catch (err) {
        console.error("CREATE EMPLOYEE REPORT GROUP ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error creating employee report group"
        });
    }
};



export const updateEmployeeReportGroup = async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const { groupName, overallGroupId, voucherIds, updatedBy } = req.body;

        if (!groupName || !overallGroupId || !Array.isArray(voucherIds) || voucherIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "groupName, overallGroupId and a non-empty voucherIds array are required"
            });
        }

        await transaction.begin();


        const deleteRequest = new sql.Request(transaction);
        deleteRequest.input("groupName", sql.NVarChar, groupName);
        deleteRequest.input("overallGroupId", sql.Int, overallGroupId);

        await deleteRequest.query(`
            DELETE FROM tbl_Repots_EmployeeReport_Group
            WHERE Group_Name = @groupName
              AND Overall_GroupId = @overallGroupId
        `);

        for (const voucherId of voucherIds) {
            const insertRequest = new sql.Request(transaction);
            insertRequest.input("groupName", sql.NVarChar, groupName);
            insertRequest.input("overallGroupId", sql.Int, overallGroupId);
            insertRequest.input("voucherId", sql.Int, voucherId);
            insertRequest.input("updatedBy", sql.NVarChar, updatedBy || null);

            await insertRequest.query(`
                INSERT INTO tbl_Repots_EmployeeReport_Group
                    (Group_Name, Overall_GroupId, VoucherId, Created_By, Created_At)
                VALUES
                    (@groupName, @overallGroupId, @voucherId, @updatedBy, GETDATE())
            `);
        }

        await transaction.commit();

        return res.json({
            success: true,
            message: "Employee report group updated successfully"
        });

    } catch (err) {
        await transaction.rollback();
        console.error("UPDATE EMPLOYEE REPORT GROUP ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error updating employee report group"
        });
    }
};


export const createSalesStockGodown = async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const { salesStockGroup, saleStock, godownIds, createdBy } = req.body;

        if (!salesStockGroup || !saleStock || !Array.isArray(godownIds) || godownIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "salesStockGroup, saleStock and a non-empty godownIds array are required"
            });
        }

        await transaction.begin();

        for (const godownId of godownIds) {
            const insertRequest = new sql.Request(transaction);
            insertRequest.input("salesStockGroup", sql.NVarChar, salesStockGroup);
            insertRequest.input("saleStock", sql.NVarChar, saleStock);
            insertRequest.input("godownId", sql.BigInt, godownId);
            insertRequest.input("createdBy", sql.BigInt, createdBy || null);

            await insertRequest.query(`
                INSERT INTO tbl_SalesStockGodown
                    (SalesStockGroup, SaleStock, Godown_Id, created_by, created_at)
                VALUES
                    (@salesStockGroup, @saleStock, @godownId, @createdBy, GETDATE())
            `);
        }

        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: "Sales stock godown created successfully"
        });

    } catch (err) {
        await transaction.rollback();
        console.error("CREATE SALES STOCK GODOWN ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error creating sales stock godown"
        });
    }
};



export const getSalesStockGodown = async (req, res) => {
    try {
        const request = new sql.Request();

        const result = await request.query(`
             SELECT ssg.*,gm.Godown_Name
            FROM tbl_SalesStockGodown ssg
			LEFT JOIN tbl_Godown_Master gm ON gm.Godown_Id=ssg.Godown_Id
        `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("GET SALES STOCK GODOWN ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error fetching sales stock godown"
        });
    }
};


export const updateSalesStockGodown = async (req, res) => {
    const transaction = new sql.Transaction();

    try {
        const { salesStockGroup, saleStock, godownIds, createdBy } = req.body;

        if (!salesStockGroup || !saleStock || !Array.isArray(godownIds) || godownIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "salesStockGroup, saleStock and a non-empty godownIds array are required"
            });
        }

        await transaction.begin();

        const deleteRequest = new sql.Request(transaction);
        deleteRequest.input("salesStockGroup", sql.NVarChar, salesStockGroup);
        deleteRequest.input("saleStock", sql.NVarChar, saleStock);

        await deleteRequest.query(`
            DELETE FROM tbl_SalesStockGodown
            WHERE SalesStockGroup = @salesStockGroup
              AND SaleStock = @saleStock
        `);

        for (const godownId of godownIds) {
            const insertRequest = new sql.Request(transaction);
            insertRequest.input("salesStockGroup", sql.NVarChar, salesStockGroup);
            insertRequest.input("saleStock", sql.NVarChar, saleStock);
            insertRequest.input("godownId", sql.BigInt, godownId);
            insertRequest.input("createdBy", sql.BigInt, createdBy || null);

            await insertRequest.query(`
                INSERT INTO tbl_SalesStockGodown
                    (SalesStockGroup, SaleStock, Godown_Id, created_by, created_at)
                VALUES
                    (@salesStockGroup, @saleStock, @godownId, @createdBy, GETDATE())
            `);
        }

        await transaction.commit();

        return res.json({
            success: true,
            message: "Sales stock godown updated successfully"
        });

    } catch (err) {
        await transaction.rollback();
        console.error("UPDATE SALES STOCK GODOWN ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Error updating sales stock godown"
        });
    }
};