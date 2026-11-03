import React, { useEffect, useMemo, useState } from "react";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Menu,
    TextField,
    MenuItem,
    Typography,
    Tooltip,
    Button,
    Switch,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
} from "@mui/material";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import SettingsIcon from "@mui/icons-material/Settings";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import { DndContext, closestCenter, } from "@dnd-kit/core";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FunctionsIcon from "@mui/icons-material/Functions";
import {
    SortableContext, useSortable,
    verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { SalesReportLedgerService, SalesReportItemService, } from "../../services/SalesReport.service";
import { SettingsService } from "../../services/reportSettings.services";
import { lollosColumnsService } from "../../services/lollosColumns.service";

const ABSTRACT_DEFAULT_KEYS = [
    "Y1",
    "M6",
    "M2",
    "LM",
    "Ledger_Name",
    "Total_Qty",
    "Q_Pay_Days",
    "Freq_Days",
];

const EXPANDED_DEFAULT_KEYS = [
    "Y1",
    "M6",
    "M2",
    "LM",
    "Item_Name",
    "Total_Qty",
];

const NUMERIC_KEYS = [
    "Y1",
    "M6",
    "M2",
    "LM",
    "M3",
    "M9",
    "Total_Qty",
    "Q_Pay_Days",
    "Freq_Days",
    "Tot_Amo",
];

const formatCreatedOn = (dateString: any): string => {
  if (!dateString) return "-";
  if (typeof dateString === "string" && (dateString.includes("a.m.") || dateString.includes("p.m."))) {
    return dateString;
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

  const day = getPart("day");
  const month = getPart("month");
  const year = getPart("year");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod = getPart("dayPeriod").toLowerCase();

  const ampm = dayPeriod.includes("pm") || dayPeriod.includes("p.m") ? "p.m." : "a.m.";

  return `${day}-${month}-${year} ${hour}.${minute} ${ampm}`;
};

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    isNumeric?: boolean;
    order: number;
    groupBy?: number;
};

type FiltersMap = {
    Date: { from: string; to: string };
    columnFilters: Record<string, string[] | undefined>;
};

/* ================= HELPERS ================= */

const normalizeKey = (k: string) =>
    k.replace(/[\s_]/g, "").toLowerCase();

const buildColumnsFromApi = (
    rows: any[],
    mode: "Abstract" | "Expanded",
    lolColumns: any[],
    losColumns: any[]
): ColumnConfig[] => {
    if (!rows.length) return [];

    const defaults =
        mode === "Abstract"
            ? ABSTRACT_DEFAULT_KEYS
            : EXPANDED_DEFAULT_KEYS;

    const mappingCols = mode === "Abstract" ? lolColumns : losColumns;

    return Object.keys(rows[0]).map((key, index) => {
        const matched = mappingCols.find(
            col => col.ColumnName?.toUpperCase() === key.toUpperCase()
        );
        const label = (matched && matched.Alias_Name && matched.Alias_Name.trim()) 
            ? matched.Alias_Name.trim() 
            : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        return {
            key,
            label,
            enabled: defaults.includes(key),

            // ✅ FIX HERE
            isNumeric:
                NUMERIC_KEYS.some(n => normalizeKey(n) === normalizeKey(key)) ||
                rows.some(r => !isNaN(Number(r[key]))),

            order: index,
        };
    });
};

/* ================= COMPONENT ================= */

const SalesReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const { toggleMode, setToggleMode } = useToggleMode();

    const [lolColumns, setLolColumns] = useState<any[]>([]);
    const [losColumns, setLosColumns] = useState<any[]>([]);

    useEffect(() => {
        lollosColumnsService.getLolColumns()
            .then(res => setLolColumns(res.data.data || []))
            .catch(err => console.error("Error loading LOL columns:", err));

        lollosColumnsService.getLosColumns()
            .then(res => setLosColumns(res.data.data || []))
            .catch(err => console.error("Error loading LOS columns:", err));
    }, []);

    /* ===== DATA ===== */
    const [abstractRows, setAbstractRows] = useState<any[]>([]);
    const [expandedRows, setExpandedRows] = useState<any[]>([]);
    const rawRows =
        toggleMode === "Expanded" ? expandedRows : abstractRows;

    /* ===== COLUMNS ===== */
    const [abstractColumns, setAbstractColumns] = useState<ColumnConfig[]>([]);
    const [expandedColumns, setExpandedColumns] = useState<ColumnConfig[]>([]);
    const columns =
        toggleMode === "Expanded"
            ? expandedColumns
            : abstractColumns;
    const setColumns =
        toggleMode === "Expanded"
            ? setExpandedColumns
            : setAbstractColumns;

    /* ===== UI STATE ===== */
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [settingsAnchor, setSettingsAnchor] =
        useState<null | HTMLElement>(null);
    const [filterAnchor, setFilterAnchor] =
        useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);

    /* ===== FILTERS ===== */
    const [filters, setFilters] = useState<FiltersMap>({
        Date: { from: today, to: today },
        columnFilters: {},
    });
    /* ===== GROUPING STATE ===== */
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [abstractGrouping, setAbstractGrouping] = useState<string[]>([]);
    const [expandedGrouping, setExpandedGrouping] = useState<string[]>([]);

    const [abstractPendingGrouping, setAbstractPendingGrouping] = useState<string[]>([]);
    const [expandedPendingGrouping, setExpandedPendingGrouping] = useState<string[]>([]);

    const [abstractExpandedKeys, setAbstractExpandedKeys] = useState<string[]>([]);
    const [expandedExpandedKeys, setExpandedExpandedKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [stockFilter, setStockFilter] = useState<"hasValues" | "zero" | "all">("hasValues");
    const [columnMode, setColumnMode] = useState<Record<string, "total" | "avg">>({});
    const [templateConfig, setTemplateConfig] = useState<{
        abstract: ColumnConfig[];
        expanded: ColumnConfig[];
    } | null>(null);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState("");
    const [parentReportName, setParentReportName] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [isEditTemplate, setIsEditTemplate] = useState(false);
    const [spConfig, setSpConfig] = useState({
        abstractSP: "",
        expandedSP: ""
    });
    const SP_MAP = {
        Abstract: "Avg_Live_Sales_Report_3",
        Expanded: "Avg_Live_Sales_Report_1"
    };

    const HEADER_HEIGHT = 36;

    /* ================= LOAD DATA ================= */

    useEffect(() => {
        setLoading(true);

        const isExpanded = toggleMode === "Expanded";

        const service = isExpanded
            ? SalesReportItemService.getReports
            : SalesReportLedgerService.getReports;

        service({
            Fromdate: filters.Date.from,
            Todate: filters.Date.to,
        })
            .then(res => {
                const apiRows = res.data.data || [];

                // ✅ AUTO DETECT SP
                setSpConfig(prev => ({
                    ...prev,
                    abstractSP: !isExpanded ? SP_MAP.Abstract : prev.abstractSP,
                    expandedSP: isExpanded ? SP_MAP.Expanded : prev.expandedSP,
                }));

                let cols = buildColumnsFromApi(apiRows, toggleMode, lolColumns, losColumns);

                // ✅ APPLY TEMPLATE IF EXISTS
                if (toggleMode === "Expanded" && templateConfig?.expanded) {
                    cols = applyTemplateToColumns(cols, templateConfig.expanded, losColumns);
                }

                if (toggleMode === "Abstract" && templateConfig?.abstract) {
                    cols = applyTemplateToColumns(cols, templateConfig.abstract, lolColumns);
                }

                if (isExpanded) {
                    setExpandedRows(apiRows);

                    setExpandedColumns(prev => {
                        // 🔥 RESET ONLY when DATE or TEMPLATE changes
                        const shouldReset =
                            prev.length === 0 ||
                            templateConfig !== null;

                        return shouldReset ? cols : prev;
                    });

                } else {
                    setAbstractRows(apiRows);

                    setAbstractColumns(prev => {
                        // 🔥 RESET ONLY when DATE or TEMPLATE changes
                        const shouldReset =
                            prev.length === 0 ||
                            templateConfig !== null;

                        return shouldReset ? cols : prev;
                    });
                }

                setPage(1);
            })
            .catch(err => {
                console.error("Sales Report API Error:", err);
            })
            .finally(() => {
                setLoading(false);
            });

    }, [toggleMode, filters.Date.from, filters.Date.to, templateConfig]);

    useEffect(() => {
        if (!columns.length) return;

        setColumnMode(prev => {
            const updated = { ...prev };

            columns.forEach(col => {
                if (col.isNumeric && !updated[col.key]) {
                    updated[col.key] = "total";
                }
            });

            return updated;
        });
    }, [columns]);

    const appliedGroupBy =
        toggleMode === "Expanded"
            ? expandedGrouping
            : abstractGrouping;

    const setAppliedGroupBy =
        toggleMode === "Expanded"
            ? setExpandedGrouping
            : setAbstractGrouping;

    const pendingGroupBy =
        toggleMode === "Expanded"
            ? expandedPendingGrouping
            : abstractPendingGrouping;

    const setPendingGroupBy =
        toggleMode === "Expanded"
            ? setExpandedPendingGrouping
            : setAbstractPendingGrouping;

    const expandedKeys =
        toggleMode === "Expanded"
            ? expandedExpandedKeys
            : abstractExpandedKeys;

    const setExpandedKeys =
        toggleMode === "Expanded"
            ? setExpandedExpandedKeys
            : setAbstractExpandedKeys;

    const loadTemplate = async (reportId: number) => {
        try {
            setLoading(true);

            setSelectedTemplateId(reportId);

            const absRes = await SettingsService.getReportEditData({
                reportId,
                typeId: 1
            });

            const expRes = await SettingsService.getReportEditData({
                reportId,
                typeId: 2
            });

            const abstractCols = absRes.data.data.columns || [];
            const expandedCols = expRes.data.data.columns || [];

            setTemplateConfig({
                abstract: abstractCols,
                expanded: expandedCols
            });

            // report details
            if (absRes.data.data.reportInfo?.Report_Name) {
                setReportName(absRes.data.data.reportInfo.Report_Name);
            }

            if (absRes.data.data.reportInfo?.Parent_Report) {
                setParentReportName(
                    absRes.data.data.reportInfo.Parent_Report
                );
            }

            setSpConfig({
                abstractSP:
                    absRes.data.data.reportInfo?.Abstract_SP ||
                    SP_MAP.Abstract,
                expandedSP:
                    expRes.data.data.reportInfo?.Expanded_SP ||
                    SP_MAP.Expanded
            });

            // force reload data with template
            setAbstractRows([]);
            setExpandedRows([]);

        } catch (err) {
            console.error("Template Load Error:", err);
            toast.error("Failed to load template");
        } finally {
            setLoading(false);
        }
    };


    const applyTemplateToColumns = (
        baseCols: ColumnConfig[],
        templateCols: ColumnConfig[],
        mappingCols: any[]
    ): ColumnConfig[] => {

        const templateBasedCols: ColumnConfig[] = templateCols.map((t) => {
            const matched = mappingCols.find(
                col => col.ColumnName?.toUpperCase() === t.key.toUpperCase()
            );
            const label = (matched && matched.Alias_Name && matched.Alias_Name.trim()) 
                ? matched.Alias_Name.trim() 
                : (t.label || t.key);

            return {
                key: t.key,
                label,
                enabled: t.enabled,
                order: t.order ?? 0,
                groupBy: (t as any).groupBy || 0
            };
        });

        const merged = templateBasedCols.map((col) => {
            const base = baseCols.find(
                (b) => b.key.toLowerCase() === col.key.toLowerCase()
            );

            return {
                ...col,
                isNumeric: base?.isNumeric,
            };
        });

        const missingBase = baseCols
            .filter(
                (b) =>
                    !templateBasedCols.some(
                        (t) => t.key.toLowerCase() === b.key.toLowerCase()
                    )
            )
            .map((b) => {
                const matched = mappingCols.find(
                    col => col.ColumnName?.toUpperCase() === b.key.toUpperCase()
                );
                const label = (matched && matched.Alias_Name && matched.Alias_Name.trim()) 
                    ? matched.Alias_Name.trim() 
                    : b.label;
                return {
                    ...b,
                    label,
                    enabled: false,
                };
            });

        return [...merged, ...missingBase];
    };

    useEffect(() => {
        if (!templateConfig) return;

        const templateCols =
            toggleMode === "Expanded"
                ? templateConfig.expanded
                : templateConfig.abstract;

        if (!templateCols?.length) return;

        const grouping: string[] = [];

        templateCols.forEach((col: any) => {
            if (col.groupBy && col.groupBy > 0 && col.enabled) {
                grouping[col.groupBy - 1] = col.key;
            }
        });

        const finalGrouping = grouping.filter(Boolean);

        if (finalGrouping.length) {
            setAppliedGroupBy(finalGrouping);
            setExpandedKeys([]);
        }

    }, [templateConfig, toggleMode]);

    useEffect(() => {
        setSpConfig({
            abstractSP: SP_MAP.Abstract,
            expandedSP: SP_MAP.Expanded
        });
    }, []);

    /* ================= FILTERING ================= */

    const filteredRows = useMemo(() => {
        return rawRows.filter(row => {

            // ✅ COLUMN FILTERS
            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (values === undefined) continue;
                const rowValue = String(row[key] ?? "");
                if (!values.some(v => v === rowValue)) return false;
            }

            // ✅ STOCK FILTER (existing)
            const y1 = Number(row.Y1) || 0;
            const m6 = Number(row.M6) || 0;
            const m2 = Number(row.M2) || 0;
            const m3 = Number(row.M3) || 0;
            const m9 = Number(row.M9) || 0;
            const total = Number(row.Total_Qty) || 0;
            const totAmo = Number(row["Tot_Amo"]) || 0;

            const hasValue =
                y1 !== 0 || m6 !== 0 || m2 !== 0 || m3 !== 0 || m9 !== 0 || total !== 0 || totAmo !== 0;

            const isZero =
                y1 === 0 && m6 === 0 && m2 === 0 && m3 === 0 && m9 === 0 && total === 0 && totAmo === 0;

            if (stockFilter === "hasValues" && !hasValue) return false;
            if (stockFilter === "zero" && !isZero) return false;

            return true;
        });
    }, [rawRows, filters, stockFilter]);

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
    } = useNumericalFilter(filteredRows, NUMERIC_KEYS);

    /* ================= TOTALS ================= */

    const toggleColumnMode = (key: string) => {
        setColumnMode(prev => ({
            ...prev,
            [key]: prev[key] === "avg" ? "total" : "avg"
        }));
    };

    // const getTotal = (key: string) => {
    //     const values = filteredRows
    //         .map(row => Number(row[key]))
    //         .filter(v => !isNaN(v));

    //     const total = values.reduce((sum, v) => sum + v, 0);

    //     let result = total;

    //     if (columnMode[key] === "avg") {
    //         result = values.length ? total / values.length : 0;
    //     }

    //     return result.toLocaleString("en-IN", {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2,
    //     });
    // };

    /* ================= PAGINATION ================= */

    const buildGroupedData = React.useCallback(
        (data: any[], level: number, parentKey = ""): any[] => {
            const groupKey = appliedGroupBy[level];
            if (!groupKey) return data;

            const map = new Map<string, any[]>();

            for (const row of data) {
                const rawVal = row[groupKey];
                const val = groupKey === "Created_on"
                    ? (rawVal ? formatCreatedOn(rawVal) : "-")
                    : String(rawVal ?? "Others");
                if (!map.has(val)) map.set(val, []);
                map.get(val)!.push(row);
            }

            return Array.from(map.entries()).map(([value, rows]) => ({
                __group: true,
                __key: `${parentKey}${groupKey}:${value}`,
                __value: value,
                __level: level,
                __rows: rows,
            }));
        },
        [appliedGroupBy]
    );

    // 2️⃣ GROUP WHOLE DATA
    const groupedRows = useMemo(() => {
        if (!appliedGroupBy.length) return numFilteredAndSortedRows;
        return buildGroupedData(numFilteredAndSortedRows, 0);
    }, [numFilteredAndSortedRows, appliedGroupBy, buildGroupedData]);

    const flattenRows = (rows: any[]): any[] => {
        const result: any[] = [];

        const walk = (list: any[]) => {
            for (const r of list) {
                result.push(r);
                if (r.__group && expandedKeys.includes(r.__key)) {
                    walk(
                        buildGroupedData(
                            r.__rows,
                            r.__level + 1,
                            `${r.__key} > `
                        )
                    );
                }
            }
        };

        walk(rows);
        return result;
    };

    // ================= PAGINATION SOURCE =================
    const paginatedSourceRows = useMemo(() => {
        return appliedGroupBy.length
            ? flattenRows(groupedRows)
            : numFilteredAndSortedRows;
    }, [groupedRows, numFilteredAndSortedRows, appliedGroupBy, expandedKeys]);

    // ================= FINAL ROWS =================
    const finalRows = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        return paginatedSourceRows.slice(start, end);
    }, [paginatedSourceRows, page, rowsPerPage]);

    // ================= TOTAL ROWS =================
    const totalRowsForPagination = useMemo(() => {
        return paginatedSourceRows.length;
    }, [paginatedSourceRows]);

    // ================= AUTO RESET PAGE =================
    useEffect(() => {
        setPage(1);
    }, [appliedGroupBy, expandedKeys, rowsPerPage]);

    const enabledColumns = useMemo(
        () =>
            [...columns]
                .filter(c => c.enabled)
                .sort((a, b) => a.order - b.order),
        [columns]
    );



    /* ================= EXPORTS ================= */

    const exportRows = useMemo(() => {
        return appliedGroupBy.length
            ? flattenRows(groupedRows)
            : numFilteredAndSortedRows;
    }, [groupedRows, numFilteredAndSortedRows, appliedGroupBy, expandedKeys]);

    const handleExportExcel = () => {
        const rows = exportRows.map(row => {
            const obj: any = {};

            enabledColumns.forEach(c => {

                // GROUP ROW
                if (row.__group) {
                    if (c.key === appliedGroupBy[row.__level]) {
                        obj[c.label] = row.__value;
                    } else if (c.isNumeric) {
                        obj[c.label] = getGroupTotal(row.__rows, c.key);
                    } else {
                        obj[c.label] = "";
                    }
                }
                // NORMAL ROW
                else {
                    if (c.key === "Created_on" && row[c.key]) {
                        obj[c.label] = formatCreatedOn(row[c.key]);
                    } else if (c.key === "Ledger_Date" && row[c.key]) {
                        obj[c.label] = dayjs(row[c.key]).format("DD/MM/YYYY");
                    } else {
                        obj[c.label] = row[c.key] ?? "";
                    }
                }
            });

            return obj;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            wb,
            ws,
            `${toggleMode} Report`
        );

        XLSX.writeFile(
            wb,
            `Sales_Report_${toggleMode}_${dayjs().format("DDMMYYYY")}.xlsx`
        );
    };

    const handleExportPDF = () => {
        const doc = new jsPDF("l", "mm", "a4");

        const rows = exportRows.map(row =>
            enabledColumns.map(c => {

                if (row.__group) {
                    if (c.key === appliedGroupBy[row.__level]) {
                        return row.__value;
                    } else if (c.isNumeric) {
                        return getGroupTotal(row.__rows, c.key);
                    } else {
                        return "";
                    }
                }

                if (c.key === "Created_on" && row[c.key]) {
                    return formatCreatedOn(row[c.key]);
                }
                if (c.key === "Ledger_Date" && row[c.key]) {
                    return dayjs(row[c.key]).format("DD/MM/YYYY");
                }
                return row[c.key] ?? "";
            })
        );

        doc.text(`Sales Report (${toggleMode})`, 14, 10);

        autoTable(doc, {
            startY: 15,
            head: [enabledColumns.map(c => c.label)],
            body: rows,
            styles: { fontSize: 7 },
        });

        doc.save(
            `Sales_Report_${toggleMode}_${dayjs().format("DDMMYYYY")}.pdf`
        );
    };

    /* ================= FILTER MENU ================= */

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        // 🚨 Apply ALL filters EXCEPT current column
        const rowsForOptions = numFilteredAndSortedRows.filter(row => {
            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (key === activeHeader) continue; // ✅ skip current column
                if (values === undefined) continue;

                const rowValue = String(row[key] ?? "");
                if (!values.includes(rowValue)) return false;
            }

            return true;
        });

        return Array.from(
            new Set(
                rowsForOptions
                    .map(r => r[activeHeader!])
                    .filter(Boolean)
                    .map(v => String(v))
            )
        );
    }, [activeHeader, numFilteredAndSortedRows, filters]);

    const groupableColumns = useMemo(() => {
        return enabledColumns.map(c => ({
            key: c.key,
            label: c.label,
        }));
    }, [enabledColumns]);

    const serialRef = React.useRef(0);

    const getGroupTotal = (rows: any[], key: string) => {
        const values = rows
            .map(r => Number(r[key]))
            .filter(v => !isNaN(v));

        const total = values.reduce((sum, v) => sum + v, 0);

        let result = total;

        if (columnMode[key] === "avg") {
            result = values.length ? total / values.length : 0;
        }

        return result.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const renderRows = (rows: any[]) =>
        rows.map((row: any, rowIndex: number) => {
            if (row.__group) {
                const expanded = expandedKeys.includes(row.__key);

                return (
                    <React.Fragment key={row.__key}>
                        {/* ===== GROUP HEADER ===== */}
                        <TableRow sx={{ background: "#E2E8F0" }}>
                            {/* S.No / Expand */}
                            <TableCell>
                                <Box display="flex" alignItems="center">
                                    <IconButton
                                        size="small"
                                        onClick={() =>
                                            setExpandedKeys(p =>
                                                p.includes(row.__key)
                                                    ? p.filter(x => x !== row.__key)
                                                    : [...p, row.__key]
                                            )
                                        }
                                    >
                                        {expanded ? (
                                            <ExpandMoreIcon fontSize="small" />
                                        ) : (
                                            <ChevronRightIcon fontSize="small" />
                                        )}
                                    </IconButton>
                                </Box>
                            </TableCell>

                            {/* 🔥 IMPORTANT: Render all columns */}
                            {enabledColumns.map(c => {
                                // ✅ Show group value in grouped column
                                if (c.key === appliedGroupBy[row.__level]) {
                                    const displayVal =
                                        c.key === "Created_on"
                                            ? (row.__value && row.__value !== "-" && !row.__value.includes("m.") ? formatCreatedOn(row.__value) : row.__value)
                                            : row.__value;

                                    return (
                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"} sx={{ fontWeight: 600 }}>
                                            {displayVal}
                                        </TableCell>
                                    );
                                }

                                // ✅ Show totals for numeric columns
                                if (c.isNumeric) {
                                    return (
                                        <TableCell key={c.key} align="right" sx={{ fontWeight: 600 }}>
                                            {getGroupTotal(row.__rows, c.key)}
                                        </TableCell>
                                    );
                                }

                                // ✅ Empty for others
                                return <TableCell key={c.key} align={c.isNumeric ? "right" : "left"} />;
                            })}
                        </TableRow>
                    </React.Fragment>
                );
            }

            return (
                <TableRow key={row.Id ?? rowIndex}>
                    <TableCell>
                        {++serialRef.current}
                    </TableCell>

                    {enabledColumns.map(c => {
                        const align = c.isNumeric ? "right" : "left";
                        if (c.key === "Ledger_Name" && toggleMode === "Abstract") {
                            return (
                                <TableCell
                                    key={c.key}
                                    align={align}
                                    sx={{
                                        cursor: "pointer",
                                        color: "#1E3A8A",
                                        fontWeight: 500,
                                        textDecoration: "underline"
                                    }}
                                    onClick={() => {

                                        const params = new URLSearchParams({
                                            ledgerId: String(row["Retailer_Id"]),
                                            ledgerName: String(row["Ledger_Name"]),
                                            from: filters.Date.from,
                                            to: filters.Date.to
                                        });

                                        window.open(
                                            `/reports/ledger-item?${params.toString()}`,
                                            "ledgerItemTab"
                                        );
                                    }}
                                >
                                    {row[c.key]}
                                </TableCell>
                            );
                        }

                        if (c.key === "Created_on") {
                            return (
                                <TableCell key={c.key} align={align}>
                                    {formatCreatedOn(row[c.key])}
                                </TableCell>
                            );
                        }

                        return (
                            <TableCell key={c.key} align={align}>
                                {row[c.key]}
                            </TableCell>
                        );
                    })}
                </TableRow>
            );
        });

    const SortableColumnItem: React.FC<{
        column: ColumnConfig;
        showFilter: boolean;
        onToggle: (key: string) => void;
    }> = ({ column, showFilter, onToggle }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
        } = useSortable({ id: column.key });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
        };

        return (
            <Box
                ref={setNodeRef}
                style={style}
                display="flex"
                alignItems="center"
                gap={1}
                mb={1}
            >
                {/* DRAG HANDLE */}
                <IconButton
                    size="small"
                    {...listeners}
                    {...attributes}
                    sx={{ cursor: "grab" }}
                >
                    <DragIndicatorIcon fontSize="small" />
                </IconButton>

                {/* LABEL + FILTER ICON */}
                <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1 }}>
                    <Typography fontSize="0.75rem">
                        {column.label}
                    </Typography>

                    {showFilter && (
                        <Tooltip title="Header filter enabled">
                            <FilterAltIcon fontSize="small" color="action" />
                        </Tooltip>
                    )}
                </Box>

                {/* ENABLE / DISABLE SWITCH */}
                <Switch
                    size="medium"
                    checked={column.enabled}
                    onChange={() => onToggle(column.key)}
                    sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": {
                            color: "#1E3A8A",
                        },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "#b5b9c4",
                        },
                        "& .MuiSwitch-track": {
                            backgroundColor: "#CBD5E1",
                        },
                    }}
                />
            </Box>
        );
    };



    const handleQuickSave = async () => {
        try {

            if (!reportName.trim()) {
                toast.error("Enter Report Name");
                return;
            }

            if (!parentReportName?.trim()) {
                toast.error("Parent Report missing");
                return;
            }

            let finalAbstractCols = abstractColumns;
            let finalExpandedCols = expandedColumns;

            if (!finalAbstractCols.length || !finalExpandedCols.length) {
                toast.error("Load both Abstract & Expanded once");
                return;
            }
            /* =========================================
           GET LOGIN USER ID
        ========================================= */
            const userData = JSON.parse(localStorage.getItem("user") || "{}");
            const createdBy = userData?.id || 0;

            const abstractPayload = finalAbstractCols.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: abstractGrouping.includes(c.key)
                    ? abstractGrouping.indexOf(c.key) + 1
                    : 0,
                dataType: "nvarchar"
            }));

            const expandedPayload = finalExpandedCols.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: expandedGrouping.includes(c.key)
                    ? expandedGrouping.indexOf(c.key) + 1
                    : 0,
                dataType: "nvarchar"
            }));

            /* ===== EDIT TEMPLATE ===== */
            if (selectedTemplateId) {

                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 1,
                    reportName: reportName.trim(),
                    columns: abstractPayload
                });

                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 2,
                    reportName: reportName.trim(),
                    columns: expandedPayload
                });

                toast.success("Template Updated Successfully ✅");
            }

            /* ===== CREATE TEMPLATE ===== */
            else {

                await SettingsService.saveReportSettings({
                    reportName,
                    parentReport: parentReportName,
                    abstractSP: spConfig.abstractSP,
                    expandedSP: spConfig.expandedSP,
                    abstractColumns: abstractPayload,
                    expandedColumns: expandedPayload,
                    createdBy
                });

                toast.success("Template Saved Successfully ✅");
            }

            setSaveDialogOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 400);

        } catch (err) {
            console.error(err);
            toast.error("Save Failed ❌");
        }
    };


    const totalsMap = useMemo(() => {
        const map: Record<string, string> = {};

        enabledColumns.forEach(c => {
            if (!c.isNumeric) return;

            const values = numFilteredAndSortedRows
                .map(row => Number(row[c.key]))
                .filter(v => !isNaN(v));

            const total = values.reduce((sum, v) => sum + v, 0);

            let result = total;

            if (columnMode[c.key] === "avg") {
                result = values.length ? total / values.length : 0;
            }

            map[c.key] = result.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        });

        return map;

    }, [numFilteredAndSortedRows, enabledColumns, columnMode]);

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onReportChange={(template) => {

                    // RESET
                    if (!template) {
                        const todayDate = dayjs().format("YYYY-MM-DD");

                        setIsEditTemplate(false);
                        setSelectedTemplateId(null);
                        setReportName("");
                        setParentReportName("");
                        setTemplateConfig(null);

                        setToggleMode("Abstract");

                        setFilters({
                            Date: { from: todayDate, to: todayDate },
                            columnFilters: {}
                        });

                        setAbstractRows([]);
                        setExpandedRows([]);
                        setAbstractColumns([]);
                        setExpandedColumns([]);

                        setAbstractGrouping([]);
                        setExpandedGrouping([]);

                        setAbstractPendingGrouping([]);
                        setExpandedPendingGrouping([]);

                        setAbstractExpandedKeys([]);
                        setExpandedExpandedKeys([]);

                        setPage(1);

                        return;
                    }

                    // EDIT TEMPLATE
                    setIsEditTemplate(true);
                    setSelectedTemplateId(template.Report_Id);
                    setReportName(template.Report_Name);

                    loadTemplate(template.Report_Id);
                }}
                onQuickSave={(parentName) => {

                    setParentReportName(parentName);

                    // new template only
                    if (!selectedTemplateId) {
                        setReportName("");
                    }

                    setSaveDialogOpen(true);
                }}
                settingsSlot={
                    < Box display="flex" gap={1} >
                        {/* GROUP BY ICON */}
                        < Tooltip title="Group By" >
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setPendingGroupBy(appliedGroupBy);
                                    setGroupDialogOpen(true);
                                }}
                                sx={{
                                    height: 24,
                                    width: 24,
                                    backgroundColor: "#fff",
                                    borderRadius: 0.5,
                                }}
                            >
                                <GroupWorkIcon fontSize="small" />
                            </IconButton>
                        </Tooltip >

                        {/* COLUMN SETTINGS */}
                        < Tooltip title="Column Settings" >
                            <IconButton
                                size="small"
                                onClick={e => setSettingsAnchor(e.currentTarget)}
                                sx={{
                                    height: 24,
                                    width: 24,
                                    backgroundColor: "#fff",
                                    borderRadius: 0.5,
                                }}
                            >
                                <SettingsIcon fontSize="small" />
                            </IconButton>
                        </Tooltip >
                    </Box >
                }
            />
            < ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen(p => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={filters.Date.from}
                toDate={filters.Date.to}
                onFromDateChange={
                    v =>
                        setFilters(p => ({ ...p, Date: { ...p.Date, from: v } }))
                }
                onToDateChange={
                    v =>
                        setFilters(p => ({ ...p, Date: { ...p.Date, to: v } }))
                }
                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}
                onApply={() => setDrawerOpen(false)}
            />

            < AppLayout fullWidth >
                <Box sx={{ overflow: "auto", mt: 1 }}>
                    <TableContainer
                        component={Paper}
                        sx={{
                            maxHeight: "calc(100vh - 100px)",
                            "& th, & td": { fontSize: "0.75rem" },
                        }}
                    >
                        <Table size="small">
                            <TableHead
                                sx={{
                                    background: "#1E3A8A",
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 3,
                                    height: HEADER_HEIGHT,
                                }}
                            >
                                <TableRow>
                                    <TableCell sx={{ color: "#fff" }}>
                                        <Box display="flex" alignItems="center" gap={0.5}>
                                            S.No
                                        </Box>
                                    </TableCell>
                                    {enabledColumns.map(c => (
                                        <TableCell
                                            key={c.key}
                                            align={c.isNumeric ? "right" : "left"}
                                            sx={{
                                                color: "#fff",
                                                backgroundColor: appliedGroupBy.includes(c.key)
                                                    ? "#1E40AF"
                                                    : "inherit",
                                                fontWeight: appliedGroupBy.includes(c.key) ? 700 : 500,
                                                padding: "4px 6px"
                                            }}
                                        >
                                            <Box
                                                display="flex"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                gap={0.5}
                                            >
                                                {c.isNumeric ? (
                                                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                        <SortableHeaderLabel
                                                            label={c.label}
                                                            columnKey={c.key}
                                                            sortConfig={numSortConfig}
                                                            onSort={handleNumSort}
                                                            onOpenFilter={(e) => openNumFilter(e, c.key)}
                                                        />
                                                        <Tooltip
                                                            title={
                                                                columnMode[c.key] === "avg"
                                                                    ? "Showing Average (Click for Total)"
                                                                    : "Showing Total (Click for Avg)"
                                                            }
                                                        >
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => toggleColumnMode(c.key)}
                                                                sx={{
                                                                    color: "#fff",
                                                                    p: 0.3,
                                                                    opacity: columnMode[c.key] === "avg" ? 1 : 0.7
                                                                }}
                                                            >
                                                                <FunctionsIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                ) : (
                                                    <Box
                                                        sx={{ cursor: "pointer", flex: 1 }}
                                                        onClick={e => {
                                                            setActiveHeader(c.key);
                                                            setFilterAnchor(e.currentTarget);
                                                        }}
                                                    >
                                                        {c.label}
                                                    </Box>
                                                )}
                                            </Box>
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* ===== TOTAL ROW ===== */}
                                <TableRow sx={{ background: "#f3f4f6" }}>
                                    <TableCell>
                                        Total / Avg
                                    </TableCell>
                                    {enabledColumns.map(c => (
                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"}>
                                            {c.isNumeric ? totalsMap[c.key] : ""}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>

                            <TableBody>

                                {loading ? (

                                    <TableRow>
                                        <TableCell
                                            colSpan={enabledColumns.length + 1}
                                            align="center"
                                            sx={{ py: 6 }}
                                        >
                                            <CircularProgress size={30} />
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    (() => {
                                       serialRef.current = (page - 1) * rowsPerPage;
                                        return renderRows(finalRows);
                                    })()

                                )}

                            </TableBody>
                        </Table>
                    </TableContainer>

                    <CommonPagination
                        totalRows={totalRowsForPagination}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={(rows) => {
                            setRowsPerPage(rows);
                            setPage(1);
                        }}
                    />
                </Box>
            </AppLayout >

            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
                columnLabel={activeHeader || undefined}
                options={filterOptions}
                selectedValues={activeHeader ? filters.columnFilters[activeHeader] : undefined}
                onFilterChange={(newSelected) => {
                    if (!activeHeader) return;
                    setFilters((p) => {
                        const copy = { ...p.columnFilters };
                        if (newSelected === undefined) {
                            delete copy[activeHeader];
                        } else {
                            copy[activeHeader] = newSelected;
                        }
                        return { ...p, columnFilters: copy };
                    });
                    setPage(1);
                }}
            />

            {/* ===== COLUMN SETTINGS MENU ===== */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
                PaperProps={{
                    sx: {
                        width: 280,
                        maxHeight: 420,
                    },
                }}
            >
                <Box px={2} py={1}>
                    <Typography fontWeight={600} fontSize={13}>
                        Enabled Columns
                    </Typography>
                </Box>

                <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={({ active, over }) => {
                        if (!over || active.id === over.id) return;

                        setColumns(prev => {
                            const enabledCols = prev
                                .filter(c => c.enabled)
                                .sort((a, b) => a.order - b.order);

                            const oldIndex = enabledCols.findIndex(c => c.key === active.id);
                            const newIndex = enabledCols.findIndex(c => c.key === over.id);

                            const reordered = arrayMove(enabledCols, oldIndex, newIndex);

                            return prev.map(col => {
                                const idx = reordered.findIndex(r => r.key === col.key);
                                return idx !== -1 ? { ...col, order: idx } : col;
                            });
                        });
                    }}
                >
                    <SortableContext
                        items={columns.filter(c => c.enabled).map(c => c.key)}
                        strategy={verticalListSortingStrategy}
                    >
                        {columns
                            .filter(c => c.enabled)
                            .sort((a, b) => a.order - b.order)
                            .map(col => (
                                <SortableColumnItem
                                    key={col.key}
                                    column={col}
                                    showFilter={filters.columnFilters[col.key] !== undefined || !!numRangeFilter[col.key]}
                                    onToggle={() =>
                                        setColumns(prev =>
                                            prev.map(c =>
                                                c.key === col.key
                                                    ? { ...c, enabled: false }
                                                    : c
                                            )
                                        )
                                    }
                                />
                            ))}
                    </SortableContext>
                </DndContext>

                <Box px={2} py={1} mt={1}>
                    <Typography fontWeight={600} fontSize={13}>
                        Disabled Columns
                    </Typography>
                </Box>

                {columns
                    .filter(c => !c.enabled)
                    .sort((a, b) => a.order - b.order)
                    .map(col => (
                        <Box
                            key={col.key}
                            display="flex"
                            alignItems="center"
                            gap={1}
                            px={1}
                            py={0.5}
                            mb={1}
                        >
                            {/* LABEL */}
                            <Box sx={{ flex: 1 }}>
                                <Typography fontSize="0.75rem">
                                    {col.label}
                                </Typography>
                            </Box>

                            {/* ENABLE SWITCH */}
                            <Switch
                                size="medium"
                                checked={false}
                                onChange={() =>
                                    setColumns(prev =>
                                        prev.map(c =>
                                            c.key === col.key
                                                ? { ...c, enabled: true }
                                                : c
                                        )
                                    )
                                }
                                sx={{
                                    "& .MuiSwitch-switchBase.Mui-checked": {
                                        color: "#1E3A8A",
                                    },
                                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                        backgroundColor: "#b5b9c4",
                                    },
                                    "& .MuiSwitch-track": {
                                        backgroundColor: "#CBD5E1",
                                    },
                                }}
                            />
                        </Box>
                    ))}
            </Menu>

            {/* ===== GROUPING ===== */}
            <Dialog
                open={groupDialogOpen}
                onClose={() => setGroupDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Group By Columns</DialogTitle>

                <DialogContent>
                    {[0, 1, 2].map(level => (
                        <TextField
                            key={level}
                            select
                            fullWidth
                            margin="dense"
                            label={`Level ${level + 1}`}
                            value={pendingGroupBy[level] || ""}
                            onChange={e => {
                                const copy = [...pendingGroupBy];
                                copy[level] = e.target.value;
                                setPendingGroupBy(copy);
                            }}
                        >
                            <MenuItem value="">
                                No Grouping (Level {level + 1})
                            </MenuItem>

                            {groupableColumns.map(col => (
                                <MenuItem
                                    key={col.key}
                                    value={col.key}
                                    disabled={pendingGroupBy.includes(col.key)}
                                >
                                    {col.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    ))}
                </DialogContent>

                <DialogActions>
                    <Button color="warning" onClick={() => setGroupDialogOpen(false)}>
                        Close
                    </Button>

                    <Button
                        variant="contained"
                        color="info"
                        onClick={() => {
                            setAppliedGroupBy(pendingGroupBy.filter(Boolean));
                            setExpandedKeys([]);
                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ===== DYNAMIC REPORT SAVING ===== */}

            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
                <DialogTitle>
                    {isEditTemplate ? "Edit Template" : "Create Template"}
                </DialogTitle>

                <DialogContent>
                    <TextField
                        fullWidth
                        size="small"
                        label="Report Name"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)}>
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        onClick={handleQuickSave}
                    >
                        Save
                    </Button>
                </DialogActions>
             </Dialog>

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

export default SalesReport;