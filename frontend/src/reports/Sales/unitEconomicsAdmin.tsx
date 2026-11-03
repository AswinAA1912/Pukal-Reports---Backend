import React, { useEffect, useState, useMemo } from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Menu,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Slider,
    Typography,
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import SyncIcon from "@mui/icons-material/Sync";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import CommonPagination from "../../Components/CommonPagination";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import { mapForExport } from "../../utils/exportMapper";
import {
    AdminUnitEconomicsReportService,
    AdminUnitEconomicsReport,
} from "../../services/unitEconomicsReport.service";


/* ================= STYLES ================= */
const headStyle = {
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.75rem",
    cursor: "pointer",
};

const bodyStyle = {
    fontSize: "0.68rem",
};

const UnitEconomicsAdmin: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const [data, setData] = useState<AdminUnitEconomicsReport[]>([]);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    /* -------- FILTERS -------- */
    const [filters, setFilters] = useState<{
        Date: { from: string; to: string };
        Product?: string[];
        invoice_no?: string[];
        Retailer_Name?: string[];
    }>({
        Date: { from: today, to: today },
        Product: undefined,
        invoice_no: undefined,
        Retailer_Name: undefined,
    });

    const [tempDate, setTempDate] = useState(filters.Date);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [rateType, setRateType] = useState<"cogs" | "min">("cogs");

    /* -------- HEADER FILTER -------- */
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);


    /* -------- SUMMARY -------- */
    const [summaryColumn, setSummaryColumn] = useState<keyof AdminUnitEconomicsReport | null>(null);

    /* -------- SORTING -------- */
    const [sortConfig, setSortConfig] = useState<{
        key: keyof AdminUnitEconomicsReport;
        direction: "asc" | "desc";
    } | null>(null);

    /* -------- RANGE FILTER -------- */
    const [rangeFilter, setRangeFilter] = useState<Record<string, [number, number]>>({});

    const isNumericColumn = (key: string) => {
        return [
            "Bill_Qty",
            "Rate",
            "Amount",
            "Min_Rate",
            "COGS_Rate",
            "GP_MR",
            "GP_COGS",
            "TGP_MR",
            "TGP_COGS",
            "GP_Percentage_MR",
            "GP_Percentage_COGS"
        ].includes(key);
    };

    const getMinMax = (key: string) => {
        const nums = rawApiData
            .map((r) => Number(r[key as keyof AdminUnitEconomicsReport]))
            .filter((v) => !isNaN(v));
        if (nums.length === 0) return { min: 0, max: 100 };
        const minVal = Math.min(...nums);
        const maxVal = Math.max(...nums);
        return {
            min: minVal,
            max: minVal === maxVal ? minVal + 1 : maxVal,
        };
    };

    const handleSort = (columnKey: keyof AdminUnitEconomicsReport) => {
        setSortConfig((prev) => {
            if (prev && prev.key === columnKey) {
                return {
                    key: columnKey,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                };
            }
            return {
                key: columnKey,
                direction: "asc",
            };
        });
    };

    const renderHeader = (label: string, key: keyof AdminUnitEconomicsReport) => {
        const isActive = sortConfig?.key === key;
        const direction = sortConfig?.direction;

        return (
            <Box
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    width: "100%",
                }}
            >
                <span onClick={(e) => { e.stopPropagation(); openFilter(e, key); }} style={{ cursor: "pointer" }}>{label}</span>
                <Box
                    component="span"
                    onClick={(e) => { e.stopPropagation(); handleSort(key); }}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        marginLeft: 0.5,
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        opacity: isActive ? 1 : 0.2,
                        transition: "opacity 0.2s",
                        "th:hover &": {
                            opacity: isActive ? 1 : 0.6,
                        }
                    }}
                >
                    {isActive ? (
                        direction === "asc" ? (
                            <ArrowUpwardIcon sx={{ fontSize: "0.95rem" }} />
                        ) : (
                            <ArrowDownwardIcon sx={{ fontSize: "0.95rem" }} />
                        )
                    ) : (
                        <ArrowUpwardIcon sx={{ fontSize: "0.95rem" }} />
                    )}
                </Box>
            </Box>
        );
    };

    /* -------- SYNC DIALOG STATE -------- */
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);
    const [syncFromDate, setSyncFromDate] = useState(today);
    const [syncToDate, setSyncToDate] = useState(today);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleOpenSyncDialog = () => {
        setSyncFromDate(filters.Date.from);
        setSyncToDate(filters.Date.to);
        setSyncDialogOpen(true);
    };

    const handleSync = async () => {
        try {
            setIsSyncing(true);
            const res = await AdminUnitEconomicsReportService.syncReports({
                Fromdate: syncFromDate,
                Todate: syncToDate,
            });

            if (res.data?.success || res.status === 200) {
                toast.success("synced successfully");
                setSyncDialogOpen(false);

                // Set the page filters to the synced dates, triggering a reload
                setFilters((prev) => ({
                    ...prev,
                    Date: { from: syncFromDate, to: syncToDate }
                }));
                setFromDate(syncFromDate);
                setToDate(syncToDate);
                setTempDate({ from: syncFromDate, to: syncToDate });
            } else {
                toast.error("Sync failed ❌");
            }
        } catch (error: any) {
            console.error("Sync error", error);
            toast.error(error.response?.data?.message || "Sync failed ❌");
        } finally {
            setIsSyncing(false);
        }
    };

    const exportColumns = useMemo(() => {
        const baseCols = [
            { label: "S.No", key: "sno" },
            { label: "Invoice No", key: "invoice_no" },
            { label: "Date", key: "Ledger_Date", type: "date" },
            { label: "Retailer Name", key: "Retailer_Name" },
            { label: "Product Name", key: "Product_Name" },
            { label: "Quantity", key: "Bill_Qty", type: "number" },
            { label: "Rate", key: "Rate", type: "number" },
            { label: "Amount", key: "Amount", type: "number" },
        ];

        if (rateType === "cogs") {
            return [
                ...baseCols,
                { label: "COGS Rate", key: "COGS_Rate", type: "number" },
                { label: "GP COGS", key: "GP_COGS", type: "number" },
                { label: "TGP COGS", key: "TGP_COGS", type: "number" },
                { label: "GP % COGS", key: "GP_Percentage_COGS", type: "number" },
            ];
        } else {
            return [
                ...baseCols,
                { label: "MR Rate", key: "Min_Rate", type: "number" },
                { label: "GP MR", key: "GP_MR", type: "number" },
                { label: "TGP MR", key: "TGP_MR", type: "number" },
                { label: "GP % MR", key: "GP_Percentage_MR", type: "number" },
            ];
        }
    }, [rateType]);

    /* ================= LOAD DATA ================= */
    const [rawApiData, setRawApiData] = useState<AdminUnitEconomicsReport[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const res = await AdminUnitEconomicsReportService.getReports({
                Fromdate: filters.Date.from,
                Todate: filters.Date.to,
            });

            const responseData = res.data.data;
            let rows: AdminUnitEconomicsReport[] = responseData.rows || [];
            setRawApiData(rows);
            setPage(1);
            setSummaryColumn(null);
        };

        loadData();
    }, [filters.Date]);

    useEffect(() => {
        let rows = [...rawApiData];
        if (filters.Product !== undefined) {
            rows = rows.filter((r) => filters.Product!.includes(r.Product_Name));
        }
        if (filters.invoice_no !== undefined) {
            rows = rows.filter((r) => filters.invoice_no!.includes(r.invoice_no));
        }
        if (filters.Retailer_Name !== undefined) {
            rows = rows.filter((r) => filters.Retailer_Name!.includes(r.Retailer_Name));
        }
        // Apply Range Filter
        if (rangeFilter) {
            for (const [key, range] of Object.entries(rangeFilter)) {
                rows = rows.filter((r) => {
                    const val = Number(r[key as keyof AdminUnitEconomicsReport]);
                    return isNaN(val) || (val >= range[0] && val <= range[1]);
                });
            }
        }
        if (sortConfig) {
            const { key, direction } = sortConfig;
            rows.sort((a, b) => {
                const valA = Number(a[key]) || 0;
                const valB = Number(b[key]) || 0;
                return direction === "asc" ? valA - valB : valB - valA;
            });
        }
        setData(rows);
        setPage(1);
    }, [rawApiData, filters.Product, filters.invoice_no, filters.Retailer_Name, sortConfig, rangeFilter]);

    /* ================= PAGINATION ================= */
    const paginatedData = data.slice(
        (page - 1) * rowsPerPage,
        page * rowsPerPage
    );

    /* ================= DROPDOWNS ================= */
    const products = useMemo(
        () =>
            [...new Set(rawApiData.map((d) => d.Product_Name))]
                .filter(Boolean),
        [rawApiData]
    );

    const invoiceNos = useMemo(
        () =>
            [...new Set(rawApiData.map((d) => d.invoice_no))]
                .filter(Boolean),
        [rawApiData]
    );

    const retailerNames = useMemo(
        () =>
            [...new Set(rawApiData.map((d) => d.Retailer_Name))]
                .filter(Boolean),
        [rawApiData]
    );

    /* ================= SUMMARY ================= */
    const getTotal = (key: keyof AdminUnitEconomicsReport) => {
        return data.reduce((sum, r) => sum + (Number(r[key]) || 0), 0);
    };

    /* ================= HEADER CLICK ================= */
    const openFilter = (e: React.MouseEvent<HTMLElement>, column: string) => {
        setActiveHeader(column);
        setFilterAnchor(e.currentTarget);

        if (["Bill_Qty", "Rate", "Amount", "Min_Rate", "COGS_Rate", "GP_MR", "GP_COGS", "TGP_MR", "TGP_COGS", "GP_Percentage_MR", "GP_Percentage_COGS"].includes(column)) {
            if (summaryColumn === column) {
                setSummaryColumn(null);
            } else {
                setSummaryColumn(column as keyof AdminUnitEconomicsReport);
            }
        }
    };

    useEffect(() => {
        setSummaryColumn(null);
        setRangeFilter({});
    }, [filters.Date, filters.Product, filters.invoice_no, filters.Retailer_Name]);



    /* ================= EXPORT ================= */
    const handleExportPDF = () => {
        const { headers, data: exportData } = mapForExport(exportColumns, data);
        exportToPDF("Unit Economics Report", headers, exportData);
    };

    const handleExportExcel = () => {
        const { headers, data: exportData } = mapForExport(exportColumns, data);
        exportToExcel("Unit Economics Report", headers, exportData);
    };

    const formatINR = (value: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(value);
    };


    /* ================= RENDER ================= */
    return (
        <>
            <PageHeader
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
                infoSlot={
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<SyncIcon />}
                        onClick={handleOpenSyncDialog}
                        sx={{
                            height: 24,
                            fontSize: "0.7rem",
                            backgroundColor: "#fff",
                            color: "#1E3A8A",
                            fontWeight: 600,
                            textTransform: "none",
                            "&:hover": {
                                backgroundColor: "#f5f5f5",
                            },
                        }}
                    >
                        Sync
                    </Button>
                }
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((p) => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                showRateTypeFilter={true}
                rateTypeValue={rateType}
                onRateTypeChange={setRateType}
                onApply={() => {
                    setFilters((prev) => ({
                        ...prev,
                        Date: { from: fromDate, to: toDate }
                    }));
                }}
            />

            <AppLayout fullWidth >
                <Box sx={{ overflow: "auto", mt: 0.5 }}>
                    <TableContainer
                        component={Paper}
                        sx={{
                            position: 'relative',
                            maxHeight: "calc(100vh - 100px)",
                            overflow: "auto"
                        }}
                    >
                        <Table size="small">
                            {/* ===== FIXED HEADER ===== */}
                            <TableHead sx={{
                                background: "#1E3A8A",
                                position: "sticky",
                                top: 0,
                                zIndex: 2
                            }}>
                                <TableRow>
                                    <TableCell sx={headStyle}>S.No</TableCell>
                                    <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Invoice No")}>Invoice No</TableCell>
                                    <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Date")}>Date</TableCell>
                                    <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Retailer Name")}>Retailer Name</TableCell>
                                    <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Product")}>Product</TableCell>
                                    <TableCell align="right" sx={headStyle} onClick={() => handleSort("Bill_Qty")}>
                                        {renderHeader("Quantity", "Bill_Qty")}
                                    </TableCell>
                                    <TableCell align="right" sx={headStyle} onClick={() => handleSort("Rate")}>
                                        {renderHeader("Rate", "Rate")}
                                    </TableCell>
                                    <TableCell align="right" sx={headStyle} onClick={() => handleSort("Amount")}>
                                        {renderHeader("Amount", "Amount")}
                                    </TableCell>
                                    {rateType === "cogs" ? (
                                        <>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("COGS_Rate")}>
                                                {renderHeader("COGS Rate", "COGS_Rate")}
                                            </TableCell>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("GP_COGS")}>
                                                {renderHeader("GP COGS", "GP_COGS")}
                                            </TableCell>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("TGP_COGS")}>
                                                {renderHeader("TGP COGS", "TGP_COGS")}
                                            </TableCell>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("GP_Percentage_COGS")}>
                                                {renderHeader("GP % COGS", "GP_Percentage_COGS")}
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("Min_Rate")}>
                                                {renderHeader("MR Rate", "Min_Rate")}
                                            </TableCell>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("GP_MR")}>
                                                {renderHeader("GP MR", "GP_MR")}
                                            </TableCell>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("TGP_MR")}>
                                                {renderHeader("TGP MR", "TGP_MR")}
                                            </TableCell>
                                            <TableCell align="right" sx={headStyle} onClick={() => handleSort("GP_Percentage_MR")}>
                                                {renderHeader("GP % MR", "GP_Percentage_MR")}
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                                <TableRow
                                    sx={{
                                        background: "#f3f4f6",
                                        "& .MuiTableCell-root": {
                                            backgroundColor: "#f3f4f6",
                                            color: "#374151",
                                        }
                                    }}
                                >
                                    {/* S.No */}
                                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>

                                    {/* Invoice No */}
                                    <TableCell />

                                    {/* Date */}
                                    <TableCell />

                                    {/* Retailer Name */}
                                    <TableCell />

                                    {/* Product */}
                                    <TableCell />

                                    {/* Quantity */}
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {getTotal("Bill_Qty").toFixed(2)}
                                    </TableCell>

                                    {/* Rate (empty) */}
                                    <TableCell />

                                    {/* Amount */}
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        {formatINR(getTotal("Amount"))}
                                    </TableCell>

                                    {rateType === "cogs" ? (
                                        <>
                                            {/* COGS Rate (empty) */}
                                            <TableCell />
                                            {/* GP COGS (empty) */}
                                            <TableCell />
                                            {/* TGP COGS */}
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                {formatINR(getTotal("TGP_COGS"))}
                                            </TableCell>
                                            {/* GP % COGS (empty) */}
                                            <TableCell />
                                        </>
                                    ) : (
                                        <>
                                            {/* MR Rate (empty) */}
                                            <TableCell />
                                            {/* GP MR (empty) */}
                                            <TableCell />
                                            {/* TGP MR */}
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                                                {formatINR(getTotal("TGP_MR"))}
                                            </TableCell>
                                            {/* GP % MR (empty) */}
                                            <TableCell />
                                        </>
                                    )}
                                </TableRow>
                            </TableHead>

                            {/* ===== BODY ===== */}
                            <TableBody>
                                {paginatedData.map((row, i) => (
                                    <TableRow key={`${row.invoice_no}-${i}`}>
                                        <TableCell sx={bodyStyle}>
                                            {(page - 1) * rowsPerPage + i + 1}
                                        </TableCell>
                                        <TableCell sx={bodyStyle}>{row.invoice_no}</TableCell>
                                        <TableCell sx={bodyStyle}>
                                            {dayjs(row.Ledger_Date).format("DD/MM/YYYY")}
                                        </TableCell>
                                        <TableCell sx={bodyStyle}>{row.Retailer_Name}</TableCell>
                                        <TableCell sx={bodyStyle}>{row.Product_Name}</TableCell>
                                        <TableCell align="right" sx={bodyStyle}>{Number(row.Bill_Qty).toFixed(2)}</TableCell>
                                        <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.Rate))}</TableCell>
                                        <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.Amount))}</TableCell>
                                        {rateType === "cogs" ? (
                                            <>
                                                <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.COGS_Rate))}</TableCell>
                                                <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.GP_COGS))}</TableCell>
                                                <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.TGP_COGS))}</TableCell>
                                                <TableCell align="right" sx={bodyStyle}>{Number(row.GP_Percentage_COGS).toFixed(2)}%</TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.Min_Rate))}</TableCell>
                                                <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.GP_MR))}</TableCell>
                                                <TableCell align="right" sx={bodyStyle}>{formatINR(Number(row.TGP_MR))}</TableCell>
                                                <TableCell align="right" sx={bodyStyle}>{Number(row.GP_Percentage_MR).toFixed(2)}%</TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Categorical / Date Filter Menu */}
                    <HeaderFilterMenu
                        anchorEl={filterAnchor}
                        open={Boolean(filterAnchor) && Boolean(activeHeader) && !isNumericColumn(activeHeader!)}
                        onClose={() => setFilterAnchor(null)}
                        columnLabel={activeHeader || undefined}
                        options={
                            activeHeader === "Product"
                                ? products
                                : activeHeader === "Invoice No"
                                ? invoiceNos
                                : activeHeader === "Retailer Name"
                                ? retailerNames
                                : []
                        }
                        selectedValues={
                            activeHeader === "Product"
                                ? filters.Product
                                : activeHeader === "Invoice No"
                                ? filters.invoice_no
                                : activeHeader === "Retailer Name"
                                ? filters.Retailer_Name
                                : undefined
                        }
                        onFilterChange={(newSelected) => {
                            if (activeHeader === "Product") {
                                setFilters((p) => ({ ...p, Product: newSelected }));
                            } else if (activeHeader === "Invoice No") {
                                setFilters((p) => ({ ...p, invoice_no: newSelected }));
                            } else if (activeHeader === "Retailer Name") {
                                setFilters((p) => ({ ...p, Retailer_Name: newSelected }));
                            }
                            setPage(1);
                        }}
                        isDateColumn={activeHeader === "Date"}
                        dateFrom={tempDate.from}
                        dateTo={tempDate.to}
                        onDateChange={(dates) => setTempDate(dates)}
                        onApplyDate={() => {
                            setFilters((p) => ({ ...p, Date: tempDate }));
                            setFilterAnchor(null);
                        }}
                    />

                    {/* Numerical Filter Menu */}
                    <Menu
                        anchorEl={filterAnchor}
                        open={Boolean(filterAnchor) && Boolean(activeHeader) && isNumericColumn(activeHeader!)}
                        onClose={() => setFilterAnchor(null)}
                    >

                        {activeHeader && isNumericColumn(activeHeader) && (() => {
                            const { min, max } = getMinMax(activeHeader);
                            const currentRange = rangeFilter[activeHeader] || [min, max];

                            const handleSliderChange = (newValue: number[]) => {
                                setRangeFilter((prev) => ({
                                    ...prev,
                                    [activeHeader]: newValue as [number, number],
                                }));
                            };

                            const handleFromChange = (value: string) => {
                                let newFrom = Number(value);
                                if (isNaN(newFrom)) return;
                                newFrom = Math.max(min, Math.min(newFrom, currentRange[1]));
                                handleSliderChange([newFrom, currentRange[1]]);
                            };

                            const handleToChange = (value: string) => {
                                let newTo = Number(value);
                                if (isNaN(newTo)) return;
                                newTo = Math.min(max, Math.max(newTo, currentRange[0]));
                                handleSliderChange([currentRange[0], newTo]);
                            };

                            return (
                                <Box p={2} sx={{ minWidth: 250 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                                        Filter Range
                                    </Typography>
                                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                                        <TextField
                                            type="number"
                                            size="small"
                                            label="Min"
                                            value={currentRange[0]}
                                            onChange={(e) => handleFromChange(e.target.value)}
                                            inputProps={{ min, max: currentRange[1] }}
                                            sx={{
                                                width: 90,
                                                "& input": {
                                                    py: 0.5,
                                                    fontSize: "0.75rem",
                                                    textAlign: "center"
                                                }
                                            }}
                                        />
                                        <Typography fontSize={12}>—</Typography>
                                        <TextField
                                            type="number"
                                            size="small"
                                            label="Max"
                                            value={currentRange[1]}
                                            onChange={(e) => handleToChange(e.target.value)}
                                            inputProps={{ min: currentRange[0], max }}
                                            sx={{
                                                width: 90,
                                                "& input": {
                                                    py: 0.5,
                                                    fontSize: "0.75rem",
                                                    textAlign: "center"
                                                }
                                            }}
                                        />
                                    </Box>
                                    <Slider
                                        value={currentRange}
                                        min={min}
                                        max={max}
                                        step={0.01}
                                        size="small"
                                        onChange={(_, newValue) => handleSliderChange(newValue as number[])}
                                        valueLabelDisplay="auto"
                                        sx={{
                                            mb: 1.5,
                                            "& .MuiSlider-thumb": {
                                                width: 12,
                                                height: 12,
                                            }
                                        }}
                                    />
                                    <Box display="flex" justifyContent="space-between">
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setRangeFilter((prev) => {
                                                    const copy = { ...prev };
                                                    delete copy[activeHeader];
                                                    return copy;
                                                });
                                                setFilterAnchor(null);
                                            }}
                                            sx={{ textTransform: "none", color: "gray" }}
                                        >
                                            Clear
                                        </Button>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => setFilterAnchor(null)}
                                            sx={{
                                                backgroundColor: "#1E3A8A",
                                                textTransform: "none",
                                                fontWeight: 600,
                                            }}
                                        >
                                            Close
                                        </Button>
                                    </Box>
                                </Box>
                            );
                        })()}

                    </Menu>
                </Box>
                <CommonPagination
                    totalRows={data.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            </AppLayout>

            <Dialog
                open={syncDialogOpen}
                onClose={() => !isSyncing && setSyncDialogOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        minWidth: 320,
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 600, color: "#1E3A8A", pb: 1 }}>
                    Sync Unit Economics
                </DialogTitle>
                <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 2 }}>
                    <TextField
                        label="From Date"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={syncFromDate}
                        onChange={(e) => setSyncFromDate(e.target.value)}
                        fullWidth
                        disabled={isSyncing}
                        size="small"
                    />
                    <TextField
                        label="To Date"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={syncToDate}
                        onChange={(e) => setSyncToDate(e.target.value)}
                        fullWidth
                        disabled={isSyncing}
                        size="small"
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setSyncDialogOpen(false)}
                        disabled={isSyncing}
                        color="inherit"
                        size="small"
                        sx={{ textTransform: "none" }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSync}
                        variant="contained"
                        disabled={isSyncing}
                        size="small"
                        sx={{
                            backgroundColor: "#1E3A8A",
                            textTransform: "none",
                            "&:hover": {
                                backgroundColor: "#172E6D",
                            },
                        }}
                    >
                        {isSyncing ? <CircularProgress size={20} color="inherit" /> : "Sync"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default UnitEconomicsAdmin;
