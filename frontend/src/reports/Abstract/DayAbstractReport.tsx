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
    TextField
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
    DayAbstractReportService,
    DayAbstractReportResponse,
} from "../../services/dayAbstract.service";
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
                val === "DATA 5 & 6" ||
                val === "DATA 7" ||
                val === "DATA 8" ||
                val === "DATA 9 & 10"
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
            const isRowTotal = firstCellOfRow && String(firstCellOfRow.v || "").trim() === "TOTAL";

            if (isRowTotal) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "000000" } };
                cell.s.fill = { fgColor: { rgb: "F8FAFC" } };
                cell.s.border = borderStyle;
                if (typeof cell.v === "number") {
                    cell.s.alignment = { horizontal: "right", vertical: "center" };
                }
                continue;
            }

            // Check if it is a group/parent row (non-empty first/second cell, other columns empty)
            let isGroupRow = false;
            if (val && !isRowTotal) {
                let hasOtherValues = false;
                for (let col = range.s.c; col <= range.e.c; ++col) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: col });
                    const cellInCol = ws[addr];
                    if (cellInCol && cellInCol.v !== undefined && cellInCol.v !== null && String(cellInCol.v).trim() !== "") {
                        const cellColVal = String(cellInCol.v).trim();
                        if (cellColVal !== val && cellColVal !== "") {
                            hasOtherValues = true;
                            break;
                        }
                    }
                }
                if (!hasOtherValues) {
                    isGroupRow = true;
                }
            }

            if (isGroupRow) {
                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "1E3A8A" } };
                cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
                cell.s.border = borderStyle;
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

const DayAbstractReport: React.FC = () => {

    const today = dayjs().format("YYYY-MM-DD");

    const { toggleMode, setToggleMode } = useToggleMode();

    const [loading, setLoading] = useState(false);

    const [drawerOpen, setDrawerOpen] = useState(false);

    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    const [liveData, setLiveData] =
        useState<DayAbstractReportResponse | null>(null);

    const [savedData, setSavedData] =
        useState<DayAbstractReportResponse | null>(null);

    const [dayClosing, setDayClosing] = useState<string>("0");

    const reportData =
        toggleMode === "Abstract"
            ? liveData
            : savedData;

    /* ================= LOAD REPORT ================= */

    const loadReport = async () => {
        try {
            setLoading(true);

            const result =
                await DayAbstractReportService.getDayAbstractReport({
                    Predate: dayjs(fromDate)
                        .subtract(1, "day")
                        .format("YYYY-MM-DD"),

                    Fromdate: dayjs(fromDate)
                        .format("YYYY-MM-DD"),

                    Todate: dayjs(toDate)
                        .format("YYYY-MM-DD"),
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

        setSavedData(
            JSON.parse(JSON.stringify(liveData))
        );

        toast.success("Snapshot saved successfully");
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
            [[`DAY ABSTRACT REPORT (${fromDate} To ${toDate})`]],
            { origin: `A${row}` }
        );

        row += 2;

        /* ================= DATA 1 ================= */
        XLSX.utils.sheet_add_aoa(ws, [["DATA 1"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [["S.No", "Transaction Type", "Amount"]], { origin: `A${row}` });
        row += 1;
        const data1Rows = (reportData.Data1 || []).map((r, i) => [
            i + 1,
            r.Trans_Type,
            r.Trans_Amount
        ]);
        const data1Closing = (reportData.Data1 || []).reduce((sum, r) => {
            const type = String(r.Trans_Type || "").toLowerCase().trim();
            const amt = Number(r.Trans_Amount || 0);
            if (type.includes("cold storage")) {
                return sum + amt;
            }
            if (
                type.includes("payment") ||
                type.includes("purchase") ||
                type.includes("shortage") ||
                type.includes("debit") ||
                type.includes("expense") ||
                type.includes("outflow") ||
                type.includes("dr")
            ) {
                return sum - amt;
            }
            return sum + amt;
        }, 0);
        data1Rows.push(["CLOSING", "", data1Closing]);
        XLSX.utils.sheet_add_json(ws, data1Rows, { origin: `A${row}`, skipHeader: true });
        row += data1Rows.length + 2;

        /* ================= DATA 2 ================= */
        XLSX.utils.sheet_add_aoa(ws, [["DATA 2"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [["S.No", "Transaction Type", "Count", "Amount"]], { origin: `A${row}` });
        row += 1;
        const data2Rows = (reportData.Data2 || []).map((r, i) => [
            i + 1,
            r.Trans_Type,
            r.Trans_Count,
            r.Trans_Amount
        ]);
        const data2TotalCount = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Trans_Count || 0), 0);
        const data2TotalAmount = (reportData.Data2 || []).reduce((sum, r) => sum + Number(r.Trans_Amount || 0), 0);
        data2Rows.push(["TOTAL", "", data2TotalCount, data2TotalAmount]);
        XLSX.utils.sheet_add_json(ws, data2Rows, { origin: `A${row}`, skipHeader: true });
        row += data2Rows.length + 2;

        /* ================= DATA 4 ================= */
        XLSX.utils.sheet_add_aoa(ws, [["DATA 4"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [["S.No", "Transaction Type", "Count", "Amount"]], { origin: `A${row}` });
        row += 1;
        const data4Rows = (reportData.Data4 || []).map((r, i) => [
            i + 1,
            r.Trans_Type,
            r.Trans_Count,
            r.Trans_Amount
        ]);
        const data4TotalCount = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.Trans_Count || 0), 0);
        const data4TotalAmount = (reportData.Data4 || []).reduce((sum, r) => sum + Number(r.Trans_Amount || 0), 0);
        data4Rows.push(["TOTAL", "", data4TotalCount, data4TotalAmount]);
        XLSX.utils.sheet_add_json(ws, data4Rows, { origin: `A${row}`, skipHeader: true });
        row += data4Rows.length + 2;

        /* ================= DATA 7 ================= */
        XLSX.utils.sheet_add_aoa(ws, [["DATA 7"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [[
            "S.No",
            "Trans Type",
            "Receipt Credit",
            "Receipt Debit",
            "Payment Credit",
            "Payment Debit"
        ]], { origin: `A${row}` });
        row += 1;
        const data7Rows = (reportData.Data7 || []).map((r, i) => [
            i + 1,
            r.Trans_Type,
            r.Credit_Amount,
            r.Debit_Amount,
            r.Credit_Amount_1,
            r.Debit_Amount_1
        ]);
        const data7SumCredit = (reportData.Data7 || []).reduce((sum, r) => sum + Number(r.Credit_Amount || 0), 0);
        const data7SumDebit = (reportData.Data7 || []).reduce((sum, r) => sum + Number(r.Debit_Amount || 0), 0);
        const data7SumCredit1 = (reportData.Data7 || []).reduce((sum, r) => sum + Number(r.Credit_Amount_1 || 0), 0);
        const data7SumDebit1 = (reportData.Data7 || []).reduce((sum, r) => sum + Number(r.Debit_Amount_1 || 0), 0);
        data7Rows.push(["TOTAL", "", data7SumCredit, data7SumDebit, data7SumCredit1, data7SumDebit1]);
        XLSX.utils.sheet_add_json(ws, data7Rows, { origin: `A${row}`, skipHeader: true });
        row += data7Rows.length + 2;

        /* ================= DATA 8 ================= */
        XLSX.utils.sheet_add_aoa(ws, [["DATA 8"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [[
            "S.No",
            "Trans Type",
            "Debtors Credit",
            "Debtors Debit",
            "Creditors Credit",
            "Creditors Debit"
        ]], { origin: `A${row}` });
        row += 1;
        const data8Rows = (reportData.Data8 || []).map((r, i) => [
            i + 1,
            r.Trans_Type,
            r.Credit_Amount,
            r.Debit_Amount,
            r.Credit_Amount_1,
            r.Debit_Amount_1
        ]);
        const data8SumCredit = (reportData.Data8 || []).reduce((sum, r) => sum + Number(r.Credit_Amount || 0), 0);
        const data8SumDebit = (reportData.Data8 || []).reduce((sum, r) => sum + Number(r.Debit_Amount || 0), 0);
        const data8SumCredit1 = (reportData.Data8 || []).reduce((sum, r) => sum + Number(r.Credit_Amount_1 || 0), 0);
        const data8SumDebit1 = (reportData.Data8 || []).reduce((sum, r) => sum + Number(r.Debit_Amount_1 || 0), 0);
        data8Rows.push(["TOTAL", "", data8SumCredit, data8SumDebit, data8SumCredit1, data8SumDebit1]);
        XLSX.utils.sheet_add_json(ws, data8Rows, { origin: `A${row}`, skipHeader: true });
        row += data8Rows.length + 2;

        /* ================= DATA 3 ================= */
        XLSX.utils.sheet_add_aoa(ws, [["DATA 3"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [["S No", "Expenses", "Credit", "Debit"]], { origin: `A${row}` });
        row += 1;

        const data3Rows: any[] = [];
        const groups = getLedgerGroups();
        let sno = 1;

        Object.entries(groups).forEach(([master, grpObj]: any) => {
            data3Rows.push([master, "", "", ""]);
            Object.entries(grpObj).forEach(([group, ledgers]: any) => {
                const totalCredit = ledgers.reduce((s: number, x: any) => s + Number(x.Credit_Amount || 0), 0);
                const totalDebit = ledgers.reduce((s: number, x: any) => s + Number(x.Debit_Amount || 0), 0);
                data3Rows.push(["", group, totalCredit, totalDebit]);
                ledgers.forEach((rowItem: any) => {
                    data3Rows.push([sno++, rowItem.ledger_name, rowItem.Credit_Amount, rowItem.Debit_Amount]);
                });
            });
        });

        const data3SumCredit = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.Credit_Amount || 0), 0);
        const data3SumDebit = (reportData.Data3 || []).reduce((sum, r) => sum + Number(r.Debit_Amount || 0), 0);
        data3Rows.push(["TOTAL", "", data3SumCredit, data3SumDebit]);
        XLSX.utils.sheet_add_json(ws, data3Rows, { origin: `A${row}`, skipHeader: true });
        row += data3Rows.length + 2;

        /* ================= DATA 5 & 6 ================= */
        const debtors = reportData.Data6?.[0];
        const creditors = reportData.Data5?.[0];

        XLSX.utils.sheet_add_aoa(ws, [["DATA 9 & 10"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [[
            "Sundry Creditors Type",
            "Sundry Creditors Amount",
            "Sundry Debtors Type",
            "Sundry Debtors Amount"
        ]], { origin: `A${row}` });
        row += 1;
        const data56Rows = [
            ["Receivable", reportData.Data10?.[0]?.Recivables || 0, "Receivable", reportData.Data9?.[0]?.Recivables || 0],
            ["Payable", reportData.Data10?.[0]?.Payables || 0, "Payable", reportData.Data9?.[0]?.Payables || 0],
            ["", reportData.Data10?.[0]?.Balance || 0, "", reportData.Data9?.[0]?.Balance || 0]
        ];
        XLSX.utils.sheet_add_json(ws, data56Rows, { origin: `A${row}`, skipHeader: true });
        row += data56Rows.length + 2;

        XLSX.utils.sheet_add_aoa(ws, [["DATA 5 & 6"]], { origin: `A${row}` });
        row += 1;
        XLSX.utils.sheet_add_aoa(ws, [[
            "Sundry Creditors Type",
            "Sundry Creditors Amount",
            "Sundry Debtors Type",
            "Sundry Debtors Amount"
        ]], { origin: `A${row}` });
        row += 1;
        const data6Rows = [
            ["Opening", creditors?.OB_Amount || 0, "Opening", debtors?.OB_Amount || 0],
            ["Credit", creditors?.Credit_Amt || 0, "Credit", debtors?.Credit_Amt || 0],
            ["Debit", creditors?.Debit_Amt || 0, "Debit", debtors?.Debit_Amt || 0],
            ["Closing", creditors?.Bal_Amount || 0, "Closing", debtors?.Bal_Amount || 0]
        ];
        XLSX.utils.sheet_add_json(ws, data6Rows, { origin: `A${row}`, skipHeader: true });

        ws["!cols"] = Array(10).fill({ wch: 20 });
        styleWorksheet(ws);
        XLSX.utils.book_append_sheet(wb, ws, "Day Abstract");
        XLSX.writeFile(
            wb,
            `Day_Abstract_Report_${dayjs().format(
                "DDMMYYYY_HHmmss"
            )}.xlsx`
        );
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

        doc.text(
            `DAY ABSTRACT REPORT (${fromDate} TO ${toDate})`,
            148,
            12,
            { align: "center" }
        );

        let currentY = 20;

        const addTitle = (title: string) => {
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(title, 14, currentY);
            currentY += 4;
        };

        /* ================= DATA 1 ================= */

        addTitle("DATA 1");

        const data1ClosingPDF = (reportData.Data1 || []).reduce((sum, r) => {
            const type = String(r.Trans_Type || "").toLowerCase().trim();
            const amt = Number(r.Trans_Amount || 0);
            if (type.includes("cold storage")) {
                return sum + amt;
            }
            if (
                type.includes("payment") ||
                type.includes("purchase") ||
                type.includes("shortage") ||
                type.includes("debit") ||
                type.includes("expense") ||
                type.includes("outflow") ||
                type.includes("dr")
            ) {
                return sum - amt;
            }
            return sum + amt;
        }, 0);

        const data1BodyPDF = (reportData.Data1 || []).map((r) => [
            r.Trans_Type,
            formatAmount(r.Trans_Amount),
        ]);
        data1BodyPDF.push(["CLOSING", formatAmount(data1ClosingPDF)]);

        autoTable(doc, {
            startY: currentY,
            head: [["Type", "Amount"]],
            body: data1BodyPDF,
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 2 ================= */

        addTitle("DATA 2");

        autoTable(doc, {
            startY: currentY,
            head: [["Type", "Count", "Amount"]],
            body: (reportData.Data2 || []).map((r) => [
                r.Trans_Type,
                r.Trans_Count,
                formatAmount(r.Trans_Amount),
            ]),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 4 ================= */

        addTitle("DATA 4");

        autoTable(doc, {
            startY: currentY,
            head: [["Type", "Count", "Amount"]],
            body: (reportData.Data4 || []).map((r) => [
                r.Trans_Type,
                r.Trans_Count,
                formatAmount(r.Trans_Amount),
            ]),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 7 ================= */

        addTitle("DATA 7");

        autoTable(doc, {
            startY: currentY,
            head: [
                [
                    "S.No",
                    "Trans Type",
                    "Receipt Credit",
                    "Receipt Debit",
                    "Payment Credit",
                    "Payment Debit",
                ],
            ],
            body: (reportData.Data7 || []).map((r, i) => [
                i + 1,
                r.Trans_Type,
                formatAmount(r.Credit_Amount),
                formatAmount(r.Debit_Amount),
                formatAmount(r.Credit_Amount_1),
                formatAmount(r.Debit_Amount_1),
            ]),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 8 ================= */

        addTitle("DATA 8");

        autoTable(doc, {
            startY: currentY,
            head: [
                [
                    "S.No",
                    "Trans Type",
                    "Debtors Credit",
                    "Debtors Debit",
                    "Creditors Credit",
                    "Creditors Debit",
                ],
            ],
            body: (reportData.Data8 || []).map((r, i) => [
                i + 1,
                r.Trans_Type,
                formatAmount(r.Credit_Amount),
                formatAmount(r.Debit_Amount),
                formatAmount(r.Credit_Amount_1),
                formatAmount(r.Debit_Amount_1),
            ]),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 3 ================= */

        addTitle("DATA 3");

        autoTable(doc, {
            startY: currentY,
            head: [["Master Name", "Credit", "Debit"]],
            body: (reportData.Data3 || []).map((r) => [
                r.Master_Name,
                formatAmount(r.Credit_Amount),
                formatAmount(r.Debit_Amount),
            ]),
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 9 & 10 ================= */

        addTitle("DATA 9 & 10");

        autoTable(doc, {
            startY: currentY,
            head: [[
                "Sundry Creditors Type",
                "Sundry Creditors Amount",
                "Sundry Debtors Type",
                "Sundry Debtors Amount"
            ]],
            body: [
                ["Receivable", formatAmount(reportData.Data10?.[0]?.Recivables), "Receivable", formatAmount(reportData.Data9?.[0]?.Recivables)],
                ["Payable", formatAmount(reportData.Data10?.[0]?.Payables), "Payable", formatAmount(reportData.Data9?.[0]?.Payables)],
                ["", formatAmount(reportData.Data10?.[0]?.Balance), "", formatAmount(reportData.Data9?.[0]?.Balance)],
            ],
            styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;

        /* ================= DATA 5 & 6 ================= */

        addTitle("DATA 5 & 6");

        autoTable(doc, {
            startY: currentY,
            head: [[
                "Sundry Creditors Type",
                "Sundry Creditors Amount",
                "Sundry Debtors Type",
                "Sundry Debtors Amount"
            ]],
            body: [
                ["Opening", formatAmount(reportData.Data5?.[0]?.OB_Amount), "Opening", formatAmount(reportData.Data6?.[0]?.OB_Amount)],
                ["Credit", formatAmount(reportData.Data5?.[0]?.Credit_Amt), "Credit", formatAmount(reportData.Data6?.[0]?.Credit_Amt)],
                ["Debit", formatAmount(reportData.Data5?.[0]?.Debit_Amt), "Debit", formatAmount(reportData.Data6?.[0]?.Debit_Amt)],
                ["Closing", formatAmount(reportData.Data5?.[0]?.Bal_Amount), "Closing", formatAmount(reportData.Data6?.[0]?.Bal_Amount)],
            ],
            styles: { fontSize: 8 },
        });

        doc.save(
            `Day_Abstract_Report_${dayjs().format(
                "DDMMYYYY_HHmmss"
            )}.pdf`
        );
    };

    const formatAmount = (
        value: number | undefined
    ) => {
        return Number(value || 0).toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }
        );
    };

    /* ================= SECTION HEADER ================= */

    // const SectionTitle = ({
    //     title,
    // }: {
    //     title: string;
    // }) => (
    //     <Typography
    //         sx={{
    //             py: 0.4,
    //             px: 1,
    //             fontWeight: 700,
    //             fontSize: "0.75rem",
    //             backgroundColor: "#1E3A8A",
    //             color: "#fff",
    //             lineHeight: 1.2,
    //         }}
    //     >
    //         {title}
    //     </Typography>
    // );

    const compactTableStyle = {
        width: "fit-content",
        minWidth: "unset",

        "& .MuiTableCell-root": {
            border: "1px solid #CFCFCF",
            py: 0.35,
            px: 0.8,
            fontSize: "0.78rem",
            whiteSpace: "nowrap",
        },

        "& .MuiTableHead-root .MuiTableCell-root": {
            fontWeight: 700,
            backgroundColor: "#1E3A8A",
            color: "#fff",
        },
    };

    /* ================= DATA1 TABLE ================= */

    const renderData1Table = () => {

        if (!reportData?.Data1?.length) {
            return (
                <Paper
                    sx={{
                        mb: 2,
                        display: "inline-block",
                    }}
                >


                    <Box p={3}>
                        <Typography align="center">
                            No Data Available
                        </Typography>
                    </Box>
                </Paper>
            );
        }

        const closingAmount =
            reportData.Data1.reduce((sum, row) => {
                const type = String(row.Trans_Type || "").toLowerCase().trim();
                const amt = Number(row.Trans_Amount || 0);
                if (type.includes("cold storage")) {
                    return sum + amt;
                }
                if (
                    type.includes("payment") ||
                    type.includes("purchase") ||
                    type.includes("shortage") ||
                    type.includes("debit") ||
                    type.includes("expense") ||
                    type.includes("outflow") ||
                    type.includes("dr")
                ) {
                    return sum - amt;
                }
                return sum + amt;
            }, 0);

        return (
            <Paper
                sx={{
                    mb: 2,
                    display: "inline-block",
                }}
            >

                <TableContainer>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 350,
                        }}
                    >
                        <TableHead>
                            <TableRow
                                sx={{
                                    backgroundColor: "#E2E8F0",
                                }}
                            >
                                <TableCell
                                    rowSpan={2}
                                    sx={{ fontWeight: 700 }}
                                >
                                    S.No
                                </TableCell>
                                <TableCell
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    Transaction Type
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    Amount
                                </TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {reportData.Data1.map(
                                (row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            {index + 1}
                                        </TableCell>

                                        <TableCell>
                                            {row.Trans_Type}
                                        </TableCell>

                                        <TableCell align="right">
                                            {formatAmount(
                                                row.Trans_Amount
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            )}

                            <TableRow
                                sx={{
                                    backgroundColor: "#F8FAFC",
                                }}
                            >
                                <TableCell
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    CLOSING
                                </TableCell>

                                <TableCell />

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                        color: closingAmount >= 0 ? "#15803D" : "#B91C1C"
                                    }}
                                >
                                    {formatAmount(
                                        closingAmount
                                    )}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= DATA2 TABLE ================= */

    const renderData2Table = () => {

        if (!reportData?.Data2?.length) {
            return (
                <Paper sx={{ mb: 2 }}>

                    <Box p={3}>
                        <Typography align="center">
                            No Data Available
                        </Typography>
                    </Box>
                </Paper>
            );
        }

        const totalCount =
            reportData.Data2.reduce(
                (sum, row) =>
                    sum + Number(row.Trans_Count || 0),
                0
            );

        const totalAmount =
            reportData.Data2.reduce(
                (sum, row) =>
                    sum + Number(row.Trans_Amount || 0),
                0
            );

        return (
            <Paper sx={{ mb: 2 }}>

                <TableContainer>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 500,
                        }}
                    >
                        <TableHead>
                            <TableRow
                                sx={{
                                    backgroundColor: "#E2E8F0",
                                }}
                            >
                                <TableCell
                                    rowSpan={2}
                                    sx={{ fontWeight: 700 }}
                                >
                                    S.No
                                </TableCell>
                                <TableCell
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    Transaction Type
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    Count
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    Amount
                                </TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {reportData.Data2.map(
                                (row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            {index + 1}
                                        </TableCell>

                                        <TableCell>
                                            {row.Trans_Type}
                                        </TableCell>

                                        <TableCell align="right">
                                            {row.Trans_Count}
                                        </TableCell>

                                        <TableCell align="right">
                                            {formatAmount(
                                                row.Trans_Amount
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            )}

                            <TableRow
                                sx={{
                                    backgroundColor: "#F8FAFC",
                                }}
                            >
                                <TableCell
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    TOTAL
                                </TableCell>

                                <TableCell />

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    {totalCount}
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    {formatAmount(
                                        totalAmount
                                    )}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= DATA3 TABLE ================= */

    const getLedgerGroups = () => {

        if (!reportData?.Data3?.length) return [];

        const grouped = reportData.Data3.reduce(
            (acc: any, row: any) => {

                const master =
                    row.Master_Name || "Others";

                const group =
                    row.group_name || "Others";

                if (!acc[master]) {
                    acc[master] = {};
                }

                if (!acc[master][group]) {
                    acc[master][group] = [];
                }

                acc[master][group].push(row);

                return acc;
            },
            {}
        );

        return grouped;
    };

    const renderData3Table = () => {

        const groups = getLedgerGroups();

        let sno = 1;

        return (
            <Paper sx={{ mb: 2 }}>

                <TableContainer>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 900,
                        }}
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell>S No</TableCell>
                                <TableCell>Expenses</TableCell>
                                <TableCell align="right">
                                    Credit
                                </TableCell>
                                <TableCell align="right">
                                    Debit
                                </TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {Object.entries(groups).map(
                                ([master, grpObj]: any) => (
                                    <React.Fragment key={master}>

                                        <TableRow
                                            sx={{
                                                backgroundColor:
                                                    "#dbeafe",
                                            }}
                                        >
                                            <TableCell
                                                colSpan={4}
                                                sx={{
                                                    fontWeight: 700,
                                                    color: "blue",
                                                }}
                                            >
                                                {master}
                                            </TableCell>
                                        </TableRow>

                                        {Object.entries(grpObj).map(
                                            ([group, ledgers]: any) => {

                                                const totalCredit =
                                                    ledgers.reduce(
                                                        (
                                                            s: number,
                                                            x: any
                                                        ) =>
                                                            s +
                                                            Number(
                                                                x.Credit_Amount ||
                                                                0
                                                            ),
                                                        0
                                                    );

                                                const totalDebit =
                                                    ledgers.reduce(
                                                        (
                                                            s: number,
                                                            x: any
                                                        ) =>
                                                            s +
                                                            Number(
                                                                x.Debit_Amount ||
                                                                0
                                                            ),
                                                        0
                                                    );

                                                return (
                                                    <React.Fragment
                                                        key={group}
                                                    >
                                                        <TableRow
                                                            sx={{
                                                                backgroundColor:
                                                                    "#f3f4f6",
                                                            }}
                                                        >
                                                            <TableCell />
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight:
                                                                        700,
                                                                    color:
                                                                        "blue",
                                                                }}
                                                            >
                                                                {group}
                                                            </TableCell>

                                                            <TableCell align="right">
                                                                {formatAmount(
                                                                    totalCredit
                                                                )}
                                                            </TableCell>

                                                            <TableCell align="right">
                                                                {formatAmount(
                                                                    totalDebit
                                                                )}
                                                            </TableCell>
                                                        </TableRow>

                                                        {ledgers.map(
                                                            (
                                                                row: any
                                                            ) => (
                                                                <TableRow
                                                                    key={
                                                                        sno
                                                                    }
                                                                >
                                                                    <TableCell>
                                                                        {
                                                                            sno++
                                                                        }
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        {
                                                                            row.ledger_name
                                                                        }
                                                                    </TableCell>

                                                                    <TableCell align="right">
                                                                        {formatAmount(
                                                                            row.Credit_Amount
                                                                        )}
                                                                    </TableCell>

                                                                    <TableCell align="right">
                                                                        {formatAmount(
                                                                            row.Debit_Amount
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        )}
                                                    </React.Fragment>
                                                );
                                            }
                                        )}
                                    </React.Fragment>
                                )
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    /* ================= DATA4 TABLE ================= */

    const renderData4Table = () => {

        if (!reportData?.Data4?.length) {
            return (
                <Paper sx={{ mb: 2 }}>

                    <Box p={3}>
                        <Typography align="center">
                            No Data Available
                        </Typography>
                    </Box>
                </Paper>
            );
        }

        const totalCount =
            reportData.Data4.reduce(
                (sum, row) =>
                    sum + Number(row.Trans_Count || 0),
                0
            );

        const totalAmount =
            reportData.Data4.reduce(
                (sum, row) =>
                    sum + Number(row.Trans_Amount || 0),
                0
            );

        return (
            <Paper sx={{ mb: 2 }}>

                <TableContainer>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 350,
                        }}
                    >
                        <TableHead>
                            <TableRow
                                sx={{
                                    backgroundColor: "#E2E8F0",
                                }}
                            >
                                <TableCell
                                    rowSpan={2}
                                    sx={{ fontWeight: 700 }}
                                >
                                    S.No
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    Transaction Type
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Count
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Amount
                                </TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {reportData.Data4.map((row, index) => (
                                <TableRow key={index}>

                                    <TableCell>
                                        {index + 1}
                                    </TableCell>

                                    <TableCell>
                                        {row.Trans_Type}
                                    </TableCell>

                                    <TableCell align="right">
                                        {row.Trans_Count}
                                    </TableCell>

                                    <TableCell align="right">
                                        {formatAmount(
                                            row.Trans_Amount
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}

                            <TableRow
                                sx={{
                                    backgroundColor: "#F8FAFC",
                                }}
                            >
                                <TableCell
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    TOTAL
                                </TableCell>

                                <TableCell />

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    {totalCount}
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    {formatAmount(totalAmount)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        );
    };

    const renderData7And8 = () => {

        const renderTable = (
            title: string,
            rows: any[]
        ) => {

            const leftHeader =
                title === "Data 7"
                    ? "Receipt"
                    : "Sundry Debtors";

            const rightHeader =
                title === "Data 7"
                    ? "Payment"
                    : "Sundry Creditors";

            return (
                <Paper sx={{ mb: 2, width: "100%", }}>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 700,
                        }}
                    >

                        <TableHead>

                            {/* Main Header */}

                            <TableRow>

                                <TableCell
                                    rowSpan={2}
                                    sx={{ fontWeight: 700 }}
                                >
                                    S.No
                                </TableCell>

                                <TableCell
                                    rowSpan={2}
                                    sx={{ fontWeight: 700 }}
                                >
                                    Trans Type
                                </TableCell>

                                <TableCell
                                    colSpan={2}
                                    align="center"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {leftHeader}
                                </TableCell>

                                <TableCell
                                    colSpan={2}
                                    align="center"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {rightHeader}
                                </TableCell>

                            </TableRow>

                            {/* Sub Header */}

                            <TableRow>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Credit
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Debit
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Credit
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Debit
                                </TableCell>

                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {rows.map((row, index) => (
                                <TableRow key={index}>

                                    <TableCell>
                                        {index + 1}
                                    </TableCell>

                                    <TableCell>
                                        {row.Trans_Type}
                                    </TableCell>

                                    {/* Sundry Debtors */}

                                    <TableCell align="right">
                                        {formatAmount(
                                            row.Credit_Amount
                                        )}
                                    </TableCell>

                                    <TableCell align="right">
                                        {formatAmount(
                                            row.Debit_Amount
                                        )}
                                    </TableCell>

                                    {/* Sundry Creditors */}

                                    <TableCell align="right">
                                        {formatAmount(
                                            row.Credit_Amount_1
                                        )}
                                    </TableCell>

                                    <TableCell align="right">
                                        {formatAmount(
                                            row.Debit_Amount_1
                                        )}
                                    </TableCell>

                                </TableRow>
                            ))}

                            <TableRow
                                sx={{
                                    backgroundColor: "#F8FAFC",
                                }}
                            >
                                <TableCell
                                    colSpan={2}
                                    sx={{ fontWeight: 700 }}
                                >
                                    TOTAL
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {formatAmount(
                                        rows.reduce(
                                            (s, r) =>
                                                s +
                                                Number(
                                                    r.Credit_Amount || 0
                                                ),
                                            0
                                        )
                                    )}
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {formatAmount(
                                        rows.reduce(
                                            (s, r) =>
                                                s +
                                                Number(
                                                    r.Debit_Amount || 0
                                                ),
                                            0
                                        )
                                    )}
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {formatAmount(
                                        rows.reduce(
                                            (s, r) =>
                                                s +
                                                Number(
                                                    r.Credit_Amount_1 || 0
                                                ),
                                            0
                                        )
                                    )}
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    {formatAmount(
                                        rows.reduce(
                                            (s, r) =>
                                                s +
                                                Number(
                                                    r.Debit_Amount_1 || 0
                                                ),
                                            0
                                        )
                                    )}
                                </TableCell>

                            </TableRow>

                        </TableBody>

                    </Table>
                </Paper>
            );
        };

        return (
            <Box>
                {renderTable(
                    "Data 7",
                    reportData?.Data7 || []
                )}

                {renderTable(
                    "Data 8",
                    reportData?.Data8 || []
                )}
            </Box>
        );
    };

    const renderData5And6 = () => {

        const debtors = reportData?.Data6?.[0];
        const creditors = reportData?.Data5?.[0];
        const debtorBalances = reportData?.Data9?.[0];
        const creditorBalances = reportData?.Data10?.[0];

        if (!debtors && !creditors && !debtorBalances && !creditorBalances) return null;

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    minWidth: 500,
                    width: "100%",
                }}
            >

                {/* Top Table */}

                <Paper>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 500,
                        }}
                    >
                        <TableHead>

                            <TableRow
                                sx={{
                                    backgroundColor: "#E8E8E8",
                                }}
                            >
                                <TableCell
                                    colSpan={2}
                                    align="center"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Sundry Creditors
                                </TableCell>

                                <TableCell
                                    colSpan={2}
                                    align="center"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Sundry Debtors
                                </TableCell>
                            </TableRow>

                            <TableRow
                                sx={{
                                    backgroundColor: "#F5F5F5",
                                }}
                            >
                                <TableCell sx={{ fontWeight: 700 }}>
                                    Type
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Amount
                                </TableCell>

                                <TableCell sx={{ fontWeight: 700 }}>
                                    Type
                                </TableCell>

                                <TableCell
                                    align="right"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Amount
                                </TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            <TableRow>
                                <TableCell>
                                    Receivable
                                </TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        creditorBalances?.Recivables
                                    )}
                                </TableCell>

                                <TableCell>
                                    Receivable
                                </TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        debtorBalances?.Recivables
                                    )}
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell>
                                    Payable
                                </TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        creditorBalances?.Payables
                                    )}
                                </TableCell>

                                <TableCell>
                                    Payable
                                </TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        debtorBalances?.Payables
                                    )}
                                </TableCell>
                            </TableRow>

                            <TableRow sx={{
                                backgroundColor: "#F8FAFC",
                            }}>
                                <TableCell />

                                <TableCell align="right">
                                    {formatAmount(
                                        creditorBalances?.Balance
                                    )}
                                </TableCell>

                                <TableCell />

                                <TableCell align="right">
                                    {formatAmount(
                                        debtorBalances?.Balance
                                    )}
                                </TableCell>
                            </TableRow>

                        </TableBody>
                    </Table>
                </Paper>

                {/* Bottom Table */}

                <Paper>
                    <Table
                        size="small"
                        sx={{
                            ...compactTableStyle,
                            minWidth: 500,
                        }}
                    >
                        <TableHead>

                            <TableRow
                                sx={{
                                    backgroundColor: "#E8E8E8",
                                }}
                            >
                                <TableCell
                                    colSpan={2}
                                    align="center"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Sundry Creditors
                                </TableCell>

                                <TableCell
                                    colSpan={2}
                                    align="center"
                                    sx={{ fontWeight: 700 }}
                                >
                                    Sundry Debtors
                                </TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            <TableRow>
                                <TableCell>Opening</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        creditors?.OB_Amount
                                    )}
                                </TableCell>

                                <TableCell>Opening</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        debtors?.OB_Amount
                                    )}
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell>Credit</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        creditors?.Credit_Amt
                                    )}
                                </TableCell>

                                <TableCell>Credit</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        debtors?.Credit_Amt
                                    )}
                                </TableCell>
                            </TableRow>

                            <TableRow>
                                <TableCell>Debit</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        creditors?.Debit_Amt
                                    )}
                                </TableCell>

                                <TableCell>Debit</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        debtors?.Debit_Amt
                                    )}
                                </TableCell>
                            </TableRow>

                            <TableRow sx={{
                                backgroundColor: "#F8FAFC",
                            }}>
                                <TableCell>Closing</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        creditors?.Bal_Amount
                                    )}
                                </TableCell>

                                <TableCell>Closing</TableCell>

                                <TableCell align="right">
                                    {formatAmount(
                                        debtors?.Bal_Amount
                                    )}
                                </TableCell>
                            </TableRow>

                        </TableBody>
                    </Table>
                </Paper>

            </Box>
        );
    };

    const systemClosing =
        reportData?.Data1?.reduce(
            (sum, row) => sum + Number(row.Trans_Amount || 0),
            0
        ) || 0;

    const difference =
        systemClosing - Number(dayClosing || 0);

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
            <Typography
                align="center"
                variant="h6"
                color="text.secondary"
            >
                No Saved Snapshot Available
            </Typography>

            <Typography
                align="center"
                variant="body2"
                color="text.secondary"
            >
                Click Save Snapshot in Abstract mode
                to store the current report.
            </Typography>
        </Paper>
    );

    /* ================= RENDER ================= */

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
                        p: 1,
                        backgroundColor: "#fff",
                        minHeight: "100%",
                        width: "max-content",
                        minWidth: "100%",
                        boxSizing: "border-box",
                    }}
                >

                    {/* ACTION BUTTONS */}
                    <Box
                        sx={{
                            mb: 2,
                            p: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            flexWrap: "wrap",
                        }}
                    >
                        {/* SYSTEM CLOSING */}

                        <Box>
                            <Typography
                                sx={{
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    mb: 0.5,
                                }}
                            >
                                System Closing
                            </Typography>

                            <TextField
                                size="small"
                                value={formatAmount(systemClosing)}
                                InputProps={{
                                    readOnly: true,
                                }}
                                sx={{
                                    width: 180,
                                    "& input": {
                                        textAlign: "right",
                                        fontWeight: 700,
                                        color: "#0B7A0B",
                                    },
                                }}
                            />
                        </Box>

                        {/* DAY CLOSING */}

                        <Box>
                            <Typography
                                sx={{
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    mb: 0.5,
                                }}
                            >
                                Day Closing
                            </Typography>

                            <TextField
                                size="small"
                                value={dayClosing}
                                onChange={(e) =>
                                    setDayClosing(e.target.value)
                                }
                                sx={{
                                    width: 180,
                                    "& input": {
                                        textAlign: "right",
                                        fontWeight: 700,
                                    },
                                }}
                            />
                        </Box>

                        {/* DIFFERENCE */}

                        <Box>
                            <Typography
                                sx={{
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    mb: 0.5,
                                }}
                            >
                                Difference
                            </Typography>

                            <TextField
                                size="small"
                                value={formatAmount(difference)}
                                InputProps={{
                                    readOnly: true,
                                }}
                                sx={{
                                    width: 180,
                                    "& input": {
                                        textAlign: "right",
                                        fontWeight: 700,
                                        color:
                                            difference === 0
                                                ? "#0B7A0B"
                                                : "#D32F2F",
                                    },
                                }}
                            />
                        </Box>

                        {/* SAVE BUTTON */}

                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveSnapshot}
                            disabled={!liveData}
                            sx={{
                                height: 40,
                                mt: 2.5,
                                borderRadius: 5
                            }}
                        >
                            Save
                        </Button>
                    </Box>

                    {/* EXPANDED EMPTY STATE */}

                    {toggleMode === "Expanded" &&
                        !savedData &&
                        renderExpandedEmpty()}

                    {/* REPORT TABLES */}

                    {reportData && (
                        <Box
                            sx={{
                                display: "flex",
                                gap: 2,
                                alignItems: "flex-start",
                                overflowX: "auto",
                            }}
                        >
                            {/* LEFT SIDE */}

                            <Box
                                sx={{
                                    flex: "0 0 auto",
                                    minWidth: 850,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                }}
                            >
                                {/* Top Row */}

                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 1,
                                        alignItems: "flex-start",
                                    }}
                                >
                                    {renderData1Table()}
                                    {renderData2Table()}
                                    {renderData4Table()}
                                </Box>

                                {/* Bottom Row */}

                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 2,
                                        alignItems: "flex-start",
                                    }}
                                >
                                    {renderData7And8()}
                                    {renderData5And6()}
                                </Box>
                            </Box>

                            {/* RIGHT SIDE */}

                            <Box
                                sx={{
                                    flex: "0 0 auto",
                                    minWidth: 900,
                                }}
                            >
                                {renderData3Table()}
                            </Box>
                        </Box>
                    )}
                </Box>
            </AppLayout>
        </>
    );
};

export default DayAbstractReport;