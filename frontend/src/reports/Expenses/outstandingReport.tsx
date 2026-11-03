import React, { useEffect, useMemo, useState } from "react";
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
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";

import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
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

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { toast } from "react-toastify";

import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { SettingsService } from "../../services/reportSettings.services";
import { OutStandingReportService } from "../../services/outstandingReport.service";

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    isNumeric?: boolean;
    order: number;
    groupBy?: number;
};

type SortOrder = "asc" | "desc";

type FiltersMap = {
    Date: {
        from: string;
        to: string;
    };
    columnFilters: Record<string, string[] | undefined>;
};

/* ================= CONSTANTS ================= */

const NUMERIC_KEYS = [
    "Debit_Amt",
    "Credit_Amt",
    "Bal_Amount",
    "Dr_Amount",
    "Cr_Amount",
    "Q_Pay_Days",
    "Freq_Days",
];

const CURRENCY_KEYS = [
    "Debit_Amt",
    "Credit_Amt",
    "Bal_Amount",
    "Dr_Amount",
    "Cr_Amount",
];

const DEFAULT_KEYS = [
    "Group_Name",
    "Retailer_Name",
    "OB_Amount",
    "Debit_Amt",
    "Credit_Amt",
    "Bal_Amount",
];

const REPORT_SP = "Reporting_Debtors_Creditors_VW";

/* ================= HELPERS ================= */

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(value || 0);

const buildColumnsFromApi = (rows: any[]): ColumnConfig[] => {
    if (!rows.length) return [];

    return Object.keys(rows[0]).map((key, index) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        enabled: DEFAULT_KEYS.includes(key),
        isNumeric: NUMERIC_KEYS.includes(key),
        order: index,
        groupBy: 0,
    }));
};

const sortFilterValues = (
    values: string[],
    key: string,
    order: SortOrder = "asc"
) => {
    const numericColumns = [
        "OB_Amount",
        "Debit_Amt",
        "Credit_Amt",
        "Bal_Amount",
        "Dr_Amount",
        "Cr_Amount",
        "Q_Pay_Days",
        "Freq_Days",
    ];

    const sorted = [...values];

    if (numericColumns.includes(key)) {
        sorted.sort((a, b) => {
            const aNum = Number(
                String(a).replace(/[^\d.-]/g, "")
            );

            const bNum = Number(
                String(b).replace(/[^\d.-]/g, "")
            );

            return order === "asc"
                ? aNum - bNum
                : bNum - aNum;
        });
    } else {
        sorted.sort((a, b) =>
            order === "asc"
                ? String(a).localeCompare(String(b))
                : String(b).localeCompare(String(a))
        );
    }

    return sorted;
};

/* ================= SORTABLE ROW ================= */

type SortableColumnRowProps = {
    column: ColumnConfig;
    onToggle: (key: string) => void;
    hasActiveFilter?: boolean;
};

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
            <IconButton
                size="small"
                {...listeners}
                {...attributes}
                sx={{ cursor: "grab" }}
            >
                <DragIndicatorIcon fontSize="small" />
            </IconButton>

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

            <Switch
                checked={column.enabled}
                onChange={() => onToggle(column.key)}
            />
        </Box>
    );
};

/* ================= COMPONENT ================= */

const OutstandingReport: React.FC = () => {

    const today = dayjs().format("YYYY-MM-DD");

    const [rows, setRows] = useState<any[]>([]);
    const [columns, setColumns] = useState<ColumnConfig[]>([]);

    const [loading, setLoading] = useState(false);

    const [viewMode, setViewMode] = useState<
        "Debtors" | "Creditors"
    >("Debtors");

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

    const [groupDialogOpen, setGroupDialogOpen] =
        useState(false);

    const [grouping, setGrouping] = useState<string[]>([]);
    const [pendingGrouping, setPendingGrouping] =
        useState<string[]>([]);

    const [expandedKeys, setExpandedKeys] =
        useState<string[]>([]);

    const [selectedTemplateId, setSelectedTemplateId] =
        useState<number | null>(null);

    const [templateLoading, setTemplateLoading] =
        useState(false);

    const [saveDialogOpen, setSaveDialogOpen] =
        useState(false);

    const [reportName, setReportName] =
        useState("");

    const [parentReportName, setParentReportName] =
        useState("");

    const [stockFilter, setStockFilter] =
        useState<
            "hasValues" |
            "zero" |
            "all"
        >("hasValues");

    const [filters, setFilters] =
        useState<FiltersMap>({
            Date: {
                from: today,
                to: today,
            },
            columnFilters: {},
        });

    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        order: SortOrder;
    }>({
        key: null,
        order: "asc",
    });


    /* ================= LOAD DATA ================= */

    useEffect(() => {
        loadReport();
    }, [filters.Date.from, filters.Date.to]);

    const loadReport = async () => {
        try {
            setLoading(true);

            const res =
                await OutStandingReportService.getCostingReport({
                    Fromdate: filters.Date.from,
                    Todate: filters.Date.to,
                });

            const dataObj = res.data.data || { Data1: [], Creditors: [], Debtors: [] };
            const data1 = dataObj.Data1 || [];
            const creditors = dataObj.Creditors || [];
            const debtors = dataObj.Debtors || [];

            const debtorsMap = new Map(debtors.map((d: any) => [d.Acc_Id, d]));
            const creditorsMap = new Map(creditors.map((c: any) => [c.Acc_Id, c]));

            const mergedRows = data1.map((row: any) => {
                const debtorInfo = debtorsMap.get(row.Acc_Id);
                if (debtorInfo) {
                    return {
                        ...row,
                        ...debtorInfo,
                        CR_DR: "DR", // Ensure CR_DR is DR
                    };
                }
                const creditorInfo = creditorsMap.get(row.Acc_Id);
                if (creditorInfo) {
                    return {
                        ...row,
                        ...creditorInfo,
                        CR_DR: "CR", // Ensure CR_DR is CR
                    };
                }
                return row;
            });

            setRows(mergedRows);
            setColumns(buildColumnsFromApi(mergedRows));
        } catch (err) {
            console.error(err);
            toast.error("Failed to load report");
        } finally {
            setLoading(false);
        }
    };

    /* ================= DEBTORS / CREDITORS ================= */

    const typeFilteredRows = useMemo(() => {
        return rows.filter(row =>
            viewMode === "Debtors"
                ? row.CR_DR === "DR"
                : row.CR_DR === "CR"
        );
    }, [rows, viewMode]);

    const rawRows = useMemo(() => {
        return typeFilteredRows;
    }, [typeFilteredRows]);

    /* ================= HEADER FILTER ================= */

    const filteredRows =
        useMemo(() => {

            let rows = rawRows.filter(
                (row: any) => {

                    // header filters
                    for (
                        const [
                            key,
                            values,
                        ] of Object.entries(
                            filters.columnFilters
                        )
                    ) {
                        if (
                            values === undefined
                        )
                            continue;

                        const rowValue =
                            String(
                                row[key] ?? ""
                            )
                                .trim()
                                .toLowerCase();

                        const match =
                            values.some(
                                v =>
                                    String(v)
                                        .trim()
                                        .toLowerCase() ===
                                    rowValue
                            );

                        if (!match)
                            return false;
                    }

                    return true;
                }
            );

            // helper
            const getOBAmount =
                (value: any) => {

                    if (!value)
                        return 0;

                    // "100.00 DR"
                    const num =
                        String(value)
                            .replace(
                                /[^\d.-]/g,
                                ""
                            );

                    return Number(
                        num || 0
                    );
                };

            // Drawer Filter
            if (
                stockFilter ===
                "hasValues"
            ) {

                rows = rows.filter(
                    r => {

                        const ob =
                            getOBAmount(
                                r.OB_Amount
                            );

                        const debit =
                            Number(
                                r.Debit_Amt ||
                                0
                            );

                        const credit =
                            Number(
                                r.Credit_Amt ||
                                0
                            );

                        const bal =
                            Number(
                                r.Bal_Amount ||
                                0
                            );

                        // ANY non-zero
                        return (
                            ob !== 0 ||
                            debit !== 0 ||
                            credit !== 0 ||
                            bal !== 0
                        );
                    }
                );
            }

            if (
                stockFilter ===
                "zero"
            ) {

                rows = rows.filter(
                    r => {

                        const ob =
                            getOBAmount(
                                r.OB_Amount
                            );

                        const debit =
                            Number(
                                r.Debit_Amt ||
                                0
                            );

                        const credit =
                            Number(
                                r.Credit_Amt ||
                                0
                            );

                        const bal =
                            Number(
                                r.Bal_Amount ||
                                0
                            );

                        // ALL zero
                        return (
                            ob === 0 &&
                            debit === 0 &&
                            credit === 0 &&
                            bal === 0
                        );
                    }
                );
            }

            return rows;

        }, [
            rawRows,
            filters,
            stockFilter,
        ]);

    /* ================= SORT ================= */

    const sortedRows = useMemo(() => {
        if (!sortConfig.key)
            return filteredRows;

        return [...filteredRows].sort(
            (a, b) => {
                const aVal =
                    a[sortConfig.key!];
                const bVal =
                    b[sortConfig.key!];

                if (
                    typeof aVal === "number" &&
                    typeof bVal === "number"
                ) {
                    return sortConfig.order ===
                        "asc"
                        ? aVal - bVal
                        : bVal - aVal;
                }

                return sortConfig.order ===
                    "asc"
                    ? String(aVal).localeCompare(
                        String(bVal)
                    )
                    : String(bVal).localeCompare(
                        String(aVal)
                    );
            }
        );
    }, [filteredRows, sortConfig]);

    /* ================= GROUPING ================= */

    const buildGroupedData = React.useCallback(
        (
            data: any[],
            level: number,
            parentKey = ""
        ): any[] => {
            const groupKey = grouping[level];

            if (!groupKey) return data;

            const map = new Map<string, any[]>();

            for (const row of data) {
                const value = String(
                    row[groupKey] ?? "Others"
                );

                if (!map.has(value)) {
                    map.set(value, []);
                }

                map.get(value)!.push(row);
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
        if (!grouping.length)
            return sortedRows;

        return buildGroupedData(
            sortedRows,
            0
        );
    }, [
        sortedRows,
        grouping,
        buildGroupedData,
    ]);

    const flattenRows = (
        rows: any[]
    ): any[] => {
        const result: any[] = [];

        const walk = (
            items: any[]
        ) => {
            for (const row of items) {
                result.push(row);

                if (
                    row.__group &&
                    expandedKeys.includes(
                        row.__key
                    )
                ) {
                    walk(
                        buildGroupedData(
                            row.__rows,
                            row.__level + 1,
                            `${row.__key} > `
                        )
                    );
                }
            }
        };

        walk(rows);

        return result;
    };

    const paginatedSourceRows =
        useMemo(() => {
            return grouping.length
                ? flattenRows(groupedRows)
                : sortedRows;
        }, [
            groupedRows,
            sortedRows,
            grouping,
            expandedKeys,
        ]);

    /* ================= PAGINATION ================= */

    const finalRows = useMemo(() => {
        const start =
            (page - 1) *
            rowsPerPage;

        const end =
            start + rowsPerPage;

        return paginatedSourceRows.slice(
            start,
            end
        );
    }, [
        paginatedSourceRows,
        page,
        rowsPerPage,
    ]);

    /* ================= COLUMN SETTINGS ================= */

    const sensors = useSensors(
        useSensor(
            PointerSensor,
            {
                activationConstraint: {
                    distance: 5,
                },
            }
        )
    );

    const handleDragEnd = (
        event: any
    ) => {
        const {
            active,
            over,
        } = event;

        if (
            !over ||
            active.id === over.id
        )
            return;

        setColumns(cols => {
            const enabled =
                cols.filter(
                    c => c.enabled
                );

            const disabled =
                cols.filter(
                    c => !c.enabled
                );

            const activeList =
                enabled.some(
                    c =>
                        c.key ===
                        active.id
                )
                    ? enabled
                    : disabled;

            const oldIndex =
                activeList.findIndex(
                    c =>
                        c.key ===
                        active.id
                );

            const newIndex =
                activeList.findIndex(
                    c =>
                        c.key ===
                        over.id
                );

            const reordered =
                arrayMove(
                    activeList,
                    oldIndex,
                    newIndex
                );

            reordered.forEach(
                (c, i) =>
                    (c.order = i)
            );

            return [
                ...reordered,
                ...(!activeList[0]
                    .enabled
                    ? enabled
                    : disabled),
            ];
        });
    };

    const sortedColumns =
        useMemo(() => {
            return [
                ...columns,
            ].sort((a, b) => {
                if (
                    a.enabled !==
                    b.enabled
                ) {
                    return a.enabled
                        ? -1
                        : 1;
                }

                return (
                    a.order -
                    b.order
                );
            });
        }, [columns]);

    const enabledColumns =
        sortedColumns.filter(
            c => c.enabled
        );

    /* ================= TOTAL ================= */

    const getTotal = (
        key: string
    ) =>
        Number(
            filteredRows
                .reduce(
                    (sum, row) =>
                        sum +
                        Number(
                            row[key] || 0
                        ),
                    0
                )
                .toFixed(2)
        );

    /* ================= FILTER ================= */

    const handleHeaderClick = (
        e: React.MouseEvent<HTMLElement>,
        header: string
    ) => {
        setActiveHeader(
            header
        );

        setFilterAnchor(
            e.currentTarget
        );
    };

    const handleSortClick = (
        e: React.MouseEvent<HTMLElement>,
        key: string
    ) => {
        e.stopPropagation();

        setSortConfig(prev => ({
            key,
            order:
                prev.key === key &&
                    prev.order ===
                    "asc"
                    ? "desc"
                    : "asc",
        }));
    };

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        // start from view filtered rows
        let baseRows = typeFilteredRows;

        const getOBAmount = (value: any) => {
            if (!value) return 0;

            const num = String(value).replace(/[^\d.-]/g, "");
            return Number(num || 0);
        };

        // respect drawer stock filter
        if (stockFilter === "hasValues") {
            baseRows = baseRows.filter((r: any) => {
                const ob = getOBAmount(r.OB_Amount);
                const debit = Number(r.Debit_Amt || 0);
                const credit = Number(r.Credit_Amt || 0);
                const bal = Number(r.Bal_Amount || 0);

                return (
                    ob !== 0 ||
                    debit !== 0 ||
                    credit !== 0 ||
                    bal !== 0
                );
            });
        }

        if (stockFilter === "zero") {
            baseRows = baseRows.filter((r: any) => {
                const ob = getOBAmount(r.OB_Amount);
                const debit = Number(r.Debit_Amt || 0);
                const credit = Number(r.Credit_Amt || 0);
                const bal = Number(r.Bal_Amount || 0);

                return (
                    ob === 0 &&
                    debit === 0 &&
                    credit === 0 &&
                    bal === 0
                );
            });
        }

        // IMPORTANT:
        // Ignore the current active header filter
        // so multiselect won't collapse options
        const rowsWithoutCurrentHeader = baseRows.filter((row: any) => {
            for (const [column, values] of Object.entries(filters.columnFilters)) {

                if (column === activeHeader) continue;

                if (values === undefined) continue;

                const rowValue = String(row[column] ?? "")
                    .trim()
                    .toLowerCase();

                const match = values.some(
                    (v: string) =>
                        String(v)
                            .trim()
                            .toLowerCase() === rowValue
                );

                if (!match) return false;
            }

            return true;
        });

        const uniqueValues = Array.from(
            new Set(
                rowsWithoutCurrentHeader
                    .map((r: any) => r[activeHeader])
                    .filter(
                        (v: any) =>
                            v !== null &&
                            v !== undefined &&
                            v !== ""
                    )
                    .map((v: any) => String(v).trim())
            )
        );

        return sortFilterValues(
            uniqueValues,
            activeHeader,
            sortConfig.order
        );
    }, [
        activeHeader,
        typeFilteredRows,
        filters.columnFilters,
        stockFilter,
        sortConfig.order,
    ]);
    /* ================= EXPORT ================= */

    const exportColumns =
        enabledColumns.map(
            c => ({
                key: c.key,
                label: c.label,
            })
        );

    const exportRows =
        sortedRows.map(row => {
            const obj: any =
                {};

            exportColumns.forEach(
                col => {
                    let val = row[col.key] ?? "";
                    if (col.key === "Bal_Amount") {
                        const suffix = String(row.OB_Amount || "").toUpperCase().includes("DR")
                            ? " DR"
                            : String(row.OB_Amount || "").toUpperCase().includes("CR")
                                ? " CR"
                                : "";
                        val = `${val}${suffix}`;
                    }
                    obj[
                        col.label
                    ] = val;
                }
            );

            return obj;
        });

    const handleExportExcel =
        () => {
            const worksheet =
                XLSX.utils.json_to_sheet(
                    exportRows
                );

            const workbook =
                XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                `${viewMode} Report`
            );

            XLSX.writeFile(
                workbook,
                `Outstanding_${viewMode}_${dayjs().format(
                    "DDMMYYYY"
                )}.xlsx`
            );
        };

    const handleExportPDF =
        () => {
            const doc =
                new jsPDF(
                    "l",
                    "mm",
                    "a4"
                );

            doc.text(
                `Outstanding Report (${viewMode})`,
                14,
                10
            );

            autoTable(doc, {
                startY: 15,
                head: [
                    exportColumns.map(
                        c => c.label
                    ),
                ],
                body:
                    exportRows.map(
                        r =>
                            Object.values(
                                r
                            )
                    ),
                styles: {
                    fontSize: 7,
                },
            });

            doc.save(
                `Outstanding_${viewMode}.pdf`
            );
        };

    /* ================= TEMPLATE ================= */

    const applyTemplateToColumns = (
        baseCols: ColumnConfig[],
        templateCols: any[]
    ): ColumnConfig[] => {

        // Template lookup
        const templateMap = new Map(
            templateCols.map((t: any) => [
                t.key,
                t,
            ])
        );

        // Preserve template settings
        const merged = baseCols.map(
            (base, index) => {
                const template =
                    templateMap.get(base.key);

                return {
                    ...base,

                    label:
                        template?.label ??
                        base.label,

                    enabled:
                        template !== undefined
                            ? template.enabled
                            : base.enabled,

                    order:
                        template !== undefined
                            ? template.order
                            : index,

                    groupBy:
                        template !== undefined
                            ? template.groupBy
                            : 0,

                    isNumeric:
                        base.isNumeric,
                };
            }
        );

        // Include template-only columns
        const missingTemplateColumns =
            templateCols
                .filter(
                    (t: any) =>
                        !merged.some(
                            m => m.key === t.key
                        )
                )
                .map((t: any) => ({
                    key: t.key,
                    label: t.label,
                    enabled:
                        t.enabled,
                    order:
                        t.order ?? 0,
                    groupBy:
                        t.groupBy ?? 0,
                    isNumeric:
                        NUMERIC_KEYS.includes(
                            t.key
                        ),
                }));

        const finalCols = [
            ...merged,
            ...missingTemplateColumns,
        ];
        finalCols.sort(
            (a, b) =>
                a.order - b.order
        );

        return finalCols;
    };

    const loadTemplate =
        async (
            reportId: number
        ) => {
            try {
                setTemplateLoading(
                    true
                );

                setSelectedTemplateId(
                    reportId
                );

                const res =
                    await SettingsService.getReportEditData(
                        {
                            reportId,
                            typeId: 1,
                        }
                    );

                const templateCols =
                    res.data.data
                        .columns || [];

                const reportInfo =
                    res.data.data
                        .reportInfo;

                setColumns(cols =>
                    applyTemplateToColumns(
                        cols,
                        templateCols
                    )
                );

                const autoGroups =
                    templateCols
                        .filter(
                            (c: any) =>
                                c.groupBy >
                                0 &&
                                c.enabled
                        )
                        .sort(
                            (
                                a: any,
                                b: any
                            ) =>
                                a.groupBy -
                                b.groupBy
                        )
                        .map(
                            (c: any) =>
                                c.key
                        );

                setGrouping(
                    autoGroups
                );

                setPendingGrouping(
                    autoGroups
                );

                setExpandedKeys(
                    []
                );

                if (
                    reportInfo?.Report_Name
                ) {
                    setReportName(
                        reportInfo.Report_Name
                    );
                }
            } catch (err) {
                console.error(
                    err
                );

                toast.error(
                    "Failed to load template ❌"
                );
            } finally {
                setTemplateLoading(
                    false
                );
            }
        };

    const handleQuickSave =
        async () => {
            try {
                if (
                    !reportName.trim()
                ) {
                    toast.error(
                        "Enter Report Name"
                    );
                    return;
                }

                const userData =
                    JSON.parse(
                        localStorage.getItem(
                            "user"
                        ) || "{}"
                    );

                const createdBy =
                    userData?.id ||
                    0;

                const payload =
                    columns.map(
                        c => ({
                            key: c.key,
                            label:
                                c.label,
                            enabled:
                                c.enabled,
                            order:
                                c.order,
                            groupBy:
                                grouping.includes(
                                    c.key
                                )
                                    ? grouping.indexOf(
                                        c.key
                                    ) + 1
                                    : 0,
                        })
                    );

                if (
                    selectedTemplateId
                ) {
                    await SettingsService.updateReport(
                        {
                            reportId:
                                selectedTemplateId,
                            typeId: 1,
                            reportName:
                                reportName.trim(),
                            columns:
                                payload,
                        }
                    );

                    toast.success(
                        "Template Updated Successfully ✅"
                    );
                } else {
                    await SettingsService.saveReportSettings(
                        {
                            reportName,
                            parentReport:
                                parentReportName,
                            abstractSP:
                                REPORT_SP,
                            expandedSP:
                                "REPORT_SP",
                            abstractColumns:
                                payload,
                            expandedColumns:
                                payload,
                            createdBy,
                        }
                    );

                    toast.success(
                        "Template Saved Successfully ✅"
                    );
                }

                setSaveDialogOpen(
                    false
                );

                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } catch (err) {
                console.error(
                    err
                );

                toast.error(
                    "Save Failed ❌"
                );
            }
        };

    /* ================= RESET ================= */

    const handleResetSettings =
        () => {
            const todayDate = dayjs().format("YYYY-MM-DD");
            setSelectedTemplateId(null);
            setReportName("");
            setGrouping([]);
            setPendingGrouping([]);
            setExpandedKeys([]);
            setSortConfig({ key: null, order: "asc", });
            setFilters({
                Date: {
                    from: todayDate,
                    to: todayDate,
                },
                columnFilters: {},
            });
            setStockFilter("hasValues");
            setFromDate(todayDate);
            setToDate(todayDate);
            setColumns(cols =>
                cols.map(c => ({
                    ...c,
                    enabled:
                        DEFAULT_KEYS.includes(c.key),
                    groupBy: 0,
                }))
            );
            setSettingsAnchor(null);
            setFilterAnchor(null);
            setPage(1);
        };

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
                onReportChange={(template: any) => {
                    if (!template) {
                        handleResetSettings();
                        return;
                    }
                    setSelectedTemplateId(
                        template.Report_Id
                    );
                    setReportName(
                        template.Report_Name
                    );
                    loadTemplate(
                        template.Report_Id
                    );
                }}
                onQuickSave={(parentName: string) => {
                    setParentReportName(parentName);
                    if (
                        !selectedTemplateId
                    ) {
                        setReportName("");
                    }
                    setSaveDialogOpen(true);
                }}
                settingsSlot={
                    <Box
                        display="flex"
                        gap={1}
                    >
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
                                onClick={e =>
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
                onToggle={() => setDrawerOpen(p => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={setFromDate}
                onToDateChange={setToDate}
                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}
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
                <Box
                    sx={{
                        overflow:
                            "auto",
                        mt: 1,
                    }}
                >
                    {/* TOGGLE */}

                    <Box
                        display="flex"
                        justifyContent="center"
                        mb={1}
                    >
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={viewMode}
                            onChange={(_, val) =>
                                val && setViewMode(
                                    val
                                )
                            }
                            sx={{
                                height: 30,
                                backgroundColor:
                                    "#f5f5f5",
                                borderRadius: 1,
                                p: 0.25,

                                "& .MuiToggleButton-root":
                                {
                                    fontSize: "0.7rem",
                                    px: 2,
                                    py: 0,
                                    border: "none",
                                    color: "#444",
                                    textTransform: "uppercase",
                                },
                                "& .Mui-selected":
                                {
                                    backgroundColor: "#1E3A8A !important",
                                    color: "#fff !important",
                                    fontWeight: 700,
                                },
                            }}
                        >
                            <ToggleButton value="Debtors">
                                Debtors
                            </ToggleButton>

                            <ToggleButton value="Creditors">
                                Creditors
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    {loading && (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                mt: 4,
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    )}

                    {templateLoading && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(255,255,255,0.5)",
                                zIndex: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CircularProgress
                                size={40}
                            />
                        </Box>
                    )}
                    {!loading && (
                        <TableContainer
                            component={Paper}
                            sx={{
                                maxHeight: "calc(100vh - 150px)",
                                "& th, & td":
                                {
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
                                    }}
                                >
                                    <TableRow>
                                        <TableCell
                                            sx={{ color: "#fff", }}
                                        >
                                            S.No
                                        </TableCell>

                                        {enabledColumns.map(c => (
                                            <React.Fragment
                                                key={c.key}
                                            >
                                                <TableCell
                                                    sx={{
                                                        color: "#fff",
                                                        cursor:
                                                            !c.isNumeric
                                                                ? "pointer"
                                                                : "default",
                                                    }}
                                                    onClick={e =>
                                                        !c.isNumeric &&
                                                        handleHeaderClick(
                                                            e,
                                                            c.key
                                                        )
                                                    }
                                                >
                                                    <Box
                                                        display="flex"
                                                        alignItems="center"
                                                        justifyContent="space-between"
                                                    >
                                                        {c.label}

                                                        <IconButton
                                                            size="small"
                                                            sx={{
                                                                color:
                                                                    "#fff",
                                                                p: 0,
                                                            }}
                                                            onClick={e =>
                                                                handleSortClick(
                                                                    e,
                                                                    c.key
                                                                )
                                                            }
                                                        >
                                                            {sortConfig.key ===
                                                                c.key ? (
                                                                sortConfig.order ===
                                                                    "asc" ? (
                                                                    <ArrowDropDownIcon fontSize="small" />
                                                                ) : (
                                                                    <ArrowDropUpIcon fontSize="small" />
                                                                )
                                                            ) : (
                                                                <ArrowDropDownIcon
                                                                    fontSize="small"
                                                                    sx={{
                                                                        opacity:
                                                                            0.3,
                                                                    }}
                                                                />
                                                            )}
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>

                                                {c.key ===
                                                    "Retailer_Name" && (
                                                        <TableCell
                                                            sx={{
                                                                color:
                                                                    "#fff",
                                                            }}
                                                        >
                                                            Outstanding
                                                        </TableCell>
                                                    )}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>

                                    <TableRow
                                        sx={{
                                            background: "#f3f4f6",
                                        }}
                                    >
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                            }}
                                        >
                                            Total
                                        </TableCell>

                                        {enabledColumns.map(c => (
                                            <React.Fragment
                                                key={c.key}
                                            >
                                                <TableCell align={c.isNumeric ? "right" : "left"}>
                                                    {c.isNumeric
                                                        ? CURRENCY_KEYS.includes(
                                                            c.key
                                                        )
                                                            ? formatINR(
                                                                getTotal(
                                                                    c.key
                                                                )
                                                            )
                                                            : getTotal(
                                                                c.key
                                                            )
                                                        : ""}
                                                </TableCell>

                                                {/* Empty cell for Outstanding icons column */}
                                                {c.key ===
                                                    "Retailer_Name" && (
                                                        <TableCell />
                                                    )}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {finalRows.map(
                                        (
                                            row, index
                                        ) => {
                                            if (
                                                row.__group
                                            ) {
                                                const expanded =
                                                    expandedKeys.includes(
                                                        row.__key
                                                    );

                                                return (
                                                    <TableRow
                                                        key={
                                                            row.__key
                                                        }
                                                        sx={{
                                                            background: "#E2E8F0",
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() =>
                                                                    setExpandedKeys(
                                                                        p =>
                                                                            p.includes(row.__key)
                                                                                ? p.filter(
                                                                                    x =>
                                                                                        x !==
                                                                                        row.__key
                                                                                )
                                                                                : [
                                                                                    ...p, row.__key,
                                                                                ]
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
                                                            const currentGroup =
                                                                grouping[row.__level];

                                                            const isCurrentGroup =
                                                                c.key === currentGroup;

                                                            const total =
                                                                c.isNumeric
                                                                    ? row.__rows.reduce(
                                                                        (
                                                                            s: number,
                                                                            r: any
                                                                        ) =>
                                                                            s +
                                                                            Number(
                                                                                r[
                                                                                c.key
                                                                                ] || 0
                                                                            ),
                                                                        0
                                                                    )
                                                                    : 0;

                                                            return (
                                                                <React.Fragment
                                                                    key={c.key}
                                                                >
                                                                    <TableCell
                                                                        align={c.isNumeric ? "right" : "left"}
                                                                        sx={{
                                                                            fontWeight:
                                                                                isCurrentGroup
                                                                                    ? 700
                                                                                    : 400,
                                                                        }}
                                                                    >
                                                                        {/* Group label */}
                                                                        {isCurrentGroup
                                                                            ? row.__value
                                                                            : c.isNumeric
                                                                                ? formatINR(
                                                                                    total
                                                                                )
                                                                                : ""}
                                                                    </TableCell>

                                                                    {/* Keep Outstanding column alignment */}
                                                                    {c.key ===
                                                                        "Retailer_Name" && (
                                                                            <TableCell />
                                                                        )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </TableRow>
                                                );
                                            }

                                            return (
                                                <TableRow
                                                    key={
                                                        index
                                                    }
                                                >
                                                    <TableCell>
                                                        {(page -
                                                            1) *
                                                            rowsPerPage +
                                                            index +
                                                            1}
                                                    </TableCell>

                                                    {enabledColumns.map(c => (
                                                        <React.Fragment
                                                            key={c.key}
                                                        >
                                                            <TableCell
                                                                align={c.isNumeric ? "right" : "left"}
                                                                sx={{
                                                                    color:
                                                                        c.key === "Bal_Amount"
                                                                            ? String(row.OB_Amount || "").toUpperCase().includes("DR")
                                                                                ? "red"
                                                                                : String(row.OB_Amount || "").toUpperCase().includes("CR")
                                                                                    ? "green"
                                                                                    : "inherit"
                                                                            : "inherit",
                                                                    fontWeight:
                                                                        c.key === "Bal_Amount" &&
                                                                            (String(row.OB_Amount || "").toUpperCase().includes("DR") ||
                                                                                String(row.OB_Amount || "").toUpperCase().includes("CR"))
                                                                            ? 600
                                                                            : "inherit",
                                                                }}
                                                            >
                                                                {c.key === "Bal_Amount"
                                                                    ? `${row[c.key]}${String(row.OB_Amount || "").toUpperCase().includes("DR")
                                                                        ? " DR"
                                                                        : String(row.OB_Amount || "").toUpperCase().includes("CR")
                                                                            ? " CR"
                                                                            : ""
                                                                    }`
                                                                    : row[c.key]}
                                                            </TableCell>

                                                            {/* Add icons after Retailer Name */}
                                                            {c.key ===
                                                                "Retailer_Name" && (
                                                                    <TableCell>
                                                                        <Box
                                                                            display="flex"
                                                                            gap={1}
                                                                        >
                                                                            {/* Party Transaction */}
                                                                            <Tooltip title="Party Transaction">
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() =>
                                                                                        window.open(
                                                                                            `/transaction-details/${row.Acc_Id}?partyName=${encodeURIComponent(
                                                                                                row.Retailer_Name
                                                                                            )}`,
                                                                                            "_blank"
                                                                                        )
                                                                                    }
                                                                                    sx={{
                                                                                        background:
                                                                                            "#EFF6FF",
                                                                                        borderRadius:
                                                                                            1,
                                                                                    }}
                                                                                >
                                                                                    <ReceiptLongIcon
                                                                                        fontSize="small"
                                                                                    />
                                                                                </IconButton>
                                                                            </Tooltip>

                                                                            {/* Pending Outstanding */}
                                                                            <Tooltip title="Pending Balance">
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() =>
                                                                                        window.open(
                                                                                            `/pending-outstanding/${row.Acc_Id}?partyName=${encodeURIComponent(
                                                                                                row.Retailer_Name
                                                                                            )}`,
                                                                                            "_blank"
                                                                                        )}
                                                                                    sx={{
                                                                                        background:
                                                                                            "#F0FDF4",
                                                                                        borderRadius:
                                                                                            1,
                                                                                    }}
                                                                                >
                                                                                    <AccountBalanceWalletIcon
                                                                                        fontSize="small"
                                                                                    />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        </Box>
                                                                    </TableCell>
                                                                )}
                                                        </React.Fragment>
                                                    ))}
                                                </TableRow>
                                            );
                                        }
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    <CommonPagination
                        totalRows={paginatedSourceRows.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </Box>
            </AppLayout >
            {/* ================= HEADER FILTER MENU ================= */}

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

            {/* ================= COLUMN SETTINGS ================= */}

            <Menu
                anchorEl={
                    settingsAnchor
                }
                open={Boolean(
                    settingsAnchor
                )}
                onClose={() =>
                    setSettingsAnchor(
                        null
                    )
                }
            >
                <Box
                    p={2}
                    minWidth={300}
                >
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        mb={1}
                    >
                        <Typography fontWeight={600}>
                            Column Settings
                        </Typography>

                        <Button
                            size="small"
                            color="info"
                            onClick={
                                handleResetSettings
                            }
                        >
                            Reset
                        </Button>
                    </Box>

                    <DndContext
                        sensors={
                            sensors
                        }
                        collisionDetection={
                            closestCenter
                        }
                        onDragEnd={
                            handleDragEnd
                        }
                    >
                        <Typography
                            fontSize="0.75rem"
                            fontWeight={600}
                        >
                            Enabled Columns
                        </Typography>

                        <SortableContext
                            items={sortedColumns
                                .filter(
                                    c =>
                                        c.enabled
                                )
                                .map(
                                    c =>
                                        c.key
                                )}
                            strategy={
                                verticalListSortingStrategy
                            }
                        >
                            {sortedColumns
                                .filter(
                                    c =>
                                        c.enabled
                                )
                                .map(c => (
                                    <SortableColumnRow
                                        key={
                                            c.key
                                        }
                                        column={
                                            c
                                        }
                                        onToggle={key =>
                                            setColumns(
                                                cols =>
                                                    cols.map(
                                                        x =>
                                                            x.key ===
                                                                key
                                                                ? {
                                                                    ...x,
                                                                    enabled: false,
                                                                }
                                                                : x
                                                    )
                                            )
                                        }
                                    />
                                ))}
                        </SortableContext>

                        <Typography
                            fontSize="0.75rem"
                            fontWeight={600}
                            mt={2}
                        >
                            Disabled Columns
                        </Typography>

                        <SortableContext
                            items={sortedColumns
                                .filter(
                                    c =>
                                        !c.enabled
                                )
                                .map(
                                    c =>
                                        c.key
                                )}
                            strategy={
                                verticalListSortingStrategy
                            }
                        >
                            {sortedColumns
                                .filter(
                                    c =>
                                        !c.enabled
                                )
                                .map(c => (
                                    <SortableColumnRow
                                        key={
                                            c.key
                                        }
                                        column={
                                            c
                                        }
                                        onToggle={key =>
                                            setColumns(
                                                cols =>
                                                    cols.map(
                                                        x =>
                                                            x.key ===
                                                                key
                                                                ? {
                                                                    ...x,
                                                                    enabled: true,
                                                                }
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

            {/* ================= GROUP DIALOG ================= */}

            <Dialog
                open={
                    groupDialogOpen
                }
                onClose={() =>
                    setGroupDialogOpen(
                        false
                    )
                }
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    Group By Columns
                </DialogTitle>

                <DialogContent>
                    {[0, 1, 2].map(
                        level => (
                            <TextField
                                key={
                                    level
                                }
                                select
                                fullWidth
                                margin="dense"
                                label={`Level ${level + 1
                                    }`}
                                value={
                                    pendingGrouping[
                                    level
                                    ] ||
                                    ""
                                }
                                onChange={e => {
                                    const copy =
                                        [
                                            ...pendingGrouping,
                                        ];

                                    copy[
                                        level
                                    ] =
                                        e.target
                                            .value;

                                    setPendingGrouping(
                                        copy
                                    );
                                }}
                            >
                                <MenuItem value="">
                                    No Grouping
                                </MenuItem>

                                {enabledColumns.map(
                                    col => (
                                        <MenuItem
                                            key={
                                                col.key
                                            }
                                            value={
                                                col.key
                                            }
                                            disabled={pendingGrouping.includes(
                                                col.key
                                            )}
                                        >
                                            {
                                                col.label
                                            }
                                        </MenuItem>
                                    )
                                )}
                            </TextField>
                        )
                    )}
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() =>
                            setGroupDialogOpen(
                                false
                            )
                        }
                    >
                        Close
                    </Button>

                    <Button
                        variant="contained"
                        onClick={() => {
                            setGrouping(
                                pendingGrouping
                            );

                            setColumns(prev =>
                                prev.map(col => ({
                                    ...col,
                                    enabled:
                                        pendingGrouping.includes(
                                            col.key
                                        )
                                            ? true
                                            : col.enabled,
                                }))
                            );

                            setGroupDialogOpen(
                                false
                            );
                        }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================= SAVE TEMPLATE ================= */}

            <Dialog
                open={
                    saveDialogOpen
                }
                onClose={() =>
                    setSaveDialogOpen(
                        false
                    )
                }
            >
                <DialogTitle>
                    {selectedTemplateId
                        ? "Edit Template"
                        : "Create Template"}
                </DialogTitle>

                <DialogContent>
                    <TextField
                        fullWidth
                        size="small"
                        label="Report Name"
                        value={
                            reportName
                        }
                        onChange={e =>
                            setReportName(
                                e.target
                                    .value
                            )
                        }
                    />
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() =>
                            setSaveDialogOpen(
                                false
                            )
                        }
                    >
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        onClick={
                            handleQuickSave
                        }
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );

};

export default OutstandingReport;