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
    RadioGroup,
    FormControlLabel,
    Radio,
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
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
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
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
import { RateMasterAdminService } from "../../services/rateMasterAdmin.service";

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

/* ================= SORTABLE ROW ================= */

const SortableColumnRow = ({ column, onToggle, hasActiveFilter }: SortableColumnRowProps) => {
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
            <Box
                {...listeners}
                {...attributes}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    cursor: "grab",
                    color: "text.secondary",
                    p: 0.5
                }}
            >
                <DragIndicatorIcon fontSize="small" />
            </Box>

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

/* ================= CONSTANTS ================= */

const NUMERIC_KEYS = ["Rate", "Min_Rate", "Max_Rate", "COGS", "GP_Percentage_COGS"];

const DEFAULT_KEYS = [
    "Product_Name",
    "Rate",
    "Min_Rate",
    "Max_Rate",
    "COGS",
    "GP_Percentage_COGS"
];

const ALL_COLUMNS_METADATA: Omit<ColumnConfig, "order" | "enabled">[] = [
    { key: "Product_Name", label: "Product Name", isNumeric: false },
    { key: "Rate", label: "List Rate", isNumeric: true },
    { key: "Min_Rate", label: "Min Rate", isNumeric: true },
    { key: "Max_Rate", label: "Max Rate", isNumeric: true },
    { key: "COGS", label: "COGS", isNumeric: true },
    { key: "GP_Percentage_COGS", label: "COGS %", isNumeric: true },
    { key: "Product_Id", label: "Product Id", isNumeric: false },
    { key: "Brand", label: "Brand", isNumeric: false },
    { key: "Group_ST", label: "Group ST", isNumeric: false },
    { key: "Grade_Item_Group", label: "Grade Item Group", isNumeric: false },
    { key: "POS_Group", label: "POS Group", isNumeric: false },
    { key: "Item_Name_Modified", label: "Item Name Modified", isNumeric: false },
    { key: "POS_Item_Name", label: "POS Item Name", isNumeric: false }
];

const CURRENCY_KEYS = ["Rate", "Min_Rate", "Max_Rate", "COGS"];

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(value);

/* ================= COMPONENT ================= */

const RateMasterAdminReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");
    const parentReportName = "RATE MASTER ADMIN";

    const [rawData1, setRawData1] = useState<any[]>([]);
    const [rawData2, setRawData2] = useState<any[]>([]);
    const [columns, setColumns] = useState<ColumnConfig[]>(() => {
        return ALL_COLUMNS_METADATA.map((c, index) => ({
            ...c,
            enabled: DEFAULT_KEYS.includes(c.key),
            order: index
        }));
    });

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [toDate, setToDate] = useState(today);
    const [tempToDate, setTempToDate] = useState(today);

    const [zeroFilter, setZeroFilter] = useState<"updated" | "all" | "all_zero" | "any_zero" | "all_zero_data1" | "any_zero_data1">("updated");
    const [tempZeroFilter, setTempZeroFilter] = useState<"updated" | "all" | "all_zero" | "any_zero" | "all_zero_data1" | "any_zero_data1">("updated");

    const [loading, setLoading] = useState(false);
    const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
    const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] = useState<string | null>(null);

    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [, setIsEditTemplate] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState("");

    const [columnFilters, setColumnFilters] = useState<Record<string, string[] | undefined>>({});

    const [grouping, setGrouping] = useState<string[]>([]);
    const [pendingGrouping, setPendingGrouping] = useState<string[]>([]);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

    const serialRef = React.useRef(0);

    /* ================= DND SENSORS ================= */
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    /* ================= LOAD DATA ================= */
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const res = await RateMasterAdminService.getReport({ Todate: toDate });

                if (res.data.success) {
                    const data1 = res.data.data.Data1 || [];
                    const data2 = res.data.data.Data2 || [];

                    setRawData1(data1);
                    setRawData2(data2);
                } else {
                    setRawData1([]);
                    setRawData2([]);
                }
            } catch (err) {
                console.error("Failed to load rate master report", err);
                toast.error("Failed to load Rate Master report");
                setRawData1([]);
                setRawData2([]);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [toDate]);

    /* ================= TEMPLATE LOGIC ================= */
    const handleLoadTemplate = async (templateId: number) => {
        try {
            setLoading(true);
            const res = await SettingsService.getReportEditData({
                reportId: templateId,
                typeId: 1
            });

            if (res.data.success && res.data.data) {
                const settings = res.data.data;
                const templateCols = settings.columns || [];

                if (templateCols.length > 0) {
                    const loadedCols = columns.map(col => {
                        const tc = templateCols.find((x: any) => x.key === col.key);
                        return {
                            ...col,
                            enabled: tc ? Boolean(tc.enabled) : false,
                            order: tc?.order !== undefined ? Number(tc.order) : col.order,
                            groupBy: tc?.groupBy !== undefined ? Number(tc.groupBy) : 0,
                        };
                    });

                    loadedCols.sort((a, b) => a.order - b.order);
                    setColumns(loadedCols);

                    const groupCols = loadedCols
                        .filter(c => c.groupBy && c.groupBy > 0)
                        .sort((a, b) => (a.groupBy || 0) - (b.groupBy || 0))
                        .map(c => c.key);

                    setGrouping(groupCols);
                }

                setSelectedTemplateId(templateId);
                if (settings.Report_Name) {
                    setReportName(settings.Report_Name);
                } else if (settings.reportInfo?.Report_Name) {
                    setReportName(settings.reportInfo.Report_Name);
                }
                setIsEditTemplate(true);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load template ❌");
        } finally {
            setLoading(false);
        }
    };

    const handleClearTemplate = () => {
        setSelectedTemplateId(null);
        setReportName("");
        setIsEditTemplate(false);
        setColumns(ALL_COLUMNS_METADATA.map((c, index) => ({
            ...c,
            enabled: DEFAULT_KEYS.includes(c.key),
            order: index
        })));
        setGrouping([]);
    };

    const handleQuickSave = async () => {
        try {
            const createdBy = Number(localStorage.getItem("userId") || 1);
            const abstractPayload = columns.map((col) => ({
                key: col.key,
                label: col.label,
                enabled: col.enabled ? 1 : 0,
                order: col.order,
                groupBy: grouping.includes(col.key) ? grouping.indexOf(col.key) + 1 : 0,
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
                    columns: abstractPayload
                });

                toast.success("Template Updated Successfully ✅");
            } else {
                await SettingsService.saveReportSettings({
                    reportName: reportName.trim(),
                    parentReport: parentReportName,
                    abstractSP: "Reporting_Online_Rate_Master_List_Admin",
                    expandedSP: "Reporting_Online_Rate_Master_List_Admin",
                    abstractColumns: abstractPayload,
                    expandedColumns: abstractPayload,
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

    /* ================= FILTERS & COLUMNS ================= */

    const enabledColumns = useMemo(() => {
        return columns.filter(c => c.enabled).sort((a, b) => a.order - b.order);
    }, [columns]);

    const mappedProductIds = useMemo(() => {
        return new Set(rawData2.map(d2 => String(d2.Product_Id)));
    }, [rawData2]);

    const matchesZeroFilter = (row: any, type: typeof zeroFilter, mappedIds: Set<string>) => {
        if (type === "all") return true;

        const isMapped = mappedIds.has(String(row.Product_Id));

        if (type === "updated") {
            return isMapped;
        }

        const rate = Number(row.Rate || 0);
        const minRate = Number(row.Min_Rate || 0);
        const maxRate = Number(row.Max_Rate || 0);
        const cogs = Number(row.COGS || 0);

        if (type === "all_zero") {
            return isMapped && rate === 0 && minRate === 0 && maxRate === 0 && cogs === 0;
        }
        if (type === "any_zero") {
            return isMapped && (rate === 0 || minRate === 0 || maxRate === 0 || cogs === 0);
        }
        if (type === "all_zero_data1") {
            return rate === 0 && minRate === 0 && maxRate === 0 && cogs === 0;
        }
        if (type === "any_zero_data1") {
            return rate === 0 || minRate === 0 || maxRate === 0 || cogs === 0;
        }
        return true;
    };

    const radioFilteredRows = useMemo(() => {
        return rawData1.filter(row => matchesZeroFilter(row, zeroFilter, mappedProductIds));
    }, [rawData1, zeroFilter, mappedProductIds]);

    const processedRows = useMemo(() => {
        return radioFilteredRows.filter(row => {
            // Text Header filters
            for (const [key, filterVals] of Object.entries(columnFilters)) {
                if (filterVals !== undefined) {
                    const val = String(row[key] ?? "");
                    if (!filterVals.includes(val)) {
                        return false;
                    }
                }
            }
            return true;
        });
    }, [radioFilteredRows, columnFilters]);

    /* ================= NUMERICAL FILTER HOOK ================= */
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
    } = useNumericalFilter(processedRows, NUMERIC_KEYS);

    const [sortConfig, setSortConfig] = useState<{
        key: string | null;
        direction: "asc" | "desc";
    }>({
        key: null,
        direction: "asc",
    });

    const sortedRows = useMemo(() => {
        // If sorting numeric column, use the numerical filter hook result
        if (numSortConfig) {
            return numFilteredAndSortedRows;
        }

        // Otherwise handle string sort
        if (!sortConfig.key) return numFilteredAndSortedRows;

        const { key, direction } = sortConfig;

        return [...numFilteredAndSortedRows].sort((a, b) => {
            const valA = String(a[key] ?? "");
            const valB = String(b[key] ?? "");

            return direction === "asc"
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        });
    }, [numFilteredAndSortedRows, sortConfig, numSortConfig]);

    /* ================= GROUPING ================= */

    const buildGroupedData = React.useCallback(
        (data: any[], level: number, parentKey = ""): any[] => {
            const groupKey = grouping[level];
            if (!groupKey) return data;

            const map = new Map<string, any[]>();

            for (const row of data) {
                const val = String(row[groupKey] ?? "Others");
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

            // Sort groups when sort column is selected
            const sortKey = sortConfig.key || numSortConfig?.key;
            const sortOrder = sortConfig.key ? sortConfig.direction : numSortConfig?.direction;

            if (sortKey) {
                groups.sort((a, b) => {
                    const getValue = (group: any) => {
                        const col = columns.find(c => c.key === sortKey);
                        if (col?.isNumeric) {
                            return group.__rows.reduce(
                                (sum: number, r: any) => sum + Number(r[sortKey] || 0),
                                0
                            );
                        }
                        return String(group.__rows[0]?.[sortKey] ?? "");
                    };

                    const aVal = getValue(a);
                    const bVal = getValue(b);

                    if (typeof aVal === "number" && typeof bVal === "number") {
                        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
                    }

                    return sortOrder === "asc"
                        ? String(aVal).localeCompare(String(bVal))
                        : String(bVal).localeCompare(String(aVal));
                });
            }

            return groups;
        },
        [grouping, sortConfig, numSortConfig, columns]
    );

    const groupedRows = useMemo(() => {
        if (!grouping.length) return sortedRows;
        return buildGroupedData(sortedRows, 0);
    }, [sortedRows, grouping, buildGroupedData]);

    const flattenRows = (list: any[]): any[] => {
        const result: any[] = [];
        const walk = (items: any[]) => {
            for (const r of items) {
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
        walk(list);
        return result;
    };

    const paginatedSourceRows = useMemo(() => {
        return grouping.length ? flattenRows(groupedRows) : sortedRows;
    }, [groupedRows, sortedRows, grouping, expandedKeys]);

    const finalRows = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return paginatedSourceRows.slice(start, end);
    }, [paginatedSourceRows, page, rowsPerPage]);

    const getTotal = (columnKey: string) => {
        if (sortedRows.length === 0) return 0;
        const sum = sortedRows.reduce(
            (s: number, r: any) => s + Number(r[columnKey] || 0),
            0
        );
        if (columnKey === "GP_Percentage_COGS") {
            return Number((sum / sortedRows.length).toFixed(2));
        }
        return Number(sum.toFixed(2));
    };

    /* ================= HANDLERS ================= */

    const handleHeaderClick = (e: React.MouseEvent<HTMLElement>, key: string) => {
        const col = columns.find(x => x.key === key);
        if (col?.isNumeric) return; // Handled by Numerical Filter Hook

        setActiveHeader(key);
        setFilterAnchor(e.currentTarget);
    };

    const handleSortClick = (e: React.MouseEvent, key: string) => {
        e.stopPropagation();
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
            }
            return { key, direction: "asc" };
        });
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const enabledCols = columns
            .filter(c => c.enabled)
            .sort((a, b) => a.order - b.order);
        const oldIndex = enabledCols.findIndex(c => c.key === active.id);
        const newIndex = enabledCols.findIndex(c => c.key === over.id);
        const reordered = arrayMove(enabledCols, oldIndex, newIndex);
        const newColumns = columns.map(col => {
            const found = reordered.findIndex(r => r.key === col.key);
            if (found !== -1) {
                return { ...col, order: found };
            }
            return col;
        });
        setColumns(newColumns);
    };

    const handleToggleColumn = (key: string) => {
        setColumns(prev => {
            const target = prev.find(c => c.key === key);
            if (!target) return prev;

            const isEnabling = !target.enabled;
            let updated = prev.map(c => (c.key === key ? { ...c, enabled: !c.enabled } : c));

            if (isEnabling) {
                const enabledCols = updated.filter(c => c.enabled && c.key !== key);
                const maxOrder = enabledCols.reduce((max, c) => Math.max(max, c.order), -1);
                updated = updated.map(c => (c.key === key ? { ...c, order: maxOrder + 1 } : c));
            }

            const enabledSorted = updated.filter(c => c.enabled).sort((a, b) => a.order - b.order);
            return updated.map(c => {
                if (c.enabled) {
                    return { ...c, order: enabledSorted.indexOf(c) };
                }
                return c;
            });
        });
    };

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];
        const vals = [...new Set(radioFilteredRows.map(x => String(x[activeHeader] ?? "")))].filter(Boolean);
        return vals.sort();
    }, [activeHeader, radioFilteredRows]);

    /* ================= DRAWER SUBMIT/RESET ================= */

    const handleApplyFilters = () => {
        setToDate(tempToDate);
        setZeroFilter(tempZeroFilter);
        setDrawerOpen(false);
    };



    /* ================= EXPORT LOGIC ================= */

    const handleExportExcel = () => {
        const exportData = paginatedSourceRows.map((row) => {
            if (row.__group) {
                const groupCol = grouping[row.__level];
                const colCfg = columns.find(c => c.key === groupCol);
                const colLabel = colCfg ? colCfg.label : groupCol;

                const item: any = {
                    "Product Name": `Group: ${colLabel} = ${row.__value}`
                };

                enabledColumns.forEach(c => {
                    if (c.key !== "Product_Name") {
                        if (c.isNumeric) {
                            const sum = row.__rows.reduce(
                                (s: number, r: any) => s + Number(r[c.key] || 0),
                                0
                            );
                            item[c.label] = c.key === "GP_Percentage_COGS"
                                ? (sum / row.__rows.length).toFixed(2) + "%"
                                : sum;
                        } else {
                            item[c.label] = "";
                        }
                    }
                });
                return item;
            } else {
                const item: any = {};
                enabledColumns.forEach(c => {
                    item[c.label] = row[c.key] ?? "";
                });
                return item;
            }
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rate Master Admin");
        XLSX.writeFile(workbook, `Rate_Master_Admin_${toDate}.xlsx`);
        toast.success("Excel Exported ✅");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF("l", "pt", "a4");

        const headers = ["S.No", ...enabledColumns.map(c => c.label)];
        let serial = 1;

        const body = paginatedSourceRows.map((row) => {
            if (row.__group) {
                const groupCol = grouping[row.__level];
                const colCfg = columns.find(c => c.key === groupCol);
                const colLabel = colCfg ? colCfg.label : groupCol;

                return [
                    "",
                    `Group: ${colLabel} = ${row.__value}`,
                    ...enabledColumns.slice(1).map(c => {
                        if (c.isNumeric) {
                            const sum = row.__rows.reduce(
                                (s: number, r: any) => s + Number(r[c.key] || 0),
                                0
                            );
                            return c.key === "GP_Percentage_COGS"
                                ? (sum / row.__rows.length).toFixed(2) + "%"
                                : String(sum);
                        }
                        return "";
                    })
                ];
            } else {
                return [
                    String(serial++),
                    ...enabledColumns.map(c => String(row[c.key] ?? ""))
                ];
            }
        });

        autoTable(doc, {
            head: [headers],
            body: body,
            theme: "striped",
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 58, 138] }
        });

        doc.save(`Rate_Master_Admin_${toDate}.pdf`);
        toast.success("PDF Exported ✅");
    };

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                parentReportName={parentReportName}
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onReportChange={(template) => {
                    if (!template || !template.Report_Id) {
                        handleClearTemplate();
                    } else {
                        setSelectedTemplateId(template.Report_Id);
                        setReportName(template.Report_Name || "");
                        handleLoadTemplate(template.Report_Id);
                    }
                }}
                onQuickSave={() => {
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
                                onClick={(e) => setSettingsAnchor(e.currentTarget)}
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

            <AppLayout fullWidth>
                <Box px={2} pb={1} pt={1}>
                    {loading && (
                        <Box display="flex" justifyContent="flex-end" mb={1}>
                            <CircularProgress size={20} color="primary" />
                        </Box>
                    )}

                    <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, border: "1px solid #cbd5e1", overflow: "auto", maxHeight: "calc(100vh - 110px)" }}>
                        <Table size="small" stickyHeader>
                            <TableHead
                                sx={{
                                    background: "#1E3A8A",
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 3
                                }}
                            >
                                <TableRow>
                                    <TableCell sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700, bgcolor: "#1E3A8A", borderRight: "1px solid #2448b2" }}>
                                        S.No
                                    </TableCell>
                                    {enabledColumns.map((c) => (
                                        <TableCell
                                            key={c.key}
                                            align={c.isNumeric ? "right" : "left"}
                                            sx={{
                                                color: "#fff",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: "0.75rem",
                                                bgcolor: "#1E3A8A",
                                                borderRight: "1px solid #2448b2",
                                                whiteSpace: "nowrap"
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
                                                <Box display="flex" alignItems="center" justifyContent="space-between">
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
                                                            sortConfig.direction === "asc" ? (
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
                                        top: 36,
                                        zIndex: 2,
                                    }}
                                >
                                    <TableCell sx={{ fontWeight: 700, bgcolor: "#f3f4f6" }}>Total</TableCell>
                                    {enabledColumns.map((c) => (
                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"} sx={{ fontWeight: 700, bgcolor: "#f3f4f6" }}>
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
                                                <TableRow key={row.__key} sx={{ background: "#F1F5F9" }}>
                                                    <TableCell sx={{ borderRight: "1px solid #cbd5e1" }}>
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
                                                                <TableCell key={c.key} sx={{ fontWeight: 700, borderRight: "1px solid #cbd5e1" }}>
                                                                    {row.__value}
                                                                </TableCell>
                                                            );
                                                        }

                                                        if (c.isNumeric) {
                                                            const sum = row.__rows.reduce(
                                                                (s: number, r: any) => s + Number(r[c.key] || 0),
                                                                0
                                                            );

                                                            return (
                                                                <TableCell key={c.key} align="right" sx={{ borderRight: "1px solid #cbd5e1" }}>
                                                                    {c.key === "GP_Percentage_COGS"
                                                                        ? (sum / row.__rows.length).toFixed(2) + "%"
                                                                        : CURRENCY_KEYS.includes(c.key)
                                                                            ? formatINR(sum)
                                                                            : sum}
                                                                </TableCell>
                                                            );
                                                        }

                                                        return <TableCell key={c.key} sx={{ borderRight: "1px solid #cbd5e1" }} />;
                                                    })}
                                                </TableRow>
                                            );
                                        }

                                        return (
                                            <TableRow key={i} sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                                                <TableCell sx={{ borderRight: "1px solid #cbd5e1", fontSize: "0.7rem", py: 0.8 }}>
                                                    {++serialRef.current}
                                                </TableCell>

                                                {enabledColumns.map(c => {
                                                    const align = c.isNumeric ? "right" : "left";
                                                    return (
                                                        <TableCell key={c.key} align={align} sx={{ borderRight: "1px solid #cbd5e1", fontSize: "0.7rem", py: 0.8 }}>
                                                            {c.key === "GP_Percentage_COGS"
                                                                ? (Number(row[c.key]) || 0).toFixed(2) + "%"
                                                                : CURRENCY_KEYS.includes(c.key)
                                                                    ? formatINR(Number(row[c.key]) || 0)
                                                                    : row[c.key] ?? "-"}
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

            {/* ******* COLUMN SETTINGS MENU ******* */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
                PaperProps={{
                    sx: {
                        width: 320,
                        maxHeight: 480,
                        px: 2,
                        py: 1.5,
                        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)",
                        borderRadius: 2
                    }
                }}
            >

                <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
                    <Typography variant="caption" fontWeight="bold" color="textSecondary" display="block" mb={1}>
                        Enabled Columns
                    </Typography>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={columns.filter(c => c.enabled).sort((a, b) => a.order - b.order).map(c => c.key)} strategy={verticalListSortingStrategy}>
                            {columns
                                .filter(c => c.enabled)
                                .sort((a, b) => a.order - b.order)
                                .map(col => (
                                    <SortableColumnRow
                                        key={col.key}
                                        column={col}
                                        onToggle={handleToggleColumn}
                                        hasActiveFilter={columnFilters[col.key] !== undefined}
                                    />
                                ))}
                        </SortableContext>
                    </DndContext>

                    <Box mt={2}>
                        <Typography variant="caption" fontWeight="bold" color="textSecondary" display="block" mb={1}>
                            Disabled Columns
                        </Typography>

                        {columns
                            .filter(c => !c.enabled)
                            .map(col => (
                                <Box
                                    key={col.key}
                                    display="flex"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    py={0.5}
                                    pl={1}
                                >
                                    <Typography fontSize="0.75rem">{col.label}</Typography>

                                    <Switch
                                        size="medium"
                                        checked={col.enabled}
                                        onChange={() => handleToggleColumn(col.key)}
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
                    </Box>
                </Box>
            </Menu>

            {/* ******* STRING COLUMN HEADER FILTER MENU ******* */}
            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => {
                    setFilterAnchor(null);
                    setActiveHeader(null);
                }}
                columnLabel={columns.find((c) => c.key === activeHeader)?.label || activeHeader || undefined}
                options={filterOptions}
                selectedValues={activeHeader ? columnFilters[activeHeader] : undefined}
                onFilterChange={(selected: string[] | undefined) => {
                    if (activeHeader) {
                        setColumnFilters((prev) => {
                            const copy = { ...prev };
                            if (selected === undefined) {
                                delete copy[activeHeader];
                            } else {
                                copy[activeHeader] = selected;
                            }
                            return copy;
                        });
                    }
                }}
            />

            {/* ******* NUMERICAL RANGE FILTER MENU ******* */}
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

            {/* ******* GROUPING DIALOG ******* */}
            <Dialog
                open={groupDialogOpen}
                onClose={() => setGroupDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle sx={{ color: "#1E3A8A", fontWeight: "bold" }}>Group By Columns</DialogTitle>
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
                        sx={{ bgcolor: "#1E3A8A", "&:hover": { bgcolor: "#152a66" } }}
                        onClick={() => {
                            setGrouping(pendingGrouping.filter(Boolean));
                            setExpandedKeys([]);
                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply Grouping
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ******* TEMPLATE SAVE DIALOG ******* */}
            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
                <DialogTitle sx={{ color: "#1E3A8A", fontWeight: "bold" }}>
                    {selectedTemplateId ? "Update Template" : "Save as Template"}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Template Name"
                        fullWidth
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)} color="warning">
                        Cancel
                    </Button>
                    <Button onClick={handleQuickSave} variant="contained" sx={{ bgcolor: "#1E3A8A" }}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ******* FILTER DRAWER ******* */}
            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen(p => !p)}
                onClose={() => setDrawerOpen(false)}
                onApply={handleApplyFilters}
            >
                <Box display="flex" flexDirection="column" gap={3} p={1}>
                    <Box>
                        <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="#1E3A8A">
                            Date
                        </Typography>
                        <TextField
                            type="date"
                            fullWidth
                            size="small"
                            value={tempToDate}
                            onChange={(e) => setTempToDate(e.target.value)}
                        />
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="#1E3A8A">
                            Zero Value Filter
                        </Typography>
                        <RadioGroup
                            value={zeroFilter}
                            onChange={(e) => {
                                const val = e.target.value as any;
                                setZeroFilter(val);
                                setTempZeroFilter(val);
                            }}
                        >
                            <FormControlLabel value="updated" control={<Radio size="small" />} label="Today's Movement List" />
                            <FormControlLabel value="all_zero" control={<Radio size="small" />} label="All Movement List Columns are 0 " />
                            <FormControlLabel value="any_zero" control={<Radio size="small" />} label="Any Movement List Column is 0 " />
                            <FormControlLabel value="all_zero_data1" control={<Radio size="small" />} label="All Columns are 0 " />
                            <FormControlLabel value="any_zero_data1" control={<Radio size="small" />} label="Any of the Column is 0 " />
                            <FormControlLabel value="all" control={<Radio size="small" />} label="All" />
                        </RadioGroup>
                    </Box>
                </Box>
            </ReportFilterDrawer>


        </>
    );
};

export default RateMasterAdminReport;
