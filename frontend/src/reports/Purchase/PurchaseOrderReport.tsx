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
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import { SettingsService } from "../../services/reportSettings.services";
import { toast } from "react-toastify";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import { DndContext, closestCenter, } from "@dnd-kit/core";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    SortableContext, useSortable,
    verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { PurchaseOrderReport, PurchaseOrderReportItem } from "../../services/purchaseOrderReport.service";

const ABSTRACT_DEFAULT_KEYS = [
    "invoice_no",
    "Ledger_Date",
    "Retailer_Name",
    "itemCount",
    "Total_Invoice_value",
];

const EXPANDED_DEFAULT_KEYS = [
    "invoice_no",
    "Ledger_Date",
    "Product_Name",
    "Bill_Qty",
    "Rate",
    "Amount",
    "Retailer_Name",
];

const NUMERIC_KEYS = [
    "Bill_Qty",
    "Rate",
    "Amount",
    "Total_Invoice_value",
];

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    isNumeric?: boolean;
    order: number;
};

type FiltersMap = {
    Date: { from: string; to: string };
    columnFilters: Record<string, string[] | undefined>;
};

/* ================= HELPERS ================= */

const buildAbstractData = (rows: any[]) => {
    const map: Record<string, any> = {};

    rows.forEach((row) => {
        if (!map[row.invoice_no]) {
            map[row.invoice_no] = {
                ...row,
                itemCount: 0,
            };
        }

        map[row.invoice_no].itemCount += 1;
    });

    return Object.values(map);
};

const buildColumnsFromApi = (
    rows: any[],
    mode: "Abstract" | "Expanded"
): ColumnConfig[] => {
    if (!rows.length) return [];

    const defaults =
        mode === "Abstract"
            ? ABSTRACT_DEFAULT_KEYS
            : EXPANDED_DEFAULT_KEYS;

    // ✅ Normalize keys
    const normalizeKey = (key: string) => {
        if (key === "Item_Count") return "itemCount";
        if (key.includes("Reatailer")) return key.replace(/Reatailer/g, "Retailer");
        return key;
    };

    // ✅ Collect normalized keys
    const keySet = new Set<string>();

    rows.forEach(row => {
        Object.keys(row).forEach(k => {
            keySet.add(normalizeKey(k));
        });
    });

    // ✅ Ensure itemCount exists for Abstract
    if (mode === "Abstract") {
        keySet.add("itemCount");
    }

    const keys = Array.from(keySet);

    return keys.map((key, index) => ({
        key,
        label:
            key === "invoice_no" ? "Invoice No" :
                key === "Ledger_Date" ? "Ledger Date" :
                    key === "Retailer_Name" ? "Retailer Name" :
                        key === "Product_Name" ? "Product Name" :
                            key === "Bill_Qty" ? "Bill Qty" :
                                key === "Total_Invoice_value" ? "Total Invoice Value" :
                                    key.replace(/_/g, " ")
                                        .replace(/\b\w/g, c => c.toUpperCase()),

        enabled: defaults.includes(key) || key === "invoice_no",
        isNumeric: NUMERIC_KEYS.includes(key),
        order: index,
    }));
};

const normalizeRow = (row: any) => {
    const newRow: any = {};

    Object.keys(row).forEach(key => {
        let newKey = key;

        if (key === "Item_Count") newKey = "itemCount";
        if (key.includes("Reatailer")) {
            newKey = key.replace(/Reatailer/g, "Retailer");
        }

        newRow[newKey] = row[key];
    });

    return newRow;
};

/* ================= COMPONENT ================= */

const PurchaseOrder: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const currentMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");
    const { toggleMode, setToggleMode } = useToggleMode();

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
        Date: { from: currentMonthStart, to: today },
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
    const [rangeFilter] = useState<Record<string, [number, number]>>({});

    const [templateConfig, setTemplateConfig] = useState<{
        abstract: ColumnConfig[];
        expanded: ColumnConfig[];
    } | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [isEditTemplate, setIsEditTemplate] = useState(false);

    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState("");
    const [parentReportName, setParentReportName] = useState("");

    const [spConfig, setSpConfig] = useState({
        abstractSP: "",
        expandedSP: ""
    });

    const SP_MAP = {
        Abstract: "Reporting_Online_Purchase_Order_VW",
        Expanded: "Reporting_Online_Purchase_Order_Item_VW"
    };

    const [tempDateFilter, setTempDateFilter] = useState({
        from: today,
        to: today,
    });


    const HEADER_HEIGHT = 36;

    /* ================= LOAD DATA ================= */

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const service =
            toggleMode === "Expanded"
                ? PurchaseOrderReportItem.getPurchaseOrderItem
                : PurchaseOrderReport.getPurchaseOrder;

        service({
            Fromdate: filters.Date.from,
            Todate: filters.Date.to,
        })
            .then((res) => {
                if (!mounted) return;

                const apiRowsRaw =
                    res.data?.data?.data ||
                    res.data?.data ||
                    [];

                const apiRows = apiRowsRaw.map(normalizeRow);

                const freshColumns = buildColumnsFromApi(apiRows, toggleMode);

                const applyTemplateColumns = (
                    incomingCols: ColumnConfig[],
                    templateCols?: ColumnConfig[]
                ) => {
                    if (!templateCols?.length) return incomingCols;

                    return incomingCols.map((col) => {
                        const matched = templateCols.find(
                            (t) => t.key === col.key
                        );

                        return matched
                            ? {
                                ...col,
                                enabled: matched.enabled,
                                order: matched.order,
                            }
                            : col;
                    });
                };

                if (toggleMode === "Expanded") {
                    setExpandedRows(apiRows);

                    setExpandedColumns((prev) => {
                        // already modified by user → keep it
                        if (prev.length > 0) return prev;

                        return applyTemplateColumns(
                            freshColumns,
                            templateConfig?.expanded
                        );
                    });
                }
                else {
                    const abstractData = buildAbstractData(apiRows);

                    setAbstractRows(abstractData);

                    setAbstractColumns((prev) => {
                        // already modified by user → keep it
                        if (prev.length > 0) return prev;

                        return applyTemplateColumns(
                            freshColumns,
                            templateConfig?.abstract
                        );
                    });
                }

                setSpConfig({
                    abstractSP: SP_MAP.Abstract,
                    expandedSP: SP_MAP.Expanded
                });

                setPage(1);
            })
            .catch((err) => {
                console.error("Purchase Order Report API Error:", err);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [
        toggleMode,
        filters.Date.from,
        filters.Date.to,
        templateConfig
    ]);

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

    /* ================= FILTERING ================= */

    const filteredRows = useMemo(() => {
        return rawRows.filter(row => {

            // ✅ COLUMN FILTERS (SKIP DATE COLUMN)
            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (key === "Ledger_Date") continue; // 🚨 IMPORTANT

                if (values === undefined) continue;
                const rowValue = String(row[key] ?? "");
                if (!values.includes(rowValue)) return false;
            }


            // ✅ NUMBER RANGE
            for (const [key, range] of Object.entries(rangeFilter)) {
                const val = Number(row[key]);
                if (!isNaN(val)) {
                    if (val < range[0] || val > range[1]) return false;
                }
            }

            return true;
        });
    }, [rawRows, filters, rangeFilter]);

    /* ================= TOTALS ================= */

    const getTotal = (key: string) => {
        const values = filteredRows
            .map(row => Number(row[key]))
            .filter(v => !isNaN(v));

        const total = values.reduce((sum, v) => sum + v, 0);

        return total.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    /* ================= PAGINATION ================= */

    const buildGroupedData = React.useCallback(
        (data: any[], level: number, parentKey = ""): any[] => {
            const groupKey = appliedGroupBy[level];
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
        [appliedGroupBy]
    );

    // 2️⃣ GROUP WHOLE DATA
    const groupedRows = useMemo(() => {
        if (!appliedGroupBy.length) return filteredRows;
        return buildGroupedData(filteredRows, 0);
    }, [filteredRows, appliedGroupBy, buildGroupedData]);

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

    const totalRowsForPagination = useMemo(() => {
        return appliedGroupBy.length
            ? flattenRows(groupedRows).length
            : filteredRows.length;
    }, [groupedRows, filteredRows, appliedGroupBy, expandedKeys]);

    const finalRows = useMemo(() => {
        const rows = appliedGroupBy.length
            ? flattenRows(groupedRows)
            : filteredRows;

        return rows.slice(
            (page - 1) * rowsPerPage,
            page * rowsPerPage
        );

    }, [groupedRows, filteredRows, page, rowsPerPage, appliedGroupBy, expandedKeys]);

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
            : filteredRows;
    }, [groupedRows, filteredRows, appliedGroupBy, expandedKeys]);

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
                    obj[c.label] = row[c.key] ?? "";
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
            `Purchase Order Report_${toggleMode}_${dayjs().format("DDMMYYYY")}.xlsx`
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

                return row[c.key] ?? "";
            })
        );

        doc.text(`Purchase Order Report (${toggleMode})`, 14, 10);

        autoTable(doc, {
            startY: 15,
            head: [enabledColumns.map(c => c.label)],
            body: rows,
            styles: { fontSize: 7 },
        });

        doc.save(
            `Purchase Order Report_${toggleMode}_${dayjs().format("DDMMYYYY")}.pdf`
        );
    };

    /* ================= TEMPLATE ================= */

    const applyTemplateToColumns = (
        liveColumns: ColumnConfig[],
        templateColumns: any[]
    ): ColumnConfig[] => {

        const mapped = templateColumns.map((t: any, index: number) => {
            const existing = liveColumns.find(c => c.key === t.key);

            return {
                key: t.key,
                label: t.label || existing?.label || t.key,
                enabled: t.enabled,
                isNumeric: existing?.isNumeric || false,
                order: t.order ?? index,
            };
        });

        const missing = liveColumns
            .filter(col => !mapped.some((m: any) => m.key === col.key))
            .map((col, idx) => ({
                ...col,
                enabled: false,
                order: mapped.length + idx
            }));

        return [...mapped, ...missing];
    };


    const loadTemplate = async (reportId: number) => {
        try {
            setLoading(true);

            // ✅ keep selected template state
            setSelectedTemplateId(reportId);
            setIsEditTemplate(true);

            const absRes = await SettingsService.getReportEditData({
                reportId,
                typeId: 1
            });

            const expRes = await SettingsService.getReportEditData({
                reportId,
                typeId: 2
            });

            const abstractCols = absRes.data?.data?.columns || [];
            const expandedCols = expRes.data?.data?.columns || [];

            /* ✅ set report name */
            if (absRes.data?.data?.reportInfo?.Report_Name) {
                setReportName(
                    absRes.data.data.reportInfo.Report_Name
                );
            }

            if (absRes.data?.data?.reportInfo?.Parent_Report) {
                setParentReportName(
                    absRes.data.data.reportInfo.Parent_Report
                );
            }

            /* ✅ RESTORE GROUPING ORDER */
            const abstractGrouping = [...abstractCols]
                .filter((x: any) => Number(x.groupBy) > 0)
                .sort((a: any, b: any) => Number(a.groupBy) - Number(b.groupBy))
                .map((x: any) => x.key);

            const expandedGrouping = [...expandedCols]
                .filter((x: any) => Number(x.groupBy) > 0)
                .sort((a: any, b: any) => Number(a.groupBy) - Number(b.groupBy))
                .map((x: any) => x.key);

            setTemplateConfig({
                abstract: abstractCols,
                expanded: expandedCols
            });

            setAbstractColumns(prev =>
                applyTemplateToColumns(prev.length ? prev : [], abstractCols)
            );

            setExpandedColumns(prev =>
                applyTemplateToColumns(prev.length ? prev : [], expandedCols)
            );

            /* ✅ APPLY GROUPING */
            setAbstractGrouping(abstractGrouping);
            setExpandedGrouping(expandedGrouping);

            setAbstractPendingGrouping(abstractGrouping);
            setExpandedPendingGrouping(expandedGrouping);

            /* collapse expanded rows */
            setAbstractExpandedKeys([]);
            setExpandedExpandedKeys([]);

            toast.success("Template Loaded");

        } catch (error) {
            toast.error("Failed to Load Template");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSave = async () => {
        try {
            if (!reportName.trim()) {
                toast.error("Enter Report Name");
                return;
            }

            /* =========================================
           GET LOGIN USER ID
        ========================================= */
            const userData = JSON.parse(localStorage.getItem("user") || "{}");
            const createdBy = userData?.id || 0;


            const abstractPayload = abstractColumns.map(col => ({
                key: col.key,
                label: col.label,
                enabled: col.enabled,
                order: col.order,
                groupBy: abstractGrouping.includes(col.key)
                    ? abstractGrouping.indexOf(col.key) + 1
                    : 0,
                dataType: "nvarchar"
            }));

            const expandedPayload = expandedColumns.map(col => ({
                key: col.key,
                label: col.label,
                enabled: col.enabled,
                order: col.order,
                groupBy: expandedGrouping.includes(col.key)
                    ? expandedGrouping.indexOf(col.key) + 1
                    : 0,
                dataType: "nvarchar"
            }));

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

                toast.success("Template Updated Successfully");
            } else {
                await SettingsService.saveReportSettings({
                    reportName,
                    parentReport: parentReportName,
                    abstractSP: spConfig.abstractSP,
                    expandedSP: spConfig.expandedSP,
                    abstractColumns: abstractPayload,
                    expandedColumns: expandedPayload,
                    createdBy
                });

                toast.success("Template Saved Successfully");
            }

            setSaveDialogOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 500);

        } catch (err: any) {
            toast.error("Save Failed");
        }
    };

    /* ================= FILTER MENU ================= */

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        // 🚨 Apply ALL filters EXCEPT current column
        const rowsForOptions = rawRows.filter(row => {
            for (const [key, values] of Object.entries(filters.columnFilters)) {
                if (key === activeHeader) continue;
                if (values === undefined) continue;

                const rowValue = String(row[key] ?? "");
                if (!values.includes(rowValue)) return false;
            }

            // ✅ Apply range filters also except current
            for (const [key, range] of Object.entries(rangeFilter)) {
                if (key === activeHeader) continue;

                const val = Number(row[key]);
                if (!isNaN(val)) {
                    if (val < range[0] || val > range[1]) return false;
                }
            }

            return true;
        });

        return Array.from(
            new Set(
                rowsForOptions
                    .map(r => r[activeHeader])
                    .filter(v => v !== null && v !== undefined && v !== "")
                    .map(v => String(v))
            )
        );
    }, [activeHeader, rawRows, filters, rangeFilter]);

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

        return total.toLocaleString("en-IN", {
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
                                const currentGroupKey = appliedGroupBy[row.__level];

                                // ✅ Show value ONLY for current level column
                                if (c.key === currentGroupKey) {
                                    return (
                                        <TableCell key={c.key} sx={{ fontWeight: 700 }}>
                                            {row.__value}
                                        </TableCell>
                                    );
                                }

                                // ✅ Show totals for numeric columns
                                if (c.isNumeric) {
                                    return (
                                        <TableCell key={c.key} sx={{ fontWeight: 600 }}>
                                            {getGroupTotal(row.__rows, c.key)}
                                        </TableCell>
                                    );
                                }

                                // ✅ ALL OTHER COLUMNS EMPTY (important)
                                return <TableCell key={c.key} />;
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
                        if (c.key === "Ledger_Date") {
                            return (
                                <TableCell key={c.key}>
                                    {dayjs(row[c.key]).format("DD/MM/YYYY")}
                                </TableCell>
                            );
                        }

                        return (
                            <TableCell key={c.key}>
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

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                toggleMode={toggleMode}
                onToggleChange={setToggleMode}
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onReportChange={(template) => {
                    if (!template) {
                        const todayDate = dayjs().format("YYYY-MM-DD");

                        setIsEditTemplate(false);
                        setSelectedTemplateId(null);
                        setReportName("");
                        setParentReportName("");
                        setTemplateConfig(null);

                        setToggleMode("Abstract");

                        setFilters({
                            Date: { from: currentMonthStart, to: todayDate },
                            columnFilters: {},
                        });

                        setAbstractGrouping([]);
                        setExpandedGrouping([]);
                        setAbstractPendingGrouping([]);
                        setExpandedPendingGrouping([]);
                        setAbstractExpandedKeys([]);
                        setExpandedExpandedKeys([]);

                        setAbstractColumns([]);
                        setExpandedColumns([]);
                        setPage(1);

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
                        {/* GROUP BY ICON */}
                        <Tooltip title="Group By">
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
                        </Tooltip>

                        {/* COLUMN SETTINGS */}
                        <Tooltip title="Column Settings">
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
                onToggle={() => setDrawerOpen(p => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={filters.Date.from}
                toDate={filters.Date.to}
                onFromDateChange={v =>
                    setFilters(p => ({ ...p, Date: { ...p.Date, from: v } }))
                }
                onToDateChange={v =>
                    setFilters(p => ({ ...p, Date: { ...p.Date, to: v } }))
                }
                onApply={() => setDrawerOpen(false)}
            />

            <AppLayout fullWidth>
                <Box sx={{ overflow: "auto", mt: 1, px: { xs: 1.5, md: 2 } }}>
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
                                    <TableCell
                                        sx={{
                                            color: "#fff",
                                            fontWeight: 500,
                                            width: 70,
                                        }}
                                    >
                                        S.No
                                    </TableCell>

                                    {enabledColumns.map(c => (
                                        <TableCell
                                            key={c.key}
                                            sx={{
                                                color: "#fff",
                                                cursor: "pointer",
                                                backgroundColor: appliedGroupBy.includes(c.key)
                                                    ? "#1E40AF"
                                                    : "inherit",
                                                fontWeight: appliedGroupBy.includes(c.key) ? 700 : 500,
                                            }}
                                            onClick={e => {
                                                setActiveHeader(c.key);
                                                setFilterAnchor(e.currentTarget);
                                            }}
                                        >
                                            {c.label}
                                        </TableCell>
                                    ))}
                                </TableRow>

                                {/* ===== TOTAL ROW ===== */}
                                <TableRow sx={{ background: "#f3f4f6" }}>
                                    <TableCell>Total</TableCell>
                                    {enabledColumns.map(c => (
                                        <TableCell key={c.key}>
                                            {c.isNumeric ? getTotal(c.key) : ""}
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
                                        serialRef.current = appliedGroupBy.length
                                            ? 0
                                            : (page - 1) * rowsPerPage;
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
                dateFrom={tempDateFilter.from}
                dateTo={tempDateFilter.to}
                onDateChange={(dates) => setTempDateFilter(dates)}
                onApplyDate={() => {
                    setFilters((prev) => ({
                        ...prev,
                        Date: {
                            from: tempDateFilter.from,
                            to: tempDateFilter.to,
                        },
                    }));
                    setFilterAnchor(null);
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
                                    column={col}
                                    showFilter={filters.columnFilters[col.key] !== undefined}
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
                                    setColumns(prev => {
                                        const maxOrder = prev.length ? Math.max(...prev.map(c => c.order)) : 0;

                                        return prev.map(c =>
                                            c.key === col.key
                                                ? { ...c, enabled: true, order: maxOrder + 1 }
                                                : c
                                        );
                                    })
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

            {/* ************************** SAVE TEMPLATE ************************* */}
            <Dialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
            >
                <DialogTitle>
                    {isEditTemplate ? "Edit Template" : "Create Template"}
                </DialogTitle>

                <DialogContent sx={{ minWidth: 350 }}>
                    <TextField
                        fullWidth
                        autoFocus
                        label="Report Name"
                        size="small"
                        margin="dense"
                        value={reportName}
                        onChange={(e) =>
                            setReportName(e.target.value)
                        }
                    />
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() => setSaveDialogOpen(false)}
                    >
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
        </>
    );
};

export default PurchaseOrder;