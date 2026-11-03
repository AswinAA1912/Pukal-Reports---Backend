import React, { useEffect, useMemo, useState } from "react";
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";
import { SortableHeaderLabel } from "../../Components/SortableHeaderLabel";
import { useSearchParams } from "react-router-dom";
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
    Switch,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Autocomplete,
    CircularProgress
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import {
    DndContext,
    closestCenter
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "react-toastify";
import { SettingsService } from "../../services/reportSettings.services";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import PageHeader from "../../Layout/PageHeader";
import AppLayout from "../../Layout/appLayout";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import { ledgerwiseItemService, retailers, RetailersList } from "../../services/SalesReport.service";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

const NUMERIC_KEYS = [
    "Total_Qty",
    "M1_Avg_Qty",
    "M2_AVG_Qty",
    "M3_AVG_Qty",
    "M6_AVG_Qty",
    "M9_AVG_Qty",
    "One_Year_AVG_Qty"
];

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    isNumeric?: boolean;
    order: number;
};

const DEFAULT_COLUMNS = [
    "One_Year_AVG_Qty",
    "M6_AVG_Qty",
    "M2_AVG_Qty",
    "M1_Avg_Qty",
    "Item_Name",
    "Total_Qty"
];

const LedgerItemWiseDetails: React.FC = () => {
    const [searchParams] = useSearchParams();
    const Ledger_Id = Number(searchParams.get("ledgerId"));
    const Ledger_Name = searchParams.get("ledgerName");
    const Fromdate = searchParams.get("from");
    const Todate = searchParams.get("to");
    const [rows, setRows] = useState<any[]>([]);
    const [columns, setColumns] = useState<ColumnConfig[]>(() => {
        const saved = sessionStorage.getItem("ledgerColumns");
        return saved ? JSON.parse(saved) : [];
    });
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const today = dayjs().format("YYYY-MM-DD");
    const [filters, setFilters] = useState(() => {
        const saved = sessionStorage.getItem("ledgerFilters");
        if (saved) {
            const parsed = JSON.parse(saved);

            return {
                Date: {
                    from: parsed.Date?.from || Fromdate || today,
                    to: parsed.Date?.to || Todate || today
                },
                columnFilters: parsed.columnFilters || {}
            };
        }

        return {
            Date: {
                from: Fromdate || today,
                to: Todate || today
            },
            columnFilters: {}
        };
    });
    const [settingsAnchor, setSettingsAnchor] =
        useState<null | HTMLElement>(null);
    const [filterAnchor, setFilterAnchor] =
        useState<null | HTMLElement>(null);
    const [activeHeader, setActiveHeader] =
        useState<string | null>(null);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupBy, setGroupBy] = useState<string[]>(() => {
        const saved = sessionStorage.getItem("ledgerGroupBy");
        return saved ? JSON.parse(saved) : [];
    });
    const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
        const saved = sessionStorage.getItem("ledgerExpanded");
        return saved ? JSON.parse(saved) : [];
    });
    const [retailerList, setRetailerList] = useState<RetailersList[]>([]);
    const [loading, setLoading] = useState(false);
    const [retailerLoading, setRetailerLoading] = useState(false);
    const [selectedLedger, setSelectedLedger] = useState<number | string>(
        Ledger_Id || ""
    );
    const [stockFilter, setStockFilter] = useState<"hasValues" | "zero" | "all">("hasValues");
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

    const SP_MAP = {
        Abstract: "Avg_Live_Sales_Report_4"
    };
    /* ================= LOAD RETAILER ================= */

    useEffect(() => {
        setRetailerLoading(true);
        retailers.getRetailers()
            .then(res => {
                setRetailerList(res.data.data || []);
            })
            .catch(err => console.error("Retailer dropdown error:", err))
            .finally(() => {
                setRetailerLoading(false);
            });

    }, []);

    /* ================= LOAD DATA ================= */

    useEffect(() => {
        if (!selectedLedger) return;

        setLoading(true);

        ledgerwiseItemService
            .getLedgerItemTransactions({
                Ledger_Id: Number(selectedLedger),
                Fromdate: filters.Date.from,
                Todate: filters.Date.to
            })
            .then(res => {
                const apiRows = res.data.data || [];

                setRows(apiRows);

                if (apiRows.length) {
                    const baseCols = Object.keys(apiRows[0]).map((key, index) => ({
                        key,
                        label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                        enabled: DEFAULT_COLUMNS.includes(key),
                        isNumeric: NUMERIC_KEYS.includes(key),
                        order: index
                    }));

                    if (templateConfig?.abstract?.length) {
                        setColumns(
                            applyTemplateToColumns(baseCols, templateConfig.abstract)
                        );

                        const grouped = templateConfig.abstract
                            .filter((x: any) => x.groupBy > 0)
                            .sort((a: any, b: any) => a.groupBy - b.groupBy)
                            .map((x: any) => x.key);

                        setGroupBy(grouped);

                    } else {
                        setColumns(baseCols);
                    }
                }

                setPage(1);
            })
            .catch(err => {
                console.error("Ledger Item API Error:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedLedger, filters.Date.from, filters.Date.to]);

    useEffect(() => {
        if (Ledger_Id) {
            setSelectedLedger(Number(Ledger_Id));
        }
    }, [Ledger_Id]);

    useEffect(() => {

        const ledgerId = Number(searchParams.get("ledgerId"));

        if (ledgerId && ledgerId !== selectedLedger) {
            setSelectedLedger(ledgerId);
        }

    }, [searchParams]);

    useEffect(() => {
        sessionStorage.setItem(
            "ledgerFilters",
            JSON.stringify(filters)
        );
    }, [filters]);

    /* ================= COLUMNS ================= */

    useEffect(() => {
        if (columns.length) {
            sessionStorage.setItem("ledgerColumns", JSON.stringify(columns));
        }
    }, [columns]);

    /* ================= GROUPBY ================= */
    useEffect(() => {
        sessionStorage.setItem("ledgerGroupBy", JSON.stringify(groupBy));
    }, [groupBy]);

    /* ================= FILTERS ================= */
    useEffect(() => {
        sessionStorage.setItem(
            "ledgerFilters",
            JSON.stringify({ columnFilters: filters.columnFilters })
        );
    }, [filters.columnFilters]);

    /* ================= EXPANDED ================= */
    useEffect(() => {
        sessionStorage.setItem(
            "ledgerExpanded",
            JSON.stringify(expandedGroups)
        );
    }, [expandedGroups]);

    /* ================= FILTERING ================= */

    const filteredRows = useMemo(() => {
        return rows.filter(row => {
            // ✅ COLUMN FILTERS
            for (const [key, values] of Object.entries(filters.columnFilters) as [string, string[] | undefined][]) {
                if (values === undefined) continue;
                if (!values.includes(String(row[key] ?? ""))) return false;
            }

            // ✅ STOCK FILTER (NEW)
            const values = [
                Number(row.Total_Qty) || 0,
                Number(row.M1_Avg_Qty) || 0,
                Number(row.M2_AVG_Qty) || 0,
                Number(row.M3_AVG_Qty) || 0,
                Number(row.M6_AVG_Qty) || 0,
                Number(row.M9_AVG_Qty) || 0,
                Number(row.One_Year_AVG_Qty) || 0
            ];

            const hasValue = values.some(v => v !== 0);
            const isZero = values.every(v => v === 0);

            if (stockFilter === "hasValues" && !hasValue) return false;
            if (stockFilter === "zero" && !isZero) return false;

            return true;
        });
    }, [rows, filters, stockFilter]);

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

    const enabledColumns = useMemo(
        () =>
            columns
                .filter(c => c.enabled)
                .sort((a, b) => a.order - b.order),
        [columns]
    );

    /* ================= TOTAL ================= */

    const getTotal = (key: string) => {
        const total = numFilteredAndSortedRows.reduce(
            (s, r) => s + Number(r[key] || 0),
            0
        );

        return total.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    type GroupNode = {
        __group: true;
        key: string;
        value: string;
        level: number;
        rows: any[];
        children: GroupNode[];
    };

    const groupData = (data: any[], level = 0): GroupNode[] => {
        if (level >= groupBy.length) return [];
        const key = groupBy[level];
        const map: Record<string, any[]> = {};
        data.forEach(row => {
            const val = row[key] ?? "Blank";
            if (!map[val]) map[val] = [];
            map[val].push(row);
        });

        return Object.entries(map).map(([value, rows]) => ({
            __group: true,
            key: `${level}-${value}-${rows.length}`,
            value,
            level,
            rows,
            children: groupData(rows, level + 1)
        }));
    };

    const flattenGroups = (groups: GroupNode[]) => {
        const result: any[] = [];
        const walk = (nodes: GroupNode[]) => {
            nodes.forEach(node => {
                result.push(node);
                if (expandedGroups.includes(node.key)) {
                    if (node.children.length) {
                        walk(node.children);
                    } else {
                        result.push(...node.rows);
                    }
                }
            });
        };
        walk(groups);
        return result;
    };

    /* ================= LOAD TEMPLATE ================= */
    const loadTemplate = async (reportId: number) => {
        try {
            setTemplateLoading(true);
            setSelectedTemplateId(reportId);

            const res = await SettingsService.getReportEditData({
                reportId,
                typeId: 1,
            });

            const templateCols = res.data.data.columns || [];

            setTemplateConfig({
                abstract: templateCols,
                expanded: [],
            });

            if (res.data.data.reportInfo?.Report_Name) {
                setReportName(res.data.data.reportInfo.Report_Name);
            }

            if (res.data.data.reportInfo?.Parent_Report) {
                setParentReportName(
                    res.data.data.reportInfo.Parent_Report
                );
            }

            setRows([]);
            setColumns([]);

        } catch (err) {
            console.error(err);
            toast.error("Failed to load template ❌");
        } finally {
            setTemplateLoading(false);
        }
    };

    /* ================= APPLY TEMPLATE TO COLUMNS ================= */

    const applyTemplateToColumns = (
        baseCols: ColumnConfig[],
        templateCols: any[]
    ): ColumnConfig[] => {

        const templateBased = templateCols.map(t => ({
            key: t.key,
            label: t.label || t.key,
            enabled: t.enabled,
            order: t.order ?? 0,
            groupBy: t.groupBy ?? 0,
            isNumeric: NUMERIC_KEYS.includes(t.key),
        }));

        const merged = templateBased.map(col => {
            const base = baseCols.find(b => b.key === col.key);

            return {
                ...col,
                isNumeric: base?.isNumeric ?? col.isNumeric,
            };
        });

        const missing = baseCols
            .filter(b => !templateBased.some(t => t.key === b.key))
            .map(b => ({
                ...b,
                enabled: false,
                groupBy: 0,
            }));

        return [...merged, ...missing];
    };

    /* ================= SAVE TEMPLATE ================= */
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

            const payloadColumns = columns.map((c) => ({
                key: c.key,
                label: c.label,
                enabled: c.enabled,
                order: c.order,
                groupBy: groupBy.includes(c.key)
                    ? groupBy.indexOf(c.key) + 1
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
                    columns: payloadColumns
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
                    abstractSP: SP_MAP.Abstract,
                    expandedSP: SP_MAP.Abstract,
                    abstractColumns: payloadColumns,
                    expandedColumns: payloadColumns,
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

    /* ================= PAGINATION ================= */

    const groupedRows = useMemo(() => {
        if (!groupBy.length) return numFilteredAndSortedRows;
        const groups = groupData(numFilteredAndSortedRows);
        return flattenGroups(groups);
    }, [numFilteredAndSortedRows, groupBy, expandedGroups]);

    const pagedRows = useMemo(() => {
        if (groupBy.length) return groupedRows;

        const start = (page - 1) * rowsPerPage;
        return groupedRows.slice(start, start + rowsPerPage);

    }, [groupedRows, page, rowsPerPage, groupBy]);

    /* ================= EXPORT ================= */

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(numFilteredAndSortedRows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Ledger Item Details"
        );

        XLSX.writeFile(
            workbook,
            `Ledger_Item_${Ledger_Name}.xlsx`
        );
    };

    const handleExportPDF = () => {
        const doc = new jsPDF("l");

        autoTable(doc, {
            head: [enabledColumns.map(c => c.label)],
            body: numFilteredAndSortedRows.map(r =>
                enabledColumns.map(c => r[c.key])
            ),
            styles: { fontSize: 7 }
        });

        doc.save("Ledger_Items.pdf");
    };

    /* ================= FILTER OPTIONS ================= */

    const filterOptions = useMemo(() => {
        if (!activeHeader) return [];

        return Array.from(
            new Set(
                rows
                    .map(r => r[activeHeader])
                    .filter(v => v !== null && v !== undefined)
                    .map(v => String(v))
            )
        );
    }, [activeHeader, rows]);

    type SortableColumnProps = {
        column: ColumnConfig;
        toggle: (key: string) => void;
    };

    const SortableColumn: React.FC<SortableColumnProps> = ({ column, toggle }) => {

        const { attributes, listeners, setNodeRef, transform, transition } =
            useSortable({ id: column.key });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition
        };

        return (
            <Box
                ref={setNodeRef}
                style={style}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={0.7}
                px={1}
                sx={{
                    borderBottom: "1px solid #eee"
                }}
            >
                {/* LEFT SIDE */}
                <Box display="flex" alignItems="center" gap={1}>

                    {/* DRAG HANDLE ONLY */}
                    <Box
                        {...attributes}
                        {...listeners}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "grab"
                        }}
                    >
                        <DragIndicatorIcon fontSize="small" />
                    </Box>

                    <Typography fontSize={12}>
                        {column.label}
                    </Typography>
                </Box>

                {/* SWITCH */}
                <Switch
                    size="medium"
                    checked={column.enabled}
                    onChange={() => toggle(column.key)}
                />
            </Box>
        );
    };

    /* ================= RENDER ================= */

    return (
        <>
            <PageHeader
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onReportChange={(template) => {
                    const todayDate = dayjs().format("YYYY-MM-DD");

                    // ✅ If Select Template chosen / cleared / null option
                    if (!template || !template.Report_Id) {
                        setIsEditTemplate(false);
                        setSelectedTemplateId(null);
                        setReportName("");
                        setParentReportName("");
                        setTemplateConfig(null);

                        // Reset filters
                        setFilters({
                            Date: {
                                from: Fromdate || todayDate,
                                to: Todate || todayDate,
                            },
                            columnFilters: {},
                        });

                        // Reset grouping
                        setGroupBy([]);
                        setExpandedGroups([]);

                        // Reset stock filter
                        setStockFilter("hasValues");

                        // Reset rows + columns
                        setRows([]);
                        setColumns([]);

                        // Reset pagination
                        setPage(1);

                        // Close menus
                        setSettingsAnchor(null);
                        setFilterAnchor(null);

                        return;
                    }

                    // ✅ Load selected template
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
                        <Tooltip title="Group By">
                            <IconButton
                                size="small"
                                onClick={() => setGroupDialogOpen(true)}
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
                    setFilters(p => ({
                        ...p,
                        Date: { ...p.Date, from: v }
                    }))
                }
                onToDateChange={v =>
                    setFilters(p => ({
                        ...p,
                        Date: { ...p.Date, to: v }
                    }))
                }
                stockFilter={stockFilter}
                onStockFilterChange={setStockFilter}
                onApply={() => setDrawerOpen(false)}
            />

            <AppLayout fullWidth>

                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={2}
                    mb={1}
                    flexWrap="wrap"
                >
                    <Autocomplete
                        size="small"
                        options={retailerList}
                        loading={retailerLoading}
                        sx={{ width: 420, mt: 1 }}
                        getOptionLabel={(option) => option.Retailer_Name || ""}
                        value={
                            retailerList.find(
                                r => Number(r.Retailer_Id) === Number(selectedLedger)
                            ) || null
                        }
                        onChange={(_, newValue) => {

                            if (!newValue) return;

                            setSelectedLedger(newValue.Retailer_Id);

                            const params = new URLSearchParams(window.location.search);

                            params.set("ledgerId", String(newValue.Retailer_Id));
                            params.set("ledgerName", newValue.Retailer_Name);

                            window.history.replaceState(
                                {},
                                "",
                                `${window.location.pathname}?${params.toString()}`
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Retailer"
                                placeholder="Search Retailer"
                            />
                        )}
                    />

                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            px: 2,
                            py: 0.8,
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            backgroundColor: "background.paper",
                            mt: 1
                        }}
                    >
                        <Typography
                            fontSize={13}
                            color="text.secondary"
                            sx={{ fontWeight: 600, display: "flex", alignItems: "center" }}
                        >
                            {dayjs(filters.Date.from).format("DD MMM YYYY")}
                            <Box component="span" sx={{ mx: 1 }}>-</Box>
                            {dayjs(filters.Date.to).format("DD MMM YYYY")}
                        </Typography>
                    </Box>
                </Box>
                {templateLoading && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(255,255,255,.5)",
                            zIndex: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                        }}
                    >
                        <CircularProgress />
                    </Box>
                )}
                <Box sx={{ overflow: "auto", mt: 0.5 }}>
                    <TableContainer
                        component={Paper}
                        sx={{
                            maxHeight: "calc(100vh - 160px)",
                            "& th, & td": { fontSize: "0.75rem" }
                        }}
                    >
                        <Table size="small">
                            <TableHead
                                sx={{
                                    background: "#1E3A8A",
                                    position: "sticky",
                                    top: 0
                                }}
                            >
                                <TableRow>
                                    <TableCell sx={{ color: "#fff" }}>S.No</TableCell>

                                    {enabledColumns.map(c => (
                                        <TableCell
                                            key={c.key}
                                            align={c.isNumeric ? "right" : "left"}
                                            sx={{ color: "#fff", cursor: "pointer" }}
                                            onClick={e => {
                                                if (c.isNumeric) {
                                                    openNumFilter(e, c.key);
                                                } else {
                                                    setActiveHeader(c.key);
                                                    setFilterAnchor(e.currentTarget);
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
                                                c.label
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>

                                <TableRow sx={{ background: "#f3f4f6" }}>
                                    <TableCell>Total</TableCell>

                                    {enabledColumns.map(c => (
                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"}>
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
                                            <CircularProgress size={28} />
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    (() => {
                                        let serial = (page - 1) * rowsPerPage;
                                        return pagedRows.map((row, i) => {
                                            if (row.__group) {
                                                const expanded = expandedGroups.includes(row.key);
                                                const groupColumn = groupBy[row.level];
                                                const totals: any = {};
                                                enabledColumns.forEach(c => {
                                                    if (c.isNumeric) {
                                                        totals[c.key] = row.rows
                                                            .reduce((s: number, r: any) => s + Number(r[c.key] || 0), 0)
                                                            .toLocaleString("en-IN", {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            });
                                                    }
                                                });

                                                return (
                                                    <TableRow
                                                        key={row.key}
                                                        sx={{
                                                            background: "#f3f4f6",
                                                            "& td": { fontWeight: 600 }
                                                        }}
                                                    >
                                                        {/* Expand Icon */}
                                                        <TableCell sx={{ width: 60 }}>
                                                            <Box
                                                                display="flex"
                                                                alignItems="center"
                                                                justifyContent="center"
                                                                sx={{ cursor: "pointer" }}
                                                                onClick={() => {
                                                                    setExpandedGroups(prev =>
                                                                        expanded
                                                                            ? prev.filter((x: string) => x !== row.key)
                                                                            : [...prev, row.key]
                                                                    );
                                                                }}
                                                            >
                                                                {expanded
                                                                    ? <KeyboardArrowDownIcon fontSize="small" />
                                                                    : <KeyboardArrowRightIcon fontSize="small" />}
                                                            </Box>
                                                        </TableCell>

                                                        {enabledColumns.map(c => {

                                                            if (c.key === groupColumn) {
                                                                return (
                                                                    <TableCell key={c.key} align={c.isNumeric ? "right" : "left"}>
                                                                        <Box pl={row.level * 2}>
                                                                            {row.value} ({row.rows.length})
                                                                        </Box>
                                                                    </TableCell>
                                                                );
                                                            }

                                                            if (c.isNumeric) {
                                                                return (
                                                                    <TableCell key={c.key} align="right">
                                                                        {totals[c.key]}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            return <TableCell key={c.key} align={c.isNumeric ? "right" : "left"}></TableCell>;

                                                        })}
                                                    </TableRow>
                                                );
                                            }

                                            // DATA ROW
                                            return (
                                                <TableRow key={i}>

                                                    <TableCell sx={{ width: 60 }}>
                                                        {++serial}
                                                    </TableCell>

                                                    {enabledColumns.map(c => (
                                                        <TableCell key={c.key} align={c.isNumeric ? "right" : "left"}>
                                                            {row[c.key]}
                                                        </TableCell>
                                                    ))}

                                                </TableRow>
                                            );
                                        });
                                    })()
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <CommonPagination
                        totalRows={numFilteredAndSortedRows.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </Box>
            </AppLayout>

            {/* FILTER MENU */}
            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor) && Boolean(activeHeader)}
                onClose={() => {
                    setFilterAnchor(null);
                    setActiveHeader(null);
                }}
                columnLabel={columns.find((c) => c.key === activeHeader)?.label || activeHeader || undefined}
                options={filterOptions}
                selectedValues={activeHeader ? filters.columnFilters[activeHeader] : undefined}
                onFilterChange={(selected: string[] | undefined) => {
                    if (activeHeader) {
                        setFilters((prev: any) => {
                            const copy = { ...prev.columnFilters };
                            if (selected === undefined) {
                                delete copy[activeHeader];
                            } else {
                                copy[activeHeader] = selected;
                            }
                            return {
                                ...prev,
                                columnFilters: copy,
                            };
                        });
                    }
                }}
            />

            {/* *******COLUMN SETIINGS******** */}
            <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
            >
                <Box p={2} minWidth={300}>
                    <Typography fontWeight={600} fontSize={12}>
                        Enabled Columns
                    </Typography>

                    <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
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
                                    <SortableColumn
                                        key={col.key}
                                        column={col}
                                        toggle={(key) =>
                                            setColumns(prev =>
                                                prev.map(c =>
                                                    c.key === key ? { ...c, enabled: false } : c
                                                )
                                            )
                                        }
                                    />
                                ))}

                        </SortableContext>
                    </DndContext>

                    <Box mt={2}>
                        <Typography fontWeight={600} fontSize={12}>
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
                                >
                                    <Typography fontSize={12}>{col.label}</Typography>

                                    <Switch
                                        size="medium"
                                        onChange={() =>
                                            setColumns(prev =>
                                                prev.map(c =>
                                                    c.key === col.key ? { ...c, enabled: true } : c
                                                )
                                            )
                                        }
                                    />
                                </Box>
                            ))}
                    </Box>

                </Box>
            </Menu>

            <Dialog
                open={groupDialogOpen}
                onClose={() => setGroupDialogOpen(false)}
            >
                <DialogTitle>Group By</DialogTitle>

                <DialogContent sx={{ width: 320 }}>
                    {[0, 1, 2].map(level => (
                        <TextField
                            key={level}
                            select
                            label={`Level ${level + 1}`}
                            fullWidth
                            margin="dense"
                            value={groupBy[level] || ""}
                            onChange={(e) => {
                                const newGroup = [...groupBy];
                                newGroup[level] = e.target.value;
                                setGroupBy(newGroup.filter(Boolean));
                            }}
                        >
                            <MenuItem value="">None</MenuItem>
                            {columns
                                .filter(c => c.enabled)
                                .map(c => (
                                    <MenuItem
                                        key={c.key}
                                        value={c.key}
                                        disabled={
                                            groupBy.includes(c.key) &&
                                            groupBy[level] !== c.key
                                        }
                                    >
                                        {c.label}
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
                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
            >
                <DialogTitle>
                    {isEditTemplate ? "Edit Template" : "Create Template"}
                </DialogTitle>

                <DialogContent>
                    <TextField
                        fullWidth
                        size="small"
                        label="Report Name"
                        value={reportName}
                        onChange={(e) =>
                            setReportName(e.target.value)
                        }
                    />
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() =>
                            setSaveDialogOpen(false)
                        }
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

export default LedgerItemWiseDetails;