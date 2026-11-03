import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import dayjs from "dayjs";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import CommonPagination from "../../Components/CommonPagination";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import { mapForExport } from "../../utils/exportMapper";
import {
    itemwisestockvaluereportservice,
    godownwisestockvaluereportservice,
    stockGroupingService,
    StockGroupConfig,
    stockWiseReport,
} from "../../services/stockValueReport.service";


/* ================= UTIL ================= */

const sum = (rows: stockWiseReport[], key: keyof stockWiseReport) =>
    rows.reduce((s, r) => s + Number(r[key] || 0), 0);

const getClosingValue = (row: stockWiseReport) =>
    (Number(row.Bal_Qty || 0) * Number((row as any).CL_Rate || 0));

const sumClosingValue = (rows: stockWiseReport[]) =>
    rows.reduce((s, r) => s + getClosingValue(r), 0);


/* ================= COMPONENT ================= */

type Level2Meta = {
    columnName: string;
    type: number;
};

const StockValueReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const { toggleMode, setToggleMode } = useToggleMode();
    const isExpanded = toggleMode === "Expanded";
    const [rawData, setRawData] = useState<stockWiseReport[]>([]);
    const [groupConfig, setGroupConfig] = useState<StockGroupConfig[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    /* ===== FILTER STATES ===== */

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [filterLevels, setFilterLevels] = useState<Record<number, any[]>>({});
    const [selectedFilters, setSelectedFilters] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [selectedLevel2, setSelectedLevel2] = useState<string[]>([]);

    /* ===== LEVEL 2 META (FROM CONFIG) ===== */

    const [level2Meta, setLevel2Meta] = useState<Level2Meta[]>([]);
    const [level2TypeOrder, setLevel2TypeOrder] = useState<number[]>([]);
    const [selectedLevel2ByType, setSelectedLevel2ByType] =
        useState<Record<number, string>>({});
    const [stockFilter, setStockFilter] = useState<"hasValues" | "zero" | "all">("hasValues");

    const [modeState, setModeState] = useState<{
        Abstract: any;
        Expanded: any;
    }>({
        Abstract: {},
        Expanded: {},
    });
    /* ================= GROUP CONFIG ================= */

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        const originalHeight = document.body.style.height;

        // ✅ Enable page scroll for this screen
        document.body.style.overflow = "auto";
        document.body.style.height = "auto";

        return () => {
            // 🔁 Restore when leaving the page
            document.body.style.overflow = originalOverflow;
            document.body.style.height = originalHeight;
        };
    }, []);


    useEffect(() => {
        const reportName = isExpanded
            ? "StockInhand-Godown"
            : "StockInhand";

        stockGroupingService
            .getGroupingConfig(reportName)
            .then((res) => {
                const cfg = res.data.data || [];

                // GROUPING
                setGroupConfig(
                    cfg
                        .filter(g => g.isGroupFilter)
                        .sort((a, b) => (a.Level_Id ?? 0) - (b.Level_Id ?? 0))
                );

                // LEVEL 1 FILTER
                // ✅ GROUP ALL FILTERS BY LEVEL
                const filtersOnly = cfg.filter(g => g.isGroupFilter === false);

                const grouped: Record<number, any[]> = {};

                filtersOnly.forEach((f) => {
                    const lvl = f.FilterLevel || 1;
                    if (!grouped[lvl]) grouped[lvl] = [];
                    grouped[lvl].push(f);
                });

                setFilterLevels(grouped);

                // reset selected values
                setSelectedFilters({});

                // LEVEL 2 FILTER (CASCADING META)
                const lvl2 = cfg.filter(
                    g => g.FilterLevel === 2 && g.isGroupFilter === false
                );

                const meta: Level2Meta[] = lvl2
                    .filter(l => l.filterType)
                    .map(l => ({
                        columnName: l.columnName,
                        type: Number(l.filterType),
                    }));

                setLevel2Meta(meta);

                const orderedTypes = Array.from(
                    new Set(meta.map(m => m.type))
                ).sort((a, b) => a - b);

                setLevel2TypeOrder(orderedTypes);
                setSelectedLevel2ByType({});
            });

        // optional cleanup not required
    }, [toggleMode]);


    useEffect(() => {
        setModeState(prev => ({
            ...prev,
            [toggleMode]: {
                rawData,
                expanded,
                page,
                selectedFilters,
                selectedLevel2ByType
            }
        }));
    }, [rawData, expanded, page, selectedFilters, selectedLevel2ByType, toggleMode]);

    useEffect(() => {
        const state = modeState[toggleMode];

        if (state) {
            setExpanded(state.expanded || {});
            setPage(state.page || 1);
            setSelectedFilters(state.selectedFilters || "");
            setSelectedLevel2ByType(state.selectedLevel2ByType || {});
        }

        // ✅ ALWAYS CALL API WHEN MODE CHANGES
        loadData();

    }, [toggleMode]);

    useEffect(() => {
        if (Object.keys(filterLevels).length > 0) {
            loadData();
        }
    }, [filterLevels]);


    /* ================= LOAD DATA ================= */

    const loadData = React.useCallback(async () => {
        try {
            setLoading(true);

            const payload: any = {
                Fromdate: fromDate,
                Todate: toDate,
            };

            /* =========================
               ABSTRACT MODE
            ========================= */
            if (!isExpanded) {
                Object.keys(selectedFilters).forEach((col) => {
                    const value = selectedFilters[col];

                    const filter = Object.values(filterLevels)
                        .flat()
                        .find((f: any) => f.columnName === col);

                    const label = filter?.options?.find(
                        (o: any) => String(o.value) === String(value)
                    )?.label;

                    payload[col] = label || value;
                });

                const res =
                    await itemwisestockvaluereportservice.getItemwiseReports(payload);

                setRawData(res.data?.data || []);
            }

            /* =========================
               EXPANDED MODE
            ========================= */
            else {
                const godownFilter = (filterLevels[1] || []).find(
                    (f: any) =>
                        f.columnName === "Godown_Id" ||
                        f.columnName === "Godown_Name"
                );

                const godownId =
                    selectedFilters["Godown_Id"] ||
                    selectedFilters["Godown_Name"] ||
                    selectedFilters[godownFilter?.columnName];

                if (!godownId) {
                    setRawData([]);
                    setExpanded({});
                    setPage(1);
                    return;
                }

                payload.Godown_Id = godownId;

                const res =
                    await godownwisestockvaluereportservice.getGodownwiseReports(
                        payload
                    );

                setRawData(res.data?.data || []);
            }

            setExpanded({});
            setPage(1);

        } catch (err) {
            console.error("Stock Value report load error:", err);
            setRawData([]);
        } finally {
            setLoading(false);
        }
    }, [
        isExpanded,
        selectedFilters,
        fromDate,
        toDate,
        filterLevels
    ]);

    useEffect(() => {
        setSelectedLevel2([]);
        setExpanded({});
        setPage(1);
    }, [selectedFilters, toggleMode]);

    useEffect(() => {
        const saved = sessionStorage.getItem("stockInHandState");

        if (!saved) return;
        const state = JSON.parse(saved);

        setRawData(state.rawData || []);
        setExpanded(state.expanded || {});
        setPage(state.page || 1);
        setSelectedFilters(state.selectedFilters || "");
        setSelectedLevel2ByType(state.selectedLevel2ByType || {});
        setToggleMode(state.toggleMode || "Abstract");
        setFromDate(state.fromDate || today);
        setToDate(state.toDate || today);

        sessionStorage.removeItem("stockInHandState");

    }, []);

    /* ================= LEVEL 2 FILTER ================= */

    const data = useMemo(() => {
        let filtered = rawData;

        // LEVEL 1 FILTER
        // ✅ DYNAMIC FILTERS
        Object.keys(selectedFilters).forEach((col) => {
            const value = selectedFilters[col];

            const filter = Object.values(filterLevels)
                .flat()
                .find((f: any) => f.columnName === col);

            const label = filter?.options?.find(
                (opt: any) => String(opt.value) === String(value)
            )?.label;

            if (label) {
                filtered = filtered.filter(
                    (r) => String(r[col]) === String(label)
                );
            }
        });

        // LEVEL 2 FILTER
        level2TypeOrder.forEach(type => {
            const selected = selectedLevel2ByType[type];
            if (!selected) return;

            const meta = level2Meta.find(m => m.type === type);
            if (!meta) return;

            filtered = filtered.filter(
                r => String(r[meta.columnName]) === String(selected)
            );
        });

        // ✅ ✅ ADD THIS BLOCK (IMPORTANT)
        filtered = filtered.filter((r) => {
            const ob = Number(r.OB_Bal_Qty) || 0;
            const input = Number(r.Pur_Qty) || 0;
            const out = Number(r.Sal_Qty) || 0;
            const cls = Number(r.Bal_Qty) || 0;

            const hasValue = ob !== 0 || input !== 0 || out !== 0 || cls !== 0;
            const isZero = ob === 0 && input === 0 && out === 0 && cls === 0;

            if (stockFilter === "hasValues") return hasValue;
            if (stockFilter === "zero") return isZero;

            return true; // "all"
        });

        return filtered;
    }, [
        rawData,
        selectedFilters,
        level2TypeOrder,
        level2Meta,
        selectedLevel2ByType,
        stockFilter
    ]);

    useEffect(() => {
        setExpanded({});
        setPage(1);
    }, [selectedLevel2]);

    /* ================= GROUPING ================= */

    const buildGroups = (rows: stockWiseReport[], level: number): any[] => {
        const cfg = groupConfig[level];
        if (!cfg) return [];

        const map: Record<string, stockWiseReport[]> = {};
        rows.forEach((r: any) => {
            const key = r[cfg.columnName] || "Others";
            map[key] ||= [];
            map[key].push(r);
        });

        return Object.entries(map).map(([key, children]) => ({
            key,
            rows: children,
            level,
            children:
                level + 1 < groupConfig.length
                    ? buildGroups(children, level + 1)
                    : [],
        }));
    };

    // ✅ BASE DATA FOR LEVEL-2 CHIPS (MOBILE PARITY)
    const level1FilteredData = useMemo(() => {
        let filtered = rawData;

        Object.keys(selectedFilters).forEach((col) => {
            const value = selectedFilters[col];

            const filter = Object.values(filterLevels)
                .flat()
                .find((f: any) => f.columnName === col);

            const label = filter?.options?.find(
                (opt: any) => String(opt.value) === String(value)
            )?.label;

            if (label) {
                filtered = filtered.filter(
                    (r) => String(r[col]) === String(label)
                );
            }
        });

        return filtered;
    }, [rawData, selectedFilters, filterLevels]);


    /* ===== GODOWN FIRST (EXPANDED MODE) ===== */
    const computeLevel2Values = (
        columnName: string,
        parent?: { column: string; value: string }
    ) => {
        const map = new Map<string, number>();

        level1FilteredData.forEach((r: any) => {
            if (parent) {
                if (String(r[parent.column]) !== parent.value) return;
            }

            const v = r[columnName];
            if (!v) return;

            const qty = Number(r.Bal_Qty || 0);
            map.set(String(v), (map.get(String(v)) || 0) + qty);
        });

        return Array.from(map.entries())
            .map(([value, total]) => ({ value, total }))
            .sort((a, b) => b.total - a.total);
    };


    const finalGroups = useMemo(() => {
        if (!isExpanded) return buildGroups(data, 0);

        const map: Record<string, stockWiseReport[]> = {};
        data.forEach((r: any) => {
            const g = r.Godown_Name || "Unknown";
            map[g] ||= [];
            map[g].push(r);
        });

        return Object.entries(map).map(([key, rows]) => ({
            key,
            rows,
            level: -1,
            children: buildGroups(rows, 0),
        }));
    }, [data, isExpanded, groupConfig]);

    const hasGrouping = groupConfig.length > 0;

    const formatQty = (value: any) =>
        Number(value || 0).toFixed(2);



    const extractBagKg = (row: any): number | null => {
        if (!row?.Bag) return null;

        const kg = parseFloat(String(row.Bag).toLowerCase().replace("kg", "").trim());
        return isNaN(kg) || kg <= 0 ? null : kg;
    };

    const formatBagCount = (value: number, decimals = 2) =>
        Number(value).toFixed(decimals);

    const formatQtyWithBag = (qty: string | number, row: any) => {
        const q = Number(qty || 0);
        const bagKg = extractBagKg(row);

        if (!bagKg) {
            return q.toFixed(2);
        }

        const bags = q / bagKg;

        return `${q.toFixed(2)} (${formatBagCount(bags)})`;
    };

    const getTotalBagCount = (rows: any[], qtyKey: keyof stockWiseReport) => {
        let totalBags = 0;
        let hasBag = false;

        rows.forEach(r => {
            const qty = Number(r[qtyKey] || 0);
            const bagKg = extractBagKg(r);

            if (bagKg && bagKg > 0) {
                totalBags += qty / bagKg;
                hasBag = true;
            }
        });

        if (!hasBag) return null;

        return Number(totalBags.toFixed(2));
    };


    const formatTotalQtyWithBag = (
        qty: number,
        rows: stockWiseReport[],
        qtyKey: keyof stockWiseReport
    ) => {
        const q = Number(qty || 0);
        const bags = getTotalBagCount(rows, qtyKey);

        if (!bags) {
            return q.toFixed(2);
        }

        return `${q.toFixed(2)} (${bags})`;
    };


    const flattenGroupsForExport = (
        groups: any[],
        parentKeys: Record<string, string> = {},
        isExpandedMode = isExpanded
    ): any[] => {
        const result: any[] = [];

        groups.forEach(g => {
            const keys = { ...parentKeys };

            if (isExpandedMode && g.level === -1) {
                keys["Godown"] = g.key;
            } else if (g.level >= 0) {
                keys[`Group ${g.level + 1}`] = g.key;
            }

            if (g.children?.length) {
                result.push(...flattenGroupsForExport(g.children, keys, isExpandedMode));
            } else {
                g.rows.forEach((r: stockWiseReport) => {
                    const rate = Number((r as any).CL_Rate || 0);
                    const closingQty = Number(r.Bal_Qty || 0);
                    const closingValue = closingQty * rate;

                    result.push({
                        ...keys,
                        Item: r.stock_item_name,
                        Opening: Number(r.OB_Bal_Qty || 0).toFixed(2),
                        In: Number(r.Pur_Qty || 0).toFixed(2),
                        Out: Number(r.Sal_Qty || 0).toFixed(2),
                        Rate: rate.toFixed(2),
                        Closing: closingQty.toFixed(2),
                        ClosingValue: closingValue.toFixed(2)
                    });
                });
            }
        });

        return result;
    };

    const getExportColumns = () => {
        const groupCols = groupConfig.map((_, i) => ({
            header: `Group ${i + 1}`,
            key: `Group ${i + 1}`,
        }));

        const baseCols = [
            { header: "Item", key: "Item" },
            { header: "Opening", key: "Opening" },
            { header: "In", key: "In" },
            { header: "Out", key: "Out" },
            { header: "Rate", key: "Rate" },
            { header: "Closing", key: "Closing" },
            { header: "Closing Value", key: "ClosingValue" },
        ];

        if (isExpanded) {
            return [
                { header: "Godown", key: "Godown" },
                ...groupCols,
                ...baseCols,
            ];
        }

        return [...groupCols, ...baseCols];
    };


    const handleExportPDF = () => {
        const rows = flattenGroupsForExport(finalGroups);
        const columns = getExportColumns();

        const { headers, data } = mapForExport(columns, rows);

        exportToPDF(
            `Stock Value (${toggleMode})`,
            headers,
            data
        );
    };

    const handleExportExcel = () => {
        const rows = flattenGroupsForExport(finalGroups);
        const columns = getExportColumns();

        const { headers, data } = mapForExport(columns, rows);

        exportToExcel(
            `Stock Value (${toggleMode})`,
            headers,
            data
        );
    };


    /* ================= ITEM TABLE ================= */

    const paginated = (rows: stockWiseReport[]) =>
        rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    /* ================= ITEM TABLE ================= */
    const formatINR = (value: number) => {
        return value.toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
        });
    };

    const renderItemTable = (rows: stockWiseReport[]) => {
        const pageRows = paginated(rows);

        // ✅ TOTALS (full filtered rows, NOT paginated)
        const totalOpening = sum(rows, "OB_Bal_Qty");
        const totalIn = sum(rows, "Pur_Qty");
        const totalOut = sum(rows, "Sal_Qty");
        const totalClosing = sum(rows, "Bal_Qty");
        const totalClosingValue = sumClosingValue(rows);

        return (
            <Table size="small">
                <TableHead sx={{ background: "#1E3A8A" }}>
                    <TableRow>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }}>S.No</TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }}>Item</TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">
                            Opening
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">
                            In
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">
                            Out
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">
                            Rate
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">
                            Closing
                        </TableCell>
                        <TableCell sx={{ color: "#fff", fontWeight: 600 }} align="right">
                            Closing Value
                        </TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {/* ✅ TOTAL ROW — directly below header */}
                    <TableRow sx={{ background: "#F1F5F9", fontWeight: 700 }}>
                        <TableCell colSpan={2}>TOTAL</TableCell>

                        <TableCell align="right">
                            {formatTotalQtyWithBag(totalOpening, rows, "OB_Bal_Qty")}
                        </TableCell>

                        <TableCell align="right">
                            {formatTotalQtyWithBag(totalIn, rows, "Pur_Qty")}
                        </TableCell>

                        <TableCell align="right">
                            {formatTotalQtyWithBag(totalOut, rows, "Sal_Qty")}
                        </TableCell>

                        {/* CL RATE */}
                        <TableCell align="right">-</TableCell>

                        <TableCell align="right">
                            {formatTotalQtyWithBag(totalClosing, rows, "Bal_Qty")}
                        </TableCell>

                        <TableCell align="right">
                            {formatINR(totalClosingValue)}
                        </TableCell>
                    </TableRow>

                    {/* ✅ ITEM ROWS */}
                    {pageRows.map((r, i) => {
                        const clRate = Number((r as any).CL_Rate || 0);
                        const closingValue = Number(r.Bal_Qty || 0) * clRate;

                        return (
                            <TableRow key={i}>
                                <TableCell>
                                    {(page - 1) * rowsPerPage + i + 1}
                                </TableCell>

                                <TableCell sx={{ fontWeight: 600 }}>
                                    {r.stock_item_name}
                                </TableCell>

                                <TableCell align="right">
                                    {formatQtyWithBag(r.OB_Bal_Qty, r)}
                                </TableCell>

                                <TableCell align="right">
                                    {formatQtyWithBag(r.Pur_Qty, r)}
                                </TableCell>

                                <TableCell align="right">
                                    {formatQtyWithBag(r.Sal_Qty, r)}
                                </TableCell>

                                {/* ✅ NEW: CL RATE */}
                                <TableCell align="right">
                                    {formatINR(clRate)}
                                </TableCell>

                                <TableCell align="right">
                                    {formatQtyWithBag(r.Bal_Qty, r)}
                                </TableCell>

                                {/* ✅ NEW: CLOSING VALUE */}
                                <TableCell align="right">
                                    {formatINR(closingValue)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };


    /* ================= GROUP ROWS ================= */

    const renderGroups = (groups: any[]) =>
        groups.map((g) => {
            const id = `${g.level}-${g.key}-${g.rows.length}`;
            const open = expanded[id];

            return (
                <React.Fragment key={id}>
                    <TableRow sx={{ background: "#F1F5F9" }}>
                        <TableCell width={40}>
                            <IconButton
                                size="small"
                                onClick={() =>
                                    setExpanded((p) => ({ ...p, [id]: !p[id] }))
                                }
                            >
                                {open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                            </IconButton>
                        </TableCell>

                        <TableCell sx={{ fontWeight: 600 }}>{g.key}</TableCell>
                        <TableCell align="right">{g.rows.length}</TableCell>
                        <TableCell align="right">
                            {formatTotalQtyWithBag(
                                sum(g.rows, "Bal_Qty"),
                                g.rows,
                                "Bal_Qty"
                            )}
                        </TableCell>
                        <TableCell align="right">
                            {formatINR(sumClosingValue(g.rows))}
                        </TableCell>
                    </TableRow>

                    {open && (
                        <TableRow>
                            {/* colSpan should cover all columns including icon + totals */}
                            <TableCell colSpan={6} sx={{ pl: 4 }}>
                                {g.children.length
                                    ? (
                                        <Table size="small">
                                            <TableBody>{renderGroups(g.children)}</TableBody>
                                        </Table>
                                    )
                                    : renderItemTable(g.rows)}
                            </TableCell>
                        </TableRow>
                    )}
                </React.Fragment>
            );
        });

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
                onToggle={() => setDrawerOpen(prev => !prev)}
                onClose={() => setDrawerOpen(false)}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                filterLevels={filterLevels}
                selectedFilters={selectedFilters}
                onFilterChange={(col, val) => {
                    setSelectedFilters((prev) => ({
                        ...prev,
                        [col]: val,
                    }));
                }}
                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}
                onApply={async () => {
                    await loadData();
                    setDrawerOpen(false);
                }}
            />

            <AppLayout fullWidth>
                {/* LEVEL 2 CHIPS */}
                <Box
                    sx={{
                        maxHeight: 180,
                        overflowY: "auto",
                        px: 1,
                        py: 1,
                        borderBottom: "1px solid #E5E7EB",
                        background: "#F8FAFC",
                    }}
                >
                    {level2TypeOrder.map((type, idx) => {
                        const meta = level2Meta.find(m => m.type === type);
                        if (!meta) return null;

                        let parent;
                        if (idx > 0) {
                            const parentType = level2TypeOrder[idx - 1];
                            const parentValue = selectedLevel2ByType[parentType];
                            if (!parentValue) return null;

                            const parentMeta = level2Meta.find(m => m.type === parentType);
                            if (parentMeta) {
                                parent = {
                                    column: parentMeta.columnName,
                                    value: parentValue,
                                };
                            }
                        }

                        const values = computeLevel2Values(meta.columnName, parent);
                        if (!values.length) return null;

                        const selected = selectedLevel2ByType[type];

                        return (
                            <Box
                                key={type}
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                {/* ALL */}
                                <Box
                                    onClick={() => {
                                        setSelectedLevel2ByType(prev => {
                                            const copy = { ...prev };
                                            delete copy[type];
                                            level2TypeOrder.forEach(t => t > type && delete copy[t]);
                                            return copy;
                                        });
                                    }}
                                    sx={{
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        background: !selected ? "#1E3A8A" : "#E5E7EB",
                                        color: !selected ? "#fff" : "#111",
                                    }}
                                >
                                    ALL
                                </Box>

                                {values.map(v => (
                                    <Box
                                        key={v.value}
                                        onClick={() => {
                                            setSelectedLevel2ByType(prev => {
                                                const copy = { ...prev, [type]: v.value };
                                                level2TypeOrder.forEach(t => t > type && delete copy[t]);
                                                return copy;
                                            });
                                        }}
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: "16px",
                                            cursor: "pointer",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            background:
                                                selected === v.value ? "#1E3A8A" : "#E5E7EB",
                                            color:
                                                selected === v.value ? "#fff" : "#111",
                                        }}
                                    >
                                        {v.value} ({formatQty(v.total)})
                                    </Box>
                                ))}
                            </Box>
                        );
                    })}
                </Box>

                <Paper
                    sx={{
                        mx: 1,
                        display: "flex",
                        flexDirection: "column",
                        maxHeight: "calc(100vh - 130px)",
                        overflow: "hidden",
                    }}
                >
                    <TableContainer sx={{ maxHeight: "calc(100vh - 130px)", overflow: "auto" }}>
                        {loading ? (
                            <Box
                                sx={{
                                    height: 300,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 600,
                                    color: "#64748B"
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        ) : hasGrouping ? (
                            <Table size="small">
                                <TableHead sx={{ background: "#1E3A8A" }}>
                                    <TableRow>
                                        <TableCell />
                                        <TableCell sx={{ color: "#fff" }}>Name</TableCell>
                                        <TableCell sx={{ color: "#fff" }} align="right">
                                            Items
                                        </TableCell>
                                        <TableCell sx={{ color: "#fff" }} align="right">
                                            Balance
                                        </TableCell>
                                        <TableCell sx={{ color: "#fff" }} align="right">
                                            Closing Value
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    <TableRow sx={{ background: "#F1F5F9", fontWeight: 700 }}>
                                        <TableCell />
                                        <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {data.length}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {formatTotalQtyWithBag(
                                                sum(data, "Bal_Qty"),
                                                data,
                                                "Bal_Qty"
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {formatINR(sumClosingValue(data))}
                                        </TableCell>
                                    </TableRow>
                                    {renderGroups(finalGroups)}
                                </TableBody>
                            </Table>
                        ) : (
                            renderItemTable(data)
                        )}
                    </TableContainer>

                </Paper>

                <CommonPagination
                    totalRows={data.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            </AppLayout>
        </>
    );
};

export default StockValueReport;
