import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
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
    CircularProgress,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    Chip,
    Button,
    Popover,
    TextField,
    Tooltip,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import dayjs from "dayjs";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import CommonPagination from "../../Components/CommonPagination";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import { mapForExport } from "../../utils/exportMapper";
import {
    itemwisestockreportservice,
    godownwisestockreportservice,
    stockGroupingService,
    StockGroupConfig,
    stockWiseReport,
    godownStockBadgeService,
    GodownStockBadgeItem,
    itemwiseStockBadgeService,
    ItemwiseStockBadgeItem,
    TransactionBatchStockItem,
    transactionBatchStockService,
} from "../../services/stockWiseReport.service";


/* ================= UTIL ================= */

const sum = (rows: stockWiseReport[], key: keyof stockWiseReport) =>
    rows.reduce((s, r) => s + Number(r[key] || 0), 0);

/* ================= COMPONENT ================= */

type Level2Meta = {
    columnName: string;
    type: number;
};

const StockInHandReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const { toggleMode, setToggleMode } = useToggleMode();
    const isExpanded = toggleMode === "Expanded";
    const [rawData, setRawData] = useState<stockWiseReport[]>([]);
    const [groupConfig, setGroupConfig] = useState<StockGroupConfig[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    /* ===== BATCH ACCORDION STATES ===== */
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
    const [batchDataMap, setBatchDataMap] = useState<Record<string, (GodownStockBadgeItem | ItemwiseStockBadgeItem)[]>>({});
    const [batchLoadingMap, setBatchLoadingMap] = useState<Record<string, boolean>>({});

    /* ===== BATCH TRANSACTION MODAL STATES ===== */
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [selectedBatchItem, setSelectedBatchItem] = useState<{
        item: stockWiseReport;
        batchNo: string;
        apiBatch: string;
        productId: string | number;
        productName: string;
        godownId?: string | number;
        godownName?: string;
        isGodownWise?: boolean;
    } | null>(null);
    const [batchTransactions, setBatchTransactions] = useState<TransactionBatchStockItem[]>([]);
    const [batchModalLoading, setBatchModalLoading] = useState(false);
    const [batchModalError, setBatchModalError] = useState<string | null>(null);

    /* ===== BATCH-SPECIFIC DATE FILTER STATES ===== */
    const [batchFromDate, setBatchFromDate] = useState<string>(today);
    const [batchToDate, setBatchToDate] = useState<string>(today);
    const [tempBatchFromDate, setTempBatchFromDate] = useState<string>(today);
    const [tempBatchToDate, setTempBatchToDate] = useState<string>(today);
    const [isBatchDateCustom, setIsBatchDateCustom] = useState<boolean>(false);
    const [batchDateAnchorEl, setBatchDateAnchorEl] = useState<HTMLElement | null>(null);

    /* ===== FILTER STATES ===== */

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [filterLevels, setFilterLevels] = useState<Record<number, any[]>>({});
    const [selectedFilters, setSelectedFilters] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    const [qtyMode, setQtyMode] = useState<"qty" | "actQty">("qty");

    /* ===== FETCH BATCH TRANSACTIONS ===== */
    const loadBatchTransactions = useCallback(
        async (
            selected: NonNullable<typeof selectedBatchItem>,
            targetFromDate = batchFromDate,
            targetToDate = batchToDate
        ) => {
            const productId = selected.productId || selected.item.Product_Id || selected.item.Item_Id || "";
            if (!productId) {
                setBatchModalError("Product ID is missing.");
                setBatchTransactions([]);
                return;
            }

            setBatchModalLoading(true);
            setBatchModalError(null);

            try {
                let res;
                const batchParam =
                    selected.apiBatch !== undefined && selected.apiBatch !== null
                        ? selected.apiBatch
                        : (selected.batchNo === "Unassigned" ? "" : selected.batchNo);

                if (selected.isGodownWise && selected.godownId) {
                    res = await transactionBatchStockService.getTransactionBatchStockByGodown({
                        fromDate: targetFromDate,
                        toDate: targetToDate,
                        Product_Id: productId,
                        Godown_Id: selected.godownId,
                        Batch: batchParam,
                    });
                } else {
                    res = await transactionBatchStockService.getTransactionBatchStock({
                        fromDate: targetFromDate,
                        toDate: targetToDate,
                        Product_Id: productId,
                        Batch: batchParam,
                    });
                }

                const rawData = res.data?.data || [];
                setBatchTransactions(Array.isArray(rawData) ? rawData : []);
            } catch (err: any) {
                console.error("Error fetching batch transaction stock:", err);
                setBatchModalError(
                    err.response?.data?.message || "Failed to load batch transaction data."
                );
                setBatchTransactions([]);
            } finally {
                setBatchModalLoading(false);
            }
        },
        [batchFromDate, batchToDate]
    );

    useEffect(() => {
        if (!batchModalOpen || !selectedBatchItem) return;
        loadBatchTransactions(selectedBatchItem, batchFromDate, batchToDate);
    }, [batchModalOpen, selectedBatchItem, batchFromDate, batchToDate, loadBatchTransactions]);

    const qtyKeys = useMemo(() => {
        if (isExpanded) {
            if (qtyMode === "actQty") {
                return {
                    opening: "OB_Act_Qty" as keyof stockWiseReport,
                    in: "IN_Act_Qty" as keyof stockWiseReport,
                    out: "OUT_Act_Qty" as keyof stockWiseReport,
                    closing: "Act_Bal_Qty" as keyof stockWiseReport,
                };
            }
            return {
                opening: "OB_Bal_Qty" as keyof stockWiseReport,
                in: "IN_Qty" as keyof stockWiseReport,
                out: "OUT_Qty" as keyof stockWiseReport,
                closing: "Bal_Qty" as keyof stockWiseReport,
            };
        }
        if (qtyMode === "actQty") {
            return {
                opening: "OB_Act_Qty" as keyof stockWiseReport,
                in: "Pur_Act_Qty" as keyof stockWiseReport,
                out: "Sal_Act_Qty" as keyof stockWiseReport,
                closing: "Bal_Act_Qty" as keyof stockWiseReport,
            };
        }
        return {
            opening: "OB_Bal_Qty" as keyof stockWiseReport,
            in: "Pur_Qty" as keyof stockWiseReport,
            out: "Sal_Qty" as keyof stockWiseReport,
            closing: "Bal_Qty" as keyof stockWiseReport,
        };
    }, [qtyMode, isExpanded]);


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
        const reportName =
            isExpanded ? "StockInhand-Godown" : "StockInhand";

        const loadConfig = async () => {
            try {
                setLoading(true);

                const res =
                    await stockGroupingService.getGroupingConfig(reportName);

                const cfg = res.data.data || [];

                const groups = cfg
                    .filter((g) => g.isGroupFilter)
                    .sort(
                        (a, b) =>
                            (a.Level_Id ?? 0) - (b.Level_Id ?? 0)
                    );

                setGroupConfig(groups);

                const filtersOnly = cfg.filter(
                    (g) => g.isGroupFilter === false
                );

                const grouped: Record<number, any[]> = {};

                filtersOnly.forEach((f) => {
                    const lvl = f.FilterLevel || 1;

                    if (!grouped[lvl]) grouped[lvl] = [];

                    grouped[lvl].push(f);
                });

                setFilterLevels(grouped);

                const lvl2 = cfg.filter(
                    (g) =>
                        g.FilterLevel === 2 &&
                        g.isGroupFilter === false
                );

                const meta = lvl2
                    .filter((l) => l.filterType)
                    .map((l) => ({
                        columnName: l.columnName,
                        type: Number(l.filterType),
                    }));

                setLevel2Meta(meta);

                setLevel2TypeOrder(
                    Array.from(
                        new Set(meta.map((m) => m.type))
                    ).sort((a, b) => a - b)
                );

                setSelectedLevel2ByType({});

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, [toggleMode]);

    useEffect(() => {
        if (Object.keys(filterLevels).length > 0) {
            loadData();
        }
    }, [filterLevels]);

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
            setSelectedFilters(state.selectedFilters || {});
            setSelectedLevel2ByType(state.selectedLevel2ByType || {});
        }
    }, [toggleMode]);

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
                    const rawValue = selectedFilters[col];
                    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
                    if (value === undefined || value === null || value === "") return;

                    const filter = Object.values(filterLevels)
                        .flat()
                        .find((f: any) => f.columnName === col);

                    const label = filter?.options?.find(
                        (o: any) => String(o.value) === String(value)
                    )?.label;

                    payload[col] = label || value;
                });

                const res =
                    await itemwisestockreportservice.getItemwiseReports(payload);

                setRawData(res.data?.data || []);
            }

            else {
                const godownFilter = (filterLevels[1] || []).find(
                    (f: any) =>
                        f.columnName === "Godown_Id" ||
                        f.columnName === "Godown_Name"
                );

                const rawGodownId =
                    selectedFilters["Godown_Id"] ||
                    selectedFilters["Godown_Name"] ||
                    (godownFilter ? selectedFilters[godownFilter.columnName] : undefined);

                if (!rawGodownId) {
                    setRawData([]);
                    setExpanded({});
                    setPage(1);
                    return;
                }

                const godownId = Array.isArray(rawGodownId) ? rawGodownId[0] : rawGodownId;
                if (!godownId) {
                    setRawData([]);
                    setExpanded({});
                    setPage(1);
                    return;
                }

                payload.Godown_Id = godownId;

                const sortedL1Filters = [...(filterLevels[1] || [])]
                    .filter((f: any) => f.columnName !== "Godown_Id" && f.columnName !== "Godown_Name")
                    .sort((a, b) => Number(a.filterType || 0) - Number(b.filterType || 0));

                const getFilterValuesString = (filter: any) => {
                    if (!filter) return undefined;
                    const values = selectedFilters[filter.columnName];
                    if (!values) return undefined;

                    const valArray = Array.isArray(values) ? values : [values];
                    if (valArray.length === 0) return undefined;

                    const labels = valArray.map(val => {
                        const opt = filter.options?.find((o: any) => String(o.value) === String(val));
                        return opt ? opt.label : String(val);
                    });
                    return labels.filter(Boolean).join(",");
                };

                payload.filter1 = getFilterValuesString(sortedL1Filters[0]);
                payload.filter2 = getFilterValuesString(sortedL1Filters[1]);
                payload.filter3 = getFilterValuesString(sortedL1Filters[2]);

                const res =
                    await godownwisestockreportservice.getGodownwiseReports(
                        payload
                    );

                setRawData(res.data?.data || []);
            }

            setExpanded({});
            setExpandedItems({});
            setBatchDataMap({});
            setBatchLoadingMap({});
            setPage(1);

        } catch (err) {
            console.error("Stock report load error:", err);
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
        setExpanded({});
        setExpandedItems({});
        setBatchDataMap({});
        setBatchLoadingMap({});
        setPage(1);
    }, [toggleMode]);

    useEffect(() => {
        const saved = sessionStorage.getItem("stockInHandState");

        if (!saved) return;
        const state = JSON.parse(saved);

        setRawData(state.rawData || []);
        setExpanded(state.expanded || {});
        setPage(state.page || 1);
        setSelectedFilters(state.selectedFilters || {});
        setSelectedLevel2ByType(state.selectedLevel2ByType || {});
        setToggleMode(state.toggleMode || "Abstract");
        setFromDate(state.fromDate || today);
        setToDate(state.toDate || today);
        setQtyMode(state.qtyMode || "qty");

        sessionStorage.removeItem("stockInHandState");

    }, []);

    /* ================= LEVEL 2 FILTER ================= */

    const data = useMemo(() => {
        let filtered = rawData;

        // LEVEL 1 FILTER
        // ✅ DYNAMIC FILTERS
        Object.keys(selectedFilters).forEach((col) => {
            const rawValue = selectedFilters[col];
            if (col === "Godown_Id" || col === "Godown_Name") return;

            const filter = Object.values(filterLevels)
                .flat()
                .find((f: any) => f.columnName === col);

            if (Array.isArray(rawValue)) {
                if (rawValue.length > 0) {
                    const labels = rawValue.map(val => {
                        const opt = filter?.options?.find((o: any) => String(o.value) === String(val));
                        return opt ? opt.label : String(val);
                    });
                    filtered = filtered.filter(
                        (r) => labels.some(lbl => String(r[col] || "").trim().toLowerCase() === String(lbl).trim().toLowerCase())
                    );
                }
            } else if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
                const label = filter?.options?.find(
                    (opt: any) => String(opt.value) === String(rawValue)
                )?.label || (typeof rawValue === "string" ? rawValue : undefined);

                if (label) {
                    filtered = filtered.filter(
                        (r) =>
                            String(r[col] || "").trim().toLowerCase() === String(label).trim().toLowerCase() ||
                            String(r[col] || "").trim().toLowerCase() === String(rawValue).trim().toLowerCase()
                    );
                }
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
            const ob = Number(r[qtyKeys.opening]) || 0;
            const input = Number(r[qtyKeys.in]) || 0;
            const out = Number(r[qtyKeys.out]) || 0;
            const cls = Number(r[qtyKeys.closing]) || 0;

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
        stockFilter,
        qtyKeys
    ]);

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
    } = useNumericalFilter(data, ["OB_Bal_Qty", "Pur_Qty", "Sal_Qty", "Bal_Qty", "OB_Act_Qty", "Pur_Act_Qty", "Sal_Act_Qty", "Bal_Act_Qty", "IN_Qty", "OUT_Qty", "IN_Act_Qty", "OUT_Act_Qty", "Act_Bal_Qty"]);

    const handleTransactionClick = (
        row: stockWiseReport,
        mode: "ABSTRACT" | "EXPANDED"
    ) => {

        const path =
            mode === "EXPANDED"
                ? "/stockinhand/godown-item-transaction"
                : "/stockinhand/item-transaction";

        // ✅ Save report state
        sessionStorage.setItem(
            "stockInHandState",
            JSON.stringify({
                expanded,
                page,
                selectedFilters,
                selectedLevel2ByType,
                toggleMode,
                fromDate,
                toDate,
                qtyMode
            })
        );

        const params = new URLSearchParams({
            ProductId: String(row.Product_Id ?? ""),
            productName: row.stock_item_name ?? "",
            fromDate,
            toDate,
            Godown_Id: mode === "EXPANDED" ? String(row.Godown_Id ?? "") : "",
            godownName: mode === "EXPANDED" ? String(row.Godown_Name ?? "") : ""
        });

        const url = `${window.location.origin}${path}?${params.toString()}`;

        // ✅ open new tab
        window.open(url, "_blank", "noopener,noreferrer");
    };

    useEffect(() => {
        setExpanded({});
        setPage(1);
    }, [selectedLevel2ByType]);

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
            const rawValue = selectedFilters[col];
            if (col === "Godown_Id" || col === "Godown_Name") return;

            const filter = Object.values(filterLevels)
                .flat()
                .find((f: any) => f.columnName === col);

            if (Array.isArray(rawValue)) {
                if (rawValue.length > 0) {
                    const labels = rawValue.map(val => {
                        const opt = filter?.options?.find((o: any) => String(o.value) === String(val));
                        return opt ? opt.label : String(val);
                    });
                    filtered = filtered.filter(
                        (r) => labels.some(lbl => String(r[col] || "").trim().toLowerCase() === String(lbl).trim().toLowerCase())
                    );
                }
            } else if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
                const label = filter?.options?.find(
                    (opt: any) => String(opt.value) === String(rawValue)
                )?.label || (typeof rawValue === "string" ? rawValue : undefined);

                if (label) {
                    filtered = filtered.filter(
                        (r) =>
                            String(r[col] || "").trim().toLowerCase() === String(label).trim().toLowerCase() ||
                            String(r[col] || "").trim().toLowerCase() === String(rawValue).trim().toLowerCase()
                    );
                }
            }
        });

        // ✅ Apply stockFilter to level1FilteredData (Data only has values / Data with 0 / All)
        filtered = filtered.filter((r) => {
            const ob = Number(r[qtyKeys.opening]) || 0;
            const input = Number(r[qtyKeys.in]) || 0;
            const out = Number(r[qtyKeys.out]) || 0;
            const cls = Number(r[qtyKeys.closing]) || 0;

            const hasValue = ob !== 0 || input !== 0 || out !== 0 || cls !== 0;
            const isZero = ob === 0 && input === 0 && out === 0 && cls === 0;

            if (stockFilter === "hasValues") return hasValue;
            if (stockFilter === "zero") return isZero;

            return true; // "all"
        });

        return filtered;
    }, [rawData, selectedFilters, filterLevels, stockFilter, qtyKeys]);


    /* ===== GODOWN FIRST (EXPANDED MODE) ===== */
    const computeLevel2Values = useCallback(
        (
            columnName: string,
            parent?: { column: string; value: string }
        ) => {
            const map = new Map<string, number>();

            level1FilteredData.forEach((r: any) => {
                if (parent) {
                    if (String(r[parent.column]) !== parent.value) return;
                }

                const v = r[columnName];
                if (!v || !String(v).trim()) return;

                const qty = Number(r[qtyKeys.closing] || 0);
                map.set(String(v), (map.get(String(v)) || 0) + qty);
            });

            return Array.from(map.entries())
                .map(([value, total]) => ({ value, total }))
                .filter(({ total }) => {
                    // Only show chips with data (> 0 or non-zero), hide if it is 0
                    if (stockFilter === "hasValues") {
                        return Math.abs(Number(total.toFixed(2))) > 0;
                    }
                    if (stockFilter === "zero") {
                        return Math.abs(Number(total.toFixed(2))) === 0;
                    }
                    return true; // "all"
                })
                .sort((a, b) => b.total - a.total);
        },
        [level1FilteredData, qtyKeys, stockFilter]
    );

    // ✅ Clean up any stale selectedLevel2ByType that is no longer in valid values
    useEffect(() => {
        setSelectedLevel2ByType((prev) => {
            let changed = false;
            const updated = { ...prev };

            level2TypeOrder.forEach((type, idx) => {
                const selected = updated[type];
                if (!selected) return;

                const meta = level2Meta.find((m) => m.type === type);
                if (!meta) {
                    delete updated[type];
                    changed = true;
                    return;
                }

                let parent;
                if (idx > 0) {
                    const parentType = level2TypeOrder[idx - 1];
                    const parentValue = updated[parentType];
                    if (!parentValue) {
                        delete updated[type];
                        changed = true;
                        return;
                    }

                    const parentMeta = level2Meta.find((m) => m.type === parentType);
                    if (parentMeta) {
                        parent = {
                            column: parentMeta.columnName,
                            value: parentValue,
                        };
                    }
                }

                const values = computeLevel2Values(meta.columnName, parent);
                if (!values.some((v) => v.value === selected)) {
                    delete updated[type];
                    changed = true;
                }
            });

            return changed ? updated : prev;
        });
    }, [level2TypeOrder, level2Meta, computeLevel2Values]);


    const finalGroups = useMemo(() => {
        if (!isExpanded) return buildGroups(numFilteredAndSortedRows, 0);

        const map: Record<string, stockWiseReport[]> = {};
        numFilteredAndSortedRows.forEach((r: any) => {
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
    }, [numFilteredAndSortedRows, isExpanded, groupConfig]);

    const hasGrouping = isExpanded ? finalGroups.length > 0 : groupConfig.length > 0;

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

    /* ================= BATCH (STOCK BADGE) HELPERS ================= */

    const getGodownIdForItem = (item: stockWiseReport) => {
        const godownFilter = (filterLevels[1] || []).find(
            (f: any) =>
                f.columnName === "Godown_Id" ||
                f.columnName === "Godown_Name"
        );
        const rawGodownId =
            item.Godown_Id ||
            selectedFilters["Godown_Id"] ||
            selectedFilters["Godown_Name"] ||
            (godownFilter ? selectedFilters[godownFilter.columnName] : undefined) ||
            1;

        return Array.isArray(rawGodownId) ? rawGodownId[0] : rawGodownId;
    };

    const getItemKey = (item: stockWiseReport, index?: number) => {
        const id = item.Product_Id || item.Item_Id || item.stock_item_name || (index !== undefined ? index : 0);
        if (isExpanded) {
            const gid = getGodownIdForItem(item);
            return `exp_${gid}_${id}`;
        }
        return `abs_${id}`;
    };

    const fetchBatchForItem = async (item: stockWiseReport, itemKey: string) => {
        setBatchLoadingMap((prev) => ({ ...prev, [itemKey]: true }));

        try {
            if (isExpanded) {
                const godownId = getGodownIdForItem(item);
                const itemId = item.Product_Id || item.Item_Id || "";

                const res = await godownStockBadgeService.getGodownStockBadge({
                    Fromdate: fromDate,
                    Todate: toDate,
                    Godown_Id: godownId,
                    Item_Id: itemId,
                });

                setBatchDataMap((prev) => ({ ...prev, [itemKey]: res.data?.data || [] }));
            } else {
                const res = await itemwiseStockBadgeService.getItemwiseStockBadge({
                    Fromdate: fromDate,
                    Todate: toDate,
                    Item_Name: item.stock_item_name,
                    stock_item_name: item.stock_item_name,
                    Product_Id: item.Product_Id,
                    Item_Id: item.Product_Id || item.Item_Id,
                });

                const rawBatches = res.data?.data || [];
                const targetName = String(item.stock_item_name || "").trim().toLowerCase();
                const targetId = String(item.Product_Id || item.Item_Id || "").trim();

                const filtered = rawBatches.filter((b: any) => {
                    if (targetName && String(b.stock_item_name || "").trim().toLowerCase() === targetName) {
                        return true;
                    }
                    if (targetId && String(b.Product_Id || "").trim() === targetId) {
                        return true;
                    }
                    return false;
                });

                setBatchDataMap((prev) => ({ ...prev, [itemKey]: filtered }));
            }
        } catch (err) {
            console.error("Failed to load batch data:", err);
            setBatchDataMap((prev) => ({ ...prev, [itemKey]: [] }));
        } finally {
            setBatchLoadingMap((prev) => ({ ...prev, [itemKey]: false }));
        }
    };

    const toggleItemAccordion = (item: stockWiseReport, itemKey: string) => {
        setExpandedItems((prev) => {
            const isCurrentlyOpen = Boolean(prev[itemKey]);
            const nextState = !isCurrentlyOpen;

            if (nextState && !batchDataMap[itemKey]) {
                fetchBatchForItem(item, itemKey);
            }

            return {
                ...prev,
                [itemKey]: nextState,
            };
        });
    };

    const getBatchInfo = (rawBatch: any): { displayBatch: string; apiBatch: string } => {
        if (rawBatch === null || rawBatch === undefined || String(rawBatch).trim().toLowerCase() === "null") {
            return { displayBatch: "null", apiBatch: "null" };
        }
        const trimmed = String(rawBatch).trim();
        if (trimmed === "" || trimmed.toLowerCase() === "unassigned") {
            return { displayBatch: "Unassigned", apiBatch: "" };
        }
        return { displayBatch: trimmed, apiBatch: trimmed };
    };

    const handleBatchClick = (item: stockWiseReport, batch: any) => {
        const { displayBatch, apiBatch } = getBatchInfo(batch?.Batch_No);
        const batchNo = displayBatch;

        const isGodown = Boolean(isExpanded || batch?.Godown_Id || item?.Godown_Id);
        const godownId = isGodown
            ? (batch?.Godown_Id || item?.Godown_Id || getGodownIdForItem(item))
            : undefined;
        const godownName = batch?.Godown_Name || item?.Godown_Name || "";
        const productId = batch?.Product_Id || item?.Product_Id || item?.Item_Id || "";
        const productName =
            batch?.stock_item_name ||
            item?.stock_item_name ||
            item?.Item_Name ||
            item?.POS_Item_Name ||
            "Item Details";

        setSelectedBatchItem({
            item,
            batchNo,
            apiBatch,
            productId,
            productName,
            godownId,
            godownName,
            isGodownWise: Boolean(isGodown && godownId),
        });
        setBatchFromDate(fromDate);
        setBatchToDate(toDate);
        setTempBatchFromDate(fromDate);
        setTempBatchToDate(toDate);
        setIsBatchDateCustom(false);
        setBatchDateAnchorEl(null);
        setBatchModalOpen(true);
    };

    const getBatchQty = (item: GodownStockBadgeItem | ItemwiseStockBadgeItem, type: "OB" | "IN" | "OUT" | "CLS") => {
        if (qtyMode === "actQty") {
            switch (type) {
                case "OB": return Number(item.OB_Act_Qty || 0);
                case "IN": return Number(item.IN_Act_Qty || 0);
                case "OUT": return Number(item.OUT_Act_Qty || 0);
                case "CLS": return Number(item.Act_Bal_Qty || 0);
            }
        }
        switch (type) {
            case "OB": return Number(item.OB_Bal_Qty || 0);
            case "IN": return Number(item.IN_Qty || 0);
            case "OUT": return Number(item.OUT_Qty || 0);
            case "CLS": return Number(item.Bal_Qty || 0);
        }
    };

    const formatBatchQtyWithBag = (qty: number, itemRow: stockWiseReport | null) => {
        const q = Number(qty || 0);
        const bagKg = extractBagKg(itemRow);
        if (!bagKg) {
            return q.toFixed(2);
        }
        const bags = q / bagKg;
        return `${q.toFixed(2)} (${formatBagCount(bags)})`;
    };

    /* ===== PROCESSED BATCH LEDGER (SORTED BY DATE) ===== */
    const processedBatchRows = useMemo(() => {
        const isAct = qtyMode === "actQty";

        // Sort by Opening Balance (OB) first, then chronological by Ledger_Date
        const sorted = [...batchTransactions].sort((a, b) => {
            const isA_OB =
                a.invoice_no === "OB" ||
                a.ord === 0 ||
                String(a.Particulars || "").toLowerCase().includes("opening balance");
            const isB_OB =
                b.invoice_no === "OB" ||
                b.ord === 0 ||
                String(b.Particulars || "").toLowerCase().includes("opening balance");

            if (isA_OB && !isB_OB) return -1;
            if (!isA_OB && isB_OB) return 1;

            const dateA = a.Ledger_Date ? new Date(a.Ledger_Date).getTime() : 0;
            const dateB = b.Ledger_Date ? new Date(b.Ledger_Date).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;

            const ordA = Number(a.ord || 0);
            const ordB = Number(b.ord || 0);
            if (ordA !== ordB) return ordA - ordB;

            return Number(a.Trans_Id || 0) - Number(b.Trans_Id || 0);
        });

        let running = 0;
        return sorted.map((row, index) => {
            const inQtyVal = isAct
                ? Number(row.In_Act_Qty !== undefined && row.In_Act_Qty !== null ? row.In_Act_Qty : (row.In_Qty || 0))
                : Number(row.In_Qty || 0);
            const outQtyVal = isAct
                ? Number(row.Out_Act_Qty !== undefined && row.Out_Act_Qty !== null ? row.Out_Act_Qty : (row.Out_Qty || 0))
                : Number(row.Out_Qty || 0);

            running += inQtyVal - outQtyVal;

            return {
                ...row,
                sNo: index + 1,
                inQtyVal,
                outQtyVal,
                clsQtyVal: running,
            };
        });
    }, [batchTransactions, qtyMode]);

    const batchTotals = useMemo(() => {
        let totalIn = 0;
        let totalOut = 0;

        processedBatchRows.forEach((r) => {
            totalIn += r.inQtyVal;
            totalOut += r.outQtyVal;
        });

        const finalCls =
            processedBatchRows.length > 0
                ? processedBatchRows[processedBatchRows.length - 1].clsQtyVal
                : 0;

        return { totalIn, totalOut, finalCls };
    }, [processedBatchRows]);


    const flattenGroupsForExport = (groups: any[], parentKeys: Record<string, string> = {}, isExpandedMode = isExpanded): any[] => {
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
                    result.push({
                        ...keys,
                        Item: r.stock_item_name,
                        Opening: r[qtyKeys.opening],
                        In: r[qtyKeys.in],
                        Out: r[qtyKeys.out],
                        Closing: r[qtyKeys.closing],
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
            { header: "Closing", key: "Closing" },
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
            `Stock in Hand (${toggleMode})`,
            headers,
            data
        );
    };

    const handleExportExcel = () => {
        const rows = flattenGroupsForExport(finalGroups);
        const columns = getExportColumns();

        const { headers, data } = mapForExport(columns, rows);

        exportToExcel(
            `Stock in Hand (${toggleMode})`,
            headers,
            data
        );
    };


    /* ================= ITEM TABLE ================= */

    const paginated = (rows: stockWiseReport[]) =>
        rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    /* ================= TOTALS ================= */

    const totalOpening = useMemo(() => sum(numFilteredAndSortedRows, qtyKeys.opening), [numFilteredAndSortedRows, qtyKeys.opening]);
    const totalIn = useMemo(() => sum(numFilteredAndSortedRows, qtyKeys.in), [numFilteredAndSortedRows, qtyKeys.in]);
    const totalOut = useMemo(() => sum(numFilteredAndSortedRows, qtyKeys.out), [numFilteredAndSortedRows, qtyKeys.out]);
    const totalClosing = useMemo(() => sum(numFilteredAndSortedRows, qtyKeys.closing), [numFilteredAndSortedRows, qtyKeys.closing]);

    /* ================= ITEM ROWS ================= */

    const renderItemRows = (items: stockWiseReport[], depth = 0) =>
        items.map((r, i) => {
            const itemKey = getItemKey(r, i);
            const isItemOpen = Boolean(expandedItems[itemKey]);
            const batches = batchDataMap[itemKey] || [];
            const isBatchLoading = Boolean(batchLoadingMap[itemKey]);
            const itemPl = depth === 0 ? 0.8 : 0.8 + (depth - 1) * 1.2;
            const batchPl = itemPl + 1.2;

            return (
                <React.Fragment key={`${r.Product_Id || r.Item_Id || i}-${i}`}>
                    <TableRow
                        hover
                        sx={{
                            background: isItemOpen ? "#F8FAFC" : "#FFFFFF",
                            "&:hover": { bgcolor: "#EFF6FF" },
                            borderBottom: isItemOpen ? "none" : "1px solid #F1F5F9",
                            cursor: "pointer",
                        }}
                        onClick={() => toggleItemAccordion(r, itemKey)}
                    >
                        <TableCell width={44} sx={{ py: 0.6, textAlign: "center", color: "#94A3B8", fontSize: "0.75rem" }}>
                            {i + 1}
                        </TableCell>

                        <TableCell sx={{ py: 0.6 }}>
                            <Box sx={{ display: "flex", alignItems: "center", pl: itemPl, gap: 0.6, flexWrap: "wrap" }}>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleItemAccordion(r, itemKey);
                                    }}
                                    sx={{
                                        p: 0.25,
                                        color: isItemOpen ? "#1E3A8A" : "#64748B",
                                        borderRadius: "4px",
                                        "&:hover": { bgcolor: "#DBEAFE", color: "#1E3A8A" }
                                    }}
                                >
                                    {isItemOpen ? (
                                        <KeyboardArrowDownIcon sx={{ fontSize: 17 }} />
                                    ) : (
                                        <KeyboardArrowRightIcon sx={{ fontSize: 17 }} />
                                    )}
                                </IconButton>

                                <span
                                    style={{ cursor: "pointer", color: "#1D4ED8", fontWeight: 600 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTransactionClick(
                                            r,
                                            isExpanded ? "EXPANDED" : "ABSTRACT"
                                        );
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                >
                                    {r.stock_item_name}
                                </span>
                            </Box>
                        </TableCell>

                        <TableCell align="right" sx={{ py: 0.6 }}>
                            {formatQtyWithBag(r[qtyKeys.opening] ?? 0, r)}
                        </TableCell>

                        <TableCell align="right" sx={{ py: 0.6 }}>
                            {formatQtyWithBag(r[qtyKeys.in] ?? 0, r)}
                        </TableCell>

                        <TableCell align="right" sx={{ py: 0.6 }}>
                            {formatQtyWithBag(r[qtyKeys.out] ?? 0, r)}
                        </TableCell>

                        <TableCell align="right" sx={{ py: 0.6 }}>
                            {formatQtyWithBag(r[qtyKeys.closing] ?? 0, r)}
                        </TableCell>
                    </TableRow>

                    {/* BATCH ROWS (INLINE ALIGNED WITH MAIN TABLE) */}
                    {isItemOpen && (
                        isBatchLoading ? (
                            <TableRow
                                key={`batch-loading-${itemKey}`}
                                sx={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}
                            >
                                <TableCell width={44} sx={{ py: 0.6 }} />
                                <TableCell colSpan={5} sx={{ py: 0.6 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", pl: batchPl, gap: 0.6 }}>
                                        <Box sx={{ width: 21, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <CircularProgress size={16} sx={{ color: "#1E3A8A" }} />
                                        </Box>
                                        <Typography variant="body2" sx={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 500 }}>
                                            Loading batch details...
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : batches.length === 0 ? (
                            <TableRow
                                key={`batch-empty-${itemKey}`}
                                sx={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}
                            >
                                <TableCell width={44} sx={{ py: 0.6 }} />
                                <TableCell colSpan={5} sx={{ py: 0.6 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", pl: batchPl, gap: 0.6 }}>
                                        <Box sx={{ width: 21, flexShrink: 0 }} />
                                        <Typography variant="body2" sx={{ color: "#64748B", fontSize: "0.75rem", fontStyle: "italic" }}>
                                            {isExpanded
                                                ? "No batch stock found for this item in this godown."
                                                : "No batch stock found for this item."}
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            batches.map((batch, idx) => (
                                <TableRow
                                    key={`batch-${itemKey}-${getBatchInfo(batch.Batch_No).displayBatch}-${idx}`}
                                    hover
                                    sx={{
                                        background: "#F8FAFC",
                                        "&:hover": { bgcolor: "#EFF6FF" },
                                        borderBottom: "1px solid #F1F5F9",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => handleBatchClick(r, batch)}
                                >
                                    <TableCell
                                        width={44}
                                        sx={{
                                            py: 0.5,
                                            textAlign: "center",
                                            color: "#94A3B8",
                                            fontSize: "0.7rem",
                                        }}
                                    />

                                    <TableCell sx={{ py: 0.5 }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                pl: batchPl,
                                                gap: 0.6,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 21,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        bgcolor: "#2563EB",
                                                    }}
                                                />
                                            </Box>
                                            <Typography component="span" sx={{ fontSize: "0.76rem", color: "#475569" }}>
                                                Batch:{" "}
                                                <strong
                                                    style={{
                                                        color: "#1D4ED8",
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        textDecoration: "underline",
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBatchClick(r, batch);
                                                    }}
                                                    title="Click to view batch transactions"
                                                >
                                                    {getBatchInfo(batch.Batch_No).displayBatch}
                                                </strong>
                                            </Typography>
                                        </Box>
                                    </TableCell>

                                    <TableCell align="right" sx={{ py: 0.5, fontSize: "0.75rem", color: "#334155" }}>
                                        {formatBatchQtyWithBag(getBatchQty(batch, "OB"), r)}
                                    </TableCell>

                                    <TableCell
                                        align="right"
                                        sx={{
                                            py: 0.5,
                                            fontSize: "0.75rem",
                                            color: getBatchQty(batch, "IN") > 0 ? "#16A34A" : "#334155",
                                            fontWeight: getBatchQty(batch, "IN") > 0 ? 600 : 400,
                                        }}
                                    >
                                        {formatBatchQtyWithBag(getBatchQty(batch, "IN"), r)}
                                    </TableCell>

                                    <TableCell
                                        align="right"
                                        sx={{
                                            py: 0.5,
                                            fontSize: "0.75rem",
                                            color: getBatchQty(batch, "OUT") > 0 ? "#DC2626" : "#334155",
                                            fontWeight: getBatchQty(batch, "OUT") > 0 ? 600 : 400,
                                        }}
                                    >
                                        {formatBatchQtyWithBag(getBatchQty(batch, "OUT"), r)}
                                    </TableCell>

                                    <TableCell
                                        align="right"
                                        sx={{
                                            py: 0.5,
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            color: "#1D4ED8",
                                        }}
                                    >
                                        {formatBatchQtyWithBag(getBatchQty(batch, "CLS"), r)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )
                    )}
                </React.Fragment>
            );
        });


    /* ================= GROUP ROWS ================= */

    const renderGroups = (groups: any[], depth = 0): React.ReactNode =>
        groups.map((g) => {
            const id = `${g.level}-${g.key}-${g.rows.length}`;
            const open = expanded[id];

            const bgColors = ["#F8FAFC", "#FFFFFF", "#F8FAFC"];
            const rowBg = depth === 0 ? "#F1F5F9" : bgColors[depth % bgColors.length];

            const grpOpening = sum(g.rows, qtyKeys.opening);
            const grpIn = sum(g.rows, qtyKeys.in);
            const grpOut = sum(g.rows, qtyKeys.out);
            const grpClosing = sum(g.rows, qtyKeys.closing);

            const groupPl = depth === 0 ? 0 : 0.8 + (depth - 1) * 1.2;

            return (
                <React.Fragment key={id}>
                    <TableRow
                        sx={{
                            background: rowBg,
                            cursor: "pointer",
                            "&:hover": { bgcolor: "#E2E8F0" },
                            borderBottom: "1px solid #E2E8F0",
                        }}
                        onClick={() => setExpanded((p) => ({ ...p, [id]: !p[id] }))}
                    >
                        <TableCell width={44} sx={{ py: 0.8, textAlign: "center" }}>
                            {depth === 0 ? (
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpanded((p) => ({ ...p, [id]: !p[id] }));
                                    }}
                                >
                                    {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                                </IconButton>
                            ) : null}
                        </TableCell>

                        <TableCell sx={{ py: 0.8 }}>
                            <Box sx={{ display: "flex", alignItems: "center", pl: groupPl, gap: 0.6 }}>
                                {depth > 0 && (
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpanded((p) => ({ ...p, [id]: !p[id] }));
                                        }}
                                        sx={{
                                            p: 0.25,
                                            color: open ? "#1E3A8A" : "#64748B",
                                            borderRadius: "4px",
                                            "&:hover": { bgcolor: "#E2E8F0" }
                                        }}
                                    >
                                        {open ? <KeyboardArrowDownIcon sx={{ fontSize: 17 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 17 }} />}
                                    </IconButton>
                                )}
                                <span style={{ fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 500, color: depth === 0 ? "#0F172A" : depth === 1 ? "#1E293B" : "#334155" }}>
                                    {g.key}
                                </span>
                                <span style={{ color: "#64748B", fontWeight: 600, fontSize: "0.82rem" }}>
                                    ({g.rows.length})
                                </span>
                            </Box>
                        </TableCell>

                        <TableCell align="right" sx={{ fontWeight: 600, py: 0.8 }}>
                            {formatTotalQtyWithBag(grpOpening, g.rows, qtyKeys.opening)}
                        </TableCell>

                        <TableCell align="right" sx={{ fontWeight: 600, py: 0.8 }}>
                            {formatTotalQtyWithBag(grpIn, g.rows, qtyKeys.in)}
                        </TableCell>

                        <TableCell align="right" sx={{ fontWeight: 600, py: 0.8 }}>
                            {formatTotalQtyWithBag(grpOut, g.rows, qtyKeys.out)}
                        </TableCell>

                        <TableCell align="right" sx={{ fontWeight: 600, py: 0.8 }}>
                            {formatTotalQtyWithBag(grpClosing, g.rows, qtyKeys.closing)}
                        </TableCell>
                    </TableRow>

                    {open && (
                        g.children?.length
                            ? renderGroups(g.children, depth + 1)
                            : renderItemRows(g.rows, depth + 1)
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
                level1Multiple={false}
                onFilterChange={(col, val) => {
                    setSelectedFilters((prev) => {
                        const copy = { ...prev };
                        if (val === undefined || val === null || val === "") {
                            delete copy[col];
                        } else {
                            copy[col] = val;
                        }
                        return copy;
                    });
                }}
                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}
                showQtyModeFilter
                qtyModeValue={qtyMode}
                onQtyModeChange={setQtyMode}
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
                        ) : (
                            <Table size="small" stickyHeader>
                                <TableHead
                                    sx={{
                                        background: "#1E3A8A",
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 3,
                                        "& .MuiTableCell-root": {
                                            bgcolor: "#1E3A8A !important",
                                            color: "#fff !important",
                                            fontWeight: 700,
                                            fontSize: "0.82rem",
                                            borderBottom: "1px solid #1E3A8A",
                                        },
                                        "& .MuiTableCell-stickyHeader": {
                                            bgcolor: "#1E3A8A !important",
                                            color: "#fff !important",
                                        },
                                    }}
                                >
                                    <TableRow>
                                        <TableCell sx={{ color: "#fff", width: 44, fontWeight: 700, p: 1, bgcolor: "#1E3A8A" }} />
                                        <TableCell sx={{ color: "#fff", fontWeight: 700, bgcolor: "#1E3A8A" }}>Name</TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700, width: 140, bgcolor: "#1E3A8A" }} align="right">
                                            <SortableHeaderLabel
                                                label="OB"
                                                columnKey={qtyKeys.opening as string}
                                                sortConfig={numSortConfig}
                                                onSort={handleNumSort}
                                                onOpenFilter={(e) => openNumFilter(e, qtyKeys.opening as string)}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700, width: 140, bgcolor: "#1E3A8A" }} align="right">
                                            <SortableHeaderLabel
                                                label="IN"
                                                columnKey={qtyKeys.in as string}
                                                sortConfig={numSortConfig}
                                                onSort={handleNumSort}
                                                onOpenFilter={(e) => openNumFilter(e, qtyKeys.in as string)}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700, width: 140, bgcolor: "#1E3A8A" }} align="right">
                                            <SortableHeaderLabel
                                                label="OUT"
                                                columnKey={qtyKeys.out as string}
                                                sortConfig={numSortConfig}
                                                onSort={handleNumSort}
                                                onOpenFilter={(e) => openNumFilter(e, qtyKeys.out as string)}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ color: "#fff", fontWeight: 700, width: 140, bgcolor: "#1E3A8A" }} align="right">
                                            <SortableHeaderLabel
                                                label="CLS"
                                                columnKey={qtyKeys.closing as string}
                                                sortConfig={numSortConfig}
                                                onSort={handleNumSort}
                                                onOpenFilter={(e) => openNumFilter(e, qtyKeys.closing as string)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {/* ✅ TOTAL ROW — directly below header */}
                                    <TableRow sx={{ background: "#F1F5F9", fontWeight: 700, position: "sticky", top: 37, zIndex: 1 }}>
                                        <TableCell width={44} />
                                        <TableCell sx={{ fontWeight: 700, color: "#0F172A" }}>
                                            TOTAL
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                            {formatTotalQtyWithBag(totalOpening, numFilteredAndSortedRows, qtyKeys.opening)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                            {formatTotalQtyWithBag(totalIn, numFilteredAndSortedRows, qtyKeys.in)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                            {formatTotalQtyWithBag(totalOut, numFilteredAndSortedRows, qtyKeys.out)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                            {formatTotalQtyWithBag(totalClosing, numFilteredAndSortedRows, qtyKeys.closing)}
                                        </TableCell>
                                    </TableRow>

                                    {numFilteredAndSortedRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#64748B" }}>
                                                No records found
                                            </TableCell>
                                        </TableRow>
                                    ) : hasGrouping ? (
                                        renderGroups(finalGroups, 0)
                                    ) : (
                                        renderItemRows(paginated(numFilteredAndSortedRows), 0)
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </TableContainer>

                </Paper>

                <CommonPagination
                    totalRows={numFilteredAndSortedRows.length}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setPage}
                    onRowsPerPageChange={setRowsPerPage}
                />
            </AppLayout>

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

            {/* ===== BATCH TRANSACTION MODAL POPUP (EMBEDDED) ===== */}
            <Dialog
                open={batchModalOpen}
                onClose={() => {
                    setBatchModalOpen(false);
                    setBatchDateAnchorEl(null);
                }}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        maxHeight: "92vh",
                    },
                }}
            >
                {/* Header with Item Name and Batch No */}
                <DialogTitle
                    sx={{
                        m: 0,
                        p: 2.2,
                        bgcolor: "#1E3A8A",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                    }}
                >
                    <Box sx={{ pr: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                            <Typography
                                variant="h6"
                                component="span"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "1.15rem",
                                    color: "#FFFFFF",
                                    letterSpacing: "0.2px",
                                }}
                            >
                                {selectedBatchItem?.productName ||
                                    batchTransactions[0]?.Product_Name ||
                                    selectedBatchItem?.item.stock_item_name ||
                                    selectedBatchItem?.item.Item_Name ||
                                    selectedBatchItem?.item.POS_Item_Name ||
                                    "Item Details"}
                            </Typography>

                            <Chip
                                label={`Batch: ${selectedBatchItem?.batchNo ?? "Unassigned"}`}
                                size="small"
                                sx={{
                                    bgcolor: "rgba(255, 255, 255, 0.2)",
                                    color: "#FFFFFF",
                                    fontWeight: 700,
                                    fontSize: "0.78rem",
                                    border: "1px solid rgba(255, 255, 255, 0.35)",
                                    px: 0.5,
                                }}
                            />

                            {(selectedBatchItem?.godownName || batchTransactions[0]?.Godown_Name || selectedBatchItem?.item?.Godown_Name) && (
                                <Chip
                                    label={`Godown: ${selectedBatchItem?.godownName || batchTransactions[0]?.Godown_Name || selectedBatchItem?.item?.Godown_Name}`}
                                    size="small"
                                    sx={{
                                        bgcolor: "rgba(255, 255, 255, 0.2)",
                                        color: "#FFFFFF",
                                        fontWeight: 600,
                                        fontSize: "0.72rem",
                                        border: "1px solid rgba(255, 255, 255, 0.25)",
                                    }}
                                />
                            )}

                            <Chip
                                label={qtyMode === "actQty" ? "Mode: Act_qty" : "Mode: Qty"}
                                size="small"
                                sx={{
                                    bgcolor: qtyMode === "actQty" ? "#7C3AED" : "rgba(255, 255, 255, 0.15)",
                                    color: "#FFFFFF",
                                    fontWeight: 600,
                                    fontSize: "0.72rem",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                }}
                            />
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.8, flexWrap: "wrap" }}>
                            {/* Interactive Date Filter Badge */}
                            <Tooltip title="Click to change From & To Date for this Batch" arrow>
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={(e) => {
                                        setTempBatchFromDate(batchFromDate);
                                        setTempBatchToDate(batchToDate);
                                        setBatchDateAnchorEl(e.currentTarget);
                                    }}
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 0.8,
                                        px: 1.2,
                                        py: 0.45,
                                        borderRadius: "6px",
                                        bgcolor: isBatchDateCustom ? "rgba(245, 158, 11, 0.28)" : "rgba(255, 255, 255, 0.16)",
                                        border: isBatchDateCustom ? "1.5px solid #F59E0B" : "1px solid rgba(255, 255, 255, 0.35)",
                                        color: "#FFFFFF",
                                        cursor: "pointer",
                                        outline: "none",
                                        boxShadow: isBatchDateCustom ? "0 0 12px rgba(245, 158, 11, 0.35)" : "none",
                                        transition: "all 0.2s ease-in-out",
                                        "&:hover": {
                                            bgcolor: isBatchDateCustom ? "rgba(245, 158, 11, 0.4)" : "rgba(255, 255, 255, 0.28)",
                                            borderColor: "#FFFFFF",
                                            transform: "translateY(-1px)",
                                            boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
                                        },
                                    }}
                                >
                                    <CalendarMonthIcon sx={{ fontSize: 16, color: isBatchDateCustom ? "#FDE047" : "#93C5FD" }} />
                                    <Typography variant="caption" sx={{ color: "#FFFFFF", fontSize: "0.76rem", fontWeight: 500, letterSpacing: "0.2px" }}>
                                        From: <strong>{dayjs(batchFromDate).format("DD/MM/YYYY")}</strong> | To:{" "}
                                        <strong>{dayjs(batchToDate).format("DD/MM/YYYY")}</strong>
                                    </Typography>
                                    {isBatchDateCustom && (
                                        <Chip
                                            label="Custom Date"
                                            size="small"
                                            sx={{
                                                height: 18,
                                                fontSize: "0.65rem",
                                                fontWeight: 700,
                                                bgcolor: "#F59E0B",
                                                color: "#1F2937",
                                                lineHeight: 1,
                                                px: 0.3,
                                            }}
                                        />
                                    )}
                                    <Chip
                                        label="Change Date"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: "0.65rem",
                                            fontWeight: 600,
                                            bgcolor: "rgba(255, 255, 255, 0.22)",
                                            color: "#FFFFFF",
                                            lineHeight: 1,
                                            px: 0.4,
                                        }}
                                    />
                                </Box>
                            </Tooltip>

                            {(selectedBatchItem?.godownName || batchTransactions[0]?.Godown_Name || selectedBatchItem?.item?.Godown_Name) && (
                                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.85)", fontSize: "0.75rem" }}>
                                    Godown: <strong>{selectedBatchItem?.godownName || batchTransactions[0]?.Godown_Name || selectedBatchItem?.item?.Godown_Name}</strong>
                                </Typography>
                            )}

                            <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.85)", fontSize: "0.75rem" }}>
                                Total Entries: <strong>{processedBatchRows.length}</strong>
                            </Typography>
                        </Box>
                    </Box>

                    <IconButton
                        aria-label="close"
                        onClick={() => {
                            setBatchModalOpen(false);
                            setBatchDateAnchorEl(null);
                        }}
                        sx={{
                            color: "#FFFFFF",
                            bgcolor: "rgba(255, 255, 255, 0.08)",
                            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
                            p: 0.8,
                        }}
                    >
                        <CloseIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </DialogTitle>

                {/* Batch-specific Date Filter Popover */}
                <Popover
                    open={Boolean(batchDateAnchorEl)}
                    anchorEl={batchDateAnchorEl}
                    onClose={() => setBatchDateAnchorEl(null)}
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "left",
                    }}
                    transformOrigin={{
                        vertical: "top",
                        horizontal: "left",
                    }}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            p: 2.2,
                            width: 340,
                            borderRadius: 2.5,
                            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
                            border: "1px solid #E2E8F0",
                        },
                    }}
                    sx={{ zIndex: 1400 }}
                >
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.8 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <CalendarMonthIcon sx={{ color: "#1E3A8A", fontSize: 20 }} />
                                <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1E293B" }}>
                                    Batch Date Filter
                                </Typography>
                            </Box>
                            {isBatchDateCustom && (
                                <Chip
                                    label="Custom Active"
                                    size="small"
                                    sx={{
                                        height: 20,
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        bgcolor: "#FEF3C7",
                                        color: "#B45309",
                                    }}
                                />
                            )}
                        </Box>

                        {/* Date Inputs */}
                        <Box sx={{ display: "flex", gap: 1.5 }}>
                            <TextField
                                label="From Date"
                                type="date"
                                size="small"
                                fullWidth
                                value={tempBatchFromDate}
                                onChange={(e) => setTempBatchFromDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ max: tempBatchToDate || undefined }}
                            />
                            <TextField
                                label="To Date"
                                type="date"
                                size="small"
                                fullWidth
                                value={tempBatchToDate}
                                onChange={(e) => setTempBatchToDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: tempBatchFromDate || undefined }}
                            />
                        </Box>

                        {dayjs(tempBatchFromDate).isAfter(dayjs(tempBatchToDate)) && (
                            <Typography sx={{ color: "#DC2626", fontSize: "0.75rem", fontWeight: 500 }}>
                                * From Date cannot be after To Date.
                            </Typography>
                        )}

                        {/* Actions */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1, borderTop: "1px solid #E2E8F0" }}>
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => {
                                    setBatchFromDate(fromDate);
                                    setBatchToDate(toDate);
                                    setTempBatchFromDate(fromDate);
                                    setTempBatchToDate(toDate);
                                    setIsBatchDateCustom(false);
                                    setBatchDateAnchorEl(null);
                                }}
                                sx={{ textTransform: "none", fontSize: "0.75rem", color: "#64748B" }}
                            >
                                Reset to Report
                            </Button>

                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setBatchDateAnchorEl(null)}
                                    sx={{ textTransform: "none", fontSize: "0.75rem" }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    disabled={
                                        !tempBatchFromDate ||
                                        !tempBatchToDate ||
                                        dayjs(tempBatchFromDate).isAfter(dayjs(tempBatchToDate))
                                    }
                                    onClick={() => {
                                        setBatchFromDate(tempBatchFromDate);
                                        setBatchToDate(tempBatchToDate);
                                        setIsBatchDateCustom(tempBatchFromDate !== fromDate || tempBatchToDate !== toDate);
                                        setBatchDateAnchorEl(null);
                                    }}
                                    sx={{
                                        textTransform: "none",
                                        fontSize: "0.75rem",
                                        bgcolor: "#1E3A8A",
                                        "&:hover": { bgcolor: "#1E40AF" },
                                    }}
                                >
                                    Apply Filter
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Popover>

                {/* Dialog Content: Table with Invoice No & Date as Separate Columns & No Horizontal Bottom Scroll */}
                <DialogContent sx={{ p: 0, bgcolor: "#FFFFFF", overflowX: "hidden" }}>
                    {batchModalLoading ? (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                py: 8,
                                gap: 1.5,
                            }}
                        >
                            <CircularProgress size={36} sx={{ color: "#1E3A8A" }} />
                            <Typography sx={{ color: "#64748B", fontSize: "0.85rem", fontWeight: 500 }}>
                                Loading batch transactions...
                            </Typography>
                        </Box>
                    ) : batchModalError ? (
                        <Box sx={{ textAlign: "center", py: 5, px: 2 }}>
                            <Typography sx={{ color: "#DC2626", fontWeight: 600, mb: 1 }}>{batchModalError}</Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                    if (selectedBatchItem) {
                                        loadBatchTransactions(selectedBatchItem, batchFromDate, batchToDate);
                                    }
                                }}
                            >
                                Retry
                            </Button>
                        </Box>
                    ) : processedBatchRows.length === 0 ? (
                        <Box sx={{ textAlign: "center", py: 8 }}>
                            <Typography sx={{ color: "#64748B", fontSize: "0.9rem", fontWeight: 500 }}>
                                No transaction records found for Batch &ldquo;{selectedBatchItem?.batchNo}&rdquo; within the selected date range.
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer
                            sx={{
                                maxHeight: "65vh",
                                overflowY: "auto",
                                overflowX: "hidden",
                            }}
                        >
                            <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                                <TableHead>
                                    {/* ROW 1: COLUMN HEADERS */}
                                    <TableRow sx={{ height: 32 }}>
                                        <TableCell
                                            align="center"
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                width: 48,
                                                py: 0.4,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            S.NO
                                        </TableCell>

                                        <TableCell
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                width: 95,
                                                py: 0.4,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            Date
                                        </TableCell>

                                        {/* INVOICE NO (SEPARATE COLUMN) */}
                                        <TableCell
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                width: 130,
                                                py: 0.4,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            Vocuher No
                                        </TableCell>

                                        <TableCell
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                py: 0.4,
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                whiteSpace: "nowrap",
                                                zIndex: 3,
                                            }}
                                        >
                                            Particulars
                                        </TableCell>

                                        <TableCell
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                py: 0.4,
                                                width: 130,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            Voucher Type
                                        </TableCell>

                                        <TableCell
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                py: 0.4,
                                                width: 160,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            Retailer
                                        </TableCell>

                                        <TableCell
                                            align="right"
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                py: 0.4,
                                                width: 120,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            IN
                                        </TableCell>

                                        <TableCell
                                            align="right"
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                py: 0.4,
                                                width: 120,
                                                whiteSpace: "nowrap",
                                                borderRight: "1px solid rgba(255, 255, 255, 0.1)",
                                                zIndex: 3,
                                            }}
                                        >
                                            OUT
                                        </TableCell>

                                        <TableCell
                                            align="right"
                                            sx={{
                                                bgcolor: "#1E3A8A !important",
                                                color: "#FFFFFF !important",
                                                fontWeight: 700,
                                                fontSize: "0.76rem",
                                                py: 0.4,
                                                width: 125,
                                                whiteSpace: "nowrap",
                                                zIndex: 3,
                                            }}
                                        >
                                            CLS
                                        </TableCell>
                                    </TableRow>

                                    {/* ROW 2: FIXED TOTAL ROW — directly below Table Header */}
                                    <TableRow
                                        sx={{
                                            height: 32,
                                            "& .MuiTableCell-root": {
                                                bgcolor: "#F1F5F9 !important",
                                                position: "sticky",
                                                top: "32px !important",
                                                zIndex: 2,
                                                py: 0.35,
                                                whiteSpace: "nowrap",
                                                borderBottom: "2px solid #CBD5E1",
                                            },
                                        }}
                                    >
                                        <TableCell align="center" />
                                        <TableCell />
                                        <TableCell />
                                        <TableCell sx={{ fontWeight: 700, color: "#0F172A", fontSize: "0.76rem", whiteSpace: "nowrap" }}>
                                            TOTAL
                                        </TableCell>
                                        <TableCell />
                                        <TableCell />
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                color: "#16A34A",
                                                fontSize: "0.76rem",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {formatBatchQtyWithBag(batchTotals.totalIn, selectedBatchItem?.item || null)}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                color: "#DC2626",
                                                fontSize: "0.76rem",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {formatBatchQtyWithBag(batchTotals.totalOut, selectedBatchItem?.item || null)}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                color: "#1D4ED8",
                                                fontSize: "0.78rem",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {formatBatchQtyWithBag(batchTotals.finalCls, selectedBatchItem?.item || null)}
                                        </TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {/* DATA ROWS (COMPACT SINGLE LINE) */}
                                    {processedBatchRows.map((row) => {
                                        const isOB =
                                            row.invoice_no === "OB" ||
                                            String(row.Particulars || "").toLowerCase().includes("opening balance");

                                        return (
                                            <TableRow
                                                key={`${row.Trans_Id || row.sNo}-${row.sNo}`}
                                                hover
                                                sx={{
                                                    height: 32,
                                                    bgcolor: isOB ? "#F8FAFC" : row.sNo % 2 === 0 ? "#FAFAFA" : "#FFFFFF",
                                                    "&:hover": { bgcolor: "#EFF6FF" },
                                                    borderBottom: "1px solid #F1F5F9",
                                                }}
                                            >
                                                {/* S.NO */}
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        color: "#64748B",
                                                        fontWeight: 500,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {row.sNo}
                                                </TableCell>

                                                {/* Date */}
                                                <TableCell
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        color: "#475569",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {row.Ledger_Date ? dayjs(row.Ledger_Date).format("DD/MM/YYYY") : "—"}
                                                </TableCell>

                                                {/* Invoice No (Separate Column) */}
                                                <TableCell
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        color: "#595a5cff",
                                                        fontWeight: row.invoice_no === "OB" ? 500 : 600,
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        maxWidth: 140,
                                                    }}
                                                    title={row.invoice_no || ""}
                                                >
                                                    {row.invoice_no || "—"}
                                                </TableCell>

                                                {/* Particulars (Single Line) */}
                                                <TableCell
                                                    sx={{
                                                        py: 0.35,
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        maxWidth: 240,
                                                    }}
                                                    title={row.Particulars || (isOB ? "Opening Balance" : "—")}
                                                >
                                                    <Typography
                                                        component="span"
                                                        sx={{
                                                            fontSize: "0.75rem",
                                                            fontWeight: isOB ? 700 : 500,
                                                            color: isOB ? "#0F172A" : "#1E293B",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {row.Particulars || (isOB ? "Opening Balance" : "—")}
                                                    </Typography>
                                                </TableCell>

                                                {/* Voucher Name (Single Line) */}
                                                <TableCell
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        color: "#334155",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        maxWidth: 140,
                                                    }}
                                                    title={row.voucher_name || ""}
                                                >
                                                    {row.voucher_name || "—"}
                                                </TableCell>

                                                {/* Retailer (Single Line) */}
                                                <TableCell
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        color: "#334155",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        maxWidth: 170,
                                                    }}
                                                    title={row.Retailer_Name || ""}
                                                >
                                                    {row.Retailer_Name || "—"}
                                                </TableCell>

                                                {/* IN */}
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        fontWeight: row.inQtyVal > 0 ? 600 : 400,
                                                        color: row.inQtyVal > 0 ? "#16A34A" : "#94A3B8",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {formatBatchQtyWithBag(row.inQtyVal, selectedBatchItem?.item || null)}
                                                </TableCell>

                                                {/* OUT */}
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        fontWeight: row.outQtyVal > 0 ? 600 : 400,
                                                        color: row.outQtyVal > 0 ? "#DC2626" : "#94A3B8",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {formatBatchQtyWithBag(row.outQtyVal, selectedBatchItem?.item || null)}
                                                </TableCell>

                                                {/* CLS */}
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        py: 0.35,
                                                        fontSize: "0.75rem",
                                                        fontWeight: 700,
                                                        color: "#1D4ED8",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {formatBatchQtyWithBag(row.clsQtyVal, selectedBatchItem?.item || null)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
            </Dialog>



        </>
    );
};

export default StockInHandReport;
