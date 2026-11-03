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
    Button,
    IconButton,
    Menu,
    Switch,
    Typography,
    TextField,
    MenuItem,
    Tooltip,
    Dialog,
    DialogActions,
    DialogTitle,
    DialogContent,
    CircularProgress,
    Chip
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import CloseIcon from "@mui/icons-material/Close";
import TableChartIcon from "@mui/icons-material/TableChart";
import ViewListIcon from "@mui/icons-material/ViewList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import { SettingsService } from "../../services/reportSettings.services";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import {
    onlineSalesReportLOLService,
    onlineSalesReportItemLOLService,
} from "../../services/OnlineSalesReport.service";
import { lollosColumnsService, LolLosColumn } from "../../services/lollosColumns.service";

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    isNumeric?: boolean;
    order: number;
    groupBy?: number;
};

export type ExportFormat = "default" | "not_repeated";

/* ================= CONSTANTS ================= */

const NUMERIC_KEYS = [
    "Item_Count",
    "Total_Invoice_value",
    "Rate",
    "Bill_Qty",
    "Amount",
];

const SUMMABLE_KEYS = new Set([
    "Total_Invoice_value",
    "Item_Count",
    "Bill_Qty",
    "Amount",
]);

const ABSTRACT_DEFAULT_KEYS = [
    "Ledger_Date",
    "invoice_no",
    "Retailer_Name",
    "Item_Count",
    "Total_Invoice_value",
];

const EXPANDED_DEFAULT_KEYS = [
    "Ledger_Date",
    "invoice_no",
    "Retailer_Name",
    "Product_Name",
    "Bill_Qty",
    "Rate",
    "Amount",
];

type SortableColumnRowProps = {
    column: ColumnConfig;
    onToggle: (key: string) => void;
    hasActiveFilter?: boolean;
};

const SortableColumnRow = ({ column, onToggle, hasActiveFilter, }: SortableColumnRowProps) => {
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

            {/* LABEL */}
            <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1 }}>
                <Typography fontSize="0.75rem">
                    {column.label}
                </Typography>

                {hasActiveFilter && (
                    <Tooltip title="Header filter enabled">
                        <FilterAltIcon fontSize="small" color="action" />
                    </Tooltip>
                )}
            </Box>

            {/* ENABLE / DISABLE */}
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

const CURRENCY_KEYS = ["Total_Invoice_value", "Amount", "Rate"];

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

/* ================= HELPERS ================= */

const buildColumnsFromApi = (
    rows: any[],
    mode: "Abstract" | "Expanded",
    lolColumns: any[]
): ColumnConfig[] => {
    if (!rows.length) return [];

    const defaults =
        mode === "Abstract"
            ? ABSTRACT_DEFAULT_KEYS
            : EXPANDED_DEFAULT_KEYS;

    return Object.keys(rows[0]).map((key, index) => {
        const matched = lolColumns.find(
            col => col.ColumnName?.toUpperCase() === key.toUpperCase()
        );
        const label = (matched && matched.Alias_Name && matched.Alias_Name.trim())
            ? matched.Alias_Name.trim()
            : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        return {
            key,
            label,
            enabled: defaults.includes(key),
            isNumeric: NUMERIC_KEYS.includes(key),
            order: index,
        };
    });
};

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(value);

/* ================= COMPONENT ================= */

const OnlineSalesReportLOL: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const { toggleMode, setToggleMode } = useToggleMode();

    const [abstractRows, setAbstractRows] = useState<any[]>([]);
    const [expandedRows, setExpandedRows] = useState<any[]>([]);
    const rawRows =
        toggleMode === "Expanded" ? expandedRows : abstractRows;
    const [lolColumns, setLolColumns] = useState<LolLosColumn[]>([]);
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
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [loading, setLoading] = useState(false);

    const [settingsAnchor, setSettingsAnchor] =
        useState<null | HTMLElement>(null);
    const [filterAnchor, setFilterAnchor] =
        useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [isEditTemplate, setIsEditTemplate] = useState(false);
    type FiltersMap = {
        Date: { from: string; to: string };
        columnFilters: Record<string, string[] | undefined>;
    };

    const [filters, setFilters] = useState<FiltersMap>({
        Date: { from: today, to: today },
        columnFilters: {},
    });
    const [abstractDateKey, setAbstractDateKey] = useState<string | null>(null);
    const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
    type SortOrder = "asc" | "desc";

    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        order: SortOrder;
    }>({
        key: null,
        order: "asc",
    });

    const currentDateKey = `${filters.Date.from}_${filters.Date.to}`;

    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportTargetType, setExportTargetType] = useState<"Excel" | "PDF">("Excel");

    const [abstractGrouping, setAbstractGrouping] = useState<string[]>([]);
    const [expandedGrouping, setExpandedGrouping] = useState<string[]>([]);

    const [abstractPendingGrouping, setAbstractPendingGrouping] = useState<string[]>([]);
    const [expandedPendingGrouping, setExpandedPendingGrouping] = useState<string[]>([]);

    const [abstractExpandedKeys, setAbstractExpandedKeys] = useState<string[]>([]);
    const [expandedExpandedKeys, setExpandedExpandedKeys] = useState<string[]>([]);

    const serialRef = React.useRef(0);

    const [templateConfig, setTemplateConfig] = useState<{
        abstract: ColumnConfig[];
        expanded: ColumnConfig[];
    } | null>(null);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState("");
    const [parentReportName, setParentReportName] = useState("");
    const grouping =
        toggleMode === "Expanded" ? expandedGrouping : abstractGrouping;

    const [spConfig, setSpConfig] = useState({
        abstractSP: "",
        expandedSP: ""
    });

    const SP_MAP = {
        Abstract: "Reporting_Online_Sales_LOL_VW",
        Expanded: "Reporting_Online_Sales_Item_LOL_VW"
    };

    const HEADER_HEIGHT = 36;

    const setGrouping =
        toggleMode === "Expanded" ? setExpandedGrouping : setAbstractGrouping;

    const pendingGrouping =
        toggleMode === "Expanded"
            ? expandedPendingGrouping
            : abstractPendingGrouping;

    const setPendingGrouping =
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

    /* ================= LOAD DATA ================= */

    useEffect(() => {
        const isTemplateApplied =
            (toggleMode === "Abstract" && templateConfig?.abstract) ||
            (toggleMode === "Expanded" && templateConfig?.expanded);

        // ❌ SKIP CACHE ONLY IF NO TEMPLATE
        const isResetState =
            abstractRows.length === 0 && expandedRows.length === 0;

        if (!isTemplateApplied && !isResetState) {
            if (
                toggleMode === "Abstract" &&
                abstractRows.length > 0 &&
                abstractDateKey === currentDateKey
            ) {
                return;
            }

            if (
                toggleMode === "Expanded" &&
                expandedRows.length > 0 &&
                expandedDateKey === currentDateKey
            ) {
                return;
            }
        }

        const service =
            toggleMode === "Expanded"
                ? onlineSalesReportItemLOLService.getReportsItemLOL
                : onlineSalesReportLOLService.getReportsLOL;

        let currentLolPromise = Promise.resolve(lolColumns);
        if (lolColumns.length === 0) {
            currentLolPromise = lollosColumnsService.getLolColumns()
                .then(res => {
                    const data = res.data.data || [];
                    setLolColumns(data);
                    return data;
                })
                .catch(err => {
                    console.error("Failed to load LOL columns", err);
                    return [];
                });
        }

        setLoading(true);

        Promise.all([
            currentLolPromise,
            service({
                Fromdate: filters.Date.from,
                Todate: filters.Date.to,
            })
        ])
            .then(([currentLol, res]) => {
                const apiRows = res.data.data || [];

                let cols = buildColumnsFromApi(apiRows, toggleMode, currentLol);

                // APPLY TEMPLATE
                if (toggleMode === "Abstract" && templateConfig?.abstract) {
                    cols = applyTemplateToColumns(cols, templateConfig.abstract, currentLol);
                }

                if (toggleMode === "Expanded" && templateConfig?.expanded) {
                    cols = applyTemplateToColumns(cols, templateConfig.expanded, currentLol);
                }

                if (toggleMode === "Expanded") {
                    setExpandedRows(apiRows);
                    setExpandedDateKey(currentDateKey);
                    setExpandedColumns(cols);
                } else {
                    setAbstractRows(apiRows);
                    setAbstractDateKey(currentDateKey);
                    setAbstractColumns(cols);
                }

                setPage(1);
            })
            .catch((err) => {
                console.error(err);
                toast.error("Failed to load report ❌");
            })
            .finally(() => {
                setLoading(false);
            });

    }, [
        toggleMode,
        filters.Date.from,
        filters.Date.to,
        templateConfig // 🔥 VERY IMPORTANT
    ]);

    useEffect(() => {
        setSpConfig({
            abstractSP: SP_MAP.Abstract,
            expandedSP: SP_MAP.Expanded
        });
    }, []);

    const handleResetSettings = () => {
        const todayDate = dayjs().format("YYYY-MM-DD");

        // ✅ Clear template FIRST
        setTemplateConfig(null);

        // ✅ Reset filters
        setFromDate(todayDate);
        setToDate(todayDate);

        setFilters({
            Date: { from: todayDate, to: todayDate },
            columnFilters: {},
        });

        // ✅ Reset grouping
        // Reset BOTH modes
        setAbstractGrouping([]);
        setExpandedGrouping([]);

        setAbstractPendingGrouping([]);
        setExpandedPendingGrouping([]);

        setAbstractExpandedKeys([]);
        setExpandedExpandedKeys([]);

        // ✅ Reset sort
        setSortConfig({ key: null, order: "asc" });

        // ✅ HARD RESET DATA (IMPORTANT)
        setAbstractRows([]);
        setExpandedRows([]);

        setAbstractColumns([]);
        setExpandedColumns([]);

        setAbstractDateKey(null);
        setExpandedDateKey(null);

        // ✅ Reset pagination
        setPage(1);

        // ✅ Close menus
        setSettingsAnchor(null);
        setFilterAnchor(null);
    };

    /* ================= COLUMNS & FILTERING ================= */

    const sortedColumns = useMemo(() => {
        return [...columns].sort((a, b) => {
            // enabled columns first
            if (a.enabled !== b.enabled) {
                return a.enabled ? -1 : 1;
            }
            // then by order
            return a.order - b.order;
        });
    }, [columns]);

    const enabledColumns = useMemo(() => sortedColumns.filter(c => c.enabled), [sortedColumns]);

    const dimensionCols = useMemo(() => {
        return enabledColumns.filter(c => !SUMMABLE_KEYS.has(c.key));
    }, [enabledColumns]);

    const filteredRows = useMemo(() => {
        return rawRows.filter(row => {
            const rowDate = dayjs(row.Ledger_Date);

            if (filters.Date.from && rowDate.isBefore(dayjs(filters.Date.from), "day"))
                return false;

            if (filters.Date.to && rowDate.isAfter(dayjs(filters.Date.to), "day"))
                return false;

            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (values === undefined) continue;

                const rawVal = row[key];
                const formattedVal = key === "Created_on"
                    ? (rawVal ? formatCreatedOn(rawVal) : "-")
                    : key === "Ledger_Date"
                        ? (rawVal ? dayjs(rawVal).format("DD/MM/YYYY") : "-")
                        : String(rawVal ?? "");

                const rowValue = formattedVal.trim().toLowerCase();
                const rawRowValue = String(rawVal ?? "").trim().toLowerCase();

                const match = values.some(v => {
                    const target = String(v).trim().toLowerCase();
                    return target === rowValue || target === rawRowValue;
                });

                if (!match) return false;
            }

            return true;
        });
    }, [rawRows, filters]);

    /* ================= DYNAMIC AGGREGATION BASED ON ENABLED COLUMNS ================= */

    const aggregatedRows = useMemo(() => {
        if (!filteredRows.length) return [];
        if (!enabledColumns.length) return [];

        const map = new Map<string, any>();

        for (const row of filteredRows) {
            const compositeKey = dimensionCols.length > 0
                ? dimensionCols.map(c => {
                    const rawVal = row[c.key];
                    if (c.key === "Created_on") return `Created_on:${formatCreatedOn(rawVal)}`;
                    if (c.key === "Ledger_Date") return `Ledger_Date:${rawVal ? dayjs(rawVal).format("YYYY-MM-DD") : "-"}`;
                    return `${c.key}:${String(rawVal ?? "").trim().toLowerCase()}`;
                }).join(":::")
                : "__ALL__";

            if (!map.has(compositeKey)) {
                const entry: Record<string, any> = { ...row };
                const seenInvoices = new Set<string>();
                if (row.invoice_no) {
                    seenInvoices.add(String(row.invoice_no).trim());
                }
                entry.__seenInvoices = seenInvoices;

                SUMMABLE_KEYS.forEach(k => {
                    if (entry[k] !== undefined && entry[k] !== null) {
                        entry[k] = Number(entry[k]) || 0;
                    }
                });

                map.set(compositeKey, entry);
            } else {
                const entry = map.get(compositeKey);
                const invNo = row.invoice_no ? String(row.invoice_no).trim() : null;
                const isNewInvoice = !invNo || !entry.__seenInvoices.has(invNo);

                if (row.Total_Invoice_value !== undefined && row.Total_Invoice_value !== null) {
                    if (isNewInvoice) {
                        entry.Total_Invoice_value = Number(((Number(entry.Total_Invoice_value) || 0) + (Number(row.Total_Invoice_value) || 0)).toFixed(2));
                    }
                }

                if (row.Item_Count !== undefined && row.Item_Count !== null) {
                    if (isNewInvoice) {
                        entry.Item_Count = Number(((Number(entry.Item_Count) || 0) + (Number(row.Item_Count) || 0)).toFixed(0));
                    }
                }

                if (row.Bill_Qty !== undefined && row.Bill_Qty !== null) {
                    entry.Bill_Qty = Number(((Number(entry.Bill_Qty) || 0) + (Number(row.Bill_Qty) || 0)).toFixed(3));
                }

                if (row.Amount !== undefined && row.Amount !== null) {
                    entry.Amount = Number(((Number(entry.Amount) || 0) + (Number(row.Amount) || 0)).toFixed(2));
                }

                if (invNo) {
                    entry.__seenInvoices.add(invNo);
                }

                dimensionCols.forEach(c => {
                    if ((entry[c.key] === null || entry[c.key] === undefined || entry[c.key] === "") && row[c.key]) {
                        entry[c.key] = row[c.key];
                    }
                });

                if (!dimensionCols.some(c => c.key === "Rate") && entry.Bill_Qty && entry.Amount) {
                    entry.Rate = Number(entry.Bill_Qty) > 0
                        ? Number((Number(entry.Amount) / Number(entry.Bill_Qty)).toFixed(2))
                        : entry.Rate;
                }
            }
        }

        return Array.from(map.values());
    }, [filteredRows, enabledColumns, dimensionCols]);

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
    } = useNumericalFilter(aggregatedRows, NUMERIC_KEYS);

    const sortedRows = useMemo(() => {
        if (numSortConfig) {
            return numFilteredAndSortedRows;
        }

        if (!sortConfig.key) return numFilteredAndSortedRows;

        return [...numFilteredAndSortedRows].sort((a, b) => {
            const aVal = a[sortConfig.key!];
            const bVal = b[sortConfig.key!];

            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (sortConfig.key === "Ledger_Date") {
                return sortConfig.order === "asc"
                    ? dayjs(aVal).valueOf() - dayjs(bVal).valueOf()
                    : dayjs(bVal).valueOf() - dayjs(aVal).valueOf();
            }

            const aNum = Number(aVal);
            const bNum = Number(bVal);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortConfig.order === "asc"
                    ? aNum - bNum
                    : bNum - aNum;
            }

            return sortConfig.order === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }, [numFilteredAndSortedRows, numSortConfig, sortConfig]);

    /* ================= GROUPING ================= */

    const buildGroupedData = React.useCallback(
        (data: any[], level: number, parentKey = ""): any[] => {
            const groupKey = grouping[level];
            if (!groupKey) return data;

            const map = new Map<string, any[]>();

            for (const row of data) {
                const rawVal = row[groupKey];
                const val = groupKey === "Created_on"
                    ? (rawVal ? formatCreatedOn(rawVal) : "-")
                    : groupKey === "Ledger_Date"
                        ? (rawVal ? dayjs(rawVal).format("DD/MM/YYYY") : "-")
                        : String(rawVal ?? "Others");

                if (!map.has(val)) {
                    map.set(val, []);
                }

                map.get(val)!.push(row);
            }

            let groups = Array.from(map.entries()).map(([value, rows]) => ({
                __group: true,
                __key: `${parentKey}${groupKey}:${value}`,
                __value: value,
                __level: level,
                __rows: rows,
            }));

            // 🔥 SORT GROUPS WHEN SORT COLUMN IS SELECTED
            if (sortConfig.key) {
                groups.sort((a, b) => {
                    const key = sortConfig.key!;

                    const getValue = (group: any) => {
                        if (
                            NUMERIC_KEYS.includes(key) ||
                            typeof group.__rows[0]?.[key] === "number"
                        ) {
                            return group.__rows.reduce(
                                (sum: number, r: any) =>
                                    sum + Number(r[key] || 0),
                                0
                            );
                        }

                        if (key === "Created_on") {
                            const d = group.__rows[0]?.[key];
                            return d ? new Date(d).getTime() : 0;
                        }

                        if (key === "Ledger_Date") {
                            const d = group.__rows[0]?.[key];
                            return d ? dayjs(d).valueOf() : 0;
                        }

                        return String(group.__rows[0]?.[key] ?? "");
                    };

                    const aVal = getValue(a);
                    const bVal = getValue(b);

                    if (typeof aVal === "number" && typeof bVal === "number") {
                        return sortConfig.order === "asc"
                            ? aVal - bVal
                            : bVal - aVal;
                    }

                    return sortConfig.order === "asc"
                        ? String(aVal).localeCompare(String(bVal))
                        : String(bVal).localeCompare(String(aVal));
                });
            }

            return groups;
        },
        [grouping, sortConfig]
    );

    const groupedRows = useMemo(() => {
        if (!grouping.length) return sortedRows;

        return buildGroupedData(sortedRows, 0);
    }, [sortedRows, grouping, sortConfig]);

    const flattenRows = (rows: any[]): any[] => {
        const result: any[] = [];

        const walk = (list: any[]) => {
            for (const r of list) {
                result.push(r);

                if (r.__group && expandedKeys.includes(r.__key)) {

                    const children = buildGroupedData(
                        r.__rows,
                        r.__level + 1,
                        `${r.__key} > `
                    );

                    walk(children);
                }
            }
        };

        walk(rows);
        return result;
    };

    const paginatedSourceRows = useMemo(() => {
        return grouping.length
            ? flattenRows(groupedRows)
            : sortedRows;
    }, [groupedRows, sortedRows, grouping, expandedKeys]);

    const finalRows = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        return paginatedSourceRows.slice(start, end);
    }, [paginatedSourceRows, page, rowsPerPage]);

    useEffect(() => {
        if (page > 1 && (page - 1) * rowsPerPage >= paginatedSourceRows.length) {
            setPage(1);
        }
    }, [paginatedSourceRows.length, page, rowsPerPage]);

    /* ================= PAGINATION ================= */

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

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
                ...(!activeList[0].enabled ? enabled : disabled),
            ];
        });
    };

    const baseRows = sortedRows;

    const getTotal = (key: string) => {
        if (key === "Rate") {
            const totalQty = baseRows.reduce((s, r) => s + Number(r["Bill_Qty"] || 0), 0);
            const totalAmt = baseRows.reduce((s, r) => s + Number(r["Amount"] || 0), 0);
            return totalQty > 0 ? Number((totalAmt / totalQty).toFixed(2)) : 0;
        }
        return Number(
            baseRows.reduce((s, r) => s + Number(r[key] || 0), 0).toFixed(2)
        );
    };

    const handleHeaderClick = (
        e: React.MouseEvent<HTMLElement>,
        header: string
    ) => {
        setActiveHeader(header);
        setFilterAnchor(e.currentTarget);
    };

    useEffect(() => {
        if (!enabledColumns.length) return;

        const isCurrentSortKeyEnabled = sortConfig.key
            ? enabledColumns.some(c => c.key === sortConfig.key)
            : false;

        if (!isCurrentSortKeyEnabled) {
            const hasLedgerDate = enabledColumns.some(c => c.key === "Ledger_Date");
            const hasInvoiceNo = enabledColumns.some(c => c.key === "invoice_no");

            if (hasInvoiceNo) {
                setSortConfig({ key: "invoice_no", order: "asc" });
            } else if (hasLedgerDate) {
                setSortConfig({ key: "Ledger_Date", order: "asc" });
            } else {
                setSortConfig({ key: enabledColumns[0].key, order: "asc" });
            }
        }
    }, [enabledColumns, sortConfig.key]);

    const handleSortClick = (
        e: React.MouseEvent<HTMLElement>,
        key: string
    ) => {
        e.stopPropagation();

        setSortConfig(prev => ({
            key,
            order:
                prev.key === key && prev.order === "asc"
                    ? "desc"
                    : "asc",
        }));
    };
    const sortFilterValues = (
        values: string[],
        key: string,
        order: "asc" | "desc"
    ) => {
        return [...values].sort((a, b) => {
            // Date column
            if (key === "Ledger_Date") {
                return order === "asc"
                    ? dayjs(a).valueOf() - dayjs(b).valueOf()
                    : dayjs(b).valueOf() - dayjs(a).valueOf();
            }

            // Numeric column
            if (!isNaN(Number(a)) && !isNaN(Number(b))) {
                return order === "asc"
                    ? Number(a) - Number(b)
                    : Number(b) - Number(a);
            }

            // String column
            return order === "asc"
                ? a.localeCompare(b)
                : b.localeCompare(a);
        });
    };

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        const uniqueValues = Array.from(
            new Set(
                rawRows
                    .map(r => {
                        const rawVal = r[activeHeader];
                        if (rawVal === null || rawVal === undefined || rawVal === "") return null;
                        if (activeHeader === "Created_on") return formatCreatedOn(rawVal);
                        if (activeHeader === "Ledger_Date") return dayjs(rawVal).format("DD/MM/YYYY");
                        return String(rawVal).trim();
                    })
                    .filter((v): v is string => Boolean(v))
            )
        );

        return sortFilterValues(
            uniqueValues,
            activeHeader,
            sortConfig.order
        );
    }, [activeHeader, rawRows, sortConfig.order]);

    const buildExportRows = (format: ExportFormat = "default") => {
        const rows: any[] = [];

        // Identify non-numeric / classification columns that precede the detail / numeric columns
        const firstNumericIndex = enabledColumns.findIndex(
            c => c.isNumeric || NUMERIC_KEYS.includes(c.key)
        );
        const leadingCols =
            firstNumericIndex === -1
                ? enabledColumns
                : enabledColumns.slice(0, firstNumericIndex);

        // Classification columns are all non-numeric leading columns except the last non-numeric column
        // (which serves as the line-item / detail description, e.g. Product Name)
        const classificationCols =
            leadingCols.length > 1
                ? leadingCols.slice(0, leadingCols.length - 1)
                : [];

        const formatCellValue = (row: any, col: ColumnConfig) => {
            if (col.key === "Ledger_Date") {
                return row[col.key] && row[col.key] !== "-" && !String(row[col.key]).includes("/")
                    ? dayjs(row[col.key]).format("DD/MM/YYYY")
                    : (row[col.key] ?? "");
            }
            if (col.key === "Created_on") {
                return formatCreatedOn(row[col.key]);
            }
            return row[col.key] ?? "";
        };

        const createDetailRow = (row: any, prevRow: any) => {
            const detail: any = {};

            if (format === "not_repeated") {
                let parentChanged = false;

                classificationCols.forEach(col => {
                    const currVal = formatCellValue(row, col);
                    const prevVal = prevRow ? formatCellValue(prevRow, col) : null;

                    if (!prevRow || parentChanged || String(currVal).trim() !== String(prevVal).trim()) {
                        detail[col.label] = currVal;
                        parentChanged = true;
                    } else {
                        detail[col.label] = "";
                    }
                });

                for (let j = classificationCols.length; j < enabledColumns.length; j++) {
                    const col = enabledColumns[j];
                    detail[col.label] = formatCellValue(row, col);
                }
            } else {
                // Default: how the screen should look like
                enabledColumns.forEach(col => {
                    detail[col.label] = formatCellValue(row, col);
                });
            }

            return detail;
        };

        const walk = (
            list: any[],
            level = 0
        ) => {
            let prevDetailRow: any = null;

            for (const row of list) {

                // GROUP ROW
                if (row.__group) {
                    prevDetailRow = null;

                    const exportGroup: any = {};

                    enabledColumns.forEach(col => {

                        const currentGroupKey =
                            grouping[row.__level];

                        if (col.key === currentGroupKey) {
                            const formattedVal =
                                currentGroupKey === "Created_on"
                                    ? (row.__value && row.__value !== "-" && !row.__value.includes("m.") ? formatCreatedOn(row.__value) : row.__value)
                                    : currentGroupKey === "Ledger_Date"
                                        ? (row.__value && row.__value !== "-" && !row.__value.includes("/") ? dayjs(row.__value).format("DD/MM/YYYY") : row.__value)
                                        : row.__value;

                            exportGroup[col.label] =
                                `${" ".repeat(row.__level * 4)}${formattedVal}`;
                        }
                        else if (col.isNumeric) {

                            exportGroup[col.label] =
                                row.__rows.reduce(
                                    (sum: number, r: any) =>
                                        sum + Number(r[col.key] || 0),
                                    0
                                );
                        }
                        else {
                            exportGroup[col.label] = "";
                        }
                    });

                    rows.push(exportGroup);

                    // ONLY EXPORT CHILDREN IF EXPANDED
                    if (expandedKeys.includes(row.__key)) {

                        const children = buildGroupedData(
                            row.__rows,
                            row.__level + 1,
                            `${row.__key} > `
                        );

                        walk(children, level + 1);
                    }

                    continue;
                }

                // DETAIL ROW
                const detail = createDetailRow(row, prevDetailRow);
                prevDetailRow = row;
                rows.push(detail);
            }
        };

        if (grouping.length) {
            walk(groupedRows);
        }
        else {
            let prevRow: any = null;
            sortedRows.forEach(row => {
                const detail = createDetailRow(row, prevRow);
                prevRow = row;
                rows.push(detail);
            });
        }

        return rows;
    };

    const handleExportExcel = (format: ExportFormat = "default") => {

        const exportRows = buildExportRows(format);

        const worksheet =
            XLSX.utils.json_to_sheet(exportRows);

        const workbook =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            toggleMode
        );

        const suffix =
            format === "not_repeated" ? "SameDatasNotRepeated" : "Default";

        XLSX.writeFile(
            workbook,
            `OnlineSales_${toggleMode}_${suffix}_${dayjs().format(
                "DDMMYYYY"
            )}.xlsx`
        );
    };

    const handleExportPDF = (format: ExportFormat = "default") => {

        const exportRows = buildExportRows(format);

        const doc =
            new jsPDF("l", "mm", "a4");

        doc.setFontSize(12);

        const formatTitle =
            format === "not_repeated" ? "Same Datas not repeated" : "Default";

        doc.text(
            `Online Sales Report (${toggleMode}) - ${formatTitle}`,
            14,
            10
        );

        autoTable(doc, {
            startY: 15,

            head: [
                enabledColumns.map(
                    c => c.label
                )
            ],

            body: exportRows.map(r =>
                enabledColumns.map(
                    c => r[c.label] ?? ""
                )
            ),

            styles: {
                fontSize: 7
            },

            headStyles: {
                fillColor: [30, 58, 138]
            },

            didParseCell(data) {

                const row =
                    exportRows[data.row.index];

                const firstColumn =
                    enabledColumns[0]?.label;

                if (
                    row &&
                    row[firstColumn] &&
                    typeof row[firstColumn] === "string" &&
                    row[firstColumn].startsWith(" ")
                ) {
                    data.cell.styles.fontStyle =
                        "bold";
                }
            }
        });

        const suffix =
            format === "not_repeated" ? "SameDatasNotRepeated" : "Default";

        doc.save(
            `OnlineSales_${toggleMode}_${suffix}.pdf`
        );
    };

    /* ================= TEMPLATE ================= */

    const loadTemplate = async (reportId: number) => {
        try {
            setTemplateLoading(true);

            setSelectedTemplateId(reportId);

            const absRes = await SettingsService.getReportEditData({
                reportId,
                typeId: 1,
            });

            const expRes = await SettingsService.getReportEditData({
                reportId,
                typeId: 2,
            });

            const abstractCols = absRes.data.data.columns || [];
            const expandedCols = expRes.data.data.columns || [];

            setTemplateConfig({
                abstract: abstractCols,
                expanded: expandedCols,
            });

            if (absRes.data.data.reportInfo?.Report_Name) {
                setReportName(absRes.data.data.reportInfo.Report_Name);
            }

            if (absRes.data.data.reportInfo?.Parent_Report) {
                setParentReportName(
                    absRes.data.data.reportInfo.Parent_Report
                );
            }

            setAbstractRows([]);
            setExpandedRows([]);

        } catch (err) {
            console.error(err);
            toast.error("Failed to load template ❌");
        } finally {
            setTemplateLoading(false);
        }
    };

    const applyTemplateToColumns = (
        baseCols: ColumnConfig[],
        templateCols: any[],
        lolColumns: any[]
    ): ColumnConfig[] => {

        const templateBased = templateCols.map(t => {
            const matched = lolColumns.find(
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
                groupBy: t.groupBy ?? 0,
                isNumeric: NUMERIC_KEYS.includes(t.key),
            };
        });

        const merged = templateBased.map(col => {
            const base = baseCols.find(b => b.key === col.key);
            return {
                ...col,
                isNumeric: base?.isNumeric ?? col.isNumeric,
            };
        });

        const missing = baseCols
            .filter(b => !templateBased.some(t => t.key === b.key))
            .map(b => {
                const matched = lolColumns.find(
                    col => col.ColumnName?.toUpperCase() === b.key.toUpperCase()
                );
                const label = (matched && matched.Alias_Name && matched.Alias_Name.trim())
                    ? matched.Alias_Name.trim()
                    : b.label;
                return {
                    ...b,
                    label,
                    enabled: false,
                    groupBy: 0,
                };
            });

        return [...merged, ...missing];
    };

    useEffect(() => {
        if (!columns.length || !templateConfig) return;

        const autoGroupCols = columns
            .filter(col => col.groupBy && col.enabled)
            .sort((a, b) => (a.groupBy! - b.groupBy!))
            .map(col => col.key);

        if (toggleMode === "Expanded") {
            setExpandedGrouping(autoGroupCols);
            setExpandedPendingGrouping(autoGroupCols);
            setExpandedExpandedKeys([]);
        } else {
            setAbstractGrouping(autoGroupCols);
            setAbstractPendingGrouping(autoGroupCols);
            setAbstractExpandedKeys([]);
        }
    }, [columns]);

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

            if (!abstractColumns.length || !expandedColumns.length) {
                toast.error("Load both Abstract & Expanded once");
                return;
            }

            /* =========================================
               GET LOGIN USER ID
            ========================================= */
            const userData = JSON.parse(localStorage.getItem("user") || "{}");
            const createdBy = userData?.id || 0;

            /* =========================================
               BUILD COMMON DATA
            ========================================= */
            const abstractPayload = abstractColumns.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: abstractGrouping.includes(c.key)
                    ? abstractGrouping.indexOf(c.key) + 1
                    : 0,
                dataType: "nvarchar"
            }));

            const expandedPayload = expandedColumns.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: expandedGrouping.includes(c.key)
                    ? expandedGrouping.indexOf(c.key) + 1
                    : 0,
                dataType: "nvarchar"
            }));

            /* =========================================
               EDIT MODE
            ========================================= */
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

            /* =========================================
               CREATE MODE
            ========================================= */
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
            }, 500);

        } catch (err) {
            console.error(err);
            toast.error("Save Failed ❌");
        }
    };

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onExportPDF={() => {
                    setExportTargetType("PDF");
                    setExportDialogOpen(true);
                }}
                onExportExcel={() => {
                    setExportTargetType("Excel");
                    setExportDialogOpen(true);
                }}
                onReportChange={(template) => {
                    if (!template) {
                        const todayDate = dayjs().format("YYYY-MM-DD");

                        setIsEditTemplate(false);
                        setSelectedTemplateId(null);
                        setReportName("");
                        setParentReportName("");
                        setTemplateConfig(null);

                        setToggleMode("Abstract");

                        setFromDate(todayDate);
                        setToDate(todayDate);

                        setFilters({
                            Date: { from: todayDate, to: todayDate },
                            columnFilters: {},
                        });

                        setSortConfig({
                            key: null,
                            order: "asc",
                        });

                        setAbstractGrouping([]);
                        setExpandedGrouping([]);

                        setAbstractPendingGrouping([]);
                        setExpandedPendingGrouping([]);

                        setAbstractExpandedKeys([]);
                        setExpandedExpandedKeys([]);

                        setAbstractRows([]);
                        setExpandedRows([]);
                        setAbstractColumns([]);
                        setExpandedColumns([]);
                        setAbstractDateKey(null);
                        setExpandedDateKey(null);
                        setPage(1);
                        setSettingsAnchor(null);
                        setFilterAnchor(null);

                        return;
                    }

                    setIsEditTemplate(true);
                    setSelectedTemplateId(template.Report_Id);
                    setReportName(template.Report_Name);

                    loadTemplate(template.Report_Id);
                }}

                onQuickSave={(parentName) => {
                    setParentReportName(parentName);

                    /* New Template only */
                    if (!selectedTemplateId) {
                        setReportName("");
                    }

                    setSaveDialogOpen(true);
                }}
                settingsSlot={
                    <Box display="flex" gap={1}>
                        {/* GROUP BY ICON */}
                        <Tooltip title="Group By">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setPendingGrouping(grouping);
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
                        </Tooltip>

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
                    </Box>
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
                onApply={() =>
                    setFilters({
                        ...filters,
                        Date: { from: fromDate, to: toDate },
                    })
                }
            />

            <AppLayout fullWidth>
                <Box sx={{ overflow: "auto", mt: 1 }}>
                    {templateLoading && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: "rgba(255,255,255,0.5)",
                                zIndex: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CircularProgress size={40} />
                        </Box>
                    )}
                    {loading && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: "rgba(255,255,255,0.5)",
                                zIndex: 20,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CircularProgress size={40} />
                        </Box>
                    )}
                    <TableContainer
                        component={Paper}
                        sx={{
                            maxHeight: "calc(100vh - 100px)", "& th, & td": {
                                fontSize: "0.75rem",
                            },
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
                                    <TableCell sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 600, }}>
                                        S.No
                                    </TableCell>
                                    {enabledColumns.map((c) => (
                                        <TableCell
                                            key={c.key}
                                            align={c.isNumeric ? "right" : "left"}
                                            sx={{
                                                color: "#fff",
                                                cursor: "pointer",
                                            }}
                                            onClick={(e) => {
                                                if (c.isNumeric) {
                                                    openNumFilter(e, c.key);
                                                } else {
                                                    handleHeaderClick(e, c.key);
                                                }
                                            }}
                                        >
                                            {c.isNumeric ? (
                                                <SortableHeaderLabel
                                                    label={c.label}
                                                    columnKey={c.key}
                                                    sortConfig={numSortConfig}
                                                    onSort={handleNumSort}
                                                    onOpenFilter={(e) => openNumFilter(e, c.key)}
                                                />
                                            ) : (
                                                <Box
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="space-between"
                                                >
                                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                                        {c.label}
                                                    </Box>
                                                    <IconButton
                                                        size="small"
                                                        sx={{ color: "#fff", p: 0 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSortClick(e, c.key);
                                                        }}
                                                    >
                                                        {sortConfig.key === c.key ? (
                                                            sortConfig.order === "asc" ? (
                                                                <ArrowDropDownIcon fontSize="small" />
                                                            ) : (
                                                                <ArrowDropUpIcon fontSize="small" />
                                                            )
                                                        ) : (
                                                            <ArrowDropDownIcon
                                                                fontSize="small"
                                                                sx={{ opacity: 0.3 }}
                                                            />
                                                        )}
                                                    </IconButton>
                                                </Box>
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                                <TableRow
                                    sx={{
                                        background: "#f3f4f6",
                                        position: "sticky",
                                        top: "var(--mui-table-header-height, 36px)",
                                        zIndex: 2,
                                    }}
                                >
                                    <TableCell>Total</TableCell>
                                    {enabledColumns.map((c) => (
                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"}>
                                            {c.isNumeric
                                                ? CURRENCY_KEYS.includes(c.key)
                                                    ? formatINR(getTotal(c.key))
                                                    : getTotal(c.key)
                                                : ""}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {(() => {
                                    serialRef.current = (page - 1) * rowsPerPage;

                                    return finalRows.map((row: any, i) => {
                                        if (row.__group) {
                                            const expanded = expandedKeys.includes(row.__key);

                                            return (
                                                <TableRow key={row.__key} sx={{ background: "#E2E8F0" }}>
                                                    <TableCell>
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
                                                    </TableCell>

                                                    {enabledColumns.map(c => {
                                                        const currentGroupKey = grouping[row.__level];

                                                        if (c.key === currentGroupKey) {
                                                            const displayVal =
                                                                currentGroupKey === "Created_on"
                                                                    ? (row.__value && row.__value !== "-" && !row.__value.includes("m.") ? formatCreatedOn(row.__value) : row.__value)
                                                                    : currentGroupKey === "Ledger_Date"
                                                                        ? (row.__value && row.__value !== "-" && !row.__value.includes("/") ? dayjs(row.__value).format("DD/MM/YYYY") : row.__value)
                                                                        : row.__value;

                                                            return (
                                                                <TableCell key={c.key} sx={{ fontWeight: 700 }}>
                                                                    {displayVal}
                                                                </TableCell>
                                                            );
                                                        }

                                                        if (c.isNumeric) {
                                                            const total = row.__rows.reduce(
                                                                (s: number, r: any) =>
                                                                    s + Number(r[c.key] || 0),
                                                                0
                                                            );

                                                            return (
                                                                <TableCell key={c.key} align="right">
                                                                    {CURRENCY_KEYS.includes(c.key)
                                                                        ? formatINR(total)
                                                                        : total}
                                                                </TableCell>
                                                            );
                                                        }

                                                        return <TableCell key={c.key} align={c.isNumeric ? "right" : "left"} />;
                                                    })}
                                                </TableRow>
                                            );
                                        }

                                        return (
                                            <TableRow key={i}>
                                                <TableCell>
                                                    {!row.__group ? ++serialRef.current : ""}
                                                </TableCell>

                                                {enabledColumns.map(c => {
                                                    const align = c.isNumeric ? "right" : "left";
                                                    return (
                                                        <TableCell key={c.key} align={align}>
                                                            {c.key === "Ledger_Date"
                                                                ? dayjs(row[c.key]).format("DD/MM/YYYY")
                                                                : c.key === "Created_on"
                                                                    ? formatCreatedOn(row[c.key])
                                                                    : row[c.key]}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    });
                                })()}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <CommonPagination
                        totalRows={paginatedSourceRows.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </Box>
            </AppLayout>

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
                isDateColumn={activeHeader === "Ledger_Date"}
                dateFrom={filters.Date.from}
                dateTo={filters.Date.to}
                onDateChange={(dates) =>
                    setFilters((p) => ({
                        ...p,
                        Date: { ...p.Date, from: dates.from, to: dates.to },
                    }))
                }
                onApplyDate={() => setFilterAnchor(null)}
            />

            {/* ===== COLUMN SETTINGS ===== */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
            >
                <Box p={2} minWidth={300}>
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        mb={1}
                    >
                        <Typography fontWeight={600}>
                            Column Settings
                        </Typography>

                        <Button
                            size="small"
                            color="info"
                            onClick={handleResetSettings}
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
                                    <SortableColumnRow
                                        key={c.key}
                                        column={c}
                                        hasActiveFilter={
                                            c.key === "Ledger_Date"
                                                ? filters.Date.from !== today || filters.Date.to !== today
                                                : (filters.columnFilters[c.key]?.length ?? 0) > 0
                                        }
                                        onToggle={key =>
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
                                    <SortableColumnRow
                                        key={c.key}
                                        column={c}
                                        hasActiveFilter={
                                            c.key === "Ledger_Date"
                                                ? filters.Date.from !== today || filters.Date.to !== today
                                                : (filters.columnFilters[c.key]?.length ?? 0) > 0
                                        }
                                        onToggle={key =>
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

            {/* *******GROUPING******* */}
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
                            value={pendingGrouping[level] || ""}
                            onChange={e => {
                                const copy = [...pendingGrouping];
                                copy[level] = e.target.value;
                                setPendingGrouping(copy);
                            }}
                        >
                            <MenuItem value="">
                                No Grouping (Level {level + 1})
                            </MenuItem>

                            {enabledColumns.map(col => (
                                <MenuItem
                                    key={col.key}
                                    value={col.key}
                                    disabled={pendingGrouping.includes(col.key)}
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
                            setGrouping(pendingGrouping.filter(Boolean));
                            setExpandedKeys([]);
                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* *****TEMPLATE***** */}

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

            {/* Export Format Selection Dialog */}
            <Dialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        p: 1,
                        boxShadow: "0 10px 40px rgba(0,0,0,0.15)"
                    }
                }}
            >
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1.25}>
                        <FileDownloadIcon sx={{ color: "#1E3A8A", fontSize: 26 }} />
                        <Typography variant="h6" fontWeight={700} color="#1E3A8A">
                            {exportTargetType === "Excel" ? "Export as Excel" : "Export as PDF"}
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setExportDialogOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, py: 2.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        Please select the format you want to download:
                    </Typography>

                    {/* Format 1: Default */}
                    <Paper
                        variant="outlined"
                        onClick={() => {
                            setExportDialogOpen(false);
                            if (exportTargetType === "Excel") {
                                handleExportExcel("default");
                            } else {
                                handleExportPDF("default");
                            }
                        }}
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            borderColor: "#cbd5e1",
                            cursor: "pointer",
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                                borderColor: "#1E3A8A",
                                bgcolor: "#f8fafc",
                                transform: "translateY(-1px)",
                                boxShadow: "0 4px 12px rgba(30, 58, 138, 0.08)"
                            }
                        }}
                    >
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                            <Box>
                                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                    <TableChartIcon sx={{ fontSize: 20, color: "#1E3A8A" }} />
                                    <Chip label="Default" size="small" sx={{ fontWeight: 700, fontSize: "0.65rem", bgcolor: "#e2e8f0" }} />
                                    <Typography variant="subtitle1" fontWeight={700} color="#1e293b">
                                        Default
                                    </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Downloads how the screen looks with all row data and repeated values fully displayed.
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExportDialogOpen(false);
                                    if (exportTargetType === "Excel") {
                                        handleExportExcel("default");
                                    } else {
                                        handleExportPDF("default");
                                    }
                                }}
                                sx={{
                                    textTransform: "none",
                                    bgcolor: "#1E3A8A",
                                    fontWeight: 600,
                                    borderRadius: 1.5,
                                    flexShrink: 0,
                                    "&:hover": { bgcolor: "#1b3580" }
                                }}
                            >
                                {exportTargetType === "Excel" ? "Download Excel" : "Download PDF"}
                            </Button>
                        </Box>
                    </Paper>

                    {/* Format 2: Same Datas not repeated */}
                    <Paper
                        variant="outlined"
                        onClick={() => {
                            setExportDialogOpen(false);
                            if (exportTargetType === "Excel") {
                                handleExportExcel("not_repeated");
                            } else {
                                handleExportPDF("not_repeated");
                            }
                        }}
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            borderColor: "#93c5fd",
                            bgcolor: "#f0f7ff",
                            cursor: "pointer",
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                                borderColor: "#1E3A8A",
                                bgcolor: "#e8f2fe",
                                transform: "translateY(-1px)",
                                boxShadow: "0 4px 12px rgba(30, 58, 138, 0.12)"
                            }
                        }}
                    >
                        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                            <Box>
                                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                    <ViewListIcon sx={{ fontSize: 20, color: "#1E3A8A" }} />
                                    <Chip label="Same Datas not repeated" size="small" sx={{ fontWeight: 700, fontSize: "0.65rem", bgcolor: "#dbeafe", color: "#1E3A8A" }} />
                                    <Typography variant="subtitle1" fontWeight={700} color="#1E3A8A">
                                        Same Datas not repeated
                                    </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Retailer Name, Invoice No and repeated values are fixed once, leaving subsequent repeated cells blank.
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExportDialogOpen(false);
                                    if (exportTargetType === "Excel") {
                                        handleExportExcel("not_repeated");
                                    } else {
                                        handleExportPDF("not_repeated");
                                    }
                                }}
                                sx={{
                                    textTransform: "none",
                                    bgcolor: "#1E3A8A",
                                    fontWeight: 600,
                                    borderRadius: 1.5,
                                    flexShrink: 0,
                                    "&:hover": { bgcolor: "#1b3580" }
                                }}
                            >
                                {exportTargetType === "Excel" ? "Download Excel" : "Download PDF"}
                            </Button>
                        </Box>
                    </Paper>
                </DialogContent>
                <DialogActions sx={{ px: 2, py: 1.5 }}>
                    <Button onClick={() => setExportDialogOpen(false)} sx={{ textTransform: "none", color: "text.secondary" }}>
                        Cancel
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

export default OnlineSalesReportLOL;