import { useEffect, useMemo, useState } from "react";
import {
    Box, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, IconButton, Typography,
    Tooltip, Menu, Switch, CircularProgress, Button
} from "@mui/material";

import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { arrayMove } from "@dnd-kit/sortable";

import {
    DndContext, closestCenter, PointerSensor,
    useSensor, useSensors
} from "@dnd-kit/core";

import {
    SortableContext, useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";

import dayjs from "dayjs";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { onlinePaymentReportService } from "../../services/expenseReport.service";

const formatINR = (v: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(v);

const renderFormattedAmount = (v: number, textStyles?: any) => {
    const formatted = formatINR(v);
    const lastDotIndex = formatted.lastIndexOf(".");
    if (lastDotIndex === -1) {
        return <span style={textStyles}>{formatted}</span>;
    }
    const whole = formatted.substring(0, lastDotIndex);
    const fraction = formatted.substring(lastDotIndex);
    return (
        <span style={textStyles}>
            {whole}
            <span style={{ fontSize: "0.82em", opacity: 0.85 }}>{fraction}</span>
        </span>
    );
};

/* ================= MAPPING ================= */

const mapExpenseData = (
    summary: any[],
    direct: any[],
    indirect: any[]
) => {

    const normalize = (val: any) =>
        String(val ?? "").trim();

    const mapper = (expenseList: any[]) => {

        const groupMap: any = {};

        /* Create fast lookup */
        const expenseMap = new Map(
            expenseList.map((x: any) => [
                normalize(x.Acc_Id),
                x
            ])
        );

        summary.forEach((row: any) => {

            const debitId = normalize(row.debit_ledger);
            const creditId = normalize(row.credit_ledger);

            const matchedExpense =
                expenseMap.get(debitId) ||
                expenseMap.get(creditId);

            /* ❌ Skip unmatched summary rows */
            if (!matchedExpense) return;

            const groupName =
                matchedExpense.Group_Name || "Others";

            const subKey =
                matchedExpense.Account_name || "Others";

            if (!groupMap[groupName]) {
                groupMap[groupName] = {
                    name: groupName,
                    dr: 0,
                    cr: 0,
                    balance: 0,
                    subGroups: {}
                };
            }

            if (!groupMap[groupName].subGroups[subKey]) {
                groupMap[groupName].subGroups[subKey] = {
                    name: subKey,
                    dr: 0,
                    cr: 0,
                    balance: 0,
                    ledgers: []
                };
            }

            const sub =
                groupMap[groupName].subGroups[subKey];

            /* DR MATCH */
            if (expenseMap.has(debitId)) {

                const amount = Number(
                    row.debit_amount || 0
                );

                groupMap[groupName].dr += amount;
                sub.dr += amount;

                sub.ledgers.push({
                    ...row,
                    entryType: "DR",
                    amount
                });
            }

            /* CR MATCH */
            if (expenseMap.has(creditId)) {

                const amount = Number(
                    row.credit_amount || 0
                );

                groupMap[groupName].cr += amount;
                sub.cr += amount;

                sub.ledgers.push({
                    ...row,
                    entryType: "CR",
                    amount
                });
            }

            sub.balance = sub.dr - sub.cr;
            groupMap[groupName].balance =
                groupMap[groupName].dr -
                groupMap[groupName].cr;
        });

        return {
            total: Object.values(groupMap).reduce(
                (sum: number, g: any) =>
                    sum + g.balance,
                0
            ),

            groups: Object.values(groupMap).map(
                (g: any) => ({
                    ...g,
                    subGroups: Object.values(
                        g.subGroups
                    )
                })
            )
        };
    };

    return {
        Direct: mapper(direct),
        Indirect: mapper(indirect)
    };
};

/* ================= SORT ================= */

const SortRow = ({ col, toggle }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
        useSortable({ id: col.key });

    return (
        <Box ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            display="flex" alignItems="center" gap={1} mb={1}
        >
            <IconButton {...listeners} {...attributes} size="small">
                <DragIndicatorIcon fontSize="small" />
            </IconButton>

            <Typography sx={{ flex: 1 }}>{col.label}</Typography>

            <Switch
                checked={col.enabled}
                onChange={() => toggle(col.key)}
            />
        </Box>
    );
};

/* ================= MAIN ================= */

const ExpensesReport = () => {

    const { toggleMode, setToggleMode } = useToggleMode();

    const today = dayjs().format("YYYY-MM-DD");

    const [data, setData] = useState<any>(null);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [expandedLedgers, setExpandedLedgers] = useState<string[]>([]);
    const [columns, setColumns] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [settingsAnchor, setSettingsAnchor] =
        useState<null | HTMLElement>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    const [filters, setFilters] = useState({
        Date: { from: today, to: today },
    });

    const sensors = useSensors(useSensor(PointerSensor));

    /* ================= FETCH ================= */

    useEffect(() => {
        fetchData();
    }, [filters.Date.from, filters.Date.to]);

    const DEFAULT_ENABLED = [
        "payment_date",
        "payment_invoice_no",
        "voucher_name",
        "debit_amount",
        "credit_amount",
        "remarks",
        "Created_By",
    ];

    const buildColumns = (summary: any[]) => {
        if (!summary?.length) return [];

        // Fixed order columns
        const fixedOrder = [
            "payment_date",
            "payment_invoice_no",
            "voucher_name",
            "debit_amount",
            "credit_amount",
        ];

        // Remaining dynamic columns
        const remainingCols = Object.keys(summary[0])
            .filter(
                (key) =>
                    !fixedOrder.includes(key)
            )
            .map((key) => ({
                key,
                label: key.replace(/_/g, " ").toUpperCase(),
                enabled: DEFAULT_ENABLED.includes(key),
            }));

        // Final ordered columns
        const orderedCols = [
            {
                key: "payment_date",
                label: "PAYMENT DATE",
                enabled: true,
            },
            {
                key: "payment_invoice_no",
                label: "PAYMENT INVOICE NO",
                enabled: true,
            },
            {
                key: "voucher_name",
                label: "VOUCHER NAME",
                enabled: true,
            },
            {
                key: "debit_amount",
                label: "DEBIT AMOUNT",
                enabled: true,
            },
            {
                key: "credit_amount",
                label: "CREDIT AMOUNT",
                enabled: true,
            },
            ...remainingCols
        ];

        return orderedCols.map((col, index) => ({
            ...col,
            order: index
        }));
    };

    const sortedColumns = useMemo(() => {
        return [...columns].sort((a, b) => {
            if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
            return a.order - b.order;
        });
    }, [columns]);

    const enabledCols = sortedColumns.filter(c => c.enabled);

    const fetchData = async () => {
        try {
            setLoading(true);

            const res = await onlinePaymentReportService.getOnlinePaymentReport({
                Fromdate: filters.Date.from,
                Todate: filters.Date.to,
            });

            const mapped = mapExpenseData(
                res.Summary,
                res.DirectExpense,
                res.IndirectExpense
            );

            // ✅ Dynamic Columns
            const dynamicCols = buildColumns(res.Summary);

            setColumns(dynamicCols);
            setData(mapped);

            setExpandedGroups([]);
            setExpandedLedgers([]);

        } catch {
            toast.error("Load failed ❌");
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setColumns(cols => {
            const enabled = cols.filter(c => c.enabled);
            const disabled = cols.filter(c => !c.enabled);

            const activeList = enabled.some(c => c.key === active.id)
                ? enabled
                : disabled;

            const oldIndex = activeList.findIndex(c => c.key === active.id);
            const newIndex = activeList.findIndex(c => c.key === over.id);

            const reordered = arrayMove(activeList, oldIndex, newIndex);

            reordered.forEach((c, i) => (c.order = i));

            return [
                ...reordered,
                ...(activeList[0].enabled ? disabled : enabled),
            ];
        });
    };

    /* ================= EXPORT EXCEL ================= */

    const exportExcel = () => {
        try {
            if (!section) {
                toast.error("No data available");
                return;
            }

            const excelData: any[][] = [];

            excelData.push([
                `${activeType.toUpperCase()} EXPENSE REPORT`
            ]);

            excelData.push([
                `From : ${filters.Date.from}   To : ${filters.Date.to}`
            ]);

            excelData.push([]);

            section.groups.forEach((group: any) => {

                excelData.push([
                    `${group.name}`,
                    "",
                    "",
                    `DR : ${formatINR(group.dr)}`,
                    `CR : ${formatINR(group.cr)}`,
                    `BAL : ${formatINR(group.balance)}`
                ]);

                group.subGroups.forEach((sub: any) => {

                    excelData.push([
                        `   ${sub.name}`,
                        "",
                        "",
                        `DR : ${formatINR(sub.dr)}`,
                        `CR : ${formatINR(sub.cr)}`,
                        `BAL : ${formatINR(sub.balance)}`
                    ]);

                    excelData.push([
                        "S.NO",
                        ...enabledCols.map(
                            (col: any) => col.label
                        )
                    ]);

                    sub.ledgers.forEach(
                        (row: any, index: number) => {

                            excelData.push([
                                index + 1,

                                ...enabledCols.map(
                                    (col: any) => {

                                        if (
                                            col.key ===
                                            "payment_date"
                                        ) {
                                            return dayjs(
                                                row[col.key]
                                            ).format(
                                                "DD-MM-YYYY"
                                            );
                                        }

                                        if (
                                            col.key ===
                                            "debit_amount"
                                        ) {
                                            return row.entryType ===
                                                "DR"
                                                ? row.amount
                                                : "";
                                        }

                                        if (
                                            col.key ===
                                            "credit_amount"
                                        ) {
                                            return row.entryType ===
                                                "CR"
                                                ? row.amount
                                                : "";
                                        }

                                        return (
                                            row[col.key] ?? ""
                                        );
                                    }
                                )
                            ]);
                        }
                    );

                    excelData.push([]);
                });

                excelData.push([]);
            });

            const ws =
                XLSX.utils.aoa_to_sheet(excelData);

            ws["!cols"] = [
                { wch: 10 },
                ...enabledCols.map(() => ({
                    wch: 25,
                })),
            ];

            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(
                wb,
                ws,
                `${activeType} Expenses`
            );

            XLSX.writeFile(
                wb,
                `${activeType}_Expenses_Report.xlsx`
            );

            toast.success("Excel Exported ✅");

        } catch (err) {
            console.error(err);
            toast.error("Excel Export Failed ❌");
        }
    };



    /* ================= EXPORT PDF ================= */

    const exportPDF = () => {

        try {

            if (!section) {
                toast.error("No data available");
                return;
            }

            const doc = new jsPDF(
                "landscape",
                "mm",
                "a4"
            );

            doc.setFontSize(15);

            doc.text(
                `${activeType} Expenses Report`,
                14,
                12
            );

            doc.setFontSize(10);

            doc.text(
                `From : ${filters.Date.from}   To : ${filters.Date.to}`,
                14,
                18
            );

            let startY = 25;

            section.groups.forEach(
                (group: any) => {

                    doc.setFontSize(11);

                    doc.text(
                        `${group.name} | DR : ${formatINR(
                            group.dr
                        )} | CR : ${formatINR(
                            group.cr
                        )} | BAL : ${formatINR(
                            group.balance
                        )}`,
                        14,
                        startY
                    );

                    startY += 6;

                    group.subGroups.forEach(
                        (sub: any) => {

                            doc.setFontSize(10);

                            doc.text(
                                `${sub.name} | DR : ${formatINR(
                                    sub.dr
                                )} | CR : ${formatINR(
                                    sub.cr
                                )} | BAL : ${formatINR(
                                    sub.balance
                                )}`,
                                18,
                                startY
                            );

                            startY += 4;

                            autoTable(doc, {
                                startY,

                                head: [[
                                    "S.NO",
                                    ...enabledCols.map(
                                        (c: any) =>
                                            c.label
                                    )
                                ]],

                                body:
                                    sub.ledgers.map(
                                        (
                                            row: any,
                                            index: number
                                        ) => [

                                                index + 1,

                                                ...enabledCols.map(
                                                    (
                                                        col: any
                                                    ) => {

                                                        if (
                                                            col.key ===
                                                            "payment_date"
                                                        ) {
                                                            return dayjs(
                                                                row[
                                                                col
                                                                    .key
                                                                ]
                                                            ).format(
                                                                "DD-MM-YYYY"
                                                            );
                                                        }

                                                        if (
                                                            col.key ===
                                                            "debit_amount"
                                                        ) {
                                                            return row.entryType ===
                                                                "DR"
                                                                ? formatINR(
                                                                    row.amount
                                                                )
                                                                : "";
                                                        }

                                                        if (
                                                            col.key ===
                                                            "credit_amount"
                                                        ) {
                                                            return row.entryType ===
                                                                "CR"
                                                                ? formatINR(
                                                                    row.amount
                                                                )
                                                                : "";
                                                        }

                                                        return row[
                                                            col
                                                                .key
                                                        ] ?? "";
                                                    }
                                                )
                                            ]
                                    ),

                                styles: {
                                    fontSize: 7,
                                    cellPadding: 2,
                                },

                                headStyles: {
                                    fontStyle:
                                        "bold",
                                },

                                theme: "grid",

                                margin: {
                                    left: 18,
                                    right: 10,
                                },
                            });

                            startY =
                                (
                                    doc as any
                                ).lastAutoTable
                                    .finalY + 8;

                            if (
                                startY > 180
                            ) {
                                doc.addPage();
                                startY = 15;
                            }
                        }
                    );

                    startY += 5;
                }
            );

            doc.save(
                `${activeType}_Expenses_Report.pdf`
            );

            toast.success(
                "PDF Exported ✅"
            );

        } catch (err) {
            console.error(err);
            toast.error(
                "PDF Export Failed ❌"
            );
        }
    };

    const activeType = toggleMode === "Abstract" ? "Direct" : "Indirect";
    const section = data?.[activeType];

    const getSectionSummary = (section: any) => {
        const dr = section.groups.reduce((s: number, g: any) => s + (g.dr || 0), 0);
        const cr = section.groups.reduce((s: number, g: any) => s + (g.cr || 0), 0);
        const balance = dr - cr;

        return { dr, cr, balance };
    };

    const summary = section ? getSectionSummary(section) : null;


    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onExportExcel={exportExcel}
                onExportPDF={exportPDF}
                settingsSlot={
                    <Tooltip title="Table Settings">
                        <IconButton size="small"
                            onClick={(e) => setSettingsAnchor(e.currentTarget)}
                            sx={{
                                height: 24, width: 24,
                                backgroundColor: "#fff",
                                borderRadius: 0.5,
                            }} >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                }
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onToggle={() => setDrawerOpen(p => !p)}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                onApply={() =>
                    setFilters({ Date: { from: fromDate, to: toDate } })
                }
            />

            <AppLayout fullWidth>
                <Box p={1} sx={{
                    overflow: "hidden",
                }}>

                    {data && section && (
                        <Box mb={2}>

                            {/* 🔷 LIST HEADER */}
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 10,
                                    bgcolor: "primary.main",
                                    color: "primary.contrastText",
                                    p: 1.5,
                                    mb: 1.5,
                                    borderRadius: 1,
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                }}
                            >
                                <Typography fontWeight={700} sx={{ ml: 4 }}>
                                    Particulars
                                </Typography>

                                <Box
                                    display="grid"
                                    gridTemplateColumns="160px 160px 220px"
                                    alignItems="center"
                                >
                                    <Typography fontWeight={700} sx={{ textAlign: "right", pr: 3 }}>Debit</Typography>
                                    <Typography fontWeight={700} sx={{ textAlign: "right", pr: 3 }}>Credit</Typography>
                                    <Typography fontWeight={700} sx={{ textAlign: "right", pr: 3 }}>Balance</Typography>
                                </Box>
                            </Box>

                            {/* 🔷 HEADER */}
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                border="1px solid #cbd5e1"
                                borderRadius={1}
                                p={1.5}
                                mb={1}
                                flexWrap="wrap"
                                gap={2}
                                sx={{
                                    background:
                                        (summary?.balance ?? 0) >= 0
                                            ? "#f0fdf4"
                                            : "#fef2f2",
                                }}
                            >
                                {/* LEFT TITLE */}
                                <Typography
                                    fontWeight={700}
                                    fontSize="15px"
                                >
                                    {activeType === "Direct"
                                        ? "DIRECT EXPENSES"
                                        : "INDIRECT EXPENSES"}
                                </Typography>

                                {/* RIGHT SUMMARY */}
                                <Box
                                    display="grid"
                                    gridTemplateColumns="160px 160px 220px"
                                    alignItems="center"
                                >
                                    <Typography fontWeight={700} sx={{ textAlign: "right", pr: 3 }}>
                                        {renderFormattedAmount(summary?.dr ?? 0)}
                                    </Typography>

                                    <Typography fontWeight={700} sx={{ textAlign: "right", pr: 3 }}>
                                        {renderFormattedAmount(summary?.cr ?? 0)}
                                    </Typography>

                                    <Typography
                                        fontWeight={800}
                                        fontSize="16px"
                                        color={
                                            (summary?.balance ?? 0) >= 0
                                                ? "success.main"
                                                : "error.main"
                                        }
                                        sx={{ textAlign: "right", pr: 3 }}
                                    >
                                        {renderFormattedAmount(Math.abs(summary?.balance ?? 0))}{" "}
                                        {(summary?.balance ?? 0) >= 0 ? "DR" : "CR"}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* 🔷 GROUPS */}
                            {section.groups.map((group: any) => {
                                const gKey = activeType + group.name;
                                const openGroup = expandedGroups.includes(gKey);

                                return (
                                    <Box key={gKey} mb={1}>

                                        {/* 🔷 PRIMARY GROUP */}
                                        <Box
                                            display="flex"
                                            justifyContent="space-between"
                                            sx={{ background: "#f1f5f9", p: 1, cursor: "pointer" }}
                                            onClick={() =>
                                                setExpandedGroups(p =>
                                                    p.includes(gKey)
                                                        ? p.filter(x => x !== gKey)
                                                        : [...p, gKey]
                                                )
                                            }
                                        >
                                            <Box display="flex" alignItems="center">
                                                {openGroup ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                                                <Typography ml={1}>{group.name}</Typography>
                                            </Box>

                                            <Box
                                                display="grid"
                                                gridTemplateColumns="160px 160px 220px"
                                                alignItems="center"
                                            >

                                                <Typography fontWeight={600} sx={{ textAlign: "right", pr: 3 }}>
                                                    {renderFormattedAmount(group.dr)}
                                                </Typography>

                                                <Typography fontWeight={600} sx={{ textAlign: "right", pr: 3 }}>
                                                    {renderFormattedAmount(group.cr)}
                                                </Typography>

                                                <Typography fontWeight={700} color={group.balance >= 0 ? "green" : "red"} sx={{ textAlign: "right", pr: 3 }}>
                                                    {renderFormattedAmount(Math.abs(group.balance))} {group.balance >= 0 ? "DR" : "CR"}
                                                </Typography>

                                            </Box>
                                        </Box>

                                        {/* 🔷 SUB GROUP */}
                                        {openGroup && group.subGroups.map((sub: any) => {
                                            const sKey = gKey + sub.name;
                                            const openSub = expandedLedgers.includes(sKey);

                                            return (
                                                <Box key={sKey}>

                                                    <Box
                                                        display="flex"
                                                        justifyContent="space-between"
                                                        sx={{
                                                            background: "#e2e8f0",
                                                            p: 1,
                                                            pl: 4,
                                                            cursor: "pointer"
                                                        }}
                                                        onClick={() =>
                                                            setExpandedLedgers(p =>
                                                                p.includes(sKey)
                                                                    ? p.filter(x => x !== sKey)
                                                                    : [...p, sKey]
                                                            )
                                                        }
                                                    >
                                                        <Box display="flex" alignItems="center">
                                                            {openSub ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                                                            <Typography ml={1}>{sub.name}</Typography>
                                                        </Box>

                                                        <Box
                                                            display="grid"
                                                            gridTemplateColumns="160px 160px 220px"
                                                            alignItems="center"
                                                        >
                                                            <Typography sx={{ textAlign: "right", pr: 3 }}>
                                                                {renderFormattedAmount(sub.dr)}
                                                            </Typography>

                                                            <Typography sx={{ textAlign: "right", pr: 3 }}>
                                                                {renderFormattedAmount(sub.cr)}
                                                            </Typography>

                                                            <Typography fontWeight={600} color={sub.balance >= 0 ? "green" : "red"} sx={{ textAlign: "right", pr: 3 }}>
                                                                {renderFormattedAmount(Math.abs(sub.balance))} {sub.balance >= 0 ? "DR" : "CR"}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {/* 🔥 FINAL TABLE (LEVEL 3) */}
                                                    {openSub && (
                                                        <TableContainer
                                                            component={Paper}
                                                            sx={{
                                                                ml: { xs: 2, md: 6 },
                                                                mb: 1,
                                                                maxHeight: 300,
                                                                overflowX: "auto",
                                                                overflowY: "auto",
                                                                width: "100%",
                                                            }}
                                                        >
                                                            <Table
                                                                size="small"
                                                                sx={{
                                                                    minWidth: (enabledCols.length + 1) * 150, // +1 for S.NO
                                                                    tableLayout: "auto",
                                                                }}
                                                            >
                                                                {/* TABLE HEADER */}
                                                                <TableHead>
                                                                    <TableRow
                                                                        sx={{
                                                                            position: "sticky",
                                                                            top: 0,
                                                                            background: "#f8fafc",
                                                                            zIndex: 2,
                                                                        }}
                                                                    >
                                                                        {/* S.NO */}
                                                                        <TableCell
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                                textTransform: "uppercase",
                                                                                fontSize: "12px",
                                                                                borderBottom: "2px solid #cbd5e1",
                                                                                textAlign: "center",
                                                                                minWidth: 80,
                                                                                width: 80,
                                                                                background: "#f8fafc",
                                                                            }}
                                                                        >
                                                                            S.NO
                                                                        </TableCell>

                                                                        {enabledCols.map((col) => (
                                                                            <TableCell
                                                                                key={col.key}
                                                                                sx={{
                                                                                    fontWeight: 700,
                                                                                    textTransform: "uppercase",
                                                                                    fontSize: "12px",
                                                                                    borderBottom: "2px solid #cbd5e1",

                                                                                    textAlign:
                                                                                        ["debit_amount", "credit_amount"].includes(col.key)
                                                                                            ? "right"
                                                                                            : "left",

                                                                                    minWidth:
                                                                                        ["debit_amount", "credit_amount"].includes(col.key)
                                                                                            ? 120
                                                                                            : col.key === "transaction_type"
                                                                                                ? 140
                                                                                                : col.key === "remarks"
                                                                                                    ? 300
                                                                                                    : 150,

                                                                                    maxWidth:
                                                                                        col.key === "remarks"
                                                                                            ? 300
                                                                                            : "none",

                                                                                    whiteSpace:
                                                                                        col.key === "remarks"
                                                                                            ? "normal"
                                                                                            : "nowrap",

                                                                                    wordBreak:
                                                                                        col.key === "remarks"
                                                                                            ? "break-word"
                                                                                            : "normal",

                                                                                    background: "#f8fafc",
                                                                                }}
                                                                            >
                                                                                {col.label}
                                                                            </TableCell>
                                                                        ))}
                                                                    </TableRow>
                                                                </TableHead>

                                                                {/* TABLE BODY */}
                                                                <TableBody>
                                                                    {sub.ledgers.map((row: any, index: number) => (
                                                                        <TableRow
                                                                            key={`${row.pay_id}-${index}`}
                                                                            hover
                                                                        >
                                                                            {/* S.NO */}
                                                                            <TableCell
                                                                                sx={{
                                                                                    textAlign: "center",
                                                                                    minWidth: 80,
                                                                                    width: 80,
                                                                                }}
                                                                            >
                                                                                {index + 1}
                                                                            </TableCell>

                                                                            {enabledCols.map((col) => (
                                                                                <TableCell
                                                                                    key={col.key}
                                                                                    sx={{
                                                                                        textAlign:
                                                                                            ["debit_amount", "credit_amount"].includes(col.key)
                                                                                                ? "right"
                                                                                                : "left",

                                                                                        minWidth:
                                                                                            ["debit_amount", "credit_amount"].includes(col.key)
                                                                                                ? 180
                                                                                                : col.key === "transaction_type"
                                                                                                    ? 180
                                                                                                    : col.key === "remarks"
                                                                                                        ? 350
                                                                                                        : 160,

                                                                                        maxWidth:
                                                                                            col.key === "remarks"
                                                                                                ? 300
                                                                                                : "none",

                                                                                        whiteSpace:
                                                                                            col.key === "remarks"
                                                                                                ? "normal"
                                                                                                : "nowrap",

                                                                                        wordBreak:
                                                                                            col.key === "remarks"
                                                                                                ? "break-word"
                                                                                                : "normal",
                                                                                    }}
                                                                                >
                                                                                    {col.key === "debit_amount"
                                                                                        ? row.entryType === "DR"
                                                                                            ? <>{renderFormattedAmount(row.amount)} DR</>
                                                                                            : ""

                                                                                        : col.key === "credit_amount"
                                                                                            ? row.entryType === "CR"
                                                                                                ? <>{renderFormattedAmount(row.amount)} CR</>
                                                                                                : ""

                                                                                            : col.key === "payment_date"
                                                                                                ? dayjs(row[col.key]).format(
                                                                                                    "DD-MM-YYYY"
                                                                                                )
                                                                                                : row[col.key]}
                                                                                </TableCell>
                                                                            ))}
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </TableContainer>
                                                    )}

                                                </Box>
                                            );
                                        })}

                                    </Box>
                                );
                            })}

                            {/* LOADING */}
                            {loading && (
                                <Box textAlign="center" mt={2}>
                                    <CircularProgress size={25} />
                                </Box>
                            )}
                        </Box>
                    )}

                </Box>
            </AppLayout>

            {/* COLUMN SETTINGS */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
            >
                <Box p={2} minWidth={300}>

                    {/* HEADER */}
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography fontWeight={600}>Column Settings</Typography>

                        <Button
                            size="small"
                            onClick={() => {
                                setColumns(cols =>
                                    cols.map((c, i) => ({
                                        ...c,
                                        enabled: DEFAULT_ENABLED.includes(c.key),
                                        order: i
                                    }))
                                );
                            }}
                        >
                            Reset
                        </Button>
                    </Box>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >

                        {/* ENABLED */}
                        <Typography fontSize="0.7rem" fontWeight={600} mb={0.5}>
                            Enabled Columns
                        </Typography>

                        <SortableContext
                            items={sortedColumns.filter(c => c.enabled).map(c => c.key)}
                            strategy={verticalListSortingStrategy}
                        >
                            {sortedColumns
                                .filter(c => c.enabled)
                                .map(c => (
                                    <SortRow
                                        key={c.key}
                                        col={c}
                                        toggle={(key: string) =>
                                            setColumns(cols =>
                                                cols.map(x =>
                                                    x.key === key
                                                        ? { ...x, enabled: false }
                                                        : x
                                                )
                                            )
                                        }
                                    />
                                ))}
                        </SortableContext>

                        {/* DISABLED */}
                        <Typography fontSize="0.7rem" fontWeight={600} mt={1} mb={0.5}>
                            Disabled Columns
                        </Typography>

                        <SortableContext
                            items={sortedColumns.filter(c => !c.enabled).map(c => c.key)}
                            strategy={verticalListSortingStrategy}
                        >
                            {sortedColumns
                                .filter(c => !c.enabled)
                                .map(c => (
                                    <SortRow
                                        key={c.key}
                                        col={c}
                                        toggle={(key: string) =>
                                            setColumns(cols =>
                                                cols.map(x =>
                                                    x.key === key
                                                        ? { ...x, enabled: true }
                                                        : x
                                                )
                                            )
                                        }
                                    />
                                ))}
                        </SortableContext>

                    </DndContext>
                </Box>
            </Menu>
        </>
    );
};

export default ExpensesReport;