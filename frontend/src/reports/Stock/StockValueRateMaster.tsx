import React, { useEffect, useMemo, useState } from "react";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Chip,
    Stack,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    FormLabel,
    Typography
} from "@mui/material";
import dayjs from "dayjs";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import PageHeader from "../../Layout/PageHeader";
import AppLayout from "../../Layout/appLayout";
import CommonPagination from "../../Components/CommonPagination";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import {
    stockValueReportService,
    PosRate,
    StockValue,
} from "../../services/stockValueRateMaster.service";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";

/* ================= COMPONENT ================= */

const StockValueRateMasterReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const [loading, setLoading] = useState(false);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<number>(1);

    const [columnFilters, setColumnFilters] = useState<Record<string, any>>({
        Ledger_Date: {
            from: today,
            to: today,
        },
    });

    const [posRates, setPosRates] = useState<PosRate[]>([]);
    const [stockValues, setStockValues] = useState<StockValue[]>([]);
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string>("All");

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    /* ================= LOAD DATA ================= */
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                const fromDate =
                    columnFilters?.Ledger_Date?.from || dayjs().format("YYYY-MM-DD");

                const [posRes, stockRes] = await Promise.all([
                    stockValueReportService.getPosRates({ FromDate: fromDate }),
                    stockValueReportService.getStockValues({ FromDate: fromDate }),
                ]);

                setPosRates(posRes.data?.data?.posRateMaster || []);
                setStockValues(stockRes.data?.data || []);
            } catch (err) {
                console.error("Error loading stock value report:", err);
                setPosRates([]);
                setStockValues([]);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [columnFilters["Ledger_Date"]]);

    /* ================= MERGE LOGIC ================= */
    const mergedData = useMemo(() => {
        const stockMap = new Map<string, number>();

        stockValues.forEach((s) => {
            stockMap.set(String(s.Product_Id), Number(s.CL_Rate));
        });

        const filteredRates = posRates.filter((p) => Number(p.Is_Active_Decative ?? 0) === activeFilter);

        return filteredRates.map((p) => {
            const clRate = stockMap.get(String(p.Item_Id)) || 0;

            return {
                POS_Brand_Name: p.POS_Brand_Name || "Others",
                Product_Name: p.Product_Name,
                Min_Rate: p.Min_Rate,
                Rate: p.Rate,
                CL_Rate: clRate,
            };
        });
    }, [posRates, stockValues, activeFilter]);

    // ****FILTER***** //

    const handleHeaderClick = (
        e: React.MouseEvent<HTMLElement>,
        columnKey: string
    ) => {
        setActiveHeader(columnKey);
        setFilterAnchor(e.currentTarget);
    };

    const applyFilters = (rows: any[]) => {
        return rows.filter((row) => {
            // ✅ PRODUCT NAME FILTER
            const selectedProducts = columnFilters.Product_Name;

            if (selectedProducts !== undefined) {
                if (!selectedProducts.includes(row.Product_Name)) {
                    return false;
                }
            }

            return true;
        });
    };

    /* ================= FILTERED DATA ================= */
    const filterProcessedData = useMemo(() => {
        let rows = applyFilters(mergedData);

        if (selectedBrand !== "All") {
            rows = rows.filter(
                (row) => row.POS_Brand_Name === selectedBrand
            );
        }
        return rows;
    }, [mergedData, columnFilters, selectedBrand]);

    const {
        sortConfig: numSortConfig,
        rangeFilter: numRangeFilter,
        setRangeFilter: setNumRangeFilter,
        filterAnchor: numFilterAnchor,
        setFilterAnchor: setNumFilterAnchor,
        activeHeader: numActiveHeader,
        handleSort: handleNumSort,
        openFilter: openNumFilter,
        filteredAndSortedData: numFilteredAndSortedRows,
        getMinMax,
        clearRangeFilter,
    } = useNumericalFilter(filterProcessedData, ["Min_Rate", "Rate", "CL_Rate"]);

    const filteredData = useMemo(() => {
        if (numSortConfig) {
            return numFilteredAndSortedRows;
        }

        return [...numFilteredAndSortedRows].sort((a, b) => {
            const brandA = a.POS_Brand_Name || "";
            const brandB = b.POS_Brand_Name || "";
            const brandCompare = brandA.localeCompare(brandB);
            if (brandCompare !== 0) return brandCompare;

            const nameA = a.Product_Name || "";
            const nameB = b.Product_Name || "";
            return nameA.localeCompare(nameB);
        });
    }, [numFilteredAndSortedRows, numSortConfig]);

    const formatINR = (value: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(value || 0);
    };

    /* ================= PAGINATION ================= */
    const totalRows = filteredData.length;

    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        return filteredData.slice(start, end);
    }, [filteredData, page, rowsPerPage]);

    useEffect(() => {
        setPage(1);
    }, [selectedBrand, columnFilters.Product_Name, rowsPerPage]);

    /* ================= BRAND LIST ================= */
    const brandOptions = useMemo(() => {
        const brands = [...new Set(mergedData.map((x) => x.POS_Brand_Name))]
            .filter(Boolean)
            .sort();

        return ["All", ...brands];
    }, [mergedData]);


    /* ================= EXPORT ================= */
    const handleExportPDF = () => {
        const headers = ["S.No", "Product Name", "Min Rate", "List Rate", "CL Rate"];

        const data: any[] = [];
        let sno = 1;

        filteredData.forEach((row, index) => {
            const prev = filteredData[index - 1];

            const showGroup =
                index === 0 ||
                prev?.POS_Brand_Name !== row.POS_Brand_Name;

            if (showGroup) {
                data.push([row.POS_Brand_Name, "", "", "", ""]);
            }

            data.push([
                sno++,
                row.Product_Name,
                formatINR(row.Min_Rate),
                formatINR(row.Rate),
                formatINR(row.CL_Rate),
            ]);
        });

        exportToPDF("Rate Master Report", headers, data);
    };

    const handleExportExcel = () => {
        const headers = ["S.No", "Product Name", "Min Rate", "List Rate", "CL Rate"];

        const data: any[] = [];
        let sno = 1;

        filteredData.forEach((row, index) => {
            const prev = filteredData[index - 1];

            const showGroup =
                index === 0 ||
                prev?.POS_Brand_Name !== row.POS_Brand_Name;

            if (showGroup) {
                data.push([row.POS_Brand_Name, "", "", "", ""]);
            }

            data.push([
                sno++,
                row.Product_Name,
                formatINR(row.Min_Rate),
                formatINR(row.Rate),
                formatINR(row.CL_Rate),
            ]);
        });

        exportToExcel("Rate Master Report", headers, data);
    };

    /* ================= UI ================= */
    return (
        <>
            {/* 🔥 CLEAN HEADER (EXPORT ONLY) */}
            <PageHeader
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((p) => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={columnFilters["Ledger_Date"]?.from || ""}
                onFromDateChange={(v) =>
                    setColumnFilters((prev) => ({
                        ...prev,
                        Ledger_Date: {
                            from: v,
                        },
                    }))
                }
                onApply={() => setDrawerOpen(false)}
            >
                <FormControl sx={{ mb: 2, display: "block" }}>
                    <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                        Status
                    </FormLabel>
                    <RadioGroup
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(Number(e.target.value))}
                    >
                        <FormControlLabel
                            value={1}
                            control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                            label={<Typography sx={{ fontSize: "0.825rem" }}>Active</Typography>}
                        />
                        <FormControlLabel
                            value={0}
                            control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                            label={<Typography sx={{ fontSize: "0.825rem" }}>Inactive</Typography>}
                        />
                    </RadioGroup>
                </FormControl>
            </ReportFilterDrawer>

            <AppLayout fullWidth>
                <Box sx={{ mt: 1 }}>

                    {loading ? (
                        <CircularProgress />
                    ) : (
                        <>
                            <Box sx={{ mb: 1 }}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    useFlexGap
                                    flexWrap="wrap"
                                >
                                    {brandOptions.map((brand) => (
                                        <Chip
                                            key={brand}
                                            label={brand}
                                            clickable
                                            onClick={() => {
                                                setSelectedBrand(brand);
                                                setPage(1);
                                            }}
                                            color={
                                                selectedBrand === brand
                                                    ? "primary"
                                                    : "default"
                                            }
                                            variant={
                                                selectedBrand === brand
                                                    ? "filled"
                                                    : "outlined"
                                            }
                                            sx={{
                                                fontWeight: 600,
                                                height: 30,
                                            }}
                                        />
                                    ))}
                                </Stack>
                            </Box>

                            <TableContainer
                                component={Paper}
                                sx={{
                                    maxHeight: "calc(100vh - 210px)",
                                }}
                            >
                                <Table size="small">
                                    <TableHead
                                        sx={{
                                            background: "#1E3A8A",
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 2,
                                        }}
                                    >
                                        <TableRow>
                                            <TableCell sx={{ color: "#fff" }}>S.No</TableCell>
                                            <TableCell
                                                sx={{ color: "#fff", cursor: "pointer" }}
                                                onClick={(e) => handleHeaderClick(e, "Product_Name")}
                                            >
                                                Product Name
                                            </TableCell>
                                            <TableCell sx={{ color: "#fff" }} align="right">
                                                <SortableHeaderLabel
                                                    label="Min Rate"
                                                    columnKey="Min_Rate"
                                                    sortConfig={numSortConfig}
                                                    onSort={handleNumSort}
                                                    onOpenFilter={(e) => openNumFilter(e, "Min_Rate")}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: "#fff" }} align="right">
                                                <SortableHeaderLabel
                                                    label="List Rate"
                                                    columnKey="Rate"
                                                    sortConfig={numSortConfig}
                                                    onSort={handleNumSort}
                                                    onOpenFilter={(e) => openNumFilter(e, "Rate")}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: "#fff" }} align="right">
                                                <SortableHeaderLabel
                                                    label="COGS Rate"
                                                    columnKey="CL_Rate"
                                                    sortConfig={numSortConfig}
                                                    onSort={handleNumSort}
                                                    onOpenFilter={(e) => openNumFilter(e, "CL_Rate")}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>

                                        {paginatedData.map((row, i) => {
                                            const previousRow = paginatedData[i - 1];
                                            const showGroupHeader =
                                                i === 0 ||
                                                previousRow?.POS_Brand_Name !== row.POS_Brand_Name;

                                            return (
                                                <React.Fragment key={i}>
                                                    {/* GROUP HEADER */}
                                                    {showGroupHeader && (
                                                        <TableRow
                                                            sx={{
                                                                background: "#eff2f7",
                                                            }}
                                                        >
                                                            <TableCell
                                                                colSpan={5}
                                                                sx={{
                                                                    fontWeight: 800,
                                                                    color: "#000000",
                                                                    fontSize: "13px",
                                                                }}
                                                            >
                                                                {row.POS_Brand_Name}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}

                                                    {/* DATA ROW */}
                                                    <TableRow>
                                                        <TableCell>
                                                            {(page - 1) * rowsPerPage + i + 1}
                                                        </TableCell>

                                                        <TableCell>{row.Product_Name}</TableCell>

                                                        <TableCell align="right">{formatINR(row.Min_Rate)}</TableCell>

                                                        <TableCell align="right">{formatINR(row.Rate)}</TableCell>

                                                        <TableCell align="right">{formatINR(row.CL_Rate)}</TableCell>
                                                    </TableRow>
                                                </React.Fragment>
                                            );
                                        })}

                                        {paginatedData.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center">
                                                    No Data Found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <CommonPagination
                                totalRows={totalRows}
                                page={page}
                                rowsPerPage={rowsPerPage}
                                onPageChange={setPage}
                                onRowsPerPageChange={setRowsPerPage}
                            />
                        </>
                    )}
                </Box>
            </AppLayout>

            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor) && activeHeader === "Product_Name"}
                onClose={() => setFilterAnchor(null)}
                columnLabel="Product Name"
                options={Array.from(new Set(mergedData.map((r) => r.Product_Name))).filter(Boolean).map(String)}
                selectedValues={columnFilters.Product_Name}
                onFilterChange={(selected: string[] | undefined) => {
                    setColumnFilters((prev) => ({
                        ...prev,
                        Product_Name: selected,
                    }));
                }}
            />

            <NumericalFilterMenu
                anchorEl={numFilterAnchor}
                open={Boolean(numFilterAnchor)}
                onClose={() => setNumFilterAnchor(null)}
                activeHeader={numActiveHeader}
                min={numActiveHeader ? getMinMax(numActiveHeader).min : 0}
                max={numActiveHeader ? getMinMax(numActiveHeader).max : 100}
                rangeFilter={numRangeFilter}
                onRangeChange={(key, range) => setNumRangeFilter(p => ({ ...p, [key]: range }))}
                onClear={clearRangeFilter}
            />
        </>
    );
};

export default StockValueRateMasterReport;