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
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";

import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

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
import ReportFilterDrawer, { DropdownOption } from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import { SettingsService } from "../../services/reportSettings.services";
import {
    AccountingOutstandingItem,
    AccountingOutstandingService,
} from "../../services/accountingOutstanding.service";

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
];

const CURRENCY_KEYS = [
    "Debit_Amt",
    "Credit_Amt",
    "Bal_Amount",
    "Dr_Amount",
    "Cr_Amount",
];

const DEFAULT_KEYS = [
    "Retailer_Name",
    "OB_Amount",
    "Debit_Amt",
    "Credit_Amt",
    "Bal_Amount",
];

const REPORT_SP = "Reporting_Account_Transactions_ALL_VW";
const PARENT_REPORT_NAME = "Accounting Outstanding Report";

/* ================= HELPERS ================= */

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(value || 0);

const buildColumnsFromApi = (rows: any[]): ColumnConfig[] => {
    if (!rows.length) return [];

    const keysInRow = Object.keys(rows[0]);

    // Ensure DEFAULT_KEYS appear first in specified order if present
    const orderedKeys = [
        ...DEFAULT_KEYS.filter(k => keysInRow.includes(k)),
        ...keysInRow.filter(k => !DEFAULT_KEYS.includes(k)),
    ];

    return orderedKeys.map((key, index) => ({
        key,
        label:
            key === "Retailer_Name" || key === "Account_name"
                ? "Account Name"
                : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
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
    ];

    const sorted = [...values];

    if (numericColumns.includes(key)) {
        sorted.sort((a, b) => {
            const numA = Number(String(a).replace(/[^\d.-]/g, "")) || 0;
            const numB = Number(String(b).replace(/[^\d.-]/g, "")) || 0;
            return order === "asc" ? numA - numB : numB - numA;
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

const AccountingOutstandingReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    const [rows, setRows] = useState<AccountingOutstandingItem[]>([]);
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const [drawerOpen, setDrawerOpen] = useState(false);

    // Applied Filters
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [selectedGroupId, setSelectedGroupId] = useState<string | number>(0);

    // In-Drawer Temporary States (applied on "Apply Filters")
    const [tempFromDate, setTempFromDate] = useState(today);
    const [tempToDate, setTempToDate] = useState(today);
    const [tempGroupId, setTempGroupId] = useState<string | number>(0);

    // Accounting Groups Dropdown (first 21 rows)
    const [groupOptions, setGroupOptions] = useState<DropdownOption[]>([]);

    const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);

    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [grouping, setGrouping] = useState<string[]>([]);
    const [pendingGrouping, setPendingGrouping] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [, setTemplateLoading] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState("");
    const [parentReportName, setParentReportName] = useState(PARENT_REPORT_NAME);

    const [stockFilter, setStockFilter] = useState<"hasValues" | "zero" | "all">("hasValues");

    const [filters, setFilters] = useState<FiltersMap>({
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
        key: "Retailer_Name",
        order: "asc",
    });

    /* ================= LOAD ACCOUNTING GROUPS ================= */

    useEffect(() => {
        const fetchAccountingGroups = async () => {
            try {
                const res = await AccountingOutstandingService.getAccountingGroups();
                const allGroups = res.data?.data || [];
                const first21 = allGroups.slice(0, 21);
                const opts: DropdownOption[] = first21.map(g => ({
                    label: g.Group_Name,
                    value: g.Group_Id,
                }));
                setGroupOptions(opts);
            } catch (err) {
                console.error("Failed to load accounting groups:", err);
                toast.error("Failed to load accounting groups");
            }
        };

        fetchAccountingGroups();
    }, []);

    /* ================= LOAD REPORT DATA ================= */

    const loadReport = async () => {
        try {
            setLoading(true);

            const res = await AccountingOutstandingService.getAccountingOutstanding({
                Fromdate: filters.Date.from,
                Todate: filters.Date.to,
                Group_Id: selectedGroupId,
            });

            const rawList = res.data?.data || [];

            // Normalize fields: Retailer_Name falls back to Account_name,
            // and keep Debit_Amt / Credit_Amt from the API
            const normalized = rawList.map(item => ({
                ...item,
                Retailer_Name: item.Retailer_Name || item.Account_name || "",
                Group_Name: item.Group_Name || "General",
                Debit_Amt: Number(item.Debit_Amt ?? 0),
                Credit_Amt: Number(item.Credit_Amt ?? 0),
            }));

            // Sort initially by Account Name (A-Z)
            normalized.sort((a, b) =>
                String(a.Retailer_Name || a.Account_name || "").localeCompare(
                    String(b.Retailer_Name || b.Account_name || ""),
                    undefined,
                    { sensitivity: "base", numeric: true }
                )
            );

            setRows(normalized);
            setColumns(prev => {
                if (prev.length > 0) return prev;
                return buildColumnsFromApi(normalized);
            });
        } catch (err) {
            console.error(err);
            toast.error("Failed to load accounting outstanding report");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReport();
    }, [filters.Date.from, filters.Date.to, selectedGroupId]);

    /* ================= DRAWER HANDLERS ================= */

    const handleToggleDrawer = () => {
        setDrawerOpen(prev => {
            if (!prev) {
                setTempFromDate(fromDate);
                setTempToDate(toDate);
                setTempGroupId(selectedGroupId);
            }
            return !prev;
        });
    };

    const handleCloseDrawer = () => {
        setTempFromDate(fromDate);
        setTempToDate(toDate);
        setTempGroupId(selectedGroupId);
        setDrawerOpen(false);
    };

    const handleApplyFilters = () => {
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        setSelectedGroupId(tempGroupId !== undefined && tempGroupId !== "" ? tempGroupId : 0);
        setFilters(prev => ({
            ...prev,
            Date: {
                from: tempFromDate,
                to: tempToDate,
            },
        }));
        setPage(1);
        setDrawerOpen(false);
    };

    /* ================= NUMERICAL FILTER ================= */

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
    } = useNumericalFilter(rows, ["Debit_Amt", "Credit_Amt", "Bal_Amount"]);

    /* ================= HEADER FILTER ================= */

    const filteredRows = useMemo(() => {
        let list = numFilteredAndSortedRows.filter((row: any) => {
            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (values === undefined) continue;

                const rowValue = String(row[key] ?? "").trim().toLowerCase();
                const match = values.some(
                    v => String(v).trim().toLowerCase() === rowValue
                );

                if (!match) return false;
            }
            return true;
        });

        const getOBAmount = (value: any) => {
            if (!value) return 0;
            const num = String(value).replace(/[^\d.-]/g, "");
            return Number(num || 0);
        };

        if (stockFilter === "hasValues") {
            list = list.filter(r => {
                const ob = getOBAmount(r.OB_Amount);
                const debit = Number(r.Debit_Amt || 0);
                const credit = Number(r.Credit_Amt || 0);
                const bal = Number(r.Bal_Amount || 0);

                return ob !== 0 || debit !== 0 || credit !== 0 || bal !== 0;
            });
        }

        if (stockFilter === "zero") {
            list = list.filter(r => {
                const ob = getOBAmount(r.OB_Amount);
                const debit = Number(r.Debit_Amt || 0);
                const credit = Number(r.Credit_Amt || 0);
                const bal = Number(r.Bal_Amount || 0);

                return ob === 0 && debit === 0 && credit === 0 && bal === 0;
            });
        }

        return list;
    }, [numFilteredAndSortedRows, filters.columnFilters, stockFilter]);

    /* ================= SORT ================= */

    const sortedRows = useMemo(() => {
        const sortKey = sortConfig.key || "Retailer_Name";
        const sortOrder = sortConfig.order || "asc";

        return [...filteredRows].sort((a: any, b: any) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
            }

            return sortOrder === "asc"
                ? String(aVal ?? "").localeCompare(String(bVal ?? ""), undefined, { sensitivity: "base", numeric: true })
                : String(bVal ?? "").localeCompare(String(aVal ?? ""), undefined, { sensitivity: "base", numeric: true });
        });
    }, [filteredRows, sortConfig]);

    /* ================= GROUPING ================= */

    const buildGroupedData = React.useCallback(
        (data: any[], level: number, parentKey = ""): any[] => {
            const groupKey = grouping[level];
            if (!groupKey) return data;

            const map = new Map<string, any[]>();

            for (const row of data) {
                const value = String(row[groupKey] ?? "Others");
                if (!map.has(value)) {
                    map.set(value, []);
                }
                map.get(value)!.push(row);
            }

            return Array.from(map.entries()).map(([value, gRows]) => ({
                __group: true,
                __key: `${parentKey}${groupKey}:${value}`,
                __value: value,
                __level: level,
                __rows: gRows,
            }));
        },
        [grouping]
    );

    const groupedRows = useMemo(() => {
        if (!grouping.length) return sortedRows;
        return buildGroupedData(sortedRows, 0);
    }, [sortedRows, grouping, buildGroupedData]);

    const flattenRows = (items: any[]): any[] => {
        const result: any[] = [];

        const walk = (list: any[]) => {
            for (const row of list) {
                result.push(row);

                if (row.__group && expandedKeys.includes(row.__key)) {
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

        walk(items);
        return result;
    };

    const paginatedSourceRows = useMemo(() => {
        return grouping.length ? flattenRows(groupedRows) : sortedRows;
    }, [groupedRows, sortedRows, grouping, expandedKeys]);

    /* ================= PAGINATION ================= */

    const finalRows = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return paginatedSourceRows.slice(start, start + rowsPerPage);
    }, [paginatedSourceRows, page, rowsPerPage]);

    /* ================= COLUMN SETTINGS ================= */

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
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
                ...(!activeList[0]?.enabled ? enabled : disabled),
            ];
        });
    };

    const sortedColumns = useMemo(() => {
        return [...columns].sort((a, b) => {
            if (a.enabled !== b.enabled) {
                return a.enabled ? -1 : 1;
            }
            return a.order - b.order;
        });
    }, [columns]);

    const enabledColumns = sortedColumns.filter(c => c.enabled);

    /* ================= TOTAL ================= */

    const getTotal = (key: string) =>
        Number(
            filteredRows
                .reduce((sum, row: any) => sum + Number(row[key] || 0), 0)
                .toFixed(2)
        );

    /* ================= FILTER ================= */

    const handleHeaderClick = (
        e: React.MouseEvent<HTMLElement>,
        header: string
    ) => {
        setActiveHeader(header);
        setFilterAnchor(e.currentTarget);
    };

    const handleSortClick = (
        e: React.MouseEvent<HTMLElement>,
        key: string
    ) => {
        e.stopPropagation();

        setSortConfig(prev => ({
            key,
            order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
        }));
    };

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        let baseRows = rows;

        const getOBAmount = (value: any) => {
            if (!value) return 0;
            const num = String(value).replace(/[^\d.-]/g, "");
            return Number(num || 0);
        };

        if (stockFilter === "hasValues") {
            baseRows = baseRows.filter((r: any) => {
                const ob = getOBAmount(r.OB_Amount);
                const debit = Number(r.Debit_Amt || 0);
                const credit = Number(r.Credit_Amt || 0);
                const bal = Number(r.Bal_Amount || 0);
                return ob !== 0 || debit !== 0 || credit !== 0 || bal !== 0;
            });
        }

        if (stockFilter === "zero") {
            baseRows = baseRows.filter((r: any) => {
                const ob = getOBAmount(r.OB_Amount);
                const debit = Number(r.Debit_Amt || 0);
                const credit = Number(r.Credit_Amt || 0);
                const bal = Number(r.Bal_Amount || 0);
                return ob === 0 && debit === 0 && credit === 0 && bal === 0;
            });
        }

        const rowsWithoutCurrentHeader = baseRows.filter((row: any) => {
            for (const [column, values] of Object.entries(filters.columnFilters)) {
                if (column === activeHeader) continue;
                if (values === undefined) continue;

                const rowValue = String(row[column] ?? "").trim().toLowerCase();
                const match = values.some(
                    (v: string) => String(v).trim().toLowerCase() === rowValue
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
                        (v: any) => v !== null && v !== undefined && v !== ""
                    )
                    .map((v: any) => String(v).trim())
            )
        );

        return sortFilterValues(uniqueValues, activeHeader, sortConfig.order);
    }, [
        activeHeader,
        rows,
        filters.columnFilters,
        stockFilter,
        sortConfig.order,
    ]);

    /* ================= EXPORT ================= */

    const exportColumns = enabledColumns.map(c => ({
        key: c.key,
        label: c.label,
    }));

    const exportRows = sortedRows.map((row: any) => {
        const obj: any = {};
        exportColumns.forEach(col => {
            let val = row[col.key] ?? "";
            if (col.key === "Bal_Amount") {
                const suffix = String(row.OB_Amount || "").toUpperCase().includes("DR")
                    ? " DR"
                    : String(row.OB_Amount || "").toUpperCase().includes("CR")
                        ? " CR"
                        : "";
                val = `${val}${suffix}`;
            }
            obj[col.label] = val;
        });
        return obj;
    });

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Accounting Outstanding`);
        XLSX.writeFile(
            workbook,
            `Accounting_Outstanding_${dayjs().format("DDMMYYYY")}.xlsx`
        );
    };

    const handleExportPDF = () => {
        const doc = new jsPDF("l", "mm", "a4");
        doc.text(`Accounting Outstanding Report`, 14, 10);
        autoTable(doc, {
            startY: 15,
            head: [exportColumns.map(c => c.label)],
            body: exportRows.map(r => Object.values(r)),
            styles: {
                fontSize: 7,
            },
        });
        doc.save(`Accounting_Outstanding.pdf`);
    };

    /* ================= TEMPLATE ================= */

    const applyTemplateToColumns = (
        availableCols: ColumnConfig[],
        templateCols: any[]
    ): ColumnConfig[] => {
        const templateMap = new Map<string, any>(
            templateCols.map(tc => [tc.key, tc])
        );

        const mergedCols: ColumnConfig[] = availableCols.map(col => {
            const tCol = templateMap.get(col.key);
            if (tCol) {
                return {
                    ...col,
                    label: tCol.label ?? col.label,
                    enabled: tCol.enabled ?? false,
                    order: tCol.order ?? col.order,
                    groupBy: tCol.groupBy ?? 0,
                    isNumeric: tCol.isNumeric ?? col.isNumeric,
                };
            }
            return {
                ...col,
                enabled: false,
            };
        });

        const missingTemplateColumns = templateCols
            .filter(tc => !availableCols.some(ac => ac.key === tc.key))
            .map(tc => ({
                key: tc.key,
                label: tc.label,
                enabled: tc.enabled,
                order: tc.order,
                groupBy: tc.groupBy ?? 0,
                isNumeric: tc.isNumeric,
            }));

        return [...mergedCols, ...missingTemplateColumns].sort(
            (a, b) => a.order - b.order
        );
    };

    const loadTemplate = async (reportId: number) => {
        try {
            setTemplateLoading(true);
            setSelectedTemplateId(reportId);

            const res = await SettingsService.getReportEditData({
                reportId,
                typeId: 1,
            });

            const templateCols = res.data.data.columns || [];
            const reportInfo = res.data.data.reportInfo;

            setColumns(cols => applyTemplateToColumns(cols, templateCols));

            const autoGroups = templateCols
                .filter((c: any) => c.groupBy > 0 && c.enabled)
                .sort((a: any, b: any) => a.groupBy - b.groupBy)
                .map((c: any) => c.key);

            setGrouping(autoGroups);
            setPendingGrouping(autoGroups);
            setExpandedKeys([]);

            if (reportInfo?.Report_Name) {
                setReportName(reportInfo.Report_Name);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load template ❌");
        } finally {
            setTemplateLoading(false);
        }
    };

    const handleQuickSave = async () => {
        try {
            if (!reportName.trim()) {
                toast.error("Enter Report Name");
                return;
            }

            const userData = JSON.parse(localStorage.getItem("user") || "{}");
            const createdBy = userData.id || 1;

            const payload = columns.map(c => ({
                key: c.key,
                label: c.label,
                order: c.order,
                groupBy: grouping.includes(c.key) ? grouping.indexOf(c.key) + 1 : 0,
                enabled: c.enabled,
                isNumeric: c.isNumeric,
            }));

            if (selectedTemplateId) {
                await SettingsService.updateReport({
                    reportId: selectedTemplateId,
                    typeId: 1,
                    reportName: reportName.trim(),
                    columns: payload,
                });
                toast.success("Template Updated Successfully ✅");
            } else {
                await SettingsService.saveReportSettings({
                    reportName,
                    parentReport: parentReportName,
                    abstractSP: REPORT_SP,
                    expandedSP: REPORT_SP,
                    abstractColumns: payload,
                    expandedColumns: payload,
                    createdBy,
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

    /* ================= RESET ================= */

    const handleResetSettings = () => {
        const todayDate = dayjs().format("YYYY-MM-DD");
        setSelectedTemplateId(null);
        setReportName("");
        setGrouping([]);
        setPendingGrouping([]);
        setExpandedKeys([]);
        setSortConfig({ key: "Retailer_Name", order: "asc" });
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
        setSelectedGroupId(0);
        setTempFromDate(todayDate);
        setTempToDate(todayDate);
        setTempGroupId(0);
        setColumns(cols =>
            cols.map(c => ({
                ...c,
                enabled: DEFAULT_KEYS.includes(c.key),
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
                parentReportName={PARENT_REPORT_NAME}
                onReportChange={(template: any) => {
                    if (!template) {
                        handleResetSettings();
                        return;
                    }
                    setSelectedTemplateId(template.Report_Id);
                    setReportName(template.Report_Name);
                    loadTemplate(template.Report_Id);
                }}
                onQuickSave={(parentName: string) => {
                    setParentReportName(parentName || PARENT_REPORT_NAME);
                    if (!selectedTemplateId) {
                        setReportName("");
                    }
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
                        </Tooltip>
                    </Box>
                }
            />

            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={handleToggleDrawer}
                onClose={handleCloseDrawer}
                fromDate={tempFromDate}
                toDate={tempToDate}
                onFromDateChange={setTempFromDate}
                onToDateChange={setTempToDate}
                fromDateLabel="From Date"
                toDateLabel="To Date"
                dropdownLabel="Accounting Group"
                dropdownValue={tempGroupId}
                dropdownOptions={groupOptions}
                dropdownSearchable={true}
                onDropdownChange={(val) => setTempGroupId(val !== undefined && val !== "" ? val : 0)}
                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}
                onApply={handleApplyFilters}
            />

            <AppLayout fullWidth>
                <Box sx={{ overflow: "auto", mt: 1 }}>
                    {/* TABLE */}
                    <Paper elevation={2}>
                        <TableContainer sx={{
                            maxHeight: "calc(100vh - 105px)",
                            "& th, & td":
                            {
                                fontSize: "0.75rem",
                            },
                        }}>
                            <Table stickyHeader size="small">
                                <TableHead
                                    sx={{
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 10,
                                        background: "#1E3A8A",
                                    }}
                                >
                                    {/* HEADER ROW */}
                                    <TableRow sx={{ background: "#1E3A8A" }}>
                                        <TableCell
                                            sx={{
                                                color: "#fff",
                                                fontWeight: 500,
                                                background: "#1E3A8A",
                                                whiteSpace: "nowrap",
                                                borderBottom: "none",
                                            }}
                                        >
                                            S.No
                                        </TableCell>

                                        {enabledColumns.map(c => (
                                            <React.Fragment key={c.key}>
                                                <TableCell
                                                    align={c.isNumeric ? "right" : "left"}
                                                    sx={{
                                                        color: "#fff",
                                                        fontWeight: 500,
                                                        background: "#1E3A8A",
                                                        whiteSpace: "nowrap",
                                                        borderBottom: "none",
                                                        cursor: "pointer",
                                                    }}
                                                    onClick={e => {
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
                                                            onOpenFilter={e => openNumFilter(e, c.key)}
                                                        />
                                                    ) : (
                                                        <Box
                                                            display="flex"
                                                            alignItems="center"
                                                            justifyContent="space-between"
                                                        >
                                                            <span>{c.label}</span>

                                                            <IconButton
                                                                size="small"
                                                                sx={{
                                                                    color: "#fff",
                                                                    p: 0,
                                                                    ml: 0.5,
                                                                }}
                                                                onClick={e => {
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

                                                {/* Outstanding Action Column after Retailer Name */}
                                                {c.key === "Retailer_Name" && (
                                                    <TableCell
                                                        sx={{
                                                            color: "#fff",
                                                            fontWeight: 500,
                                                            background: "#1E3A8A",
                                                            whiteSpace: "nowrap",
                                                            borderBottom: "none",
                                                        }}
                                                    >
                                                        Outstanding
                                                    </TableCell>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>

                                    {/* TOTAL ROW */}
                                    <TableRow sx={{ background: "#f3f4f6" }}>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Total
                                        </TableCell>

                                        {enabledColumns.map(c => (
                                            <React.Fragment key={c.key}>
                                                <TableCell align={c.isNumeric ? "right" : "left"}>
                                                    {c.isNumeric
                                                        ? CURRENCY_KEYS.includes(c.key)
                                                            ? formatINR(getTotal(c.key))
                                                            : getTotal(c.key)
                                                        : ""}
                                                </TableCell>

                                                {c.key === "Retailer_Name" && (
                                                    <TableCell />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={enabledColumns.length + 2}
                                                align="center"
                                            >
                                                <CircularProgress />
                                            </TableCell>
                                        </TableRow>
                                    ) : finalRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={enabledColumns.length + 2}
                                                align="center"
                                            >
                                                No Data Found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        finalRows.map((row: any, index: number) => {
                                            if (row.__group) {
                                                const expanded = expandedKeys.includes(row.__key);

                                                return (
                                                    <TableRow
                                                        key={row.__key}
                                                        sx={{ background: "#E2E8F0" }}
                                                    >
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
                                                            const currentGroup = grouping[row.__level];
                                                            const isCurrentGroup = c.key === currentGroup;
                                                            const total = c.isNumeric
                                                                ? row.__rows.reduce(
                                                                    (s: number, r: any) =>
                                                                        s + Number(r[c.key] || 0),
                                                                    0
                                                                )
                                                                : 0;

                                                            return (
                                                                <React.Fragment key={c.key}>
                                                                    <TableCell
                                                                        align={c.isNumeric ? "right" : "left"}
                                                                        sx={{
                                                                            fontWeight: isCurrentGroup ? 700 : 400,
                                                                        }}
                                                                    >
                                                                        {isCurrentGroup
                                                                            ? row.__value
                                                                            : c.isNumeric
                                                                                ? formatINR(total)
                                                                                : ""}
                                                                    </TableCell>

                                                                    {c.key === "Retailer_Name" && (
                                                                        <TableCell />
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </TableRow>
                                                );
                                            }

                                            return (
                                                <TableRow key={index} hover>
                                                    <TableCell>
                                                        {(page - 1) * rowsPerPage + index + 1}
                                                    </TableCell>

                                                    {enabledColumns.map(c => (
                                                        <React.Fragment key={c.key}>
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

                                                            {/* Add Outstanding Action icons after Retailer Name */}
                                                            {c.key === "Retailer_Name" && (
                                                                <TableCell>
                                                                    <Box display="flex" gap={1}>
                                                                        {/* Party Transaction */}
                                                                        <Tooltip title="Party Transaction">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() =>
                                                                                    window.open(
                                                                                        `/transaction-details/${row.Acc_Id}?partyName=${encodeURIComponent(
                                                                                            row.Retailer_Name || row.Account_name || ""
                                                                                        )}`,
                                                                                        "_blank"
                                                                                    )
                                                                                }
                                                                                sx={{
                                                                                    background: "#EFF6FF",
                                                                                    borderRadius: 1,
                                                                                }}
                                                                            >
                                                                                <ReceiptLongIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>

                                                                        {/* Pending Outstanding */}
                                                                        <Tooltip title="Pending Balance">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() =>
                                                                                    window.open(
                                                                                        `/pending-outstanding/${row.Acc_Id}?partyName=${encodeURIComponent(
                                                                                            row.Retailer_Name || row.Account_name || ""
                                                                                        )}`,
                                                                                        "_blank"
                                                                                    )
                                                                                }
                                                                                sx={{
                                                                                    background: "#F0FDF4",
                                                                                    borderRadius: 1,
                                                                                }}
                                                                            >
                                                                                <AccountBalanceWalletIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Box>
                                                                </TableCell>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* PAGINATION */}
                    <Box mt={2}>
                        <CommonPagination
                            totalRows={filteredRows.length}
                            page={page}
                            rowsPerPage={rowsPerPage}
                            onPageChange={setPage}
                            onRowsPerPageChange={val => {
                                setRowsPerPage(val);
                                setPage(1);
                            }}
                        />
                    </Box>
                </Box>
            </AppLayout>

            {/* HEADER FILTER MENU */}
            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
                columnLabel={activeHeader || undefined}
                options={filterOptions}
                selectedValues={
                    activeHeader
                        ? filters.columnFilters[activeHeader]
                        : undefined
                }
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

            {/* COLUMN SETTINGS MENU */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
            >
                <Box p={2} minWidth={300}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography fontWeight={600}>Column Settings</Typography>
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
                        <Typography fontSize="0.75rem" fontWeight={600}>
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

                        <Typography fontSize="0.75rem" fontWeight={600} mt={2}>
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

            {/* GROUP BY DIALOG */}
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
                            <MenuItem value="">No Grouping</MenuItem>
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
                    <Button onClick={() => setGroupDialogOpen(false)}>
                        Close
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            setGrouping(pendingGrouping);
                            setColumns(prev =>
                                prev.map(col => ({
                                    ...col,
                                    enabled: pendingGrouping.includes(col.key)
                                        ? true
                                        : col.enabled,
                                }))
                            );
                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            {/* SAVE TEMPLATE DIALOG */}
            <Dialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
            >
                <DialogTitle>
                    {selectedTemplateId ? "Edit Template" : "Create Template"}
                </DialogTitle>

                <DialogContent>
                    <TextField
                        fullWidth
                        size="small"
                        label="Report Name"
                        value={reportName}
                        onChange={e => setReportName(e.target.value)}
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

            {/* NUMERICAL FILTER MENU */}
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

export default AccountingOutstandingReport;
