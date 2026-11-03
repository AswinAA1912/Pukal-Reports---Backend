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
} from "@mui/material";

import dayjs from "dayjs";

import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";

import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import AppLayout, {
    useToggleMode,
} from "../../Layout/appLayout";

import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { toast } from "react-toastify";

import { SettingsService } from "../../services/reportSettings.services";

import {
    costCenterListService,
    staffBasedReportService,
} from "../../services/staffBasedReport.services";

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    isNumeric?: boolean;
    order: number;
    groupBy?: number;
};

type SortableColumnRowProps = {
    column: ColumnConfig;
    onToggle: (key: string) => void;
    hasActiveFilter?: boolean;
};

/* ================= SORTABLE COLUMN ================= */

const SortableColumnRow = ({
    column,
    onToggle,
    hasActiveFilter,
}: SortableColumnRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        id: column.key,
    });

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
            <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{ flex: 1 }}
            >
                <Typography fontSize="0.75rem">
                    {column.label}
                </Typography>

                {hasActiveFilter && (
                    <Tooltip title="Header filter enabled">
                        <FilterAltIcon
                            fontSize="small"
                            color="action"
                        />
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
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                    {
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

const STAFF_CATEGORY_FIELDS = [
    "Load_Man",
    "Others1",
    "Others2",
    "Others3",
    "Others4",
    "Others5",
    "Checker",
    "Delivery_Man",
    "Others6",
    "Driver",
    "Ladies_Coolie",
    "Supervisor",
    "Created_By",
];

/* ================= COMPONENT ================= */

const StaffBasedGroupingReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const {
        toggleMode,
        setToggleMode,
    } = useToggleMode();

    const [loading, setLoading] =
        useState(false);

    const [abstractRows, setAbstractRows] =
        useState<any[]>([]);

    const [expandedRows, setExpandedRows] =
        useState<any[]>([]);


    /* ================= COLUMNS ================= */

    const [
        abstractColumns,
        setAbstractColumns,
    ] = useState<ColumnConfig[]>([]);

    const [
        expandedColumns,
        setExpandedColumns,
    ] = useState<ColumnConfig[]>([]);

    const columns =
        toggleMode === "Expanded"
            ? expandedColumns
            : abstractColumns;

    const setColumns =
        toggleMode === "Expanded"
            ? setExpandedColumns
            : setAbstractColumns;

    /* ================= PAGINATION ================= */

    const [page, setPage] = useState(1);

    const [rowsPerPage, setRowsPerPage] =
        useState(100);

    /* ================= DRAWER ================= */

    const [drawerOpen, setDrawerOpen] =
        useState(false);

    /* ================= DATE FILTER ================= */

    const [fromDate, setFromDate] =
        useState(today);

    const [toDate, setToDate] =
        useState(today);

    /* ================= STOCK FILTER ================= */

    const [stockFilter, setStockFilter] =
        useState<
            "hasValues" | "zero" | "all"
        >("hasValues");

    /* ================= MENU ANCHORS ================= */

    const [
        settingsAnchor,
        setSettingsAnchor,
    ] = useState<null | HTMLElement>(
        null
    );

    const [
        filterAnchor,
        setFilterAnchor,
    ] = useState<null | HTMLElement>(
        null
    );

    const [activeHeader, setActiveHeader] =
        useState<string | null>(null);



    /* ================= FILTERS ================= */

    type FiltersMap = {
        Date: {
            from: string;
            to: string;
        };
        columnFilters: Record<
            string,
            string[]
        >;
    };

    const [filters, setFilters] =
        useState<FiltersMap>({
            Date: {
                from: today,
                to: today,
            },
            columnFilters: {},
        });

    const [staffBasedDisplayMode, setStaffBasedDisplayMode] =
        useState<"qty" | "count">("qty");

    const formatDisplay = (value: number, count: number, isQtyCol = false) => {
        if (staffBasedDisplayMode === "qty") {
            return value > 0 ? value.toFixed(2) : (isQtyCol ? "0.00" : "-");
        }
        if (staffBasedDisplayMode === "count") {
            return count > 0 ? `${count}` : (isQtyCol ? "0" : "-");
        }
        return value > 0 ? value.toFixed(2) : (isQtyCol ? "0.00" : "-");
    };

    const abstractDates = useMemo(() => {
        const start = dayjs(filters.Date.from);
        const end = dayjs(filters.Date.to);
        const list: string[] = [];
        let current = start;
        while (current.isBefore(end) || current.isSame(end, "day")) {
            list.push(current.format("DD.MM"));
            current = current.add(1, "day");
        }
        return list;
    }, [filters.Date.from, filters.Date.to]);

    const processedAbstractRows = useMemo(() => {
        const enabledDateKeys = abstractColumns
            .filter((c) => c.key !== "Staff_Name" && c.key !== "Total" && c.enabled)
            .map((c) => c.key);

        return abstractRows.map((row) => {
            const newRow = { ...row };
            abstractDates.forEach((d) => {
                newRow[d] = staffBasedDisplayMode === "qty" ? row[`${d}_qty`] : row[`${d}_count`];
            });
            
            if (enabledDateKeys.length > 0) {
                newRow.Total = enabledDateKeys.reduce((sum, key) => sum + (Number(newRow[key]) || 0), 0);
            } else {
                newRow.Total = 0;
            }
            
            return newRow;
        });
    }, [abstractRows, staffBasedDisplayMode, abstractDates, abstractColumns]);

    const rawRows =
        toggleMode === "Expanded"
            ? expandedRows
            : processedAbstractRows;


    /* ================= SORT ================= */

    type SortOrder = "asc" | "desc";

    const [sortConfig, setSortConfig] =
        useState<{
            key: string | null;
            order: SortOrder;
        }>({
            key: null,
            order: "asc",
        });

    /* ================= GROUPING ================= */

    const [
        groupDialogOpen,
        setGroupDialogOpen,
    ] = useState(false);

    const [
        abstractGrouping,
        setAbstractGrouping,
    ] = useState<string[]>([]);

    const [
        expandedGrouping,
        setExpandedGrouping,
    ] = useState<string[]>([]);

    const [
        abstractPendingGrouping,
        setAbstractPendingGrouping,
    ] = useState<string[]>([]);

    const [
        expandedPendingGrouping,
        setExpandedPendingGrouping,
    ] = useState<string[]>([]);

    const [
        abstractExpandedKeys,
        setAbstractExpandedKeys,
    ] = useState<string[]>([]);

    const [
        expandedExpandedKeys,
        setExpandedExpandedKeys,
    ] = useState<string[]>([]);

    const serialRef =
        React.useRef(0);

    /* ================= TEMPLATE ================= */

    const [
        templateConfig,
        setTemplateConfig,
    ] = useState<{
        expanded: ColumnConfig[];
    } | null>(null);

    const [
        selectedTemplateId,
        setSelectedTemplateId,
    ] = useState<number | null>(
        null
    );

    const [
        saveDialogOpen,
        setSaveDialogOpen,
    ] = useState(false);

    const [reportName, setReportName] =
        useState("");

    const [
        parentReportName,
        setParentReportName,
    ] = useState("");

    const [
        isEditTemplate,
        setIsEditTemplate,
    ] = useState(false);

    /* ================= GROUP HELPERS ================= */

    const grouping =
        toggleMode === "Expanded"
            ? expandedGrouping
            : abstractGrouping;

    const HEADER_HEIGHT = 36;

    const setGrouping =
        toggleMode === "Expanded"
            ? setExpandedGrouping
            : setAbstractGrouping;

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

    const [useActualQty, setUseActualQty] =
        useState(false);

    console.log("RENDER:", { toggleMode, expandedPendingGrouping, abstractPendingGrouping, pendingGrouping });

    /* ================= LOAD EFFECT ================= */

    useEffect(() => {
        let ignore = false;

        const load = async () => {
            if (ignore) return;

            await loadStaffBasedReport();
        };

        load();

        return () => {
            ignore = true;
        };
    }, [
        toggleMode,
        filters.Date.from,
        filters.Date.to,
        selectedTemplateId,
        useActualQty,
    ]);

    /* ================= LOAD DATA ================= */

    const loadStaffBasedReport =
        async () => {
            try {
                setLoading(true);

                const [
                    staffRes,
                    reportRes,
                ] = await Promise.all([
                    costCenterListService.getStaff(),

                    staffBasedReportService.getStaffBasedReport(
                        {
                            Fromdate:
                                filters.Date.from,
                            Todate:
                                filters.Date.to,
                        }
                    ),
                ]);

                const staffList =
                    staffRes.data.data || [];

                const reportRows =
                    reportRes.data.data || [];

                // Pre-build a lookup cache for matching transaction names to Cost Center names
                const matchCache: Record<string, string> = {};
                const getMatchingCCName = (staffName: string): string => {
                    if (matchCache[staffName] !== undefined) return matchCache[staffName];
                    const cleanStaff = staffName.trim().toLowerCase();
                    
                    // 1. Exact match
                    let match = staffList.find((cc: any) => 
                        String(cc.Cost_Center_Name || "").trim().toLowerCase() === cleanStaff
                    );
                    if (!match) {
                        // 2. Prefix match
                        match = staffList.find((cc: any) => {
                            const cleanCC = String(cc.Cost_Center_Name || "").trim().toLowerCase();
                            return cleanCC.startsWith(cleanStaff) || cleanStaff.startsWith(cleanCC);
                        });
                    }
                    if (!match) {
                        // 3. Containment match
                        match = staffList.find((cc: any) => {
                            const cleanCC = String(cc.Cost_Center_Name || "").trim().toLowerCase();
                            return cleanCC.includes(cleanStaff) || cleanStaff.includes(cleanCC);
                        });
                    }
                    
                    const resolved = match ? match.Cost_Center_Name : staffName;
                    matchCache[staffName] = resolved;
                    return resolved;
                };

                /* ================= ABSTRACT ================= */

                if (
                    toggleMode ===
                    "Abstract"
                ) {
                    const start = dayjs(
                        filters.Date.from
                    );

                    const end = dayjs(
                        filters.Date.to
                    );

                    const dates: string[] =
                        [];

                    let current = start;

                    while (
                        current.isBefore(end) ||
                        current.isSame(
                            end,
                            "day"
                        )
                    ) {
                        dates.push(
                            current.format(
                                "DD.MM"
                            )
                        );

                        current =
                            current.add(
                                1,
                                "day"
                            );
                    }

                    const staffFields = [
                        "Others1",
                        "Others2",
                        "Others3",
                        "Others4",
                        "Others5",
                        "Load_Man",
                        "Checker",
                        "Delivery_Man",
                        "Others6",
                        "Driver",
                        "Ladies_Coolie",
                        "Supervisor",
                        "Created_By",
                    ];

                    /* ================= BUILD FAST LOOKUP MAP ================= */

                    const qtyMap: Record<
                        string,
                        number
                    > = {};

                    const countMap: Record<
                        string,
                        number
                    > = {};

                    reportRows.forEach(
                        (row: any) => {
                            const dateKey =
                                dayjs(
                                    row.Stock_Journal_date
                                ).format(
                                    "DD.MM"
                                );

                            const qty = Number(
                                useActualQty
                                    ? row.Act_Qty || 0
                                    : row.Qty || 0
                            );

                            staffFields.forEach(
                                (field) => {
                                    const staff =
                                        String(
                                            row[field] ||
                                            ""
                                        ).trim();

                                    if (!staff) {
                                        return;
                                    }

                                    const resolvedCCName = getMatchingCCName(staff);
                                    const mapKey =
                                        `${resolvedCCName}_${dateKey}`;

                                    qtyMap[
                                        mapKey
                                    ] =
                                        (
                                            qtyMap[
                                            mapKey
                                            ] || 0
                                        ) + qty;

                                    countMap[
                                        mapKey
                                    ] =
                                        (
                                            countMap[
                                            mapKey
                                            ] || 0
                                        ) + 1;
                                }
                            );
                        }
                    );


                    /* ================= BUILD ABSTRACT ROWS ================= */

                    const rows =
                        staffList.map(
                            (
                                staff: any,
                                index: number
                            ) => {
                                const obj: any =
                                {
                                    SNo:
                                        index + 1,

                                    Staff_Name:
                                        staff.Cost_Center_Name,
                                };

                                let totalQty = 0;
                                let totalCount = 0;

                                dates.forEach(
                                    (
                                        dateCol
                                    ) => {
                                        const mapKey =
                                            `${staff.Cost_Center_Name}_${dateCol}`;

                                        const qty =
                                            qtyMap[
                                            mapKey
                                            ] || 0;

                                        const count =
                                            countMap[
                                            mapKey
                                            ] || 0;

                                        obj[`${dateCol}_qty`] = qty;
                                        obj[`${dateCol}_count`] = count;

                                        totalQty += qty;
                                        totalCount += count;
                                    }
                                );

                                obj.Total_qty = totalQty;
                                obj.Total_count = totalCount;

                                return obj;
                            }
                        );

                    const cols: ColumnConfig[] =
                        [
                            {
                                key:
                                    "Staff_Name",

                                label:
                                    "Staff Name",

                                enabled:
                                    true,

                                order: 1,
                            },

                            ...dates.map(
                                (
                                    d,
                                    i
                                ) => ({
                                    key: d,

                                    label: d,

                                    enabled:
                                        true,

                                    order:
                                        i + 2,

                                    isNumeric:
                                        true,
                                })
                            ),

                            {
                                key: "Total",

                                label:
                                    "Total",

                                enabled:
                                    true,

                                order:
                                    999,

                                isNumeric:
                                    true,
                            },
                        ];

                    setAbstractRows(
                        rows
                    );

                    setAbstractColumns(
                        cols
                    );
                }

                /* ================= EXPANDED ================= */

                else {
                    const defaultEnabled =
                        [
                            "Staff_Name",
                            "Godown_Name",
                            "Qty",
                            "Load_Man",
                            "Others1",
                            "Others2",
                            "Others3",
                            "Others4",
                            "Others5",
                            "Supervisor",
                            "Ladies_Coolie",
                            "Created_By",
                        ];

                    const excludeKeys =
                        ["SNo"];

                    const allKeys =
                        reportRows.length >
                            0
                            ? Object.keys(
                                reportRows[0]
                            ).filter(
                                (
                                    key
                                ) =>
                                    !excludeKeys.includes(
                                        key
                                    )
                            )
                            : [];

                    const categoryFields =
                        [
                            "Load_Man",
                            "Others1",
                            "Others2",
                            "Others3",
                            "Others4",
                            "Others5",
                            "Checker",
                            "Delivery_Man",
                            "Others6",
                            "Driver",
                            "Ladies_Coolie",
                            "Supervisor",
                            "Created_By",
                        ];

                    /* ================= COLUMN CONFIG ================= */

                    const cols: ColumnConfig[] =
                        [
                            {
                                key: "Staff_Name",
                                label: "Staff Name",
                                enabled:
                                    true,
                                order: 1,
                            },

                            {
                                key:
                                    "Godown_Name",
                                label:
                                    "Godown Name",
                                enabled:
                                    true,
                                order: 2,
                            },

                            {
                                key:
                                    "Invoice_no",
                                label:
                                    "Invoice no",
                                enabled:
                                    false,
                                order: 3,
                            },

                            {
                                key:
                                    "Journal_no",
                                label:
                                    "Journal no",
                                enabled:
                                    false,
                                order: 3,
                            },

                            {
                                key:
                                    "Stock_Journal_Voucher_type",
                                label:
                                    "Voucher Type",
                                enabled:
                                    false,
                                order: 4,
                            },

                            {
                                key: "Qty",
                                label:
                                    "Total Qty",
                                enabled:
                                    true,
                                order: 5,
                                isNumeric:
                                    true,
                            },

                            ...allKeys
                                .filter(
                                    (
                                        key
                                    ) =>
                                        ![
                                            "Staff_Name",
                                            "Godown_Name",
                                            "Invoice_no",
                                            "Journal_no",
                                            "Stock_Journal_Voucher_type",
                                            "Qty",
                                        ].includes(
                                            key
                                        )
                                )
                                .map(
                                    (
                                        key,
                                        i
                                    ) => ({
                                        key,

                                        label:
                                            key.replace(
                                                /_/g,
                                                " "
                                            ),

                                        enabled:
                                            defaultEnabled.includes(
                                                key
                                            ),

                                        order:
                                            i + 6,

                                        isNumeric:
                                            [
                                                "Qty",
                                                "Act_Qty",
                                            ].includes(
                                                key
                                            ) ||
                                            categoryFields.includes(
                                                key
                                            ),
                                    })
                                ),
                        ];

                    /* ================= APPLY TEMPLATE ================= */

                    let finalCols: ColumnConfig[] =
                        cols;

                    if (
                        selectedTemplateId &&
                        templateConfig
                            ?.expanded
                            ?.length
                    ) {
                        finalCols =
                            applyTemplateToColumns(
                                cols,
                                templateConfig.expanded
                            );
                    } else {
                        const previousColumnState =
                            expandedColumns;

                        finalCols =
                            cols.map(
                                (
                                    col
                                ) => {
                                    const existing =
                                        previousColumnState.find(
                                            (
                                                c
                                            ) =>
                                                c.key ===
                                                col.key
                                        );

                                    return existing
                                        ? {
                                            ...col,
                                            enabled:
                                                existing.enabled,
                                            order:
                                                existing.order,
                                            groupBy:
                                                existing.groupBy,
                                        }
                                        : col;
                                }
                            );
                    }

                    /* ================= ENABLED SPLIT COLUMNS ================= */

                    const enabledSplitColumns =
                        finalCols
                            .filter(
                                (c) =>
                                    c.enabled &&
                                    ![
                                        "Staff_Name",
                                        "Qty",
                                        "SNo",
                                    ].includes(c.key) &&
                                    !categoryFields.includes(
                                        c.key
                                    )
                            )
                            .sort(
                                (a, b) =>
                                    a.order -
                                    b.order
                            )
                            .map((c) => c.key);

                    /* ================= PIVOT MAP ================= */

                    const pivotMap = new Map<
                        string,
                        any
                    >();

                    reportRows.forEach(
                        (row: any) => {
                            const qty = Number(row.Qty || 0);

                            const actQty = Number(
                                row.Act_Qty || 0
                            );

                            const processedStaffs =
                                new Set<string>();

                            categoryFields.forEach(
                                (field) => {
                                    const staff =
                                        String(
                                            row[field] ||
                                            ""
                                        ).trim();

                                    if (!staff)
                                        return;

                                    const resolvedCCName = getMatchingCCName(staff);

                                    const duplicateKey = `${row.Invoice_no}_${row.Trans_Id}_${field}_${resolvedCCName}`;

                                    if (
                                        processedStaffs.has(
                                            duplicateKey
                                        )
                                    )
                                        return;

                                    processedStaffs.add(
                                        duplicateKey
                                    );

                                    /* ================= BASE GROUP KEY ================= */

                                    const pivotParts: string[] =
                                        [resolvedCCName];

                                    /* ================= DYNAMIC SPLIT ================= */

                                    enabledSplitColumns.forEach(
                                        (col: string) => {
                                            pivotParts.push(
                                                String(
                                                    row[
                                                    col
                                                    ] || ""
                                                )
                                            );
                                        }
                                    );

                                    const pivotKey =
                                        pivotParts.join(
                                            "|"
                                        );

                                    /* ================= CREATE ROW ================= */

                                    if (
                                        !pivotMap.has(
                                            pivotKey
                                        )
                                    ) {
                                        const baseRow: any =
                                            {};

                                        allKeys.forEach(
                                            (key) => {
                                                if (
                                                    categoryFields.includes(
                                                        key
                                                    )
                                                ) {
                                                    baseRow[
                                                        key
                                                    ] = 0;
                                                } else {
                                                    baseRow[
                                                        key
                                                    ] =
                                                        row[key];
                                                }
                                            }
                                        );

                                        baseRow.Staff_Name =
                                            resolvedCCName;

                                        baseRow.Qty = 0;
                                        baseRow.Act_Qty = 0;

                                        baseRow.__qtyInvoiceCount = 0;

                                        enabledSplitColumns.forEach(
                                            (col) => {
                                                baseRow[
                                                    col
                                                ] =
                                                    row[
                                                    col
                                                    ] ?? "";
                                            }
                                        );

                                        baseRow.__invoiceTracker =
                                            new Set<string>();

                                        baseRow.__categoryTracker =
                                            new Set<string>();

                                        baseRow.__categoryInvoiceCount =
                                            {};

                                        pivotMap.set(
                                            pivotKey,
                                            baseRow
                                        );
                                    }

                                    const existing =
                                        pivotMap.get(
                                            pivotKey
                                        );

                                    /* ================= CATEGORY TOTAL ================= */

                                    existing[field] =
                                        Number(existing[field] || 0) +
                                        (
                                            useActualQty
                                                ? actQty
                                                : qty
                                        );

                                    existing.__categoryInvoiceCount[field] =
                                        (
                                            existing.__categoryInvoiceCount[
                                            field
                                            ] || 0
                                        ) + 1;

                                    /* ================= QTY CALC ================= */

                                    existing.Qty += qty;

                                    existing.Act_Qty += actQty;

                                    existing.__qtyInvoiceCount += 1;

                                    /* ================= OTHER FIELD MERGE ================= */

                                    allKeys.forEach(
                                        (key) => {
                                            if (
                                                [
                                                    "Staff_Name",
                                                    "Godown_Name",
                                                    "Invoice_no",
                                                    "Journal_no",
                                                    "Stock_Journal_Voucher_type",
                                                    "Qty",
                                                    "Act_Qty",
                                                    ...categoryFields,
                                                ].includes(
                                                    key
                                                )
                                            )
                                                return;

                                            const oldValue =
                                                existing[
                                                key
                                                ];

                                            const newValue =
                                                row[key];

                                            if (
                                                oldValue ===
                                                null ||
                                                oldValue ===
                                                undefined ||
                                                oldValue ===
                                                ""
                                            ) {
                                                existing[
                                                    key
                                                ] = newValue;
                                            } else if (
                                                String(
                                                    oldValue
                                                ) !==
                                                String(
                                                    newValue
                                                )
                                            ) {
                                                existing[
                                                    key
                                                ] =
                                                    "Multiple";
                                            }
                                        }
                                    );
                                }
                            );
                        }
                    );

                    /* ================= FINAL ROWS ================= */

                    const rows =
                        Array.from(
                            pivotMap.values()
                        ).map(
                            (
                                r: any,
                                i
                            ) => {
                                delete r.__invoiceTracker;
                                delete r.__categoryTracker;

                                return {
                                    SNo: i + 1,
                                    ...r,
                                };
                            }
                        );

                    setExpandedRows(rows);

                    /* ================= COLUMN STATE UPDATE ================= */

                    setExpandedColumns((prev) => {
                        const next = finalCols.map((col) => {
                            const existing = prev.find(
                                (p) => p.key === col.key
                            );

                            return existing
                                ? {
                                    ...col,

                                    // Preserve template enabled state
                                    enabled: col.enabled,

                                    // Keep drag order/grouping only
                                    order:
                                        col.order ??
                                        existing.order,

                                    groupBy:
                                        col.groupBy ??
                                        existing.groupBy,
                                }
                                : col;
                        });

                        return JSON.stringify(prev) ===
                            JSON.stringify(next)
                            ? prev
                            : next;
                    });
                }

                setPage(1);
            } catch (error) {
                console.error(error);
                toast.error(
                    "Failed to load Staff Based Report"
                );
            } finally {
                setLoading(false);
            }
        };

    useEffect(() => {
        setFromDate(filters.Date.from);
        setToDate(filters.Date.to);
    }, [toggleMode]);

    /* ================= RESET SETTINGS ================= */

    const handleResetSettings = () => {
        const todayDate = dayjs().format("YYYY-MM-DD");

        setFromDate(todayDate);
        setToDate(todayDate);

        setFilters({
            Date: {
                from: todayDate,
                to: todayDate,
            },
            columnFilters: {},
        });

        setAbstractGrouping([]);
        setExpandedGrouping([]);
        setAbstractPendingGrouping([]);
        setExpandedPendingGrouping([]);
        setAbstractExpandedKeys([]);
        setExpandedExpandedKeys([]);

        setSortConfig({
            key: null,
            order: "asc",
        });

        setAbstractRows([]);
        setExpandedRows([]);
        setAbstractColumns([]);
        setExpandedColumns([]);

        setStockFilter("hasValues");

        setPage(1);

        setSettingsAnchor(null);
        setFilterAnchor(null);
    };

    /* ================= FILTERING ================= */

    const filteredRows = useMemo(() => {
        let rows = [...rawRows];

        for (const [key, values] of Object.entries(
            filters.columnFilters
        )) {
            if (values === undefined) continue;

            rows = rows.filter((row) => {
                const rowValue = String(row[key] ?? "")
                    .trim()
                    .toLowerCase();

                return values.some(
                    (v) =>
                        String(v).trim().toLowerCase() === rowValue
                );
            });
        }

        rows = rows.filter((row) => {
            const qty = Number(
                toggleMode === "Expanded"
                    ? (
                        useActualQty
                            ? row.Act_Qty ??
                            row.Qty ??
                            0
                            : row.Qty ?? 0
                    )
                    : row.Total || 0
            );

            if (stockFilter === "hasValues" && qty <= 0)
                return false;

            if (stockFilter === "zero" && qty !== 0)
                return false;

            return true;
        });

        return rows;
    }, [rawRows, filters.columnFilters, stockFilter]);

    const numericKeys = useMemo(() => {
        return columns.filter((c) => c.isNumeric).map((c) => c.key);
    }, [columns]);

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

    /* ================= SORTING ================= */

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
                    ? dayjs(aVal).valueOf() -
                    dayjs(bVal).valueOf()
                    : dayjs(bVal).valueOf() -
                    dayjs(aVal).valueOf();
            }

            if (
                typeof aVal === "number" &&
                typeof bVal === "number"
            ) {
                return sortConfig.order === "asc"
                    ? aVal - bVal
                    : bVal - aVal;
            }

            return sortConfig.order === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }, [numFilteredAndSortedRows, numSortConfig, sortConfig]);

    /* ================= GROUPING ================= */

    const buildGroupedData = React.useCallback(
        (data: any[], level: number, parentKey = "") => {
            const groupKey = grouping[level];

            if (!groupKey) return data;

            const map = new Map<string, any[]>();

            for (const row of data) {
                const val = String(row[groupKey] ?? "Others");

                if (!map.has(val)) map.set(val, []);
                map.get(val)!.push(row);
            }

            return Array.from(map.entries()).map(
                ([value, rows]) => ({
                    __group: true,
                    __key: `${parentKey}${groupKey}:${value}`,
                    __value: value,
                    __level: level,
                    __rows: rows,
                })
            );
        },
        [grouping]
    );

    const groupedRows = useMemo(() => {
        if (!grouping.length) return sortedRows;
        return buildGroupedData(sortedRows, 0);
    }, [sortedRows, grouping, buildGroupedData]);

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
                            `${r.__key}>`
                        )
                    );
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

    /* ================= DRAG & DROP ================= */

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        setColumns((cols) => {
            const enabled = cols.filter((c) => c.enabled);
            const disabled = cols.filter((c) => !c.enabled);

            const isEnabledDrag = enabled.some(
                (c) => c.key === active.id
            );

            const activeList = isEnabledDrag
                ? enabled
                : disabled;

            const oldIndex = activeList.findIndex(
                (c) => c.key === active.id
            );

            const newIndex = activeList.findIndex(
                (c) => c.key === over.id
            );

            const reordered = arrayMove(
                activeList,
                oldIndex,
                newIndex
            );

            const reorderedWithOrder = reordered.map(
                (c, index) => ({
                    ...c,
                    order: index + 1,
                })
            );

            return isEnabledDrag
                ? [...reorderedWithOrder, ...disabled]
                : [...enabled, ...reorderedWithOrder];
        });
    };

    /* ================= COLUMNS SORT ================= */

    const sortedColumns = useMemo(() => {
        return [...columns].sort((a, b) => {
            if (a.enabled !== b.enabled) {
                return a.enabled ? -1 : 1;
            }

            return a.order - b.order;
        });
    }, [columns]);

    const enabledColumns =
        sortedColumns.filter((c) => c.enabled);

    /* ================= TOTAL ================= */

    const baseRows = grouping.length
        ? filteredRows
        : sortedRows;

    const getTotal = (key: string) => {
        // Total / Qty column special logic
        if (key === "Total" || key === "Qty") {
            const enabledNumericColumns =
                enabledColumns.filter(
                    (c) =>
                        c.enabled &&
                        c.key !== "Total" &&
                        c.key !== "Qty" &&
                        c.key !== "Staff_Name"
                );

            return Number(
                baseRows
                    .reduce((sum, row) => {
                        const rowTotal =
                            enabledNumericColumns.reduce(
                                (rSum, col) =>
                                    rSum +
                                    Number(
                                        row[col.key] || 0
                                    ),
                                0
                            );

                        return sum + rowTotal;
                    }, 0)
                    .toFixed(2)
            );
        }

        const isAbstractNumericKey = toggleMode === "Abstract" && (key === "Total" || key.includes("."));
        const actualKey = isAbstractNumericKey ? `${key}_${staffBasedDisplayMode}` : key;

        return Number(
            baseRows
                .reduce((s, r) => {
                    const value = Number(r[actualKey]);

                    return (
                        s +
                        (Number.isFinite(value)
                            ? value
                            : 0)
                    );
                }, 0)
                .toFixed(2)
        );
    };

    /* ================= HEADER CLICK ================= */

    const handleHeaderClick = (
        e: React.MouseEvent<HTMLElement>,
        header: string
    ) => {
        setActiveHeader(header);
        setFilterAnchor(e.currentTarget);
    };

    /* ================= DEFAULT SORT INIT ================= */

    useEffect(() => {
        if (sortConfig.key) return;

        const hasLedgerDate = enabledColumns.some(
            (c) => c.key === "Ledger_Date"
        );

        const hasInvoiceNo = enabledColumns.some(
            (c) => c.key === "invoice_no"
        );

        if (
            !hasLedgerDate &&
            !hasInvoiceNo &&
            enabledColumns.length > 0
        ) {
            setSortConfig({
                key: enabledColumns[0].key,
                order: "asc",
            });
        }
    }, [enabledColumns, sortConfig.key]);

    /* ================= FILTER OPTIONS ================= */

    const sortFilterValues = (
        values: string[],
        key: string,
        order: "asc" | "desc"
    ) => {
        return [...values].sort((a, b) => {
            if (key === "Ledger_Date") {
                return order === "asc"
                    ? dayjs(a).valueOf() -
                    dayjs(b).valueOf()
                    : dayjs(b).valueOf() -
                    dayjs(a).valueOf();
            }

            if (
                !isNaN(Number(a)) &&
                !isNaN(Number(b))
            ) {
                return order === "asc"
                    ? Number(a) - Number(b)
                    : Number(b) - Number(a);
            }

            return order === "asc"
                ? a.localeCompare(b)
                : b.localeCompare(a);
        });
    };

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        let rows = [...rawRows];

        for (const [key, values] of Object.entries(
            filters.columnFilters
        )) {
            if (key === activeHeader) continue;
            if (!values?.length) continue;

            rows = rows.filter((row) => {
                const rowValue = String(row[key] ?? "")
                    .trim()
                    .toLowerCase();

                return values.some(
                    (v) =>
                        String(v).trim().toLowerCase() === rowValue
                );
            });
        }

        const uniqueValues = Array.from(
            new Set(
                rows
                    .map((r) => r[activeHeader])
                    .filter((v) => v !== null && v !== undefined && v !== "")
                    .map((v) => String(v).trim())
            )
        );

        return sortFilterValues(
            uniqueValues,
            activeHeader,
            sortConfig.order
        );
    }, [activeHeader, rawRows, filters.columnFilters, sortConfig.order]);

    /* ================= EXPORT ================= */

    const exportColumns = enabledColumns.map((c) => ({
        key: c.key,
        label: c.label,
    }));

    const exportRows = sortedRows.map((row) => {
        const obj: any = {};

        exportColumns.forEach((col) => {
            let value = row[col.key];

            if (col.key === "Ledger_Date") {
                value = dayjs(value).format("DD/MM/YYYY");
            } else if (toggleMode === "Abstract" && (col.key === "Total" || col.key.includes("."))) {
                const numericVal = Number(value || 0);
                value = numericVal > 0 ? (staffBasedDisplayMode === "qty" ? numericVal.toFixed(2) : numericVal.toFixed(0)) : "";
            } else if (toggleMode === "Expanded") {
                if (STAFF_CATEGORY_FIELDS.includes(col.key)) {
                    const rawVal = Number(row[col.key] || 0);
                    const invoiceCount = row.__categoryInvoiceCount?.[col.key] || 0;
                    if (staffBasedDisplayMode === "qty") {
                        value = rawVal > 0 ? rawVal.toFixed(2) : "";
                    } else {
                        value = invoiceCount > 0 ? `${invoiceCount}` : "";
                    }
                } else if (col.key === "Qty") {
                    const displayQty = Number(
                        useActualQty
                            ? row.Act_Qty || 0
                            : row.Qty || 0
                    );
                    const invoiceCount = row.__qtyInvoiceCount || 0;
                    if (staffBasedDisplayMode === "qty") {
                        value = displayQty > 0 ? displayQty.toFixed(2) : "0.00";
                    } else {
                        value = invoiceCount > 0 ? `${invoiceCount}` : "0";
                    }
                } else if (typeof value === "number") {
                    value = value > 0 ? value.toFixed(2) : "";
                }
            }

            obj[col.label] = value ?? "";
        });

        return obj;
    });

    /* ================= EXPORT EXCEL ================= */

    const handleExportExcel = () => {
        const worksheet =
            XLSX.utils.json_to_sheet(exportRows);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            toggleMode === "Expanded"
                ? "Expanded Report"
                : "Abstract Report"
        );

        XLSX.writeFile(
            workbook,
            `Staff Based Report_${toggleMode}_${dayjs().format(
                "DDMMYYYY"
            )}.xlsx`
        );
    };

    /* ================= EXPORT PDF ================= */

    const handleExportPDF = () => {
        const doc = new jsPDF("l", "mm", "a4");

        doc.text(
            `Staff Based Report (${toggleMode})`,
            14,
            10
        );

        autoTable(doc, {
            startY: 15,
            head: [exportColumns.map((c) => c.label)],
            body: exportRows.map((r) =>
                Object.values(r)
            ),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [30, 58, 138] },
        });

        doc.save(
            `Staff Based Report_${toggleMode}_${dayjs().format(
                "DDMMYYYY"
            )}.pdf`
        );
    };

    /* ================= APPLY TEMPLATE FUNCTION ================= */

    const applyTemplateToColumns = (
        baseCols: ColumnConfig[],
        templateCols: any[]
    ): ColumnConfig[] => {

        const templateMap = new Map(
            templateCols.map((t: any) => [
                t.key ?? t.Key,
                t,
            ])
        );

        return baseCols.map((base) => {
            const template =
                templateMap.get(base.key);

            // Template exists → use saved state
            if (template) {
                return {
                    ...base,
                    enabled:
                        template.enabled ??
                        template.Enabled ??
                        false,

                    order:
                        template.order ??
                        template.Order ??
                        base.order,

                    groupBy:
                        template.groupBy ??
                        template.GroupBy ??
                        template.group_by ??
                        template.Group_By ??
                        0,
                };
            }

            // Template missing → preserve base column state
            return base;
        });
    };

    /* ================= LOAD TEMPLATE ================= */

    const loadTemplate = async (reportId: number) => {
        try {
            setLoading(true);

            const res =
                await SettingsService.getReportEditData({
                    reportId,
                    typeId: 2,
                });

            const data =
                res?.data?.data || res?.data || {};

            const templateCols =
                data?.columns || data?.Columns || [];

            const reportInfo =
                data?.reportInfo ||
                data?.ReportInfo ||
                {};

            const autoReportName =
                reportInfo?.Report_Name ||
                reportInfo?.ReportName ||
                data?.Report_Name ||
                data?.ReportName ||
                "";

            const autoParentReport =
                reportInfo?.Parent_Report ||
                reportInfo?.ParentReport ||
                data?.Parent_Report ||
                data?.ParentReport ||
                "";

            setExpandedRows([]);

            setTemplateConfig({
                expanded: templateCols,
            });

            setSelectedTemplateId(reportId);

            setIsEditTemplate(true);

            setReportName(autoReportName);

            setParentReportName(autoParentReport);

            setToggleMode("Expanded");

            const mappedCols =
                applyTemplateToColumns(
                    expandedColumns,
                    templateCols
                );

            setExpandedColumns(mappedCols);

            setPage(1);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load template");
        } finally {
            setLoading(false);
        }
    };

    /* ================= QUICK SAVE TEMPLATE ================= */

    const handleQuickSave = async () => {
        try {
            if (toggleMode !== "Expanded") {
                toast.info(
                    "Templates can be saved only in Expanded mode"
                );
                return;
            }

            if (!reportName.trim()) {
                toast.error("Enter Report Name");
                return;
            }

            if (!parentReportName.trim()) {
                toast.error("Parent Report missing");
                return;
            }

            if (!expandedColumns.length) {
                toast.error("Expanded columns not loaded");
                return;
            }

            const userData = JSON.parse(
                localStorage.getItem("user") || "{}"
            );

            const createdBy = userData?.id || 0;

            const abstractPayload =
                (abstractColumns.length
                    ? abstractColumns
                    : [
                        {
                            key: "Staff_Name",
                            label: "Staff Name",
                            enabled: true,
                            order: 1,
                            groupBy: 0,
                            isNumeric: false,
                        },
                    ]
                ).map((c) => ({
                    key: c.key,
                    label: c.label,

                    // Always save exact state
                    enabled: Boolean(c.enabled),

                    order: c.order,
                    groupBy: 0,
                    dataType: "nvarchar",
                }));

            const expandedPayload = expandedColumns.map((c) => ({
                key: c.key,
                label: c.label,

                // Always send actual UI state
                enabled: Boolean(c.enabled),

                order: c.order,

                groupBy: expandedGrouping.includes(c.key)
                    ? expandedGrouping.indexOf(c.key) + 1
                    : 0,

                dataType: "nvarchar",
            }));

            if (isEditTemplate && selectedTemplateId) {
                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 1,
                    reportName: reportName.trim(),
                    columns: abstractPayload,
                });

                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 2,
                    reportName: reportName.trim(),
                    columns: expandedPayload,
                });

                toast.success(
                    "Template Updated Successfully ✅"
                );

                setIsEditTemplate(false);
            } else {
                await SettingsService.saveReportSettings({
                    reportName: reportName.trim(),
                    parentReport:
                        parentReportName.trim(),
                    abstractSP:
                        "Reporting_Online_Stock_Journal_VW",
                    expandedSP:
                        "Reporting_Online_Stock_Journal_Item_VW",
                    abstractColumns: abstractPayload,
                    expandedColumns: expandedPayload,
                    createdBy,
                });

                toast.success(
                    "Template Saved Successfully ✅"
                );
            }

            setSaveDialogOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (err: any) {
            console.error(err);

            toast.error(
                err?.response?.data?.message ||
                "Save Failed ❌"
            );
        }
    };

    /* ================= USE EFFECT (GROUP AUTO INIT) ================= */

    useEffect(() => {
        console.log("AUTO-INIT EFFECT TRIGGERED:", { columnsLength: columns.length, toggleMode });
        if (!columns.length) return;

        // Existing template grouping
        let templateGroups = columns
            .filter(
                (col) => Number(col.groupBy || 0) > 0
            )
            .sort(
                (a, b) =>
                    Number(a.groupBy) -
                    Number(b.groupBy)
            )
            .map((col) => col.key);

        // If no template grouping exists, default to Staff_Name as first level
        if (templateGroups.length === 0 && columns.some(c => c.key === "Staff_Name")) {
            templateGroups = ["Staff_Name"];
        }

        if (toggleMode === "Expanded") {
            setExpandedGrouping(templateGroups);
            setExpandedPendingGrouping(templateGroups);
            setExpandedExpandedKeys([]);
        } else {
            setAbstractGrouping(templateGroups);
            setAbstractPendingGrouping(templateGroups);
            setAbstractExpandedKeys([]);
        }
    }, [columns, toggleMode]);

    /* ================= RENDER START ================= */

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
                onReportChange={(template) => {
                    if (!template) {
                        setSelectedTemplateId(null);
                        setTemplateConfig(null);
                        setReportName("");
                        setParentReportName("");
                        setIsEditTemplate(false);
                        setExpandedColumns([]);
                        setExpandedRows([]);
                        setPage(1);
                        setGrouping([]);
                        setPendingGrouping([]);
                        setExpandedKeys([]);
                        setToggleMode("Abstract");
                        handleResetSettings();
                        return;
                    }

                    loadTemplate(template.Report_Id);
                }}
                onQuickSave={(parentName) => {
                    if (toggleMode !== "Expanded") {
                        toast.info(
                            "Templates only available in Expanded mode"
                        );
                        return;
                    }

                    setParentReportName(parentName);
                    setSaveDialogOpen(true);
                }}
                settingsSlot={
                    <Box display="flex" gap={1}>
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

                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}

                showStaffBasedDisplayMode={true}
                staffBasedDisplayMode={staffBasedDisplayMode}
                onStaffBasedDisplayModeChange={setStaffBasedDisplayMode}

                onApply={() =>
                    setFilters({
                        ...filters,
                        Date: {
                            from: fromDate,
                            to: toDate,
                        },
                    })
                }
            />

            <AppLayout fullWidth>
                <Box sx={{ overflow: "auto", mt: 1 }}>

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
                                    {enabledColumns.map((c) => {
                                        const isQtyHeader = c.key === "Qty";

                                        return (
                                            <TableCell
                                                key={c.key}
                                                align={c.isNumeric ? "right" : "left"}
                                                sx={{
                                                    color: "#fff",
                                                    cursor: "pointer",
                                                    userSelect: "none",
                                                }}
                                                onClick={(e) => {
                                                    // Toggle Qty <-> Act_Qty
                                                    if (isQtyHeader) {
                                                        setUseActualQty((prev) => !prev);
                                                        return;
                                                    }

                                                    // Existing filter click
                                                    if (!c.isNumeric) {
                                                        handleHeaderClick(e, c.key);
                                                    } else {
                                                        openNumFilter(e, c.key);
                                                    }
                                                }}
                                            >
                                                <Box
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="space-between"
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            fontWeight:
                                                                isQtyHeader ? 700 : 500,
                                                            width: "100%",
                                                        }}
                                                    >
                                                        {c.isNumeric ? (
                                                            <SortableHeaderLabel
                                                                label={isQtyHeader
                                                                    ? `Total Qty (${useActualQty ? "Act_Qty" : "Qty"})`
                                                                    : c.label
                                                                }
                                                                columnKey={c.key}
                                                                sortConfig={numSortConfig}
                                                                onSort={(key) => {
                                                                    setSortConfig({ key: null, order: "asc" });
                                                                    handleNumSort(key);
                                                                }}
                                                                onOpenFilter={(e) => openNumFilter(e, c.key)}
                                                                disableLabelFilterClick={isQtyHeader}
                                                            />
                                                        ) : (
                                                            c.label
                                                        )}
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                        );
                                    })}
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
                                    {enabledColumns.map((c) => {
                                        if (!c.isNumeric) {
                                            return (
                                                <TableCell key={c.key} align="left">
                                                    -
                                                </TableCell>
                                            );
                                        }

                                        const workColumns = STAFF_CATEGORY_FIELDS;

                                        // ===== TOTAL QTY =====
                                        if (c.key === "Qty") {
                                            const totalQty = baseRows.reduce(
                                                (sum, row) =>
                                                    sum +
                                                    Number(
                                                        useActualQty
                                                            ? row.Act_Qty || 0
                                                            : row.Qty || 0
                                                    ),
                                                0
                                            );

                                            const totalInvoiceCount =
                                                baseRows.reduce(
                                                    (sum, row) =>
                                                        sum +
                                                        Number(
                                                            row.__qtyInvoiceCount || 0
                                                        ),
                                                    0
                                                );

                                            return (
                                                <TableCell key={c.key} align="right">
                                                    {formatDisplay(totalQty, totalInvoiceCount, true)}
                                                </TableCell>
                                            );
                                        }

                                        // ===== WORK COLUMNS =====
                                        if (workColumns.includes(c.key)) {
                                            const totalQty = baseRows.reduce(
                                                (sum, row) =>
                                                    sum +
                                                    Number(row[c.key] || 0),
                                                0
                                            );

                                            const invoiceCount =
                                                baseRows.reduce(
                                                    (sum, row) =>
                                                        sum +
                                                        Number(
                                                            row
                                                                .__categoryInvoiceCount?.[
                                                            c.key
                                                            ] || 0
                                                        ),
                                                    0
                                                );

                                            return (
                                                <TableCell key={c.key} align="right">
                                                    {formatDisplay(totalQty, invoiceCount)}
                                                </TableCell>
                                            );
                                        }

                                        // ===== NORMAL NUMERIC =====
                                        const total = Number(
                                            getTotal(c.key)
                                        );

                                        return (
                                            <TableCell key={c.key} align="right">
                                                {total > 0
                                                    ? total.toFixed(2)
                                                    : "-"}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={enabledColumns.length + 1} align="center">
                                            <Box py={4}>
                                                <CircularProgress size={28} />
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    (() => {
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
                                                                return (
                                                                    <TableCell key={c.key} align={c.isNumeric ? "right" : "left"} sx={{ fontWeight: 700 }}>
                                                                        {row.__value}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            if (c.isNumeric) {
                                                                const workColumns = STAFF_CATEGORY_FIELDS;

                                                                // ===== QTY COLUMN =====
                                                                if (c.key === "Qty") {
                                                                    const totalQty = row.__rows.reduce(
                                                                        (sum: number, r: any) =>
                                                                            sum +
                                                                            Number(
                                                                                useActualQty
                                                                                    ? r.Act_Qty || 0
                                                                                    : r.Qty || 0
                                                                            ),
                                                                        0
                                                                    );

                                                                    const invoiceCount = row.__rows.reduce(
                                                                        (sum: number, r: any) =>
                                                                            sum + Number(r.__qtyInvoiceCount || 0),
                                                                        0
                                                                    );

                                                                    return (
                                                                        <TableCell key={c.key} align="right">
                                                                            {formatDisplay(totalQty, invoiceCount, true)}
                                                                        </TableCell>
                                                                    );
                                                                }

                                                                // ===== STAFF WORK COLUMNS =====
                                                                if (workColumns.includes(c.key)) {
                                                                    const totalQty = row.__rows.reduce(
                                                                        (sum: number, r: any) =>
                                                                            sum + Number(r[c.key] || 0),
                                                                        0
                                                                    );

                                                                    const invoiceCount = row.__rows.reduce(
                                                                        (sum: number, r: any) =>
                                                                            sum +
                                                                            Number(
                                                                                r.__categoryInvoiceCount?.[
                                                                                c.key
                                                                                ] || 0
                                                                            ),
                                                                        0
                                                                    );

                                                                    return (
                                                                        <TableCell key={c.key} align="right">
                                                                            {formatDisplay(totalQty, invoiceCount)}
                                                                        </TableCell>
                                                                    );
                                                                }

                                                                // ===== NORMAL NUMERIC =====
                                                                const total = row.__rows.reduce(
                                                                    (s: number, r: any) =>
                                                                        s + Number(r[c.key] || 0),
                                                                    0
                                                                );

                                                                return (
                                                                    <TableCell key={c.key} align="right">
                                                                        {total > 0
                                                                            ? total.toFixed(2)
                                                                            : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            return <TableCell key={c.key} />;
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

                                                                    : c.isNumeric
                                                                        ? (() => {

                                                                            const workColumns = STAFF_CATEGORY_FIELDS;

                                                                            const isAbstractNumericKey = toggleMode === "Abstract" && (c.key === "Total" || c.key.includes("."));
                                                                            const actualKey = isAbstractNumericKey ? `${c.key}_${staffBasedDisplayMode}` : c.key;
                                                                            const value =
                                                                                Number(row[actualKey] || 0);

                                                                            // Show qty + invoice count
                                                                            if (workColumns.includes(c.key)) {
                                                                                const invoiceCount =
                                                                                    row.__categoryInvoiceCount?.[
                                                                                    c.key
                                                                                    ] || 0;

                                                                                return formatDisplay(value, invoiceCount);
                                                                            }


                                                                            // Qty column
                                                                            if (c.key === "Qty") {
                                                                                const displayQty = Number(
                                                                                    useActualQty
                                                                                        ? row.Act_Qty || 0
                                                                                        : row.Qty || 0
                                                                                );

                                                                                const invoiceCount =
                                                                                    row.__qtyInvoiceCount || 0;

                                                                                return formatDisplay(displayQty, invoiceCount, true);
                                                                            }

                                                                            if (toggleMode === "Abstract") {
                                                                                if (staffBasedDisplayMode === "qty") {
                                                                                    return value > 0 ? value.toFixed(2) : "-";
                                                                                } else {
                                                                                    return value > 0 ? value.toFixed(0) : "-";
                                                                                }
                                                                            }

                                                                            return Number.isFinite(value) &&
                                                                                value > 0
                                                                                ? value.toFixed(2)
                                                                                : "-";
                                                                        })()

                                                                        : (
                                                                            row[c.key] !== null &&
                                                                            row[c.key] !== undefined &&
                                                                            row[c.key] !== ""
                                                                        )
                                                                            ? row[c.key]
                                                                            : "-"
                                                                }
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            );
                                        });
                                    })()
                                )}
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
                                console.log("SELECT ONCHANGE:", { level, value: e.target.value, currentPendingGrouping: pendingGrouping });
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
                                    disabled={pendingGrouping.includes(col.key) && pendingGrouping[level] !== col.key}
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
                            const nextGrouping = pendingGrouping.filter(Boolean);
                            setGrouping(nextGrouping);

                            // Sync columns groupBy values with the applied grouping
                            setColumns((prevCols) =>
                                prevCols.map((col) => {
                                    const groupIdx = nextGrouping.indexOf(col.key);
                                    return {
                                        ...col,
                                        groupBy: groupIdx !== -1 ? groupIdx + 1 : 0,
                                    };
                                })
                            );

                            setExpandedKeys([]);
                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
                <DialogTitle>
                    {isEditTemplate ? "Edit Template" : "Create Template"}
                </DialogTitle>

                <DialogContent>
                    <TextField
                        fullWidth
                        size="small"
                        label="Report Name"
                        value={reportName || ""}
                        onChange={(e) =>
                            setReportName(
                                e.target.value
                            )
                        }
                    />
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)}>
                        Cancel
                    </Button>

                    <Button variant="contained" onClick={handleQuickSave}>
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

export default StaffBasedGroupingReport;