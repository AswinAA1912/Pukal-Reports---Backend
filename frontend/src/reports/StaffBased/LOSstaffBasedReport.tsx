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
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
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
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import { SettingsService } from "../../services/reportSettings.services";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import {
    staffBasedReportService, costCenterListService
} from "../../services/staffBasedReport.services";
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

/* ================= CONSTANTS ================= */

const NUMERIC_KEYS = [
    "Qty",
    "Rate",
    "Amt",
    "Amount",
    "Bill_Qty",
    "Item_Count",
    "Total_Invoice_value"
];

const DEFAULT_KEYS = [
    "Journal_no",
    "Stock_Journal_date",
    "Stock_Journal_Voucher_type",
    "Product_Name",
    "Godown_Name",
    // "Qty",
    // "Rate"
];

const EXPANDED_DEFAULT_KEYS = [
    "Journal_no",
    "Stock_Journal_date",
    "Stock_Journal_Voucher_type",
    "Product_Name",
    "Godown_Name",
    "Created_By",
    "Qty",
    "Rate"
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

const CURRENCY_KEYS = ["Total_Invoice_value", "Amt", "Rate"];

/* ================= HELPERS ================= */

const buildColumnsFromApi = (
    rows: any[],
    losColumns: any[]
): ColumnConfig[] => {
    if (!rows.length) return [];

    return Object.keys(rows[0]).map((key, index) => {
        const matched = losColumns.find(
            col => col.ColumnName?.toUpperCase() === key.toUpperCase()
        );
        const label = (matched && matched.Alias_Name && matched.Alias_Name.trim()) 
            ? matched.Alias_Name.trim() 
            : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        return {
            key,
            label,

            // ✅ Only DEFAULT_KEYS enabled initially
            enabled: DEFAULT_KEYS.includes(key),

            isNumeric: NUMERIC_KEYS.includes(key),

            // ✅ Enabled first, Disabled later
            order: DEFAULT_KEYS.includes(key)
                ? DEFAULT_KEYS.indexOf(key)
                : DEFAULT_KEYS.length + index,
        };
    });
};

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(value);

/* ================= COMPONENT ================= */

const LOSStaffBasedReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const [rows, setRows] = useState<any[]>([]);
    const rawRows = rows;
    const [losColumns, setLosColumns] = useState<LolLosColumn[]>([]);

    const [abstractColumns, setAbstractColumns] = useState<ColumnConfig[]>([]);
    const [expandedColumns, setExpandedColumns] = useState<ColumnConfig[]>([]);
    const [toggleMode, setToggleMode] = useState<"Abstract" | "Expanded">("Abstract");
    const columns =
        toggleMode === "Expanded"
            ? expandedColumns
            : abstractColumns;

    const setColumns =
        toggleMode === "Expanded"
            ? setExpandedColumns
            : setAbstractColumns;

    const [staffList, setStaffList] = useState<any[]>([]);
    const [expandedData, setExpandedData] = useState<any[]>([]);

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    const [settingsAnchor, setSettingsAnchor] =
        useState<null | HTMLElement>(null);
    const [filterAnchor, setFilterAnchor] =
        useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);
    type FiltersMap = {
        Date: { from: string; to: string };
        columnFilters: Record<string, string[] | undefined>;
    };

    const [filters, setFilters] = useState<FiltersMap>({
        Date: { from: today, to: today },
        columnFilters: {},
    });
    const [abstractDateKey, setAbstractDateKey] = useState<string | null>(null);
    type SortOrder = "asc" | "desc";

    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        order: SortOrder;
    }>({
        key: null,
        order: "asc",
    });

    // Hook call moved to after filteredRows is declared

    const currentDateKey = `${filters.Date.from}_${filters.Date.to}`;
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [abstractGrouping, setAbstractGrouping] = useState<string[]>([]);
    const [expandedGrouping, setExpandedGrouping] = useState<string[]>([]);

    // ACTIVE GROUPING

    const grouping =
        toggleMode === "Expanded"
            ? expandedGrouping
            : abstractGrouping;

    const setGrouping =
        toggleMode === "Expanded"
            ? setExpandedGrouping
            : setAbstractGrouping;

    const [abstractPendingGrouping, setAbstractPendingGrouping] = useState<string[]>([]);
    const [expandedPendingGrouping, setExpandedPendingGrouping] = useState<string[]>([]);

    const [abstractExpandedKeys, setAbstractExpandedKeys] = useState<string[]>([]);
    const [expandedExpandedKeys, setExpandedExpandedKeys] = useState<string[]>([]);

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
    const [loading, setLoading] = useState(false);

    const serialRef = React.useRef(0);

    const [templateConfig, setTemplateConfig] = useState<{
        abstract: ColumnConfig[];
        expanded: ColumnConfig[];
    } | null>(null);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [isEditTemplate, setIsEditTemplate] = useState(false);
    const [reportName, setReportName] = useState("");
    const [parentReportName, setParentReportName] = useState("");
    const [spConfig, setSpConfig] = useState({
        abstractSP: "",
        expandedSP: ""
    });
    const SP_MAP = {
        Abstract: "Reporting_Online_Stock_Journal_Item_VW",
        Expanded: "Reporting_Online_Stock_Journal_Item_VW"
    };
    const HEADER_HEIGHT = 36;
    /* ================= LOAD DATA ================= */

    useEffect(() => {
        const isTemplateApplied = templateConfig?.abstract;
        const isResetState = rows.length === 0;

        if (
            toggleMode === "Abstract" &&
            !isTemplateApplied &&
            !isResetState
        ) {
            if (
                rows.length > 0 &&
                abstractDateKey === currentDateKey
            ) {
                return;
            }
        }

        const loadData = async () => {
            try {
                setLoading(true);

                let currentLos = losColumns;
                if (currentLos.length === 0) {
                    try {
                        const colsRes = await lollosColumnsService.getLosColumns();
                        if (colsRes.data.success) {
                            currentLos = colsRes.data.data || [];
                            setLosColumns(currentLos);
                        }
                    } catch (e) {
                        console.error("Failed to load LOS columns", e);
                    }
                }

                const [reportRes, staffRes] = await Promise.all([
                    staffBasedReportService.getStaffBasedReport({
                        Fromdate: filters.Date.from,
                        Todate: filters.Date.to,
                    }),
                    costCenterListService.getStaff()
                ]);

                const apiRows = reportRes.data.data || [];
                const staffRows = staffRes.data.data || [];

                let cols = buildColumnsFromApi(apiRows, currentLos);

                /* =====================================================
                APPLY TEMPLATE BASED ON MODE
                ===================================================== */
                const modeTemplate =
                    toggleMode === "Expanded"
                        ? templateConfig?.expanded || []
                        : templateConfig?.abstract || [];

                const hasTemplate = modeTemplate.length > 0;

                if (hasTemplate) {
                    cols = applyTemplateToColumns(
                        cols,
                        modeTemplate
                    );
                }

                /* =====================================================
                ONLY APPLY DEFAULTS WHEN NO TEMPLATE
                ===================================================== */
                if (!hasTemplate) {
                    const activeDefaults =
                        toggleMode === "Expanded"
                            ? EXPANDED_DEFAULT_KEYS
                            : DEFAULT_KEYS;

                    cols = cols.map((col, index) => {
                        const oldCol = columns.find(
                            c => c.key === col.key
                        );

                        const isDefault =
                            activeDefaults.includes(col.key);

                        return {
                            ...col,
                            enabled: oldCol
                                ? oldCol.enabled
                                : isDefault,

                            order: oldCol
                                ? oldCol.order
                                : isDefault
                                    ? activeDefaults.indexOf(col.key)
                                    : activeDefaults.length + index,

                            groupBy: oldCol?.groupBy || 0,
                        };
                    });
                }

                /* =====================================================
                FINAL SORT
                ===================================================== */
                cols.sort((a, b) => a.order - b.order);

                /* =====================================================
                SET DATA
                ===================================================== */
                setRows(apiRows);
                setExpandedData(apiRows);
                setStaffList(staffRows);

                setAbstractDateKey(currentDateKey);
                setColumns(cols);
                setPage(1);

            } catch (error) {
                console.error(error);
                toast.error("Failed to load report");
            } finally {
                setLoading(false);
            }
        };

        loadData();

    }, [
        filters.Date.from,
        filters.Date.to,
        templateConfig,
        toggleMode
    ]);

    useEffect(() => {
        setSpConfig({
            abstractSP: SP_MAP.Abstract,
            expandedSP: SP_MAP.Expanded
        });
    }, []);

    const handleResetSettings = () => {
        const todayDate = dayjs().format("YYYY-MM-DD");

        // Clear template
        setTemplateConfig(null);

        // Reset filters
        setFromDate(todayDate);
        setToDate(todayDate);

        setFilters({
            Date: { from: todayDate, to: todayDate },
            columnFilters: {},
        });

        // Reset grouping
        setAbstractGrouping([]);
        setExpandedGrouping([]);

        setAbstractPendingGrouping([]);
        setExpandedPendingGrouping([]);

        setAbstractExpandedKeys([]);
        setExpandedExpandedKeys([]);

        // Reset sort
        setSortConfig({
            key: null,
            order: "asc",
        });

        // ✅ Get active defaults based on mode
        const activeDefaults =
            toggleMode === "Expanded"
                ? EXPANDED_DEFAULT_KEYS
                : DEFAULT_KEYS;

        // ✅ Reset columns
        setColumns((prev) =>
            prev
                .map((col, index) => ({
                    ...col,
                    enabled: activeDefaults.includes(col.key),
                    groupBy: 0,
                    order: activeDefaults.includes(col.key)
                        ? activeDefaults.indexOf(col.key)
                        : activeDefaults.length + index,
                }))
                .sort((a, b) => a.order - b.order)
        );

        // Keep rows
        setAbstractDateKey(currentDateKey);

        // Reset pagination
        setPage(1);

        // Close menus
        setSettingsAnchor(null);
        setFilterAnchor(null);
    };

    /* ================= FILTERING ================= */

    const filteredRows = useMemo(() => {
        const filtered = rawRows.filter(row => {
            const rowDate = dayjs(row.Stock_Journal_date);

            if (
                filters.Date.from &&
                rowDate.isBefore(dayjs(filters.Date.from), "day")
            )
                return false;

            if (
                filters.Date.to &&
                rowDate.isAfter(dayjs(filters.Date.to), "day")
            )
                return false;

            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (values === undefined) continue;

                const rowValue = String(row[key] ?? "")
                    .trim()
                    .toLowerCase();

                const match = values.some(
                    v =>
                        String(v)
                            .trim()
                            .toLowerCase() === rowValue
                );

                if (!match) return false;
            }

            return true;
        });

        return filtered.sort((a, b) => {
            return (
                dayjs(b.Stock_Journal_date).valueOf() -
                dayjs(a.Stock_Journal_date).valueOf()
            );
        });
    }, [rawRows, filters]);

    const numericKeys = useMemo(() => NUMERIC_KEYS, []);

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
    } = useNumericalFilter(filteredRows, numericKeys);

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

            // Date handling
            if (sortConfig.key === "Stock_Journal_date") {
                return sortConfig.order === "asc"
                    ? dayjs(aVal).valueOf() - dayjs(bVal).valueOf()
                    : dayjs(bVal).valueOf() - dayjs(aVal).valueOf();
            }

            // Numeric
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortConfig.order === "asc"
                    ? aVal - bVal
                    : bVal - aVal;
            }

            // String
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
                const val = String(row[groupKey] ?? "Others");
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
        [grouping]
    );

    const groupedRows = useMemo(() => {
        if (!grouping.length) return sortedRows;
        return buildGroupedData(sortedRows, 0);
    }, [sortedRows, grouping]);

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

    const finalRows = useMemo(() => {
        const rows = grouping.length
            ? flattenRows(groupedRows)
            : sortedRows;

        return rows.slice(
            (page - 1) * rowsPerPage,
            page * rowsPerPage
        );
    }, [groupedRows, sortedRows, grouping, expandedKeys, page, rowsPerPage]);

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

    const enabledColumns = sortedColumns.filter(c => c.enabled);

    const baseRows = grouping.length ? filteredRows : sortedRows;

    const getTotal = (key: string) =>
        Number(
            baseRows.reduce((s, r) => s + Number(r[key] || 0), 0).toFixed(2)
        );

    const handleHeaderClick = (
        e: React.MouseEvent<HTMLElement>,
        header: string
    ) => {
        setActiveHeader(header);
        setFilterAnchor(e.currentTarget);
    };

    useEffect(() => {
        if (sortConfig.key) return;

        const hasLedgerDate = enabledColumns.some(c => c.key === "Stock_Journal_date");
        const hasInvoiceNo = enabledColumns.some(c => c.key === "invoice_no");

        if (!hasLedgerDate && !hasInvoiceNo && enabledColumns.length > 0) {
            setSortConfig({
                key: enabledColumns[0].key,
                order: "asc",
            });
        }
    }, [enabledColumns, sortConfig.key]);

    const sortFilterValues = (
        values: string[],
        key: string,
        order: "asc" | "desc"
    ) => {
        return [...values].sort((a, b) => {
            // Date column
            if (key === "Stock_Journal_date") {
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
                    .map(r => r[activeHeader])
                    .filter(v => v !== null && v !== undefined && v !== "")
                    .map(v => String(v).trim())
            )
        );

        return sortFilterValues(
            uniqueValues,
            activeHeader,
            sortConfig.order
        );
    }, [activeHeader, rawRows, sortConfig.order]);

    const staffFields = [
        "Others1",
        "Others2",
        "Others3",
        "Others4",
        "Others5",
        "Load_Man",
        "Checker",
        "Delivery_Man",
        "Driver",
        "Ladies_Coolie",
        "Supervisor",
    ];

    /* =====================================================
   ✅ EXPANDED VIEW (NO COLUMN GROUPING ALLOWED)
   ===================================================== */
    const renderExpandedView = () => {
        return renderExpandedStaffRows(expandedData);
    };

    /* =====================================================
    ✅ STAFF WISE ACCORDION VIEW
    ===================================================== */
    const renderExpandedStaffRows = (sourceRows: any[]) => {
        const numericKeys = ["Qty", "Rate", "Amt"];

        const activeStaff = staffList.filter((staff) =>
            sourceRows.some((row) =>
                staffFields.some(
                    (field) =>
                        String(row[field] || "").trim().toLowerCase() ===
                        String(staff.Cost_Center_Name).trim().toLowerCase()
                )
            )
        );

        return activeStaff.map((staff, staffIndex) => {
            const staffName = staff.Cost_Center_Name;

            const staffRows = sourceRows.filter((row) =>
                staffFields.some(
                    (field) =>
                        String(row[field] || "").trim().toLowerCase() ===
                        staffName.trim().toLowerCase()
                )
            );

            /* =========================
            STAFF TOTALS
            (MULTI WORK SAME INVOICE)
         ========================= */
            const staffTotals: any = {};

            numericKeys.forEach((key) => {
                staffTotals[key] = staffRows.reduce(
                    (sum, row) => {

                        const workedCount = staffFields.filter(
                            (field) =>
                                String(row[field] || "")
                                    .trim()
                                    .toLowerCase() ===
                                staffName.trim().toLowerCase()
                        ).length || 1;

                        return (
                            sum +
                            Number(row[key] || 0) * workedCount
                        );
                    },
                    0
                );
            });

            /* =========================
               GROUP BY WORKED AS
               (MULTIPLE WORK SUPPORT)
            ========================= */
            const workedGroups: any = {};

            staffRows.forEach((row) => {

                // get ALL matched roles instead of first role
                const workedFields = staffFields.filter(
                    (field) =>
                        String(row[field] || "")
                            .trim()
                            .toLowerCase() ===
                        staffName.trim().toLowerCase()
                );

                // fallback
                const finalFields =
                    workedFields.length > 0
                        ? workedFields
                        : ["Others"];

                // push row into every matched group
                finalFields.forEach((workedField) => {
                    if (!workedGroups[workedField]) {
                        workedGroups[workedField] = [];
                    }

                    workedGroups[workedField].push(row);
                });
            });
            return (
                <Accordion
                    key={`${staffName}-${staffIndex}`}
                    sx={{
                        backgroundColor: "#F8FAFC",
                        boxShadow: "none",
                        border: "1px solid #E2E8F0",
                        mb: 0.5,
                        "&:before": { display: "none" },
                    }}
                >
                    {/* STAFF HEADER */}
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography fontWeight={700}>
                            {staffIndex + 1}. {staffName} (
                            {staffTotals.Qty.toFixed(2)} Tons)
                        </Typography>
                    </AccordionSummary>

                    <AccordionDetails sx={{ p: 0 }}>
                        {/* WORKED AS GROUPING */}
                        {Object.entries(workedGroups).map(
                            ([workedAs, rows]: any, workIndex) => {
                                const totals: any = {};

                                numericKeys.forEach((key) => {
                                    totals[key] = rows.reduce(
                                        (sum: number, r: any) =>
                                            sum + Number(r[key] || 0),
                                        0
                                    );
                                });

                                return (
                                    <Accordion
                                        key={workedAs}
                                        sx={{
                                            boxShadow: "none",
                                            borderTop:
                                                "1px solid #E5E7EB",
                                            "&:before": {
                                                display: "none",
                                            },
                                        }}
                                    >
                                        {/* WORKED AS HEADER */}
                                        <AccordionSummary
                                            expandIcon={
                                                <ExpandMoreIcon />
                                            }
                                        >
                                            <Typography
                                                fontWeight={600}
                                            >
                                                {workIndex + 1}.{" "}
                                                {workedAs.replace(
                                                    /_/g,
                                                    " "
                                                )}{" "}
                                                (
                                                {totals.Qty.toFixed(
                                                    2
                                                )} Tons)
                                            </Typography>
                                        </AccordionSummary>

                                        <AccordionDetails
                                            sx={{ p: 0 }}
                                        >
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell
                                                            sx={{
                                                                fontWeight: 700,
                                                                bgcolor:
                                                                    "#1E3A8A",
                                                                color:
                                                                    "#fff",
                                                            }}
                                                        >
                                                            S.No
                                                        </TableCell>

                                                        {enabledColumns.map(
                                                            (
                                                                col
                                                            ) => (
                                                                <TableCell
                                                                    key={
                                                                        col.key
                                                                    }
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        bgcolor:
                                                                            "#1E3A8A",
                                                                        color:
                                                                            "#fff",
                                                                    }}
                                                                >
                                                                    {
                                                                        col.label
                                                                    }
                                                                </TableCell>
                                                            )
                                                        )}
                                                    </TableRow>
                                                </TableHead>

                                                <TableBody>
                                                    {/* TOTAL */}
                                                    <TableRow
                                                        sx={{
                                                            bgcolor:
                                                                "#E0E7FF",
                                                        }}
                                                    >
                                                        <TableCell
                                                            sx={{
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            Total
                                                        </TableCell>

                                                        {enabledColumns.map((col) => (
                                                            <TableCell
                                                                key={col.key}
                                                                sx={{ fontWeight: 700 }}
                                                            >
                                                                {["Qty", "Rate", "Amt"].includes(col.key)
                                                                    ? Number(totals[col.key] || 0).toFixed(2)
                                                                    : col.key === "Created_By"
                                                                        ? Number(totals["Qty"] || 0).toFixed(2)
                                                                        : ""}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>

                                                    {/* DATA */}
                                                    {rows.map(
                                                        (
                                                            row: any,
                                                            i: number
                                                        ) => (
                                                            <TableRow
                                                                key={
                                                                    i
                                                                }
                                                            >
                                                                <TableCell>
                                                                    {i +
                                                                        1}
                                                                </TableCell>

                                                                {enabledColumns.map((col) => (
                                                                    <TableCell key={col.key}>
                                                                        {col.key === "Stock_Journal_date"
                                                                            ? dayjs(row[col.key]).format("DD/MM/YYYY")

                                                                            : col.key === "Created_By"
                                                                                ? Number(row["Qty"] || 0).toFixed(2)

                                                                                : numericKeys.includes(col.key)
                                                                                    ? Number(row[col.key] || 0).toFixed(2)

                                                                                    : row[col.key] ?? ""}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        )
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            }
                        )}
                    </AccordionDetails>
                </Accordion>
            );
        });
    };

    /* ================= EXPORT HELPERS ================= */

    // ✅ Use current enabled columns for both modes
    const exportColumns = columns
        .filter(c => c.enabled)
        .sort((a, b) => a.order - b.order);

    const getWorkedAs = (row: any, staffName: string) => {
        const field = staffFields.find(
            (f) =>
                String(row[f] || "")
                    .trim()
                    .toLowerCase() === staffName.trim().toLowerCase()
        );

        return field ? field.replace(/_/g, " ") : "";
    };

    /* ================= EXPORT ROWS ================= */

    const exportRows =
        toggleMode === "Expanded"
            ? (() => {
                const rows: any[] = [];

                const activeStaff = staffList.filter((staff) =>
                    expandedData.some((row) =>
                        staffFields.some(
                            (field) =>
                                String(row[field] || "")
                                    .trim()
                                    .toLowerCase() ===
                                String(staff.Cost_Center_Name)
                                    .trim()
                                    .toLowerCase()
                        )
                    )
                );

                activeStaff.forEach((staff) => {
                    const staffName = staff.Cost_Center_Name;

                    const staffRows = expandedData.filter((row) =>
                        staffFields.some(
                            (field) =>
                                String(row[field] || "")
                                    .trim()
                                    .toLowerCase() ===
                                staffName.trim().toLowerCase()
                        )
                    );

                    staffRows.forEach((row) => {
                        const obj: any = {
                            Staff: staffName,
                            "Worked As": getWorkedAs(row, staffName),
                        };

                        exportColumns.forEach((col) => {
                            let value = row[col.key];

                            if (
                                col.key ===
                                "Stock_Journal_date"
                            ) {
                                value = dayjs(value).format(
                                    "DD/MM/YYYY"
                                );
                            }

                            obj[col.label] = value ?? "";
                        });

                        rows.push(obj);
                    });
                });

                return rows;
            })()
            : sortedRows.map((row) => {
                const obj: any = {};

                exportColumns.forEach((col) => {
                    let value = row[col.key];

                    if (
                        col.key ===
                        "Stock_Journal_date"
                    ) {
                        value = dayjs(value).format(
                            "DD/MM/YYYY"
                        );
                    }

                    obj[col.label] = value ?? "";
                });

                return obj;
            });

    /* ================= EXPORT EXCEL ================= */

    const handleExportExcel = () => {
        const worksheet =
            XLSX.utils.json_to_sheet(exportRows);

        const workbook =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            toggleMode === "Expanded"
                ? "Expanded Report"
                : "Abstract Report"
        );

        XLSX.writeFile(
            workbook,
            `Staff_Based_Report_${toggleMode}_${dayjs().format(
                "DDMMYYYY"
            )}.xlsx`
        );
    };

    /* ================= EXPORT PDF ================= */

    const handleExportPDF = () => {
        const doc = new jsPDF(
            "l",
            "mm",
            "a4"
        );

        doc.text(
            `Staff Based Report (${toggleMode})`,
            14,
            10
        );

        autoTable(doc, {
            startY: 15,
            head: [Object.keys(exportRows[0] || {})],
            body: exportRows.map((r) =>
                Object.values(r)
            ),
            styles: {
                fontSize: 7,
            },
            headStyles: {
                fillColor: [30, 58, 138],
            },
        });

        doc.save(
            `Staff_Based_Report_${toggleMode}_${dayjs().format(
                "DDMMYYYY"
            )}.pdf`
        );
    };

    /* ================= TEMPLATE ================= */

    const loadTemplate = async (reportId: number) => {
        try {
            /* ========================================
            PREVENT INVALID CALL AFTER NEW SAVE
            ======================================== */
            if (!reportId || reportId <= 0) {
                return;
            }

            setTemplateLoading(true);
            setSelectedTemplateId(reportId);

            const res = await SettingsService.getReportEditData({
                reportId,
                typeId: 1,
            });

            const data = res?.data?.data || {};

            /* ========================================
            SAFE TEMPLATE READ
            ======================================== */
            const abstractCols = Array.isArray(data.abstractColumns)
                ? data.abstractColumns
                : Array.isArray(data.columns)
                    ? data.columns
                    : [];

            const expandedCols = Array.isArray(data.expandedColumns)
                ? data.expandedColumns
                : Array.isArray(data.columns)
                    ? data.columns
                    : [];

            /* ========================================
            SAVE TEMPLATE
            ======================================== */
            setTemplateConfig({
                abstract: abstractCols,
                expanded: expandedCols,
            });

            /* ========================================
            REPORT INFO
            ======================================== */
            setReportName(
                data?.reportInfo?.Report_Name || ""
            );

            setParentReportName(
                data?.reportInfo?.Parent_Report || ""
            );

            /* ========================================
            RESET SCREEN TO RELOAD
            ======================================== */
            setRows([]);
            setAbstractColumns([]);
            setExpandedColumns([]);

            setAbstractGrouping([]);
            setExpandedGrouping([]);

            setAbstractPendingGrouping([]);
            setExpandedPendingGrouping([]);

            setAbstractExpandedKeys([]);
            setExpandedExpandedKeys([]);

            setAbstractDateKey(null);
            setPage(1);

        } catch (err: any) {
            console.error(err);

            /* ========================================
            IGNORE EMPTY / NOT FOUND AFTER SAVE
            ======================================== */
            if (
                err?.response?.status === 404 ||
                err?.response?.status === 400
            ) {
                return;
            }

            toast.error("Failed to load template ❌");
        } finally {
            setTemplateLoading(false);
        }
    };


    /* ================= APPLY TEMPLATE ================= */

    const applyTemplateToColumns = (
        baseCols: ColumnConfig[],
        templateCols: any[]
    ): ColumnConfig[] => {

        if (!templateCols?.length) return baseCols;

        const finalCols: ColumnConfig[] = [];

        templateCols.forEach((temp: any, index: number) => {
            const base = baseCols.find(
                x => x.key === temp.key
            );

            if (base) {
                const matched = losColumns.find(
                    col => col.ColumnName?.toUpperCase() === base.key.toUpperCase()
                );
                const label = (matched && matched.Alias_Name && matched.Alias_Name.trim()) 
                    ? matched.Alias_Name.trim() 
                    : (temp.label || base.label);

                finalCols.push({
                    ...base,
                    label,
                    enabled: Boolean(temp.enabled),
                    order:
                        temp.order !== undefined
                            ? Number(temp.order)
                            : index,
                    groupBy:
                        temp.groupBy !== undefined
                            ? Number(temp.groupBy)
                            : 0,
                });
            }
        });

        /* add missing new columns */
        baseCols.forEach((base) => {
            const exists = finalCols.some(
                x => x.key === base.key
            );

            if (!exists) {
                finalCols.push({
                    ...base,
                    enabled: false,
                    order: finalCols.length,
                    groupBy: 0,
                });
            }
        });

        return finalCols.sort(
            (a, b) => a.order - b.order
        );
    };


    /* ================= APPLY GROUPING AFTER LOAD ================= */

    useEffect(() => {
        if (!templateConfig) return;

        const sourceCols =
            toggleMode === "Expanded"
                ? expandedColumns
                : abstractColumns;

        if (!sourceCols.length) return;

        const autoGroupCols = sourceCols
            .filter(col => col.groupBy && col.enabled)
            .sort((a, b) => (a.groupBy || 0) - (b.groupBy || 0))
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

    }, [
        templateConfig,
        abstractColumns,
        expandedColumns,
        toggleMode
    ]);


    /* ================= SAVE TEMPLATE ================= */

    const handleQuickSave = async () => {
        try {
            if (!reportName.trim()) {
                toast.error("Enter Report Name");
                return;
            }

            const userData = JSON.parse(
                localStorage.getItem("user") || "{}"
            );

            const createdBy = userData?.id || 0;

            const isCreateMode = !selectedTemplateId;

            /* =====================================================
            ✅ ABSTRACT PAYLOAD
            ===================================================== */
            const abstractPayload = abstractColumns.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: abstractGrouping.includes(c.key)
                    ? abstractGrouping.indexOf(c.key) + 1
                    : 0,
                viewType: "Abstract",
                dataType: "nvarchar",
            }));

            /* =====================================================
            ✅ EXPANDED PAYLOAD
            ===================================================== */
            const expandedPayload = expandedColumns.map((c) => {

                /* CREATE MODE -> copy abstract config */
                if (isCreateMode) {
                    const absCol = abstractColumns.find(
                        x => x.key === c.key
                    );

                    return {
                        key: c.key,
                        label: c.label,
                        enabled: absCol
                            ? absCol.enabled
                            : c.enabled,
                        order: absCol
                            ? absCol.order
                            : c.order,
                        groupBy: 0,
                        viewType: "Expanded",
                        dataType: "nvarchar",
                    };
                }

                /* UPDATE MODE -> keep expanded own config */
                return {
                    key: c.key,
                    label: c.label,
                    enabled: c.enabled,
                    order: c.order,
                    groupBy: 0,
                    viewType: "Expanded",
                    dataType: "nvarchar",
                };
            });

            if (selectedTemplateId) {

                /* ==========================================
                If user is working in Abstract mode
                update only Abstract columns
                ========================================== */
                const payloadColumns =
                    toggleMode === "Abstract"
                        ? abstractPayload
                        : expandedPayload;

                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 1,
                    reportName: reportName.trim(),
                    columns: payloadColumns,
                });

                toast.success(
                    "Updated Successfully ✅"
                );
            }

            /* =====================================================
            ✅ CREATE TEMPLATE
            ===================================================== */
            else {
                await SettingsService.saveReportSettings({
                    reportName,
                    parentReport: parentReportName,
                    abstractSP: spConfig.abstractSP,
                    expandedSP: spConfig.expandedSP,
                    abstractColumns: abstractPayload,
                    expandedColumns: expandedPayload,
                    createdBy,
                });

                toast.success(
                    "Saved Successfully ✅"
                );
            }

            setSaveDialogOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 300);

        } catch (err) {
            console.error(err);
            toast.error("Save Failed ❌");
        }
    };

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onReportChange={(template) => {
                    if (!template) {
                        const todayDate = dayjs().format("YYYY-MM-DD");

                        setIsEditTemplate(false);
                        setSelectedTemplateId(null);
                        setReportName("");
                        setParentReportName("");
                        setTemplateConfig(null);

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
                        setAbstractPendingGrouping([]);
                        setAbstractExpandedKeys([]);

                        setExpandedGrouping([]);   // ✅ reset expanded grouping also

                        setRows([]);
                        setColumns([]);
                        setAbstractDateKey(null);
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

                    if (!selectedTemplateId) {
                        setReportName("");
                    }

                    setSaveDialogOpen(true);
                }}

                settingsSlot={
                    <Box display="flex" gap={1}>

                        {/* ✅ SHOW GROUP BY ONLY FOR ABSTRACT */}
                        {toggleMode === "Abstract" && (
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
                        )}

                        {/* SETTINGS ICON ALWAYS */}
                        <Tooltip title="Table Settings">
                            <IconButton
                                size="small"
                                onClick={(e) =>
                                    setSettingsAnchor(e.currentTarget)
                                }
                                sx={{
                                    height: 24,
                                    width: 24,
                                    backgroundColor: "#fff",
                                    borderRadius: 0.5,
                                }}
                            >
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
                    <Box sx={{ position: "relative" }}>
                        {/* GLOBAL LOADING OVERLAY */}
                        {loading && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    backgroundColor: "rgba(255,255,255,0.6)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 1000,
                                    minHeight: "300px",
                                }}
                            >
                                <CircularProgress size={40} />
                            </Box>
                        )}

                        {toggleMode === "Abstract" ? (
                            <TableContainer
                                component={Paper}
                                sx={{
                                    maxHeight: "calc(100vh - 100px)",
                                    "& th, & td": {
                                        fontSize: "0.75rem",
                                    },
                                    position: "relative",
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
                                                    onClick={(e) =>
                                                        c.isNumeric
                                                            ? openNumFilter(e, c.key)
                                                            : handleHeaderClick(e, c.key)
                                                    }
                                                >
                                                    <Box
                                                        display="flex"
                                                        alignItems="center"
                                                        justifyContent="space-between"
                                                    >
                                                        {/* HEADER LABEL (FILTER CLICK) */}
                                                        <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                                                            {c.isNumeric ? (
                                                                <SortableHeaderLabel
                                                                    label={c.label}
                                                                    columnKey={c.key}
                                                                    sortConfig={numSortConfig}
                                                                    onSort={(key) => {
                                                                        setSortConfig({ key: null, order: "asc" });
                                                                        handleNumSort(key);
                                                                    }}
                                                                    onOpenFilter={(e) => openNumFilter(e, c.key)}
                                                                />
                                                            ) : (
                                                                c.label
                                                            )}
                                                        </Box>
                                                    </Box>
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
                                                        ? c.key === "Qty"
                                                            ? Number(getTotal(c.key)).toFixed(2)
                                                            : CURRENCY_KEYS.includes(c.key)
                                                                ? formatINR(getTotal(c.key))
                                                                : Number(getTotal(c.key)).toFixed(2)
                                                        : ""}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {(() => {
                                            serialRef.current = grouping.length
                                                ? 0
                                                : (page - 1) * rowsPerPage;

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
                                                                    return (
                                                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"} sx={{ fontWeight: 700 }}>
                                                                            {row.__value}
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
                                                                            {c.key === "Qty"
                                                                                ? total.toFixed(2)
                                                                                : CURRENCY_KEYS.includes(c.key)
                                                                                    ? formatINR(total)
                                                                                    : total.toFixed(2)}
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
                                                                    {c.key === "Stock_Journal_date"
                                                                        ? dayjs(row[c.key]).format("DD/MM/YYYY")
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
                        ) : (
                            <Paper sx={{ p: 1 }}>
                                {renderExpandedView()}
                            </Paper>
                        )}
                    </Box>


                    <CommonPagination
                        totalRows={filteredRows.length}
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
                isDateColumn={activeHeader === "Stock_Journal_date"}
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
                                            c.key === "Stock_Journal_date"
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
                                            c.key === "Stock_Journal_date"
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

export default LOSStaffBasedReport;