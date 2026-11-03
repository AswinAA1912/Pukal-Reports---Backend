import React, { useState, useEffect } from "react";
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    CircularProgress,
    MenuItem,
    TextField,
} from "@mui/material";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { toast } from "react-toastify";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import { SalesDeliveryReportService, SalesDeliveryItem, GodownItem } from "../../services/salesDeliveryReport.service";

const getFunnelValue = (
    data: SalesDeliveryItem[],
    metricType: "Count" | "Tonnage",
    field: keyof Omit<SalesDeliveryItem, "Metric" | "ReportDate">
): string => {
    if (!data.length) return "-";
    const row = data.find((r) => r.Metric === metricType);
    if (!row) return "-";
    return String(row[field] ?? "-");
};

const groupDataByDate = (data: SalesDeliveryItem[]): { date: string; displayDate: string; rows: SalesDeliveryItem[] }[] => {
    const map = new Map<string, SalesDeliveryItem[]>();
    data.forEach(item => {
        const dateStr = item.ReportDate ? dayjs(item.ReportDate).format("YYYY-MM-DD") : "N/A";
        if (!map.has(dateStr)) {
            map.set(dateStr, []);
        }
        map.get(dateStr)!.push(item);
    });
    return Array.from(map.entries()).map(([date, rows]) => ({
        date,
        displayDate: date !== "N/A" ? dayjs(date).format("DD-MM-YYYY") : "N/A",
        rows
    }));
};

const SalesDeliveryReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const { toggleMode, setToggleMode } = useToggleMode();
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [data, setData] = useState<SalesDeliveryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [godowns, setGodowns] = useState<GodownItem[]>([]);
    const [selectedGodownId, setSelectedGodownId] = useState<string>("");
    const [filters, setFilters] = useState<{
        Date: { from: string; to: string };
        Godown_Id?: string;
    }>({
        Date: {
            from: today,
            to: today,
        },
        Godown_Id: "",
    });

    useEffect(() => {
        const loadGodowns = async () => {
            try {
                const res = await SalesDeliveryReportService.getGodowns();
                setGodowns(res.data.data || []);
            } catch (err) {
                console.error("Error loading godowns:", err);
            }
        };
        loadGodowns();
    }, []);

    useEffect(() => {
        loadData();
    }, [filters, toggleMode]);

    const loadData = async () => {
        try {
            setLoading(true);
            const fetchFn = toggleMode === "Expanded"
                ? SalesDeliveryReportService.getSalesDeliveryDaywise
                : SalesDeliveryReportService.getSalesDeliveryCumulative;

            const res = await fetchFn({
                Fromdate: filters.Date.from,
                Todate: filters.Date.to,
                Godown_Id: filters.Godown_Id || undefined,
            });
            setData(res.data.data || []);
        } catch (err: any) {
            console.error("Error loading sales delivery data:", err);
            toast.error(err?.response?.data?.message || "Failed to load report data ❌");
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const selectedGodown = godowns.find((g) => String(g.Godown_Id) === String(filters.Godown_Id));
    const godownSuffix = selectedGodown?.Godown_Name ? ` - ${selectedGodown.Godown_Name}` : "";

    // Excel Export
    const handleExportExcel = () => {
        try {
            if (!data.length) {
                toast.warning("No data to export");
                return;
            }

            const excelData: any[][] = [];
            
            if (toggleMode === "Expanded") {
                excelData.push([`SALES DELIVERY FUNNEL TRACKING - DAYWISE${godownSuffix}`]);
                excelData.push([]);
                excelData.push([
                    "Date",
                    "Sales Order",
                    "Sales Invoice",
                    "Printed",
                    "Taken",
                    "Check",
                    "Delivery",
                    "Dispatch",
                    "Shed Sheet",
                    "Metric"
                ]);

                const grouped = groupDataByDate(data);
                grouped.forEach(({ displayDate, rows }) => {
                    excelData.push([
                        displayDate,
                        getFunnelValue(rows, "Count", "SalesOrder"),
                        getFunnelValue(rows, "Count", "SalesInvoice"),
                        getFunnelValue(rows, "Count", "Printed"),
                        getFunnelValue(rows, "Count", "Taken"),
                        getFunnelValue(rows, "Count", "Check"),
                        getFunnelValue(rows, "Count", "Delivery"),
                        getFunnelValue(rows, "Count", "Dispatch"),
                        getFunnelValue(rows, "Count", "ShedSheet"),
                        "Count"
                    ]);
                    excelData.push([
                        displayDate,
                        getFunnelValue(rows, "Tonnage", "SalesOrder"),
                        getFunnelValue(rows, "Tonnage", "SalesInvoice"),
                        getFunnelValue(rows, "Tonnage", "Printed"),
                        getFunnelValue(rows, "Tonnage", "Taken"),
                        getFunnelValue(rows, "Tonnage", "Check"),
                        getFunnelValue(rows, "Tonnage", "Delivery"),
                        getFunnelValue(rows, "Tonnage", "Dispatch"),
                        getFunnelValue(rows, "Tonnage", "ShedSheet"),
                        "Tonnage"
                    ]);
                });
            } else {
                excelData.push([`SALES DELIVERY FUNNEL TRACKING${godownSuffix}`]);
                excelData.push([]);
                excelData.push([
                    "Sales Order",
                    "Sales Invoice",
                    "Printed",
                    "Taken",
                    "Check",
                    "Delivery",
                    "Dispatch",
                    "Shed Sheet",
                    "Metric"
                ]);

                excelData.push([
                    getFunnelValue(data, "Count", "SalesOrder"),
                    getFunnelValue(data, "Count", "SalesInvoice"),
                    getFunnelValue(data, "Count", "Printed"),
                    getFunnelValue(data, "Count", "Taken"),
                    getFunnelValue(data, "Count", "Check"),
                    getFunnelValue(data, "Count", "Delivery"),
                    getFunnelValue(data, "Count", "Dispatch"),
                    getFunnelValue(data, "Count", "ShedSheet"),
                    "Count"
                ]);

                excelData.push([
                    getFunnelValue(data, "Tonnage", "SalesOrder"),
                    getFunnelValue(data, "Tonnage", "SalesInvoice"),
                    getFunnelValue(data, "Tonnage", "Printed"),
                    getFunnelValue(data, "Tonnage", "Taken"),
                    getFunnelValue(data, "Tonnage", "Check"),
                    getFunnelValue(data, "Tonnage", "Delivery"),
                    getFunnelValue(data, "Tonnage", "Dispatch"),
                    getFunnelValue(data, "Tonnage", "ShedSheet"),
                    "Tonnage"
                ]);
            }

            const ws = XLSX.utils.aoa_to_sheet(excelData);

            // Styling excel cells
            if (ws && ws["!ref"]) {
                const range = XLSX.utils.decode_range(ws["!ref"]);
                const borderStyle = {
                    top: { style: "thin", color: { rgb: "CFCFCF" } },
                    bottom: { style: "thin", color: { rgb: "CFCFCF" } },
                    left: { style: "thin", color: { rgb: "CFCFCF" } },
                    right: { style: "thin", color: { rgb: "CFCFCF" } }
                };

                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                        if (!cell) continue;

                        cell.s = {
                            font: { name: "Arial", sz: 10 },
                            border: borderStyle
                        };

                        // Main Title Row
                        if (R === 0) {
                            cell.s.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFF" } };
                            cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                            cell.s.alignment = { horizontal: "center" };
                        }
                        // Header Row
                        else if (R === 2) {
                            cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
                            cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                        }
                        // Data Row styling
                        else if (R > 2) {
                            const isMetricCol = toggleMode === "Expanded" ? C === 9 : C === 8;
                            const isDateCol = toggleMode === "Expanded" && C === 0;
                            cell.s.font = { name: "Arial", sz: 10, bold: true };
                            
                            if (isMetricCol) {
                                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "1E3A8A" } };
                                cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
                            } else if (isDateCol) {
                                cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "1E293B" } };
                                cell.s.fill = { fgColor: { rgb: "F8FAFC" } };
                            } else {
                                cell.s.fill = { fgColor: { rgb: "FFE5D9" } }; // Soft peach background
                            }
                        }
                    }
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "SalesDelivery");
            XLSX.writeFile(wb, `SalesDelivery_${toggleMode}_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
            toast.success("Excel Exported ✅");
        } catch (err) {
            console.error(err);
            toast.error("Excel Export Failed ❌");
        }
    };

    // PDF Export
    const handleExportPDF = () => {
        try {
            if (!data.length) {
                toast.warning("No data to export");
                return;
            }

            const doc = new jsPDF("landscape", "mm", "a4");
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            
            const title = toggleMode === "Expanded" 
                ? `SALES DELIVERY FUNNEL TRACKING DAYWISE REPORT${godownSuffix}` 
                : `SALES DELIVERY FUNNEL TRACKING REPORT${godownSuffix}`;
            doc.text(title, 148, 15, { align: "center" });

            let funnelHead: string[][];
            let funnelBody: string[][];

            if (toggleMode === "Expanded") {
                funnelHead = [["Date", "Sales Order", "Sales Invoice", "Printed", "Taken", "Check", "Delivery", "Dispatch", "Shed Sheet", "Metric"]];
                funnelBody = [];
                const grouped = groupDataByDate(data);
                grouped.forEach(({ displayDate, rows }) => {
                    funnelBody.push([
                        displayDate,
                        getFunnelValue(rows, "Count", "SalesOrder"),
                        getFunnelValue(rows, "Count", "SalesInvoice"),
                        getFunnelValue(rows, "Count", "Printed"),
                        getFunnelValue(rows, "Count", "Taken"),
                        getFunnelValue(rows, "Count", "Check"),
                        getFunnelValue(rows, "Count", "Delivery"),
                        getFunnelValue(rows, "Count", "Dispatch"),
                        getFunnelValue(rows, "Count", "ShedSheet"),
                        "Count"
                    ]);
                    funnelBody.push([
                        displayDate,
                        getFunnelValue(rows, "Tonnage", "SalesOrder"),
                        getFunnelValue(rows, "Tonnage", "SalesInvoice"),
                        getFunnelValue(rows, "Tonnage", "Printed"),
                        getFunnelValue(rows, "Tonnage", "Taken"),
                        getFunnelValue(rows, "Tonnage", "Check"),
                        getFunnelValue(rows, "Tonnage", "Delivery"),
                        getFunnelValue(rows, "Tonnage", "Dispatch"),
                        getFunnelValue(rows, "Tonnage", "ShedSheet"),
                        "Tonnage"
                    ]);
                });
            } else {
                funnelHead = [["Sales Order", "Sales Invoice", "Printed", "Taken", "Check", "Delivery", "Dispatch", "Shed Sheet", "Metric"]];
                funnelBody = [
                    [
                        getFunnelValue(data, "Count", "SalesOrder"),
                        getFunnelValue(data, "Count", "SalesInvoice"),
                        getFunnelValue(data, "Count", "Printed"),
                        getFunnelValue(data, "Count", "Taken"),
                        getFunnelValue(data, "Count", "Check"),
                        getFunnelValue(data, "Count", "Delivery"),
                        getFunnelValue(data, "Count", "Dispatch"),
                        getFunnelValue(data, "Count", "ShedSheet"),
                        "Count"
                    ],
                    [
                        getFunnelValue(data, "Tonnage", "SalesOrder"),
                        getFunnelValue(data, "Tonnage", "SalesInvoice"),
                        getFunnelValue(data, "Tonnage", "Printed"),
                        getFunnelValue(data, "Tonnage", "Taken"),
                        getFunnelValue(data, "Tonnage", "Check"),
                        getFunnelValue(data, "Tonnage", "Delivery"),
                        getFunnelValue(data, "Tonnage", "Dispatch"),
                        getFunnelValue(data, "Tonnage", "ShedSheet"),
                        "Tonnage"
                    ]
                ];
            }

            autoTable(doc, {
                startY: 25,
                head: funnelHead,
                body: funnelBody,
                theme: "grid",
                headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
                bodyStyles: { fontStyle: "bold" },
                styles: { fontSize: 9, cellPadding: 2.5 },
                didParseCell: (cellData) => {
                    const metricColIndex = toggleMode === "Expanded" ? 9 : 8;
                    const dateColIndex = toggleMode === "Expanded" ? 0 : -1;
                    
                    if (cellData.column.index === metricColIndex) {
                        cellData.cell.styles.fillColor = [241, 245, 249];
                        cellData.cell.styles.textColor = [30, 58, 138];
                    } else if (cellData.column.index === dateColIndex) {
                        cellData.cell.styles.fillColor = [248, 250, 252];
                        cellData.cell.styles.textColor = [30, 41, 59];
                    } else {
                        cellData.cell.styles.fillColor = [255, 229, 204]; // soft peach background
                    }
                }
            });

            doc.save(`SalesDelivery_${toggleMode}_Report_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
            toast.success("PDF Exported ✅");
        } catch (err) {
            console.error(err);
            toast.error("PDF Export Failed ❌");
        }
    };

    return (
        <>
            <PageHeader
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                showPages={true}
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((prev) => !prev)}
                onClose={() => setDrawerOpen(false)}
                fromDate={fromDate}
                onFromDateChange={setFromDate}
                toDate={toDate}
                onToDateChange={setToDate}
                onApply={() => {
                    setFilters({
                        Date: { from: fromDate, to: toDate },
                        Godown_Id: selectedGodownId,
                    });
                    setDrawerOpen(false);
                }}
            >
                <TextField
                    select
                    label="Godown"
                    fullWidth
                    value={selectedGodownId}
                    onChange={(e) => setSelectedGodownId(e.target.value)}
                    sx={{ mb: 2 }}
                >
                    <MenuItem value="">All</MenuItem>
                    {godowns.map((g) => (
                        <MenuItem key={g.Godown_Id} value={g.Godown_Id}>
                            {g.Godown_Name || "Unnamed Godown"}
                        </MenuItem>
                    ))}
                </TextField>
            </ReportFilterDrawer>

            <AppLayout fullWidth>
                <Box px={3} pb={4} pt={4}>
                    <Typography variant="subtitle1" fontWeight="bold" color="#1e3a8a" mb={2} sx={{ letterSpacing: 0.5 }}>
                        {toggleMode === "Expanded" ? `SALES DELIVERY FUNNEL TRACKING - DAYWISE${godownSuffix}` : `SALES DELIVERY FUNNEL TRACKING${godownSuffix}`}
                    </Typography>

                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                            <CircularProgress size={40} />
                        </Box>
                    ) : (
                        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, border: "1px solid #e2e8f0" }}>
                            <Table size="medium">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "#1E3A8A" }}>
                                        {toggleMode === "Expanded" && (
                                            <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }} align="center">Date</TableCell>
                                        )}
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Sales Order</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Sales Invoice</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Printed</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Taken</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Check</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Delivery</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Dispatch</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, borderRight: "1px solid #2448b2", fontSize: "0.9rem" }}>Shed Sheet</TableCell>
                                        <TableCell sx={{ color: "#ffffff", fontWeight: 700, py: 1.5, bgcolor: "#172d6c", width: "120px", fontSize: "0.9rem" }} align="center">Metric</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.length > 0 ? (
                                        toggleMode === "Expanded" ? (
                                            groupDataByDate(data).map(({ date, displayDate, rows }, idx) => (
                                                <React.Fragment key={date}>
                                                    {/* COUNT ROW */}
                                                    <TableRow sx={{ "&:hover": { bgcolor: "#ecedeeff" }, borderTop: idx > 0 ? "2px solid #cbd5e1" : "none" }}>
                                                        <TableCell rowSpan={2} sx={{ fontWeight: 750, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem", bgcolor: "#f8fafc", whiteSpace: "nowrap" }} align="center">
                                                            {displayDate}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "SalesOrder")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "SalesInvoice")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "Printed")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "Taken")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "Check")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "Delivery")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "Dispatch")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Count", "ShedSheet")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 800, py: 2, bgcolor: "#f1f5f9", color: "#1e3a8a", fontSize: "0.85rem" }} align="center">
                                                            Count
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* TONNAGE ROW */}
                                                    <TableRow sx={{ "&:hover": { bgcolor: "#ecedeeff" } }}>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "SalesOrder")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "SalesInvoice")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "Printed")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "Taken")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "Check")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "Delivery")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "Dispatch")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                            {getFunnelValue(rows, "Tonnage", "ShedSheet")}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 800, py: 2, bgcolor: "#f1f5f9", color: "#1e3a8a", fontSize: "0.85rem" }} align="center">
                                                            Tonnage
                                                        </TableCell>
                                                    </TableRow>
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            <>
                                                {/* COUNT ROW */}
                                                <TableRow sx={{ "&:hover": { bgcolor: "#ecedeeff" } }}>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "SalesOrder")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "SalesInvoice")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "Printed")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "Taken")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "Check")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "Delivery")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "Dispatch")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Count", "ShedSheet")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 800, py: 2, bgcolor: "#f1f5f9", color: "#1e3a8a", fontSize: "0.85rem" }} align="center">
                                                        Count
                                                    </TableCell>
                                                </TableRow>

                                                {/* TONNAGE ROW */}
                                                <TableRow sx={{ "&:hover": { bgcolor: "#ecedeeff" } }}>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "SalesOrder")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "SalesInvoice")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "Printed")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "Taken")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "Check")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "Delivery")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "Dispatch")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700, borderRight: "1px solid #e2e8f0", py: 2, color: "#1e293b", fontSize: "0.85rem" }}>
                                                        {getFunnelValue(data, "Tonnage", "ShedSheet")}
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 800, py: 2, bgcolor: "#f1f5f9", color: "#1e3a8a", fontSize: "0.85rem" }} align="center">
                                                        Tonnage
                                                    </TableCell>
                                                </TableRow>
                                            </>
                                        )
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={toggleMode === "Expanded" ? 10 : 9} align="center" sx={{ py: 6, color: "text.secondary" }}>
                                                No records found
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </AppLayout>
        </>
    );
};

export default SalesDeliveryReport;
