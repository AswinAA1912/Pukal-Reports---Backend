import React, { useEffect, useState } from "react";
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    CircularProgress,
    Radio,
    RadioGroup,
    FormControlLabel
} from "@mui/material";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { toast } from "react-toastify";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import {
    StockAbstractReportService,
    StockAbstractReportResponse,
    StockAbstractData3,
    StockAbstractData4
} from "../../services/dayStockAbstract.service";


const styleWorksheet = (ws: XLSX.WorkSheet) => {
    if (!ws || !ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);

    const borderStyle = {
        top: { style: "thin", color: { rgb: "CFCFCF" } },
        bottom: { style: "thin", color: { rgb: "CFCFCF" } },
        left: { style: "thin", color: { rgb: "CFCFCF" } },
        right: { style: "thin", color: { rgb: "CFCFCF" } }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];
            if (!cell) continue;

            cell.s = cell.s || {};
            const val = String(cell.v || "").trim();

            if (R === 0) {
                cell.s.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "1E3A8A" } };
                continue;
            }

            const isSectionHeader = val && (
                val === "SALES VOUCHER" ||
                val === "PURCHASE VOUCHER" ||
                val === "STOCK SUMMARY" ||
                val === "GODOWN TABLE" ||
                val === "STOCK JOURNAL" ||
                val === "OUTWARD SUMMARY 1" ||
                val === "OUTWARD SUMMARY 2" ||
                val === "INWARD SUMMARY 1" ||
                val === "INWARD SUMMARY 2" ||
                val === "DATA 1" ||
                val === "DATA 2" ||
                val === "DATA 3" ||
                val === "DATA 4" ||
                val === "DATA 5" ||
                val === "DATA 6" ||
                val === "DATA 7" ||
                val === "DATA 8"
            );

            if (isSectionHeader) {
                cell.s.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } };
                cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                cell.s.alignment = { horizontal: "left", vertical: "center" };
                continue;
            }

            const isHeaderCell = val && (
                val === "S.No" ||
                val === "S No" ||
                val === "Trans Type" ||
                val === "Transaction Type" ||
                val === "Sales Voucher Name" ||
                val === "Purchase Voucher Name" ||
                val === "Journal Vouchers" ||
                val === "Godown Name" ||
                val === "Act In" ||
                val === "Act Out" ||
                val === "In qty" ||
                val === "Out qty" ||
                val === "ACT ALT QTY" ||
                val === "BILL ALT QTY" ||
                val === "ACT QTY" ||
                val === "BILL QTY" ||
                val === "Qty" ||
                val === "Alt Qty" ||
                val === "OP" ||
                val === "IN" ||
                val === "Out" ||
                val === "CL" ||
                val === "Act OB" ||
                val === "Act IN" ||
                val === "Act out" ||
                val === "Act CL" ||
                val === "Outward Godown Qty" ||
                val === "Outward Godown ALT" ||
                val === "Pending Godown Qty" ||
                val === "Pending Godown ALT" ||
                val === "Sales Out Qty" ||
                val === "Sales Out ALT" ||
                val === "Journal Out Qty" ||
                val === "Journal Out ALT" ||
                val === "BAL QTY Qty" ||
                val === "BAL QTY ALT" ||
                val === "Transfer Godown Qty" ||
                val === "Transfer Godown ALT" ||
                val === "Inward Godown Qty" ||
                val === "Inward Godown ALT" ||
                val === "Storage Godown Qty" ||
                val === "Storage Godown ALT" ||
                val === "Outward Godown IN Qty" ||
                val === "Outward Godown IN ALT" ||
                val === "Pending Godown IN Qty" ||
                val === "Pending Godown IN ALT" ||
                val === "Transfer Godown IN Qty" ||
                val === "Transfer Godown IN ALT" ||
                val === "Storage Godown IN Qty" ||
                val === "Storage Godown IN ALT" ||
                val === "Journal IN Qty" ||
                val === "Journal IN ALT" ||
                val === "Inward Godown IN Qty" ||
                val === "Inward Godown IN ALT" ||
                val === "Purchase IN Qty" ||
                val === "Purchase IN ALT" ||
                val === "Receipt Credit" ||
                val === "Receipt Debit" ||
                val === "Payment Credit" ||
                val === "Payment Debit" ||
                val === "Debtors Credit" ||
                val === "Debtors Debit" ||
                val === "Creditors Credit" ||
                val === "Creditors Debit" ||
                val === "Expenses" ||
                val === "Credit" ||
                val === "Debit" ||
                val === "Count" ||
                val === "Amount" ||
                val === "Sundry Creditors Type" ||
                val === "Sundry Creditors Amount" ||
                val === "Sundry Debtors Type" ||
                val === "Sundry Debtors Amount"
            );

            if (isHeaderCell) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "000000" } };
                cell.s.fill = { fgColor: { rgb: "E2E8F0" } };
                cell.s.alignment = { horizontal: "center", vertical: "center" };
                cell.s.border = borderStyle;
                continue;
            }

            const firstCellOfRow = ws[XLSX.utils.encode_cell({ r: R, c: range.s.c })];
            const isRowTotal = firstCellOfRow && String(firstCellOfRow.v || "").trim().toUpperCase() === "TOTAL";

            if (isRowTotal) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "000000" } };
                cell.s.fill = { fgColor: { rgb: "F8FAFC" } };
                cell.s.border = borderStyle;
                if (typeof cell.v === "number") {
                    cell.s.alignment = { horizontal: "right", vertical: "center" };
                }
                continue;
            }

            // Check if it is a group/parent row (non-empty first cell which is not a number and not a total/header)
            let isGroupRow = false;
            if (firstCellOfRow && firstCellOfRow.v !== undefined && firstCellOfRow.v !== null) {
                const firstVal = String(firstCellOfRow.v).trim();
                const firstValUpper = firstVal.toUpperCase();
                const isNumber = !isNaN(Number(firstVal));
                const isSpecial = isRowTotal ||
                    firstValUpper === "S.NO" ||
                    firstValUpper === "S NO" ||
                    firstValUpper === "S.NO." ||
                    firstValUpper === "S NO." ||
                    firstValUpper.startsWith("STOCK ABSTRACT REPORT") ||
                    firstValUpper === "SALES VOUCHER" ||
                    firstValUpper === "PURCHASE VOUCHER" ||
                    firstValUpper === "STOCK SUMMARY" ||
                    firstValUpper === "GODOWN TABLE" ||
                    firstValUpper === "STOCK JOURNAL" ||
                    firstValUpper.startsWith("OUTWARD SUMMARY") ||
                    firstValUpper.startsWith("INWARD SUMMARY") ||
                    firstValUpper.startsWith("DATA ");
                if (!isNumber && !isSpecial && firstVal !== "") {
                    isGroupRow = true;
                }
            }

            if (isGroupRow) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "1E3A8A" } };
                cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
                cell.s.border = borderStyle;
                if (typeof cell.v === "number") {
                    cell.s.alignment = { horizontal: "right", vertical: "center" };
                } else {
                    cell.s.alignment = { horizontal: "left", vertical: "center" };
                }
                continue;
            }

            cell.s.font = { name: "Arial", sz: 10, color: { rgb: "000000" } };
            cell.s.border = borderStyle;

            if (typeof cell.v === "number") {
                cell.s.alignment = { horizontal: "right", vertical: "center" };
            } else {
                cell.s.alignment = { horizontal: "left", vertical: "center" };
            }
        }
    }
};


const StockAbstractReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const { toggleMode, setToggleMode } = useToggleMode();

    const [loading, setLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    const [liveData, setLiveData] = useState<StockAbstractReportResponse | null>(null);
    const [savedData, setSavedData] = useState<StockAbstractReportResponse | null>(null);

    // Unit mode selection: "All", "Chippam", "Kg"
    const [unitMode, setUnitMode] = useState<"All" | "Chippam" | "Kg">("All");

    const rawReportData = toggleMode === "Abstract" ? liveData : savedData;

    const reportData = React.useMemo(() => {
        if (!rawReportData) return null;
        return {
            ...rawReportData,
            Data4: (rawReportData.Data4 || []).filter(row =>
                Number(row.OB_Qty || 0) !== 0 ||
                Number(row.IN_Qty || 0) !== 0 ||
                Number(row.ACt_OB_Qty || 0) !== 0 ||
                Number(row.ACt_In_Qty || 0) !== 0 ||
                Number(row.ACt_Out_Qty || 0) !== 0 ||
                Number(row.Out_Qty || 0) !== 0 ||
                Number(row.CL_ACt_QTY || 0) !== 0 ||
                Number(row.CL_QTY || 0) !== 0
            )
        };
    }, [rawReportData]);

    /* ================= LOAD REPORT ================= */
    const loadReport = async () => {
        try {
            setLoading(true);
            const result = await StockAbstractReportService.getStockAbstractReport({
                Predate: dayjs(fromDate).subtract(1, "day").format("YYYY-MM-DD"),
                Fromdate: dayjs(fromDate).format("YYYY-MM-DD"),
                Todate: dayjs(toDate).format("YYYY-MM-DD"),
            });
            setLiveData(result);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load report");
        } finally {
            setLoading(false);
        }
    };

    /* ================= INITIAL LOAD ================= */
    useEffect(() => {
        loadReport();
    }, []);

    /* ================= SAVE SNAPSHOT ================= */
    const handleSaveSnapshot = () => {
        if (!liveData) {
            toast.warning("No data available");
            return;
        }
        setSavedData(JSON.parse(JSON.stringify(liveData)));
        toast.success("Snapshot saved successfully");
    };

    /* ================= FORMAT QUANTITY ================= */
    const formatQty = (value: number | undefined) => {
        if (value === undefined || isNaN(value)) return "0";
        return Number(value).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    /* ================= GROUP JOURNAL DATA ================= */
    const getJournalGroups = () => {
        if (!reportData?.Data3?.length) return {};
        return reportData.Data3.reduce((acc: Record<string, StockAbstractData3[]>, row) => {
            const group = row.Group_Name || "Others";
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(row);
            return acc;
        }, {});
    };

    /* ================= GROUP GODOWN DATA ================= */
    const getGodownGroups = () => {
        if (!reportData?.Data4?.length) return {};
        return reportData.Data4.reduce((acc: Record<string, StockAbstractData4[]>, row) => {
            const group = row.parent_godown_name || "Others";
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(row);
            return acc;
        }, {});
    };

    /* ================= EXPORT EXCEL ================= */
    const handleExportExcel = () => {
        if (!reportData) {
            toast.warning("No data available");
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        let row = 1;

        XLSX.utils.sheet_add_aoa(
            ws,
            [[`STOCK ABSTRACT REPORT (${fromDate} To ${toDate})`]],
            { origin: `A${row}` }
        );

        row += 2;

        const getHeaders = (voucherColName: string) => {
            const cols = ["S.No", voucherColName];
            if (unitMode === "All" || unitMode === "Chippam") {
                cols.push("Act In", "Act Out");
            }
            if (unitMode === "All" || unitMode === "Kg") {
                cols.push("In qty", "Out qty");
            }
            return [cols];
        };

        const getSalesPurchaseHeaders = (voucherColName: string) => {
            const cols = ["S.No", voucherColName];
            if (unitMode === "All" || unitMode === "Chippam") {
                cols.push("ACT ALT QTY");
                cols.push("BILL ALT QTY");
            }
            if (unitMode === "All" || unitMode === "Kg") {
                cols.push("ACT QTY");
                cols.push("BILL QTY");
            }
            return [cols];
        };

        /* ================= SALES VOUCHER (Data 1) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["SALES VOUCHER"]], { origin: `A${row}` });
        row += 1;

        const data1Headers = getSalesPurchaseHeaders("Sales Voucher Name");
        XLSX.utils.sheet_add_aoa(ws, data1Headers, { origin: `A${row}` });
        row += 1;

        const data1Rows = (reportData.Data1 || []).map((r, i) => {
            const line = [i + 1, r.voucher_name];
            if (unitMode === "All" || unitMode === "Chippam") {
                line.push(r.Act_Alt_Sal_Qty, r.Bill_Alt_Sal_Qty);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                line.push(r.Act_Sal_Qty, r.Bill_Sal_Qty);
            }
            return line;
        });

        const data1Total: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            const totalActAltSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Act_Alt_Sal_Qty || 0), 0);
            const totalBillAltSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Bill_Alt_Sal_Qty || 0), 0);
            data1Total.push(totalActAltSalQty, totalBillAltSalQty);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            const totalActSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Act_Sal_Qty || 0), 0);
            const totalBillSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Bill_Sal_Qty || 0), 0);
            data1Total.push(totalActSalQty, totalBillSalQty);
        }
        data1Rows.push(data1Total);

        XLSX.utils.sheet_add_json(ws, data1Rows, { origin: `A${row}`, skipHeader: true });
        row += data1Rows.length + 2;

        /* ================= PURCHASE VOUCHER (Data 2) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["PURCHASE VOUCHER"]], { origin: `A${row}` });
        row += 1;

        const data2Headers = getSalesPurchaseHeaders("Purchase Voucher Name");
        XLSX.utils.sheet_add_aoa(ws, data2Headers, { origin: `A${row}` });
        row += 1;

        const data2Rows = (reportData.Data2 || []).map((r, i) => {
            const line = [i + 1, r.voucher_name];
            if (unitMode === "All" || unitMode === "Chippam") {
                line.push(r.Act_Alt_Pur_Qty, r.Bill_Alt_Pur_Qty);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                line.push(r.Act_Pur_Qty, r.Bill_Pur_Qty);
            }
            return line;
        });

        const data2Total: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            const totalActAltPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Act_Alt_Pur_Qty || 0), 0);
            const totalBillAltPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Bill_Alt_Pur_Qty || 0), 0);
            data2Total.push(totalActAltPurQty, totalBillAltPurQty);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            const totalActPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Act_Pur_Qty || 0), 0);
            const totalBillPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Bill_Pur_Qty || 0), 0);
            data2Total.push(totalActPurQty, totalBillPurQty);
        }
        data2Rows.push(data2Total);

        XLSX.utils.sheet_add_json(ws, data2Rows, { origin: `A${row}`, skipHeader: true });
        row += data2Rows.length + 2;

        /* ================= STOCK SUMMARY (Data 9) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["STOCK SUMMARY"]], { origin: `A${row}` });
        row += 1;

        const data9Headers = ["S.No", "Trans Type"];
        if (unitMode === "All" || unitMode === "Kg") {
            data9Headers.push("Qty");
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            data9Headers.push("Alt Qty");
        }
        XLSX.utils.sheet_add_aoa(ws, [data9Headers], { origin: `A${row}` });
        row += 1;

        const data9Rows = (reportData.Data9 || []).map((r, i) => {
            const line: any[] = [i + 1, r.Trans_Type];
            if (unitMode === "All" || unitMode === "Kg") {
                line.push(r.Bal_Qty);
            }
            if (unitMode === "All" || unitMode === "Chippam") {
                line.push(r.Bal_Act_Qty);
            }
            return line;
        });



        XLSX.utils.sheet_add_json(ws, data9Rows, { origin: `A${row}`, skipHeader: true });
        row += data9Rows.length + 2;

        /* ================= GODOWN TABLE (Data 4) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["GODOWN TABLE"]], { origin: `A${row}` });
        row += 1;

        const godownHeaders = ["S.No", "Godown Name"];
        if (unitMode === "All" || unitMode === "Chippam") {
            godownHeaders.push("Act OB", "Act IN");
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownHeaders.push("OP", "IN");
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownHeaders.push("Act out");
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownHeaders.push("Out");
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownHeaders.push("Act CL");
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownHeaders.push("CL");
        }

        XLSX.utils.sheet_add_aoa(ws, [godownHeaders], { origin: `A${row}` });
        row += 1;

        const godownRows: any[] = [];
        const godownGroups = getGodownGroups();
        let gSno = 1;

        const totalOB = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.OB_Qty || 0), 0);
        const totalInQty4 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.IN_Qty || 0), 0);
        const totalActOB = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.ACt_OB_Qty || 0), 0);
        const totalActInQty4 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.ACt_In_Qty || 0), 0);
        const totalOutQty4 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.Out_Qty || 0), 0);
        const totalActOutQty4 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.ACt_Out_Qty || 0), 0);
        const totalCL = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.CL_QTY || 0), 0);
        const totalActCL = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.CL_ACt_QTY || 0), 0);

        const godownTotalRow: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            godownTotalRow.push(totalActOB, totalActInQty4);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownTotalRow.push(totalOB, totalInQty4);
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownTotalRow.push(totalActOutQty4);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownTotalRow.push(totalOutQty4);
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownTotalRow.push(totalActCL);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownTotalRow.push(totalCL);
        }
        godownRows.push(godownTotalRow);

        Object.entries(godownGroups).forEach(([parentName, items]: [string, any]) => {
            // Calculate Group Totals
            const groupOB = items.reduce((sum: number, r: any) => sum + Number(r.OB_Qty || 0), 0);
            const groupIn = items.reduce((sum: number, r: any) => sum + Number(r.IN_Qty || 0), 0);
            const groupActOB = items.reduce((sum: number, r: any) => sum + Number(r.ACt_OB_Qty || 0), 0);
            const groupActIn = items.reduce((sum: number, r: any) => sum + Number(r.ACt_In_Qty || 0), 0);
            const groupOut = items.reduce((sum: number, r: any) => sum + Number(r.Out_Qty || 0), 0);
            const groupActOut = items.reduce((sum: number, r: any) => sum + Number(r.ACt_Out_Qty || 0), 0);
            const groupCL = items.reduce((sum: number, r: any) => sum + Number(r.CL_QTY || 0), 0);
            const groupActCL = items.reduce((sum: number, r: any) => sum + Number(r.CL_ACt_QTY || 0), 0);

            const groupHeaderRow: any[] = [parentName, ""];
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderRow.push(groupActOB, groupActIn);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderRow.push(groupOB, groupIn);
            }
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderRow.push(groupActOut);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderRow.push(groupOut);
            }
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderRow.push(groupActCL);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderRow.push(groupCL);
            }
            godownRows.push(groupHeaderRow);

            items.forEach((rowItem: any) => {
                const line = [gSno++, rowItem.godown_name];
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(rowItem.ACt_OB_Qty, rowItem.ACt_In_Qty);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(rowItem.OB_Qty, rowItem.IN_Qty);
                }
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(rowItem.ACt_Out_Qty);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(rowItem.Out_Qty);
                }
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(rowItem.CL_ACt_QTY);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(rowItem.CL_QTY);
                }
                godownRows.push(line);
            });
        });

        XLSX.utils.sheet_add_json(ws, godownRows, { origin: `A${row}`, skipHeader: true });
        row += godownRows.length + 2;

        /* ================= STOCK JOURNAL (Data 3) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["STOCK JOURNAL"]], { origin: `A${row}` });
        row += 1;

        const data3Headers = getHeaders("Journal Vouchers");
        XLSX.utils.sheet_add_aoa(ws, data3Headers, { origin: `A${row}` });
        row += 1;

        const data3Rows: any[] = [];
        const groups = getJournalGroups();
        let sno = 1;

        Object.entries(groups).forEach(([groupName, vouchers]: [string, any]) => {
            const groupIn = vouchers.reduce((sum: number, r: any) => sum + Number(r.IN_Qty || 0), 0);
            const groupOut = vouchers.reduce((sum: number, r: any) => sum + Number(r.Out_Qty || 0), 0);
            const groupActIn = vouchers.reduce((sum: number, r: any) => sum + Number(r.ACt_In_Qty || 0), 0);
            const groupActOut = vouchers.reduce((sum: number, r: any) => sum + Number(r.ACt_Out_Qty || 0), 0);

            const groupHeaderLine: any[] = ["", groupName];
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderLine.push(groupActIn, groupActOut);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderLine.push(groupIn, groupOut);
            }
            data3Rows.push(groupHeaderLine);

            vouchers.forEach((r: any) => {
                const line = [sno++, r.voucher_name];
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(r.ACt_In_Qty, r.ACt_Out_Qty);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(r.IN_Qty, r.Out_Qty);
                }
                data3Rows.push(line);
            });
        });

        const data3Total: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            const totalActIn = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.ACt_In_Qty || 0), 0);
            const totalActOut = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.ACt_Out_Qty || 0), 0);
            data3Total.push(totalActIn, totalActOut);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            const totalIn = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.IN_Qty || 0), 0);
            const totalOut = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.Out_Qty || 0), 0);
            data3Total.push(totalIn, totalOut);
        }
        data3Rows.push(data3Total);

        XLSX.utils.sheet_add_json(ws, data3Rows, { origin: `A${row}`, skipHeader: true });
        row += data3Rows.length + 2;

        /* ================= OUTWARD SUMMARY 1 (Data 5) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["OUTWARD SUMMARY 1"]], { origin: `A${row}` });
        row += 1;

        const outSummary1Headers = ["S.No"];
        if (unitMode === "All") {
            outSummary1Headers.push(
                "Outward Godown Qty", "Outward Godown ALT",
                "Pending Godown Qty", "Pending Godown ALT",
                "Sales Out Qty", "Sales Out ALT",
                "Journal Out Qty", "Journal Out ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            outSummary1Headers.push(
                `Outward Godown (${unitMode})`,
                `Pending Godown (${unitMode})`,
                `Sales Out (${unitMode})`,
                `Journal Out (${unitMode})`,
                `BAL QTY (${unitMode})`
            );
        }

        XLSX.utils.sheet_add_aoa(ws, [outSummary1Headers], { origin: `A${row}` });
        row += 1;

        const data5Rows: any[] = [];
        (reportData.Data5 || []).forEach((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.OWSG_Out_Qty, item.OWSG_ACt_Out_Qty,
                    item.TSG_Out_Qty, item.TSG_ACt_Out_Qty,
                    item.Sal_Out_Qty, item.Sal_ACt_Out_Qty,
                    item.Out_Qty, item.ACt_Out_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.OWSG_ACt_Out_Qty, item.TSG_ACt_Out_Qty, item.Sal_ACt_Out_Qty, item.ACt_Out_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.OWSG_Out_Qty, item.TSG_Out_Qty, item.Sal_Out_Qty, item.Out_Qty, item.Bal_Qty);
            }
            data5Rows.push(line);
        });

        XLSX.utils.sheet_add_json(ws, data5Rows, { origin: `A${row}`, skipHeader: true });
        row += data5Rows.length + 2;

        /* ================= OUTWARD SUMMARY 2 (Data 7) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["OUTWARD SUMMARY 2"]], { origin: `A${row}` });
        row += 1;

        const outSummary2Headers = ["S.No"];
        if (unitMode === "All") {
            outSummary2Headers.push(
                "Transfer Godown Qty", "Transfer Godown ALT",
                "Inward Godown Qty", "Inward Godown ALT",
                "Storage Godown Qty", "Storage Godown ALT",
                "Journal Out Qty", "Journal Out ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            outSummary2Headers.push(
                `Transfer Godown (${unitMode})`,
                `Inward Godown (${unitMode})`,
                `Storage Godown (${unitMode})`,
                `Journal Out (${unitMode})`,
                `BAL QTY (${unitMode})`
            );
        }

        XLSX.utils.sheet_add_aoa(ws, [outSummary2Headers], { origin: `A${row}` });
        row += 1;

        const data7Rows: any[] = [];
        (reportData.Data7 || []).forEach((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.TSG_Out_Qty, item.TSG_ACt_Out_Qty,
                    item.OWSG_Out_Qty, item.OWSG_ACt_Out_Qty,
                    item.SG_Out_Qty, item.SG_ACt_Out_Qty,
                    item.Out_Qty, item.ACt_Out_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.TSG_ACt_Out_Qty, item.OWSG_ACt_Out_Qty, item.SG_ACt_Out_Qty, item.ACt_Out_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.TSG_Out_Qty, item.OWSG_Out_Qty, item.SG_Out_Qty, item.Out_Qty, item.Bal_Qty);
            }
            data7Rows.push(line);
        });

        XLSX.utils.sheet_add_json(ws, data7Rows, { origin: `A${row}`, skipHeader: true });
        row += data7Rows.length + 2;

        /* ================= INWARD SUMMARY 1 (Data 6) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["INWARD SUMMARY 1"]], { origin: `A${row}` });
        row += 1;

        const inSummary1Headers = ["S.No"];
        if (unitMode === "All") {
            inSummary1Headers.push(
                "Outward Godown IN Qty", "Outward Godown IN ALT",
                "Pending Godown IN Qty", "Pending Godown IN ALT",
                "Transfer Godown IN Qty", "Transfer Godown IN ALT",
                "Storage Godown IN Qty", "Storage Godown IN ALT",
                "Journal IN Qty", "Journal IN ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            inSummary1Headers.push(
                `Outward Godown IN (${unitMode})`,
                `Pending Godown IN (${unitMode})`,
                `Transfer Godown IN (${unitMode})`,
                `Storage Godown IN (${unitMode})`,
                `Journal IN (${unitMode})`,
                `BAL QTY (${unitMode})`
            );
        }

        XLSX.utils.sheet_add_aoa(ws, [inSummary1Headers], { origin: `A${row}` });
        row += 1;

        const data6Rows: any[] = [];
        (reportData.Data6 || []).forEach((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.OWSG_In_Qty, item.OWSG_ACt_In_Qty,
                    item.PSG_In_Qty, item.PSG_ACt_In_Qty,
                    item.TSG_In_Qty, item.TSG_ACt_In_Qty,
                    item.ST_In_Qty, item.ST_ACt_In_Qty,
                    item.In_Qty, item.ACt_In_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.OWSG_ACt_In_Qty, item.PSG_ACt_In_Qty, item.TSG_ACt_In_Qty, item.ST_ACt_In_Qty, item.ACt_In_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.OWSG_In_Qty, item.PSG_In_Qty, item.TSG_In_Qty, item.ST_In_Qty, item.In_Qty, item.Bal_Qty);
            }
            data6Rows.push(line);
        });

        XLSX.utils.sheet_add_json(ws, data6Rows, { origin: `A${row}`, skipHeader: true });
        row += data6Rows.length + 2;

        /* ================= INWARD SUMMARY 2 (Data 8) ================= */
        XLSX.utils.sheet_add_aoa(ws, [["INWARD SUMMARY 2"]], { origin: `A${row}` });
        row += 1;

        const inSummary2Headers = ["S.No"];
        if (unitMode === "All") {
            inSummary2Headers.push(
                "Inward Godown IN Qty", "Inward Godown IN ALT",
                "Purchase IN Qty", "Purchase IN ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            inSummary2Headers.push(
                `Inward Godown IN (${unitMode})`,
                `Purchase IN (${unitMode})`,
                `BAL QTY (${unitMode})`
            );
        }

        XLSX.utils.sheet_add_aoa(ws, [inSummary2Headers], { origin: `A${row}` });
        row += 1;

        const data8Rows: any[] = [];
        (reportData.Data8 || []).forEach((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.IWSG_In_Qty, item.INSG_ACt_In_Qty,
                    item.Pur_IN_Qty, item.Pur_ACt_IN_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.INSG_ACt_In_Qty, item.Pur_ACt_IN_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.IWSG_In_Qty, item.Pur_IN_Qty, item.Bal_Qty);
            }
            data8Rows.push(line);
        });

        XLSX.utils.sheet_add_json(ws, data8Rows, { origin: `A${row}`, skipHeader: true });

        ws["!cols"] = Array(15).fill({ wch: 20 });
        styleWorksheet(ws);
        XLSX.utils.book_append_sheet(wb, ws, "Stock Abstract");
        XLSX.writeFile(wb, `Stock_Abstract_Report_${dayjs().format("DDMMYYYY_HHmmss")}.xlsx`);
    };

    /* ================= EXPORT PDF ================= */
    const handleExportPDF = () => {
        if (!reportData) {
            toast.warning("No data available");
            return;
        }

        const doc = new jsPDF("landscape", "mm", "a4");

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(`STOCK ABSTRACT REPORT (${fromDate} TO ${toDate})`, 148, 12, { align: "center" });

        let currentY = 20;

        const addTitle = (title: string) => {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(title, 14, currentY);
            currentY += 4;
        };

        const getHeaders = (voucherColName: string) => {
            const cols = ["S.No", voucherColName];
            if (unitMode === "All" || unitMode === "Chippam") {
                cols.push("Act In", "Act Out");
            }
            if (unitMode === "All" || unitMode === "Kg") {
                cols.push("In qty", "Out qty");
            }
            return cols;
        };

        const getSalesPurchasePDFHeaders = (voucherColName: string) => {
            const cols = ["S.No", voucherColName];
            if (unitMode === "All" || unitMode === "Chippam") {
                cols.push("ACT ALT QTY", "BILL ALT QTY");
            }
            if (unitMode === "All" || unitMode === "Kg") {
                cols.push("ACT QTY", "BILL QTY");
            }
            return cols;
        };

        /* ================= SALES VOUCHER ================= */
        addTitle("SALES VOUCHER");

        const data1Body = (reportData.Data1 || []).map((r, i) => {
            const line: any[] = [i + 1, r.voucher_name];
            if (unitMode === "All" || unitMode === "Chippam") {
                line.push(r.Act_Alt_Sal_Qty, r.Bill_Alt_Sal_Qty);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                line.push(r.Act_Sal_Qty, r.Bill_Sal_Qty);
            }
            return line;
        });

        const data1Total: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            const totalActAltSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Act_Alt_Sal_Qty || 0), 0);
            const totalBillAltSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Bill_Alt_Sal_Qty || 0), 0);
            data1Total.push(totalActAltSalQty, totalBillAltSalQty);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            const totalActSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Act_Sal_Qty || 0), 0);
            const totalBillSalQty = (reportData.Data1 || []).reduce((sum, r) => sum + Number(r.Bill_Sal_Qty || 0), 0);
            data1Total.push(totalActSalQty, totalBillSalQty);
        }
        data1Body.push(data1Total);

        autoTable(doc, {
            startY: currentY,
            head: [getSalesPurchasePDFHeaders("Sales Voucher Name")],
            body: data1Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= PURCHASE VOUCHER ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("PURCHASE VOUCHER");

        const data2Body = (reportData.Data2 || []).map((r, i) => {
            const line: any[] = [i + 1, r.voucher_name];
            if (unitMode === "All" || unitMode === "Chippam") {
                line.push(r.Act_Alt_Pur_Qty, r.Bill_Alt_Pur_Qty);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                line.push(r.Act_Pur_Qty, r.Bill_Pur_Qty);
            }
            return line;
        });

        const data2Total: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            const totalActAltPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Act_Alt_Pur_Qty || 0), 0);
            const totalBillAltPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Bill_Alt_Pur_Qty || 0), 0);
            data2Total.push(totalActAltPurQty, totalBillAltPurQty);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            const totalActPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Act_Pur_Qty || 0), 0);
            const totalBillPurQty = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Bill_Pur_Qty || 0), 0);
            data2Total.push(totalActPurQty, totalBillPurQty);
        }
        data2Body.push(data2Total);

        autoTable(doc, {
            startY: currentY,
            head: [getSalesPurchasePDFHeaders("Purchase Voucher Name")],
            body: data2Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= STOCK SUMMARY ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("STOCK SUMMARY");

        const data9Body = (reportData.Data9 || []).map((r, i) => {
            const line: any[] = [i + 1, r.Trans_Type];
            if (unitMode === "All" || unitMode === "Kg") {
                line.push(r.Bal_Qty);
            }
            if (unitMode === "All" || unitMode === "Chippam") {
                line.push(r.Bal_Act_Qty);
            }
            return line;
        });



        const data9HeadersPDF = ["S.No", "Trans Type"];
        if (unitMode === "All" || unitMode === "Kg") {
            data9HeadersPDF.push("Qty");
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            data9HeadersPDF.push("Alt Qty");
        }

        autoTable(doc, {
            startY: currentY,
            head: [data9HeadersPDF],
            body: data9Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= GODOWN TABLE ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("GODOWN TABLE");

        const godownCols = ["S.No", "Godown Name"];
        if (unitMode === "All" || unitMode === "Chippam") {
            godownCols.push("Act OB", "Act IN");
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownCols.push("OP", "IN");
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownCols.push("Act out");
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownCols.push("Out");
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownCols.push("Act CL");
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownCols.push("CL");
        }

        const godownBody: any[] = [];
        const godownGroups2 = getGodownGroups();
        let gSno2 = 1;

        const totalOB2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.OB_Qty || 0), 0);
        const totalInQty4_2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.IN_Qty || 0), 0);
        const totalActOB2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.ACt_OB_Qty || 0), 0);
        const totalActInQty4_2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.ACt_In_Qty || 0), 0);
        const totalOutQty4_2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.Out_Qty || 0), 0);
        const totalActOutQty4_2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.ACt_Out_Qty || 0), 0);
        const totalCL2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.CL_QTY || 0), 0);
        const totalActCL2 = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.CL_ACt_QTY || 0), 0);

        const godownTotalLine = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            godownTotalLine.push(totalActOB2 as any, totalActInQty4_2 as any);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownTotalLine.push(totalOB2 as any, totalInQty4_2 as any);
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownTotalLine.push(totalActOutQty4_2 as any);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownTotalLine.push(totalOutQty4_2 as any);
        }
        if (unitMode === "All" || unitMode === "Chippam") {
            godownTotalLine.push(totalActCL2 as any);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            godownTotalLine.push(totalCL2 as any);
        }
        godownBody.push(godownTotalLine);

        Object.entries(godownGroups2).forEach(([parentName, items]: [string, any]) => {
            // Calculate Group Totals
            const groupOB = items.reduce((sum: number, r: any) => sum + Number(r.OB_Qty || 0), 0);
            const groupIn = items.reduce((sum: number, r: any) => sum + Number(r.IN_Qty || 0), 0);
            const groupActOB = items.reduce((sum: number, r: any) => sum + Number(r.ACt_OB_Qty || 0), 0);
            const groupActIn = items.reduce((sum: number, r: any) => sum + Number(r.ACt_In_Qty || 0), 0);
            const groupOut = items.reduce((sum: number, r: any) => sum + Number(r.Out_Qty || 0), 0);
            const groupActOut = items.reduce((sum: number, r: any) => sum + Number(r.ACt_Out_Qty || 0), 0);
            const groupCL = items.reduce((sum: number, r: any) => sum + Number(r.CL_QTY || 0), 0);
            const groupActCL = items.reduce((sum: number, r: any) => sum + Number(r.CL_ACt_QTY || 0), 0);

            const groupHeaderRow: any[] = [parentName, ""];
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderRow.push(groupActOB, groupActIn);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderRow.push(groupOB, groupIn);
            }
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderRow.push(groupActOut);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderRow.push(groupOut);
            }
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderRow.push(groupActCL);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderRow.push(groupCL);
            }
            godownBody.push(groupHeaderRow);

            items.forEach((rowItem: any) => {
                const line = [gSno2++, rowItem.godown_name];
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(rowItem.ACt_OB_Qty, rowItem.ACt_In_Qty);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(rowItem.OB_Qty, rowItem.IN_Qty);
                }
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(rowItem.ACt_Out_Qty);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(rowItem.Out_Qty);
                }
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(rowItem.CL_ACt_QTY);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(rowItem.CL_QTY);
                }
                godownBody.push(line);
            });
        });

        autoTable(doc, {
            startY: currentY,
            head: [godownCols],
            body: godownBody.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= STOCK JOURNAL ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("STOCK JOURNAL");

        const data3Body: any[] = [];
        const groups2 = getJournalGroups();
        let sno2 = 1;

        Object.entries(groups2).forEach(([groupName, vouchers]: [string, any]) => {
            const groupIn = vouchers.reduce((sum: number, r: any) => sum + Number(r.IN_Qty || 0), 0);
            const groupOut = vouchers.reduce((sum: number, r: any) => sum + Number(r.Out_Qty || 0), 0);
            const groupActIn = vouchers.reduce((sum: number, r: any) => sum + Number(r.ACt_In_Qty || 0), 0);
            const groupActOut = vouchers.reduce((sum: number, r: any) => sum + Number(r.ACt_Out_Qty || 0), 0);

            const groupHeaderLine: any[] = [groupName, ""];
            if (unitMode === "All" || unitMode === "Chippam") {
                groupHeaderLine.push(groupActIn, groupActOut);
            }
            if (unitMode === "All" || unitMode === "Kg") {
                groupHeaderLine.push(groupIn, groupOut);
            }
            data3Body.push(groupHeaderLine);

            vouchers.forEach((r: any) => {
                const line = [sno2++, r.voucher_name];
                if (unitMode === "All" || unitMode === "Chippam") {
                    line.push(r.ACt_In_Qty, r.ACt_Out_Qty);
                }
                if (unitMode === "All" || unitMode === "Kg") {
                    line.push(r.IN_Qty, r.Out_Qty);
                }
                data3Body.push(line);
            });
        });

        const data3Total: any[] = ["TOTAL", ""];
        if (unitMode === "All" || unitMode === "Chippam") {
            const totalActIn = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.ACt_In_Qty || 0), 0);
            const totalActOut = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.ACt_Out_Qty || 0), 0);
            data3Total.push(totalActIn, totalActOut);
        }
        if (unitMode === "All" || unitMode === "Kg") {
            const totalIn = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.IN_Qty || 0), 0);
            const totalOut = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.Out_Qty || 0), 0);
            data3Total.push(totalIn, totalOut);
        }
        data3Body.push(data3Total);

        autoTable(doc, {
            startY: currentY,
            head: [getHeaders("Journal Vouchers")],
            body: data3Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= OUTWARD SUMMARY 1 ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("OUTWARD SUMMARY 1");

        const data5Body = (reportData.Data5 || []).map((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.OWSG_Out_Qty, item.OWSG_ACt_Out_Qty,
                    item.TSG_Out_Qty, item.TSG_ACt_Out_Qty,
                    item.Sal_Out_Qty, item.Sal_ACt_Out_Qty,
                    item.Out_Qty, item.ACt_Out_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.OWSG_ACt_Out_Qty, item.TSG_ACt_Out_Qty, item.Sal_ACt_Out_Qty, item.ACt_Out_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.OWSG_Out_Qty, item.TSG_Out_Qty, item.Sal_Out_Qty, item.Out_Qty, item.Bal_Qty);
            }
            return line;
        });

        const data5Headers2 = ["S.No"];
        if (unitMode === "All") {
            data5Headers2.push(
                "Outward Godown Qty", "Outward Godown ALT",
                "Pending Godown Qty", "Pending Godown ALT",
                "Sales Out Qty", "Sales Out ALT",
                "Journal Out Qty", "Journal Out ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            data5Headers2.push("Outward Godown", "Pending Godown", "Sales Out", "Journal Out", "BAL QTY");
        }

        autoTable(doc, {
            startY: currentY,
            head: [data5Headers2],
            body: data5Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= OUTWARD SUMMARY 2 ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("OUTWARD SUMMARY 2");

        const data7Body = (reportData.Data7 || []).map((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.TSG_Out_Qty, item.TSG_ACt_Out_Qty,
                    item.OWSG_Out_Qty, item.OWSG_ACt_Out_Qty,
                    item.SG_Out_Qty, item.SG_ACt_Out_Qty,
                    item.Out_Qty, item.ACt_Out_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.TSG_ACt_Out_Qty, item.OWSG_ACt_Out_Qty, item.SG_ACt_Out_Qty, item.ACt_Out_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.TSG_Out_Qty, item.OWSG_Out_Qty, item.SG_Out_Qty, item.Out_Qty, item.Bal_Qty);
            }
            return line;
        });

        const data7Headers2 = ["S.No"];
        if (unitMode === "All") {
            data7Headers2.push(
                "Transfer Godown Qty", "Transfer Godown ALT",
                "Inward Godown Qty", "Inward Godown ALT",
                "Storage Godown Qty", "Storage Godown ALT",
                "Journal Out Qty", "Journal Out ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            data7Headers2.push("Transfer Godown", "Inward Godown", "Storage Godown", "Journal Out", "BAL QTY");
        }

        autoTable(doc, {
            startY: currentY,
            head: [data7Headers2],
            body: data7Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= INWARD SUMMARY 1 ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("INWARD SUMMARY 1");

        const data6Body = (reportData.Data6 || []).map((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.OWSG_In_Qty, item.OWSG_ACt_In_Qty,
                    item.PSG_In_Qty, item.PSG_ACt_In_Qty,
                    item.TSG_In_Qty, item.TSG_ACt_In_Qty,
                    item.ST_In_Qty, item.ST_ACt_In_Qty,
                    item.In_Qty, item.ACt_In_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.OWSG_ACt_In_Qty, item.PSG_ACt_In_Qty, item.TSG_ACt_In_Qty, item.ST_ACt_In_Qty, item.ACt_In_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.OWSG_In_Qty, item.PSG_In_Qty, item.TSG_In_Qty, item.ST_In_Qty, item.In_Qty, item.Bal_Qty);
            }
            return line;
        });

        const data6Headers2 = ["S.No"];
        if (unitMode === "All") {
            data6Headers2.push(
                "Outward Godown IN Qty", "Outward Godown IN ALT",
                "Pending Godown IN Qty", "Pending Godown IN ALT",
                "Transfer Godown IN Qty", "Transfer Godown IN ALT",
                "Storage Godown IN Qty", "Storage Godown IN ALT",
                "Journal IN Qty", "Journal IN ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            data6Headers2.push("Outward Godown IN", "Pending Godown IN", "Transfer Godown IN", "Storage Godown IN", "Journal IN", "BAL QTY");
        }

        autoTable(doc, {
            startY: currentY,
            head: [data6Headers2],
            body: data6Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= INWARD SUMMARY 2 ================= */
        if (currentY > 180) {
            doc.addPage();
            currentY = 20;
        }
        addTitle("INWARD SUMMARY 2");

        const data8Body = (reportData.Data8 || []).map((item, idx) => {
            const line = [idx + 1];
            if (unitMode === "All") {
                line.push(
                    item.IWSG_In_Qty, item.INSG_ACt_In_Qty,
                    item.Pur_IN_Qty, item.Pur_ACt_IN_Qty,
                    item.Bal_Qty, item.Bal_Act_Qty
                );
            } else if (unitMode === "Chippam") {
                line.push(item.INSG_ACt_In_Qty, item.Pur_ACt_IN_Qty, item.Bal_Act_Qty);
            } else if (unitMode === "Kg") {
                line.push(item.IWSG_In_Qty, item.Pur_IN_Qty, item.Bal_Qty);
            }
            return line;
        });

        const data8Headers2 = ["S.No"];
        if (unitMode === "All") {
            data8Headers2.push(
                "Inward Godown IN Qty", "Inward Godown IN ALT",
                "Purchase IN Qty", "Purchase IN ALT",
                "BAL QTY Qty", "BAL QTY ALT"
            );
        } else {
            data8Headers2.push("Inward Godown IN", "Purchase IN", "BAL QTY");
        }

        autoTable(doc, {
            startY: currentY,
            head: [data8Headers2],
            body: data8Body.map(row => row.map((val: any) => typeof val === "number" ? formatQty(val) : val)),
            styles: { fontSize: 8 },
        });

        doc.save(`Stock_Abstract_Report_${dayjs().format("DDMMYYYY_HHmmss")}.pdf`);
    };

    const compactTableStyle = {
        width: "max-content",
        minWidth: "100%",
        "& .MuiTableCell-root": {
            border: "1px solid #CFCFCF",
            py: 0.5,
            px: 1,
            fontSize: "0.78rem",
            whiteSpace: "nowrap",
        },
        "& .MuiTableHead-root .MuiTableCell-root": {
            fontWeight: 700,
            backgroundColor: "#1E3A8A",
            color: "#fff",
        },
    };

    /* ================= STOCK SUMMARY TABLE (T9) ================= */
    const renderStockSummaryTable = () => {
        if (!reportData?.Data9?.length) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Stock Summary Data Available
                    </Typography>
                </Paper>
            );
        }

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 60 }}>S.No</TableCell>
                                <TableCell sx={{ width: 150 }}>Trans Type</TableCell>
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <TableCell align="right" sx={{ width: 100 }}>Qty</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <TableCell align="right" sx={{ width: 100 }}>Alt Qty</TableCell>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportData.Data9.map((row, index) => (
                                <TableRow key={index} sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{row.Trans_Type}</TableCell>
                                    {(unitMode === "All" || unitMode === "Kg") && (
                                        <TableCell align="right">{formatQty(row.Bal_Qty)}</TableCell>
                                    )}
                                    {(unitMode === "All" || unitMode === "Chippam") && (
                                        <TableCell align="right">{formatQty(row.Bal_Act_Qty)}</TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= SALES VOUCHERS TABLE ================= */
    const renderSalesTable = () => {
        if (!reportData?.Data1?.length) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%", display: "block" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Sales Data Available
                    </Typography>
                </Paper>
            );
        }

        const totalActSalQty = reportData.Data1.reduce((sum, r) => sum + Number(r.Act_Sal_Qty || 0), 0);
        const totalActAltSalQty = reportData.Data1.reduce((sum, r) => sum + Number(r.Act_Alt_Sal_Qty || 0), 0);
        const totalBillSalQty = reportData.Data1.reduce((sum, r) => sum + Number(r.Bill_Sal_Qty || 0), 0);
        const totalBillAltSalQty = reportData.Data1.reduce((sum, r) => sum + Number(r.Bill_Alt_Sal_Qty || 0), 0);

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 60 }}>S.No</TableCell>
                                <TableCell sx={{ width: 250 }}>Sales Voucher Name</TableCell>
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 100 }}>ACT ALT QTY</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>BILL ALT QTY</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 100 }}>ACT QTY</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>BILL QTY</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportData.Data1.map((row, index) => (
                                <TableRow key={index} sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{row.voucher_name}</TableCell>
                                    {(unitMode === "All" || unitMode === "Chippam") && (
                                        <>
                                            <TableCell align="right">{formatQty(row.Act_Alt_Sal_Qty)}</TableCell>
                                            <TableCell align="right">{formatQty(row.Bill_Alt_Sal_Qty)}</TableCell>
                                        </>
                                    )}
                                    {(unitMode === "All" || unitMode === "Kg") && (
                                        <>
                                            <TableCell align="right">{formatQty(row.Act_Sal_Qty)}</TableCell>
                                            <TableCell align="right">{formatQty(row.Bill_Sal_Qty)}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                            <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
                                <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                <TableCell />
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActAltSalQty)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalBillAltSalQty)}</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActSalQty)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalBillSalQty)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= PURCHASE VOUCHERS TABLE ================= */
    const renderPurchaseTable = () => {
        if (!reportData?.Data2?.length) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Purchase Data Available
                    </Typography>
                </Paper>
            );
        }

        const totalActPurQty = reportData.Data2.reduce((sum, r) => sum + Number(r.Act_Pur_Qty || 0), 0);
        const totalActAltPurQty = reportData.Data2.reduce((sum, r) => sum + Number(r.Act_Alt_Pur_Qty || 0), 0);
        const totalBillPurQty = reportData.Data2.reduce((sum, r) => sum + Number(r.Bill_Pur_Qty || 0), 0);
        const totalBillAltPurQty = reportData.Data2.reduce((sum, r) => sum + Number(r.Bill_Alt_Pur_Qty || 0), 0);

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 60 }}>S.No</TableCell>
                                <TableCell sx={{ width: 250 }}>Purchase Voucher Name</TableCell>
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 100 }}>ACT ALT QTY</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>BILL ALT QTY</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 100 }}>ACT QTY</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>BILL QTY</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportData.Data2.map((row, index) => (
                                <TableRow key={index} sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{row.voucher_name}</TableCell>
                                    {(unitMode === "All" || unitMode === "Chippam") && (
                                        <>
                                            <TableCell align="right">{formatQty(row.Act_Alt_Pur_Qty)}</TableCell>
                                            <TableCell align="right">{formatQty(row.Bill_Alt_Pur_Qty)}</TableCell>
                                        </>
                                    )}
                                    {(unitMode === "All" || unitMode === "Kg") && (
                                        <>
                                            <TableCell align="right">{formatQty(row.Act_Pur_Qty)}</TableCell>
                                            <TableCell align="right">{formatQty(row.Bill_Pur_Qty)}</TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                            <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
                                <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                <TableCell />
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActAltPurQty)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalBillAltPurQty)}</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActPurQty)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalBillPurQty)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= STOCK JOURNAL TABLE ================= */
    const renderJournalTable = () => {
        if (!reportData?.Data3?.length) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Journal Data Available
                    </Typography>
                </Paper>
            );
        }

        const groups = getJournalGroups();
        let sno = 1;

        const totalIn = reportData.Data3.reduce((sum, r) => sum + Number(r.IN_Qty || 0), 0);
        const totalOut = reportData.Data3.reduce((sum, r) => sum + Number(r.Out_Qty || 0), 0);
        const totalActIn = reportData.Data3.reduce((sum, r) => sum + Number(r.ACt_In_Qty || 0), 0);
        const totalActOut = reportData.Data3.reduce((sum, r) => sum + Number(r.ACt_Out_Qty || 0), 0);

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 60 }}>S.No</TableCell>
                                <TableCell sx={{ width: 250 }}>Journal Vouchers</TableCell>
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 100 }}>Act In</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>Act Out</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 100 }}>In qty</TableCell>
                                        <TableCell align="right" sx={{ width: 100 }}>Out qty</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(groups).map(([groupName, vouchers]: [string, any]) => {
                                const groupIn = vouchers.reduce((sum: number, r: any) => sum + Number(r.IN_Qty || 0), 0);
                                const groupOut = vouchers.reduce((sum: number, r: any) => sum + Number(r.Out_Qty || 0), 0);
                                const groupActIn = vouchers.reduce((sum: number, r: any) => sum + Number(r.ACt_In_Qty || 0), 0);
                                const groupActOut = vouchers.reduce((sum: number, r: any) => sum + Number(r.ACt_Out_Qty || 0), 0);

                                return (
                                    <React.Fragment key={groupName}>
                                        <TableRow sx={{ backgroundColor: "#e2e8f0" }}>
                                            <TableCell />
                                            <TableCell sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                {groupName}
                                            </TableCell>
                                            {(unitMode === "All" || unitMode === "Chippam") && (
                                                <>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupActIn)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupActOut)}</TableCell>
                                                </>
                                            )}
                                            {(unitMode === "All" || unitMode === "Kg") && (
                                                <>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupIn)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupOut)}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                        {vouchers.map((row: any, i: number) => (
                                            <TableRow key={i} sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                                <TableCell>{sno++}</TableCell>
                                                <TableCell>{row.voucher_name}</TableCell>
                                                {(unitMode === "All" || unitMode === "Chippam") && (
                                                    <>
                                                        <TableCell align="right">{formatQty(row.ACt_In_Qty)}</TableCell>
                                                        <TableCell align="right">{formatQty(row.ACt_Out_Qty)}</TableCell>
                                                    </>
                                                )}
                                                {(unitMode === "All" || unitMode === "Kg") && (
                                                    <>
                                                        <TableCell align="right">{formatQty(row.IN_Qty)}</TableCell>
                                                        <TableCell align="right">{formatQty(row.Out_Qty)}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                            <TableRow sx={{ backgroundColor: "#F8FAFC" }}>
                                <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                <TableCell />
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActIn)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActOut)}</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalIn)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalOut)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= GODOWN TABLE (Data 4) ================= */
    const renderGodownTable = () => {
        if (!reportData?.Data4?.length) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Godown Data Available
                    </Typography>
                </Paper>
            );
        }

        const groups = getGodownGroups();

        // Calculate grand totals
        const totalOB = reportData.Data4.reduce((sum, r) => sum + Number(r.OB_Qty || 0), 0);
        const totalIn = reportData.Data4.reduce((sum, r) => sum + Number(r.IN_Qty || 0), 0);
        const totalActOB = reportData.Data4.reduce((sum, r) => sum + Number(r.ACt_OB_Qty || 0), 0);
        const totalActIn = reportData.Data4.reduce((sum, r) => sum + Number(r.ACt_In_Qty || 0), 0);
        const totalOut = reportData.Data4.reduce((sum, r) => sum + Number(r.Out_Qty || 0), 0);
        const totalActOut = reportData.Data4.reduce((sum, r) => sum + Number(r.ACt_Out_Qty || 0), 0);
        const totalCL = reportData.Data4.reduce((sum, r) => sum + Number(r.CL_QTY || 0), 0);
        const totalActCL = reportData.Data4.reduce((sum, r) => sum + Number(r.CL_ACt_QTY || 0), 0);

        let sno = 1;

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 60 }}>S.No</TableCell>
                                <TableCell sx={{ width: 200 }}>Godown Name</TableCell>
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 80 }}>OP</TableCell>
                                        <TableCell align="right" sx={{ width: 80 }}>IN</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ width: 90 }}>Act OB</TableCell>
                                        <TableCell align="right" sx={{ width: 90 }}>Act IN</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <TableCell align="right" sx={{ width: 90 }}>Act out</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <TableCell align="right" sx={{ width: 80 }}>Out</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <TableCell align="right" sx={{ width: 90 }}>Act CL</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <TableCell align="right" sx={{ width: 80 }}>CL</TableCell>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/* TOTALS ROW (DIRECTLY BELOW THE HEADER) */}
                            <TableRow sx={{ backgroundColor: "#F1F5F9", fontWeight: 700 }}>
                                <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                <TableCell />
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalOB)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalIn)}</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActOB)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActIn)}</TableCell>
                                    </>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActOut)}</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalOut)}</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Chippam") && (
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalActCL)}</TableCell>
                                )}
                                {(unitMode === "All" || unitMode === "Kg") && (
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatQty(totalCL)}</TableCell>
                                )}
                            </TableRow>

                            {Object.entries(groups).map(([parentName, items]: [string, any]) => {
                                const groupOB = items.reduce((sum: number, r: any) => sum + Number(r.OB_Qty || 0), 0);
                                const groupIn = items.reduce((sum: number, r: any) => sum + Number(r.IN_Qty || 0), 0);
                                const groupActOB = items.reduce((sum: number, r: any) => sum + Number(r.ACt_OB_Qty || 0), 0);
                                const groupActIn = items.reduce((sum: number, r: any) => sum + Number(r.ACt_In_Qty || 0), 0);
                                const groupOut = items.reduce((sum: number, r: any) => sum + Number(r.Out_Qty || 0), 0);
                                const groupActOut = items.reduce((sum: number, r: any) => sum + Number(r.ACt_Out_Qty || 0), 0);
                                const groupCL = items.reduce((sum: number, r: any) => sum + Number(r.CL_QTY || 0), 0);
                                const groupActCL = items.reduce((sum: number, r: any) => sum + Number(r.CL_ACt_QTY || 0), 0);

                                return (
                                    <React.Fragment key={parentName}>
                                        {/* Parent Godown Header Row with Group Totals */}
                                        <TableRow sx={{ backgroundColor: "#e2e8f0" }}>
                                            <TableCell />
                                            <TableCell sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                {parentName}
                                            </TableCell>
                                            {(unitMode === "All" || unitMode === "Kg") && (
                                                <>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupOB)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupIn)}</TableCell>
                                                </>
                                            )}
                                            {(unitMode === "All" || unitMode === "Chippam") && (
                                                <>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupActOB)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupActIn)}</TableCell>
                                                </>
                                            )}
                                            {(unitMode === "All" || unitMode === "Chippam") && (
                                                <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupActOut)}</TableCell>
                                            )}
                                            {(unitMode === "All" || unitMode === "Kg") && (
                                                <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupOut)}</TableCell>
                                            )}
                                            {(unitMode === "All" || unitMode === "Chippam") && (
                                                <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupActCL)}</TableCell>
                                            )}
                                            {(unitMode === "All" || unitMode === "Kg") && (
                                                <TableCell align="right" sx={{ fontWeight: 700, color: "#1E3A8A" }}>{formatQty(groupCL)}</TableCell>
                                            )}
                                        </TableRow>
                                        {/* Godown Rows */}
                                        {items.map((row: any, idx: number) => (
                                            <TableRow key={idx} sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                                <TableCell>{sno++}</TableCell>
                                                <TableCell>{row.godown_name}</TableCell>
                                                {(unitMode === "All" || unitMode === "Kg") && (
                                                    <>
                                                        <TableCell align="right">{formatQty(row.OB_Qty)}</TableCell>
                                                        <TableCell align="right">{formatQty(row.IN_Qty)}</TableCell>
                                                    </>
                                                )}
                                                {(unitMode === "All" || unitMode === "Chippam") && (
                                                    <>
                                                        <TableCell align="right">{formatQty(row.ACt_OB_Qty)}</TableCell>
                                                        <TableCell align="right">{formatQty(row.ACt_In_Qty)}</TableCell>
                                                    </>
                                                )}
                                                {(unitMode === "All" || unitMode === "Chippam") && (
                                                    <TableCell align="right">{formatQty(row.ACt_Out_Qty)}</TableCell>
                                                )}
                                                {(unitMode === "All" || unitMode === "Kg") && (
                                                    <TableCell align="right">{formatQty(row.Out_Qty)}</TableCell>
                                                )}
                                                {(unitMode === "All" || unitMode === "Chippam") && (
                                                    <TableCell align="right">{formatQty(row.CL_ACt_QTY)}</TableCell>
                                                )}
                                                {(unitMode === "All" || unitMode === "Kg") && (
                                                    <TableCell align="right">{formatQty(row.CL_QTY)}</TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= OUTWARD SUMMARY 1 TABLE (T5 / Data 5) ================= */
    const renderOutwardSummary1Table = () => {
        const item = reportData?.Data5?.[0];
        if (!item) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Outward Summary 1 Data Available
                    </Typography>
                </Paper>
            );
        }

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            {unitMode === "All" ? (
                                <>
                                    <TableRow>
                                        <TableCell rowSpan={2} sx={{ width: 50, verticalAlign: "middle" }}>S No</TableCell>
                                        <TableCell colSpan={2} align="center">Outward Godown</TableCell>
                                        <TableCell colSpan={2} align="center">Pending Godown</TableCell>
                                        <TableCell colSpan={2} align="center">Sales Out</TableCell>
                                        <TableCell colSpan={2} align="center">Journal Out</TableCell>
                                        <TableCell colSpan={2} align="center">BAL QTY</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell sx={{ width: 50 }}>S No</TableCell>
                                    <TableCell align="right">Outward Godown ({unitMode})</TableCell>
                                    <TableCell align="right">Pending Godown ({unitMode})</TableCell>
                                    <TableCell align="right">Sales Out ({unitMode})</TableCell>
                                    <TableCell align="right">Journal Out ({unitMode})</TableCell>
                                    <TableCell align="right">BAL QTY ({unitMode})</TableCell>
                                </TableRow>
                            )}
                        </TableHead>
                        <TableBody>
                            <TableRow sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                <TableCell>1</TableCell>
                                {unitMode === "All" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.OWSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.OWSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Sal_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Sal_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Chippam" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.OWSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Sal_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Kg" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.OWSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Sal_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Qty)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= OUTWARD SUMMARY 2 TABLE (T6 / Data 7) ================= */
    const renderOutwardSummary2Table = () => {
        const item = reportData?.Data7?.[0];
        if (!item) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Outward Summary 2 Data Available
                    </Typography>
                </Paper>
            );
        }

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            {unitMode === "All" ? (
                                <>
                                    <TableRow>
                                        <TableCell rowSpan={2} sx={{ width: 50, verticalAlign: "middle" }}>S No</TableCell>
                                        <TableCell colSpan={2} align="center">Transfer Godown</TableCell>
                                        <TableCell colSpan={2} align="center">Inward Godown</TableCell>
                                        <TableCell colSpan={2} align="center">Storage Godown</TableCell>
                                        <TableCell colSpan={2} align="center">Journal Out</TableCell>
                                        <TableCell colSpan={2} align="center">BAL QTY</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell sx={{ width: 50 }}>S No</TableCell>
                                    <TableCell align="right">Transfer Godown ({unitMode})</TableCell>
                                    <TableCell align="right">Inward Godown ({unitMode})</TableCell>
                                    <TableCell align="right">Storage Godown ({unitMode})</TableCell>
                                    <TableCell align="right">Journal Out ({unitMode})</TableCell>
                                    <TableCell align="right">BAL QTY ({unitMode})</TableCell>
                                </TableRow>
                            )}
                        </TableHead>
                        <TableBody>
                            <TableRow sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                <TableCell>1</TableCell>
                                {unitMode === "All" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.TSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.OWSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.OWSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.SG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.SG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Chippam" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.TSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.OWSG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.SG_ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ACt_Out_Qty)}</TableCell>
                                        <TableCell align="right" sx={{ color: "#2563EB", fontWeight: 700 }}>{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Kg" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.TSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.OWSG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.SG_Out_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Out_Qty)}</TableCell>
                                        <TableCell align="right" sx={{ color: "#2563EB", fontWeight: 700 }}>{formatQty(item.Bal_Qty)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= INWARD SUMMARY 1 TABLE (T7 / Data 6) ================= */
    const renderInwardSummary1Table = () => {
        const item = reportData?.Data6?.[0];
        if (!item) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Inward Summary 1 Data Available
                    </Typography>
                </Paper>
            );
        }

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            {unitMode === "All" ? (
                                <>
                                    <TableRow>
                                        <TableCell rowSpan={2} sx={{ width: 50, verticalAlign: "middle" }}>S No</TableCell>
                                        <TableCell colSpan={2} align="center">Outward Godown IN</TableCell>
                                        <TableCell colSpan={2} align="center">Pending Godown IN</TableCell>
                                        <TableCell colSpan={2} align="center">Transfer Godown IN</TableCell>
                                        <TableCell colSpan={2} align="center">Storage Godown IN</TableCell>
                                        <TableCell colSpan={2} align="center">Journal IN</TableCell>
                                        <TableCell colSpan={2} align="center">BAL QTY</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell sx={{ width: 50 }}>S No</TableCell>
                                    <TableCell align="right">Outward Godown IN ({unitMode})</TableCell>
                                    <TableCell align="right">Pending Godown IN ({unitMode})</TableCell>
                                    <TableCell align="right">Transfer Godown IN ({unitMode})</TableCell>
                                    <TableCell align="right">Storage Godown IN ({unitMode})</TableCell>
                                    <TableCell align="right">Journal IN ({unitMode})</TableCell>
                                    <TableCell align="right">BAL QTY ({unitMode})</TableCell>
                                </TableRow>
                            )}
                        </TableHead>
                        <TableBody>
                            <TableRow sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                <TableCell>1</TableCell>
                                {unitMode === "All" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.OWSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.OWSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.PSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.PSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ST_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ST_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Chippam" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.OWSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.PSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ST_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ACt_In_Qty)}</TableCell>
                                        <TableCell align="right" sx={{ color: "#2563EB", fontWeight: 700 }}>{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Kg" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.OWSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.PSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.TSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.ST_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.In_Qty)}</TableCell>
                                        <TableCell align="right" sx={{ color: "#2563EB", fontWeight: 700 }}>{formatQty(item.Bal_Qty)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= INWARD SUMMARY 2 TABLE (T8 / Data 8) ================= */
    const renderInwardSummary2Table = () => {
        const item = reportData?.Data8?.[0];
        if (!item) {
            return (
                <Paper sx={{ mb: 2, p: 3, width: "100%" }}>
                    <Typography align="center" variant="body2" color="textSecondary">
                        No Inward Summary 2 Data Available
                    </Typography>
                </Paper>
            );
        }

        return (
            <Paper sx={{ mb: 2, width: "fit-content", minWidth: "100%" }}>
                <TableContainer sx={{ overflow: "visible" }}>
                    <Table size="small" sx={compactTableStyle}>
                        <TableHead>
                            {unitMode === "All" ? (
                                <>
                                    <TableRow>
                                        <TableCell rowSpan={2} sx={{ width: 50, verticalAlign: "middle" }}>S No</TableCell>
                                        <TableCell colSpan={2} align="center">Inward Godown IN</TableCell>
                                        <TableCell colSpan={2} align="center">Purchase IN</TableCell>
                                        <TableCell colSpan={2} align="center">BAL QTY</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT QTY</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">ALT Qty</TableCell>
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell sx={{ width: 50 }}>S No</TableCell>
                                    <TableCell align="right">Inward Godown IN ({unitMode})</TableCell>
                                    <TableCell align="right">Purchase IN ({unitMode})</TableCell>
                                    <TableCell align="right">BAL QTY ({unitMode})</TableCell>
                                </TableRow>
                            )}
                        </TableHead>
                        <TableBody>
                            <TableRow sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}>
                                <TableCell>1</TableCell>
                                {unitMode === "All" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.IWSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.INSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Pur_IN_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Pur_ACt_IN_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Chippam" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.INSG_ACt_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Pur_ACt_IN_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Act_Qty)}</TableCell>
                                    </>
                                )}
                                {unitMode === "Kg" && (
                                    <>
                                        <TableCell align="right">{formatQty(item.IWSG_In_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Pur_IN_Qty)}</TableCell>
                                        <TableCell align="right">{formatQty(item.Bal_Qty)}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= LOADING ================= */
    const renderLoading = () => {
        if (!loading) return null;
        return (
            <Box
                sx={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    backgroundColor: "rgba(255,255,255,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <CircularProgress />
            </Box>
        );
    };

    /* ================= EXPANDED EMPTY ================= */
    const renderExpandedEmpty = () => (
        <Paper sx={{ p: 4, mb: 2 }}>
            <Typography align="center" variant="h6" color="text.secondary">
                No Saved Snapshot Available
            </Typography>
            <Typography align="center" variant="body2" color="text.secondary">
                Click Save in Abstract mode to store the current report.
            </Typography>
        </Paper>
    );

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((p) => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={loadReport}
            />

            {renderLoading()}

            <AppLayout fullWidth>
                <Box
                    sx={{
                        p: 1.5,
                        backgroundColor: "#fff",
                        minHeight: "100%",
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    {/* ACTION & SELECTION BAR */}
                    <Box
                        sx={{
                            mb: 2,
                            p: 1.5,
                            border: "1px solid #E2E8F0",
                            borderRadius: 2,
                            backgroundColor: "#F8FAFC",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 2,
                        }}
                    >
                        {/* RADIO CONTROLS */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <RadioGroup
                                row
                                value={unitMode}
                                onChange={(e) => setUnitMode(e.target.value as "All" | "Chippam" | "Kg")}
                                sx={{
                                    "& .MuiFormControlLabel-label": {
                                        fontSize: "0.85rem",
                                        fontWeight: 600,
                                    }
                                }}
                            >
                                <FormControlLabel value="All" control={<Radio size="small" />} label="All" />
                                <FormControlLabel value="Chippam" control={<Radio size="small" />} label="Chippam" />
                                <FormControlLabel value="Kg" control={<Radio size="small" />} label="Kg" />
                            </RadioGroup>
                        </Box>

                        {/* SAVE SNAPSHOT BUTTON */}
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveSnapshot}
                            disabled={!liveData}
                            size="small"
                            sx={{
                                height: 32,
                                borderRadius: 1.5,
                                textTransform: "none",
                                fontWeight: 700,
                                backgroundColor: "#1E3A8A",
                                "&:hover": {
                                    backgroundColor: "#1e40af",
                                }
                            }}
                        >
                            Save
                        </Button>
                    </Box>

                    {/* EXPANDED EMPTY STATE */}
                    {toggleMode === "Expanded" && !savedData && renderExpandedEmpty()}

                    {/* REPORT TABLES LAYOUT */}
                    {reportData && (
                        <Box
                            sx={{
                                overflowX: "auto",
                                width: "100%",
                                pb: 2,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 3,
                                    width: "100%",
                                }}
                            >
                                {/* TOP ROW: Two main columns side-by-side */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 4,
                                        alignItems: "flex-start",
                                        width: "100%",
                                    }}
                                >
                                    {/* LEFT SIDE COLUMN: T1, T2, T3 */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 3,
                                            flex: 1,
                                            width: "fit-content",
                                            minWidth: "fit-content",
                                        }}
                                    >
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Sales Voucher Table
                                            </Typography>
                                            {renderSalesTable()}
                                        </Box>

                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Purchase Voucher Table
                                            </Typography>
                                            {renderPurchaseTable()}
                                        </Box>

                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Stock Journal Table
                                            </Typography>
                                            {renderJournalTable()}
                                        </Box>
                                    </Box>

                                    {/* RIGHT SIDE COLUMN: T9, T5, T7, T6, T8 stacked vertically */}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 3,
                                            flex: 1,
                                            width: "fit-content",
                                            minWidth: "fit-content",
                                        }}
                                    >
                                        {/* Stock Summary (T9) */}
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Stock Summary
                                            </Typography>
                                            {renderStockSummaryTable()}
                                        </Box>

                                        {/* Outward Summary 1 */}
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Outward Summary 1
                                            </Typography>
                                            {renderOutwardSummary1Table()}
                                        </Box>

                                        {/* Outward Summary 2 */}
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Outward Summary 2
                                            </Typography>
                                            {renderOutwardSummary2Table()}
                                        </Box>

                                        {/* Inward Summary 1 */}
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Inward Summary 1
                                            </Typography>
                                            {renderInwardSummary1Table()}
                                        </Box>

                                        {/* Inward Summary 2 */}
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                                Inward Summary 2
                                            </Typography>
                                            {renderInwardSummary2Table()}
                                        </Box>
                                    </Box>
                                </Box>

                                {/* BOTTOM SECTION: Godown Table (T4) */}
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: "100%" }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
                                        Godown Table
                                    </Typography>
                                    {renderGodownTable()}
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Box>
            </AppLayout>
        </>
    );
};

export default StockAbstractReport;
