import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TextField,
    CircularProgress,
    Autocomplete,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    FormLabel,
    Typography,
} from "@mui/material";

import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { toast } from "react-toastify";

import AppLayout from "../../Layout/appLayout";
import PageHeader, { ToggleMode } from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { RecievablePayableReportService, RecievablePayableItem } from "../../services/recievablePayableReport.service";

/* ================= HELPERS ================= */

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(value || 0);

/* ================= COMPONENT ================= */

const RecievablePayableReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const [rows, setRows] = useState<RecievablePayableItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [toggleMode, setToggleMode] = useState<ToggleMode>("Abstract"); // Abstract = Receivable, Expanded = Payable

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [toDate, setToDate] = useState(today);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [tempGroups, setTempGroups] = useState<string[]>([]);
    const [groupMode, setGroupMode] = useState<"withGroup" | "withoutGroup">("withGroup");
    const [tempGroupMode, setTempGroupMode] = useState<"withGroup" | "withoutGroup">("withGroup");
    
    const [selectedAccountNames, setSelectedAccountNames] = useState<string[] | undefined>(undefined);
    const [accountFilterAnchor, setAccountFilterAnchor] = useState<null | HTMLElement>(null);

    const [filters, setFilters] = useState({
        Date: {
            to: today,
        },
        Group: [] as string[],
        GroupMode: "withGroup" as "withGroup" | "withoutGroup",
    });

    /* ================= DATA LOADING ================= */

    useEffect(() => {
        loadReport();
    }, [filters.Date.to, toggleMode]);

    const loadReport = async () => {
        try {
            setLoading(true);
            const apiCall =
                toggleMode === "Abstract"
                    ? RecievablePayableReportService.getReceivables
                    : RecievablePayableReportService.getPayables;

            const res = await apiCall({ Todate: filters.Date.to });
            setRows(res.data.data || []);
            setSelectedAccountNames(undefined);
            setPage(1);
        } catch (err: any) {
            console.error("Error loading report data:", err);
            toast.error(err?.response?.data?.message || "Failed to load report data ❌");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    // Reset filters when toggleMode changes
    useEffect(() => {
        setSelectedGroups([]);
        setTempGroups([]);
        setGroupMode("withGroup");
        setTempGroupMode("withGroup");
        setFilters((prev) => ({
            ...prev,
            Group: [],
            GroupMode: "withGroup",
        }));
    }, [toggleMode]);

    /* ================= FILTERS & SEARCH ================= */

    // Unique group names list
    const uniqueGroupNames = useMemo(() => {
        const groups = new Set(rows.map((r: any) => r.Group_Name).filter(Boolean));
        return Array.from(groups).sort((a: any, b: any) => a.localeCompare(b));
    }, [rows]);

    // Unique account names list (filtered by selected groups)
    const uniqueAccountNames = useMemo(() => {
        let source = rows;
        if (filters.GroupMode === "withGroup" && filters.Group && filters.Group.length > 0) {
            source = source.filter((r: any) => r.Group_Name && filters.Group.includes(r.Group_Name));
        }
        const names = new Set(source.map((r) => r.Account_name).filter(Boolean));
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [rows, filters.Group, filters.GroupMode]);

    // Apply group filter and header filter selection on account names
    const filteredBySearch = useMemo(() => {
        let source = rows.map((r: any) => {
            const debit = r.CR_DR === "DR" ? Number(r.Bal_Amount) || 0 : 0;
            const credit = r.CR_DR === "CR" ? Number(r.Bal_Amount) || 0 : 0;
            return {
                ...r,
                Debit_Amount: debit,
                Credit_Amount: credit,
            };
        });

        // Filter by selected Groups
        if (filters.GroupMode === "withGroup" && filters.Group && filters.Group.length > 0) {
            source = source.filter((r: any) => r.Group_Name && filters.Group.includes(r.Group_Name));
        }

        if (selectedAccountNames !== undefined) {
            source = source.filter(
                (row) =>
                    row.Account_name && selectedAccountNames.includes(row.Account_name)
            );
        }
        return source;
    }, [rows, selectedAccountNames, filters.Group, filters.GroupMode]);

    const {
        sortConfig,
        rangeFilter,
        setRangeFilter,
        filterAnchor,
        setFilterAnchor,
        activeHeader,
        clearRangeFilter,
        getMinMax,
        handleSort,
        openFilter,
        filteredAndSortedData,
    } = useNumericalFilter(filteredBySearch, ["Debit_Amount", "Credit_Amount"]);

    const finalData = useMemo(() => {
        let result = [...filteredAndSortedData];

        if (!sortConfig) {
            // Default order: invoice_date descending (from today's date to lowest)
            result.sort((a, b) => {
                const dateA = a.invoice_date ? dayjs(a.invoice_date).valueOf() : 0;
                const dateB = b.invoice_date ? dayjs(b.invoice_date).valueOf() : 0;
                return dateB - dateA;
            });
        }

        return result;
    }, [filteredAndSortedData, sortConfig]);

    /* ================= PAGINATION & GROUPING ================= */

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return finalData.slice(start, end);
    }, [finalData, page, rowsPerPage]);

    const groupedPaginatedData = useMemo(() => {
        const groupsMap = new Map<string, any[]>();
        
        paginatedRows.forEach((row) => {
            const groupName = row.Group_Name || "No Group";
            if (!groupsMap.has(groupName)) {
                groupsMap.set(groupName, []);
            }
            groupsMap.get(groupName)!.push(row);
        });

        const groups: {
            groupName: string;
            items: any[];
            subtotalDebit: number;
            subtotalCredit: number;
        }[] = [];

        groupsMap.forEach((items, groupName) => {
            const subtotalDebit = items.reduce((sum, r) => sum + (Number(r.Debit_Amount) || 0), 0);
            const subtotalCredit = items.reduce((sum, r) => sum + (Number(r.Credit_Amount) || 0), 0);
            groups.push({
                groupName,
                items,
                subtotalDebit,
                subtotalCredit,
            });
        });

        groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
        return groups;
    }, [paginatedRows]);

    useEffect(() => {
        setPage(1);
    }, [finalData.length]);

    /* ================= CALCULATIONS ================= */

    const totalDebitAmount = useMemo(() => {
        return finalData.reduce((sum, r: any) => sum + (Number(r.Debit_Amount) || 0), 0);
    }, [finalData]);

    const totalCreditAmount = useMemo(() => {
        return finalData.reduce((sum, r: any) => sum + (Number(r.Credit_Amount) || 0), 0);
    }, [finalData]);

    /* ================= EXPORT ================= */

    const reportTitle = toggleMode === "Abstract" ? "Receivable Report" : "Payable Report";

    const getGroupedDataForExport = () => {
        const groupsMap = new Map<string, any[]>();
        finalData.forEach((row) => {
            const groupName = row.Group_Name || "No Group";
            if (!groupsMap.has(groupName)) {
                groupsMap.set(groupName, []);
            }
            groupsMap.get(groupName)!.push(row);
        });

        const groups: {
            groupName: string;
            items: any[];
            subtotalDebit: number;
            subtotalCredit: number;
        }[] = [];

        groupsMap.forEach((items, groupName) => {
            const subtotalDebit = items.reduce((sum, r) => sum + (Number(r.Debit_Amount) || 0), 0);
            const subtotalCredit = items.reduce((sum, r) => sum + (Number(r.Credit_Amount) || 0), 0);
            groups.push({ groupName, items, subtotalDebit, subtotalCredit });
        });

        groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
        return groups;
    };

    const handleExportExcel = () => {
        if (!finalData.length) {
            toast.warning("No data to export");
            return;
        }

        const workbook = XLSX.utils.book_new();
        const exportRows: any[] = [];

        if (filters.GroupMode === "withGroup") {
            const groups = getGroupedDataForExport();
            let sNo = 1;
            const headerRowIndices = new Set<number>();

            groups.forEach((group) => {
                // Group Header & Totals Row
                headerRowIndices.add(exportRows.length + 2); // Excel 1-based index (including offset)
                exportRows.push({
                    "S.No": "",
                    "Account Name": group.groupName,
                    "Invoice Date": "",
                    "Invoice No": "",
                    "Recievable": group.subtotalDebit || "",
                    "Payable": group.subtotalCredit || "",
                });

                group.items.forEach((row) => {
                    exportRows.push({
                        "S.No": sNo++,
                        "Account Name": row.Account_name || "",
                        "Invoice Date": row.invoice_date ? dayjs(row.invoice_date).format("DD/MM/YYYY") : "",
                        "Invoice No": row.invoice_no || "",
                        "Recievable": row.Debit_Amount || 0,
                        "Payable": row.Credit_Amount || 0,
                    });
                });
            });

            // Grand Total Row
            const bal = toggleMode === "Abstract"
                ? totalDebitAmount - totalCreditAmount
                : totalCreditAmount - totalDebitAmount;
            exportRows.push({
                "S.No": "",
                "Account Name": `Grand Total (Bal: ${formatINR(bal)})`,
                "Invoice Date": "",
                "Invoice No": "",
                "Recievable": totalDebitAmount || 0,
                "Payable": totalCreditAmount || 0,
            });

            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle);

            // Styling cells in excel
            const range = XLSX.utils.decode_range(worksheet["!ref"] || "");
            const borderStyle = {
                top: { style: "thin", color: { rgb: "CFCFCF" } },
                bottom: { style: "thin", color: { rgb: "CFCFCF" } },
                left: { style: "thin", color: { rgb: "CFCFCF" } },
                right: { style: "thin", color: { rgb: "CFCFCF" } }
            };

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (!cell) continue;

                    cell.s = {
                        font: { name: "Arial", sz: 9 },
                        border: borderStyle
                    };

                    const val = String(cell.v || "");
                    if (headerRowIndices.has(R + 1)) {
                        cell.s.font = { name: "Arial", sz: 9, bold: true, color: { rgb: "1E3A8A" } };
                        cell.s.fill = { fgColor: { rgb: "E2E8F0" } };
                    } else if (val.startsWith("Grand Total")) {
                        cell.s.font = { name: "Arial", sz: 9, bold: true };
                        cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
                    }
                }
            }
        } else {
            // Flat list view
            finalData.forEach((row, index) => {
                exportRows.push({
                    "S.No": index + 1,
                    "Account Name": row.Account_name || "",
                    "Invoice Date": row.invoice_date ? dayjs(row.invoice_date).format("DD/MM/YYYY") : "",
                    "Invoice No": row.invoice_no || "",
                    "Recievable": row.Debit_Amount || 0,
                    "Payable": row.Credit_Amount || 0,
                });
            });

            // Grand Total Row
            const bal = toggleMode === "Abstract"
                ? totalDebitAmount - totalCreditAmount
                : totalCreditAmount - totalDebitAmount;
            exportRows.push({
                "S.No": "",
                "Account Name": `Grand Total (Bal: ${formatINR(bal)})`,
                "Invoice Date": "",
                "Invoice No": "",
                "Recievable": totalDebitAmount || 0,
                "Payable": totalCreditAmount || 0,
            });

            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle);

            // Styling cells in excel
            const range = XLSX.utils.decode_range(worksheet["!ref"] || "");
            const borderStyle = {
                top: { style: "thin", color: { rgb: "CFCFCF" } },
                bottom: { style: "thin", color: { rgb: "CFCFCF" } },
                left: { style: "thin", color: { rgb: "CFCFCF" } },
                right: { style: "thin", color: { rgb: "CFCFCF" } }
            };

            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (!cell) continue;

                    cell.s = {
                        font: { name: "Arial", sz: 9 },
                        border: borderStyle
                    };

                    const val = String(cell.v || "");
                    if (val.startsWith("Grand Total")) {
                        cell.s.font = { name: "Arial", sz: 9, bold: true };
                        cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
                    }
                }
            }
        }

        XLSX.writeFile(
            workbook,
            `${reportTitle.replace(" ", "_")}_${dayjs().format("DDMMYYYY")}.xlsx`
        );
        toast.success("Excel exported successfully 📊");
    };

    const handleExportPDF = () => {
        if (!finalData.length) {
            toast.warning("No data to export");
            return;
        }

        const doc = new jsPDF("p", "mm", "a4");
        doc.setFontSize(14);
        doc.text(`${reportTitle} - As of ${dayjs(filters.Date.to).format("DD/MM/YYYY")}`, 14, 12);

        const tableHeaders = [["S.No", "Account Name", "Invoice Date", "Invoice No", "Recievable", "Payable"]];
        const tableBody: any[] = [];

        if (filters.GroupMode === "withGroup") {
            const groups = getGroupedDataForExport();
            let sNo = 1;
            const headerIndices = new Set<number>();

            groups.forEach((group) => {
                // Group Header & Totals Row in PDF table body
                headerIndices.add(tableBody.length);
                tableBody.push([
                    "",
                    group.groupName,
                    "",
                    "",
                    group.subtotalDebit !== 0 ? group.subtotalDebit.toFixed(2) : "0.00",
                    group.subtotalCredit !== 0 ? group.subtotalCredit.toFixed(2) : "0.00",
                ]);

                group.items.forEach((row) => {
                    tableBody.push([
                        sNo++,
                        row.Account_name || "",
                        row.invoice_date ? dayjs(row.invoice_date).format("DD/MM/YYYY") : "",
                        row.invoice_no || "",
                        row.Debit_Amount ? row.Debit_Amount.toFixed(2) : "0.00",
                        row.Credit_Amount ? row.Credit_Amount.toFixed(2) : "0.00",
                    ]);
                });
            });

            // Add Grand Total Row to PDF body
            const bal = toggleMode === "Abstract"
                ? totalDebitAmount - totalCreditAmount
                : totalCreditAmount - totalDebitAmount;
            tableBody.push([
                "",
                `Grand Total (Bal: ${formatINR(bal)})`,
                "",
                "",
                totalDebitAmount.toFixed(2),
                totalCreditAmount.toFixed(2),
            ]);

            autoTable(doc, {
                startY: 18,
                head: tableHeaders,
                body: tableBody,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 58, 138] },
                didParseCell: (cellData) => {
                    if (cellData.row.index === tableBody.length - 1) {
                        cellData.cell.styles.fontStyle = "bold";
                        cellData.cell.styles.fillColor = [241, 245, 249];
                        if (cellData.column.index === 4 || cellData.column.index === 5) {
                            cellData.cell.styles.halign = "right";
                        }
                    } else if (headerIndices.has(cellData.row.index)) {
                        cellData.cell.styles.fontStyle = "bold";
                        cellData.cell.styles.fillColor = [226, 232, 240]; // slate-200
                        cellData.cell.styles.textColor = [30, 58, 138]; // navy
                        if (cellData.column.index === 4 || cellData.column.index === 5) {
                            cellData.cell.styles.halign = "right";
                        }
                    } else {
                        if (cellData.column.index === 4 || cellData.column.index === 5) {
                            cellData.cell.styles.halign = "right";
                        }
                    }
                }
            });
        } else {
            // Flat list view
            finalData.forEach((row, index) => {
                tableBody.push([
                    index + 1,
                    row.Account_name || "",
                    row.invoice_date ? dayjs(row.invoice_date).format("DD/MM/YYYY") : "",
                    row.invoice_no || "",
                    row.Debit_Amount ? row.Debit_Amount.toFixed(2) : "0.00",
                    row.Credit_Amount ? row.Credit_Amount.toFixed(2) : "0.00",
                ]);
            });

            // Add Grand Total Row to PDF body
            const bal = toggleMode === "Abstract"
                ? totalDebitAmount - totalCreditAmount
                : totalCreditAmount - totalDebitAmount;
            tableBody.push([
                "",
                `Grand Total (Bal: ${formatINR(bal)})`,
                "",
                "",
                totalDebitAmount.toFixed(2),
                totalCreditAmount.toFixed(2),
            ]);

            autoTable(doc, {
                startY: 18,
                head: tableHeaders,
                body: tableBody,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [30, 58, 138] },
                didParseCell: (cellData) => {
                    if (cellData.row.index === tableBody.length - 1) {
                        cellData.cell.styles.fontStyle = "bold";
                        cellData.cell.styles.fillColor = [241, 245, 249];
                        if (cellData.column.index === 4 || cellData.column.index === 5) {
                            cellData.cell.styles.halign = "right";
                        }
                    } else {
                        if (cellData.column.index === 4 || cellData.column.index === 5) {
                            cellData.cell.styles.halign = "right";
                        }
                    }
                }
            });
        }

        doc.save(`${reportTitle.replace(" ", "_")}_${dayjs().format("DDMMYYYY")}.pdf`);
        toast.success("PDF exported successfully 📄");
    };

    /* ================= INTERACTION HANDLERS ================= */

    /* ================= RENDER ================= */

    const headerStyle = {
        color: "#fff",
        fontWeight: 600,
        backgroundColor: "#1E3A8A",
    };

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={(mode) => setToggleMode(mode)}
                abstractLabel="Debtors"
                expandedLabel="Creditors"
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => {
                    setDrawerOpen((prev) => {
                        if (!prev) {
                            setTempGroups(selectedGroups);
                            setTempGroupMode(groupMode);
                        }
                        return !prev;
                    });
                }}
                onClose={() => setDrawerOpen(false)}
                hideFromDate={true}
                toDate={toDate}
                onToDateChange={setToDate}
                onApply={() => {
                    setFilters({
                        Date: { to: toDate },
                        Group: tempGroupMode === "withGroup" ? tempGroups : [],
                        GroupMode: tempGroupMode,
                    });
                    setSelectedGroups(tempGroupMode === "withGroup" ? tempGroups : []);
                    setGroupMode(tempGroupMode);
                    setDrawerOpen(false);
                }}
            >
                <FormControl sx={{ mb: 2, display: "block" }}>
                    <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                        Grouping Mode
                    </FormLabel>
                    <RadioGroup
                        row
                        value={tempGroupMode}
                        onChange={(e) => setTempGroupMode(e.target.value as "withGroup" | "withoutGroup")}
                    >
                        <FormControlLabel
                            value="withGroup"
                            control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                            label={<Typography sx={{ fontSize: "0.825rem" }}>With Group</Typography>}
                        />
                        <FormControlLabel
                            value="withoutGroup"
                            control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                            label={<Typography sx={{ fontSize: "0.825rem" }}>Without Group</Typography>}
                        />
                    </RadioGroup>
                </FormControl>

                {tempGroupMode === "withGroup" && (
                    <Autocomplete
                        multiple
                        disableCloseOnSelect
                        options={uniqueGroupNames}
                        value={tempGroups}
                        onChange={(_, newValue) => setTempGroups(newValue)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Group Names"
                                placeholder="Select Groups..."
                                InputLabelProps={{ shrink: true }}
                            />
                        )}
                        sx={{ mb: 3 }}
                    />
                )}
            </ReportFilterDrawer>

            <AppLayout fullWidth>
                <Box sx={{ mt: 1, overflow: "hidden" }}>
                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                            <CircularProgress size={40} />
                        </Box>
                    ) : (
                        <>
                            <TableContainer
                                component={Paper}
                                sx={{
                                    maxHeight: "calc(100vh - 115px)",
                                    borderRadius: 0,
                                    border: "1px solid #cbd5e1",
                                    overflow: "auto",
                                    "& th, & td": {
                                        fontSize: "0.75rem",
                                        py: 1,
                                    },
                                }}
                            >
                                <Table size="small" stickyHeader sx={{ tableLayout: "fixed", width: "100%" }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ ...headerStyle, width: "60px" }}>S.No</TableCell>
                                            <TableCell
                                                sx={{ ...headerStyle, cursor: "pointer" }}
                                                onClick={(e) => setAccountFilterAnchor(e.currentTarget)}
                                            >
                                                Account Name
                                            </TableCell>
                                            <TableCell sx={{ ...headerStyle, width: "110px" }}>Invoice Date</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: "160px" }}>Invoice No</TableCell>
                                            <TableCell sx={{ ...headerStyle, width: "160px" }} align="right">
                                                <SortableHeaderLabel
                                                    label="Recievable"
                                                    columnKey="Debit_Amount"
                                                    sortConfig={sortConfig}
                                                    onSort={handleSort}
                                                    onOpenFilter={(e) => openFilter(e, "Debit_Amount")}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ ...headerStyle, width: "160px" }} align="right">
                                                <SortableHeaderLabel
                                                    label="Payable"
                                                    columnKey="Credit_Amount"
                                                    sortConfig={sortConfig}
                                                    onSort={handleSort}
                                                    onOpenFilter={(e) => openFilter(e, "Credit_Amount")}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {/* Grand Total Row (Top) */}
                                        {finalData.length > 0 && (() => {
                                            const bal = toggleMode === "Abstract"
                                                ? totalDebitAmount - totalCreditAmount
                                                : totalCreditAmount - totalDebitAmount;
                                            return (
                                                <TableRow sx={{ backgroundColor: "#F8FAFC", borderBottom: "2px solid #cbd5e1" }}>
                                                    <TableCell colSpan={4} sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#1E3A8A" }}>
                                                        Grand Total (Bal: {formatINR(bal)})
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#1E3A8A" }}>
                                                        {totalDebitAmount !== 0 ? formatINR(totalDebitAmount) : "-"}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#1E3A8A" }}>
                                                        {totalCreditAmount !== 0 ? formatINR(totalCreditAmount) : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })()}

                                        {filters.GroupMode === "withGroup" ? (
                                            groupedPaginatedData.length > 0 ? (
                                                (() => {
                                                    let sNoCounter = (page - 1) * rowsPerPage;
                                                    return groupedPaginatedData.map((group, groupIdx) => {
                                                        const rowsHtml = group.items.map((row, itemIdx) => {
                                                            sNoCounter++;
                                                            return (
                                                                <TableRow key={row.Acc_Id + itemIdx} hover>
                                                                    <TableCell>{sNoCounter}</TableCell>
                                                                    <TableCell sx={{ fontWeight: 500, color: "#1E293B", wordBreak: "break-word", whiteSpace: "normal" }}>
                                                                        {row.Account_name}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {row.invoice_date
                                                                            ? dayjs(row.invoice_date).format("DD/MM/YYYY")
                                                                            : "-"}
                                                                    </TableCell>
                                                                    <TableCell sx={{ wordBreak: "break-all", whiteSpace: "normal" }}>{row.invoice_no || "-"}</TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                                        {row.Debit_Amount !== 0 ? formatINR(row.Debit_Amount) : "-"}
                                                                    </TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                                        {row.Credit_Amount !== 0 ? formatINR(row.Credit_Amount) : "-"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        });

                                                        return (
                                                            <React.Fragment key={group.groupName + groupIdx}>
                                                                {/* Group Header Row showing totals directly */}
                                                                <TableRow sx={{ backgroundColor: "#E2E8F0" }}>
                                                                    <TableCell sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#1E3A8A" }} />
                                                                    <TableCell sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#1E3A8A", py: 1 }}>
                                                                        {group.groupName}
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#1E3A8A" }} />
                                                                    <TableCell sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#1E3A8A" }} />
                                                                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#1E3A8A" }}>
                                                                        {group.subtotalDebit !== 0 ? formatINR(group.subtotalDebit) : "-"}
                                                                    </TableCell>
                                                                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#1E3A8A" }}>
                                                                        {group.subtotalCredit !== 0 ? formatINR(group.subtotalCredit) : "-"}
                                                                    </TableCell>
                                                                </TableRow>

                                                                {/* Group Items */}
                                                                {rowsHtml}
                                                            </React.Fragment>
                                                        );
                                                    });
                                                })()
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                                        No records found.
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        ) : (
                                            // Flat list view ("Without Group")
                                            paginatedRows.length > 0 ? (
                                                paginatedRows.map((row: any, i) => {
                                                    const sNo = (page - 1) * rowsPerPage + i + 1;
                                                    return (
                                                        <TableRow key={row.Acc_Id + i} hover>
                                                            <TableCell>{sNo}</TableCell>
                                                            <TableCell sx={{ fontWeight: 500, color: "#1E293B", wordBreak: "break-word", whiteSpace: "normal" }}>
                                                                {row.Account_name}
                                                            </TableCell>
                                                            <TableCell>
                                                                {row.invoice_date
                                                                    ? dayjs(row.invoice_date).format("DD/MM/YYYY")
                                                                    : "-"}
                                                            </TableCell>
                                                            <TableCell sx={{ wordBreak: "break-all", whiteSpace: "normal" }}>{row.invoice_no || "-"}</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                                {row.Debit_Amount !== 0 ? formatINR(row.Debit_Amount) : "-"}
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                                {row.Credit_Amount !== 0 ? formatINR(row.Credit_Amount) : "-"}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                                        No records found.
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Pagination */}
                            {finalData.length > 0 && (
                                <CommonPagination
                                    totalRows={finalData.length}
                                    page={page}
                                    rowsPerPage={rowsPerPage}
                                    onPageChange={setPage}
                                    onRowsPerPageChange={setRowsPerPage}
                                />
                            )}
                        </>
                    )}
                </Box>
            </AppLayout>

            {/* Account Name Header Filter Menu */}
            <HeaderFilterMenu
                anchorEl={accountFilterAnchor}
                open={Boolean(accountFilterAnchor)}
                onClose={() => setAccountFilterAnchor(null)}
                columnLabel="Account Name"
                options={uniqueAccountNames}
                selectedValues={selectedAccountNames}
                onFilterChange={(selected: string[] | undefined) => {
                    setSelectedAccountNames(selected);
                    setPage(1);
                }}
            />

            {/* Numerical Filter Menu */}
            <NumericalFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
                activeHeader={activeHeader}
                min={activeHeader ? getMinMax(activeHeader).min : 0}
                max={activeHeader ? getMinMax(activeHeader).max : 100}
                rangeFilter={rangeFilter}
                onRangeChange={(key, range) => setRangeFilter((p) => ({ ...p, [key]: range }))}
                onClear={clearRangeFilter}
            />
        </>
    );
};

export default RecievablePayableReport;
