import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    CircularProgress,
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    MenuItem,
    DialogActions,
    Button,
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import { SettingsService } from "../../services/reportSettings.services";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    CostingReportService,
    ItemSummary,
    AccountGroup,
} from "../../services/expenseReport.service";

/* =========================================
   TYPES
========================================= */

type DynamicColumn = {
    key: string;
    label: string;
    group: string;
};

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
    groupBy?: number;
    isNumeric?: boolean;
};

/* =========================================
   HELPERS
========================================= */

const formatINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

/* =========================================
   COMPONENT
========================================= */

const CostingReport: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    /* =========================================
       STATES
    ========================================= */

    const [drawerOpen, setDrawerOpen] = useState(false);

    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);

    const [filters, setFilters] = useState({
        Date: {
            from: today,
            to: today,
        },
    });

    const [loading, setLoading] = useState(false);

    const [itemSummary, setItemSummary] = useState<ItemSummary[]>([]);
    const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);

    const [page, setPage] = useState(1);
    const [grouping, setGrouping] = useState<string[]>([]);
    const [pendingGrouping, setPendingGrouping] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [filterAnchor, setFilterAnchor] =
        useState<null | HTMLElement>(null);

    const [stockFilter, setStockFilter] =
        useState<string[] | undefined>(undefined);

    const [columnFilterAnchor, setColumnFilterAnchor] =
        useState<null | HTMLElement>(null);

    const [activeFilterColumn, setActiveFilterColumn] =
        useState("");

    const [columnFilters, setColumnFilters] =
        useState<Record<string, string[] | undefined>>({});

    const [columns, setColumns] =
        useState<ColumnConfig[]>([]);

    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [isEditTemplate, setIsEditTemplate] = useState(false);

    const [templateConfig, setTemplateConfig] = useState<{
        abstract: ColumnConfig[];
        expanded: ColumnConfig[];
    } | null>(null);

    const [templateLoading, setTemplateLoading] = useState(false);

    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [reportName, setReportName] = useState("");
    const [parentReportName, setParentReportName] = useState("");
    const [expandedStockItems, setExpandedStockItems] = useState<string[]>([]);

    const [spConfig, setSpConfig] = useState({
        abstractSP: "",
        expandedSP: ""
    });

    const SP_MAP = {
        Abstract: "Reporting_Online_Payment_Costing_VW",
        Expanded: "Reporting_Online_Payment_Costing_VW"
    };

    useEffect(() => {
        setSpConfig({
            abstractSP: SP_MAP.Abstract,
            expandedSP: SP_MAP.Expanded
        });
    }, []);

    const groupableColumns = [
        "Stock_Item",
        "Product_Name",
        "Brand",
        "Stock_Group",
        "Group_ST",
        "Grade_Item_Group",
        "Item_Name_Modified",
        "POS_Group",
        "Created_By",
        "Invoice_Month",
    ];

    /* =========================================
   DYNAMIC COLUMNS
========================================= */

    const dynamicColumns: DynamicColumn[] = useMemo(() => {

        const usedAccounts = new Set(
            itemSummary.map((x) => x.debit_ledger_name)
        );

        return accountGroups
            .filter((acc) =>
                usedAccounts.has(acc.Account_name)
            )
            .map((acc) => ({
                key: acc.Account_name,
                label: acc.Account_name,
                group: acc.Group_Name,
            }));

    }, [accountGroups, itemSummary]);

    const visibleGroupColumns = useMemo(() => {

        return grouping.filter(Boolean);

    }, [grouping]);

    const templateColumns: ColumnConfig[] = useMemo(() => {

        const staticCols: ColumnConfig[] = [

            ...groupableColumns.map((g, index) => ({
                key: g,
                label:
                    g === "Stock_Item"
                        ? "Stock Item"
                        : g.replace(/_/g, " "),
                enabled: g === "Stock_Item",
                order: index + 1,
            })),

        ];

        const dynamicCols: ColumnConfig[] =
            dynamicColumns.map((col, index) => ({
                key: col.key,
                label: col.label,
                enabled: true,
                order: index + 100,
                isNumeric: true,
            }));

        return [
            ...staticCols,
            ...dynamicCols,
            {
                key: "Total",
                label: "Total",
                enabled: true,
                order: 999,
                isNumeric: true,
            },
        ];

    }, [dynamicColumns]);

    const exportColumns = useMemo(() => {
        const groupCols = visibleGroupColumns.map((g) => ({
            key: g,
            label: g.replace(/_/g, " "),
        }));

        const stockCol = [{ key: "Stock_Item", label: "Stock Item" }];

        const dynCols = dynamicColumns.map((c) => ({
            key: c.key,
            label: c.label,
        }));

        const totalCol = [{ key: "Total", label: "Total" }];

        return [...groupCols, ...stockCol, ...dynCols, ...totalCol];
    }, [visibleGroupColumns, dynamicColumns]);


    /* =========================================
       FETCH DATA
    ========================================= */

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                const res = await CostingReportService.getCostingReport({
                    Fromdate: filters.Date.from,
                    Todate: filters.Date.to,
                });

                setItemSummary(res.ItemSummary || []);
                setAccountGroups(res.Accountgroup || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [filters.Date.from, filters.Date.to]);

    useEffect(() => {

        if (!templateColumns.length) return;

        // NO TEMPLATE

        if (!templateConfig?.abstract?.length) {

            setColumns(templateColumns);

            setGrouping([]);

            setPendingGrouping([]);

            return;
        }

        // APPLY TEMPLATE

        const mergedColumns = applyTemplateToColumns(
            templateColumns,
            templateConfig.abstract
        );

        // RESTORE GROUPING

        const groupedCols = mergedColumns
            .filter((col) => Number(col.groupBy || 0) > 0)
            .sort(
                (a, b) =>
                    Number(a.groupBy || 0) -
                    Number(b.groupBy || 0)
            )
            .map((col) => col.key);

        // APPLY GROUPBY TO COLUMN STATE

        const finalColumns = mergedColumns.map((col) => ({
            ...col,
            groupBy: groupedCols.includes(col.key)
                ? groupedCols.indexOf(col.key) + 1
                : 0,
        }));


        setColumns(finalColumns);

        setGrouping(groupedCols);

        setPendingGrouping(groupedCols);

    }, [templateConfig, dynamicColumns]);

    /* =========================================
       PIVOT REPORT
    ========================================= */

    const costingRows = useMemo(() => {

        const grouped = new Map<string, any>();

        itemSummary.forEach((row) => {

            const stockKey = row.Stock_Item || "Others";

            if (!grouped.has(stockKey)) {

                const initialRow: any = {

                    Stock_Item: stockKey,

                    Product_Name: row.Product_Name || "",
                    Brand: row.Brand || "",
                    Stock_Group: row.Stock_Group || "",
                    Group_ST: row.Group_ST || "",
                    Grade_Item_Group: row.Grade_Item_Group || "",
                    Item_Name_Modified: row.Item_Name_Modified || "",
                    POS_Group: row.POS_Group || "",
                    Created_By: row.Created_By || "",
                    Invoice_Month: row.Invoice_Month || "",

                };

                dynamicColumns.forEach((col) => {
                    initialRow[col.key] = 0;
                });

                initialRow.Total = 0;

                grouped.set(stockKey, initialRow);
            }

            const existing = grouped.get(stockKey);

            const accountName = row.debit_ledger_name;

            if (existing[accountName] !== undefined) {
                existing[accountName] += Number(
                    row.expence_value || 0
                );
            }

            existing.Total += Number(row.expence_value || 0);

        });

        return Array.from(grouped.values());

    }, [itemSummary, dynamicColumns]);

    const buildGroupedData = (
        data: any[],
        level: number,
        parentKey = ""
    ): any[] => {

        const groupKey = visibleGroupColumns[level];

        if (!groupKey) return data;

        const map = new Map<string, any[]>();

        data.forEach((row) => {

            const value =
                row[groupKey] || "Others";

            if (!map.has(value)) {
                map.set(value, []);
            }

            map.get(value)!.push(row);

        });

        return Array.from(map.entries()).map(
            ([value, rows]) => {

                const groupTotal = rows.reduce(
                    (sum, row) => sum + Number(row.Total || 0),
                    0
                );

                const dynamicTotals: any = {};

                dynamicColumns.forEach((col) => {

                    dynamicTotals[col.key] = rows.reduce(
                        (sum, row) =>
                            sum + Number(row[col.key] || 0),
                        0
                    );
                });

                return {
                    __group: true,
                    __key: `${parentKey}${groupKey}:${value}`,
                    __value: value,
                    __level: level,
                    __rows: rows,
                    __total: groupTotal,
                    ...dynamicTotals,
                };
            }
        );
    };

    const filteredRows = useMemo(() => {

        return costingRows.filter((row) => {

            /* STOCK ITEM FILTER */

            if (
                stockFilter !== undefined &&
                !stockFilter.includes(row.Stock_Item)
            ) {
                return false;
            }

            /* GROUP COLUMN FILTERS */

            for (const key in columnFilters) {

                const selectedValues =
                    columnFilters[key];

                if (
                    selectedValues !== undefined &&
                    !selectedValues.includes(
                        row[key]
                    )
                ) {
                    return false;
                }
            }

            return true;
        });

    }, [costingRows, stockFilter, columnFilters]);

    const groupedRows = useMemo(() => {

        if (!visibleGroupColumns.length) {
            return filteredRows;
        }

        return buildGroupedData(filteredRows, 0);

    }, [filteredRows, visibleGroupColumns]);

    const flattenRows = (rows: any[]): any[] => {

        const result: any[] = [];

        const walk = (
            list: any[],
            parentGroups: Record<string, any> = {}
        ) => {

            list.forEach((r) => {

                if (r.__group) {

                    result.push(r);

                    if (
                        expandedKeys.includes(r.__key)
                    ) {

                        const nextGroupKey =
                            visibleGroupColumns[r.__level];

                        const nextParentGroups = {
                            ...parentGroups,
                            [nextGroupKey]: r.__value,
                        };

                        const children = buildGroupedData(
                            r.__rows,
                            r.__level + 1,
                            `${r.__key} > `
                        );

                        walk(children, nextParentGroups);
                    }

                } else {

                    result.push({
                        ...parentGroups,
                        ...r,
                    });
                }
            });
        };

        walk(rows);

        return result;
    };

    /* =========================================
       PAGINATION
    ========================================= */

    const paginatedRows = useMemo(() => {

        return visibleGroupColumns.length
            ? flattenRows(groupedRows)
            : filteredRows;

    }, [groupedRows, filteredRows, grouping, expandedKeys]);

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

        } catch (err) {
            console.error(err);
        } finally {
            setTemplateLoading(false);
        }
    };

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

            isNumeric:
                t.key === "Total" ||
                dynamicColumns.some(
                    d => d.key === t.key
                ),
        }));

        const merged = templateBased.map(col => {

            const base = baseCols.find(
                b => b.key === col.key
            );

            return {
                ...col,
                isNumeric:
                    base?.isNumeric ??
                    col.isNumeric,
            };
        });

        const missing = baseCols
            .filter(
                b =>
                    !templateBased.some(
                        t => t.key === b.key
                    )
            )
            .map(b => ({
                ...b,
                enabled: false,
                groupBy: 0,
            }));

        return [
            ...merged,
            ...missing,
        ];
    };

    const handleQuickSave = async () => {

        try {

            if (!reportName.trim()) {

                toast.error("Enter Report Name");
                return;
            }

            // PREPARE FINAL COLUMNS
            const updatedColumns = templateColumns.map((c) => ({

                ...c,

                enabled:
                    grouping.includes(c.key)
                        ? true
                        : (
                            columns.find(x => x.key === c.key)?.enabled
                            ?? c.enabled
                        ),

                order:
                    columns.find(x => x.key === c.key)?.order ?? c.order,

                groupBy: grouping.includes(c.key)
                    ? grouping.indexOf(c.key) + 1
                    : 0,
            }));

            // REMOVE DUPLICATE COLUMN ENTRIES
            const uniqueColumns = updatedColumns.filter(
                (col, index, self) =>
                    index ===
                    self.findIndex(
                        (c) => c.key === col.key
                    )
            );

            const payload = uniqueColumns.map((c) => ({

                key: c.key,

                label: c.label,

                enabled: c.enabled,

                order: c.order,

                groupBy: Number(c.groupBy || 0),

                dataType: "nvarchar",
            }));

            const userData =
                JSON.parse(localStorage.getItem("user") || "{}");

            const createdBy = userData?.id || 0;

            if (selectedTemplateId) {

                await SettingsService.updateReport({

                    reportId: selectedTemplateId,

                    typeId: 1,

                    reportName: reportName.trim(),

                    columns: payload,
                });

                toast.success(
                    "Template Updated Successfully"
                );

            } else {

                await SettingsService.saveReportSettings({

                    reportName,

                    parentReport: parentReportName,

                    abstractSP: spConfig.abstractSP,

                    expandedSP: spConfig.expandedSP,

                    abstractColumns: payload,

                    expandedColumns: payload,

                    createdBy,
                });

                toast.success(
                    "Template Saved Successfully"
                );
            }

            setColumns(uniqueColumns);

            setSaveDialogOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 500);


        } catch (err) {

            console.error(err);

            toast.error("Save Failed");
        }
    };


    /* =========================================
       EXPORT 
    ========================================= */
    const exportRows = useMemo(() => {
        return costingRows.map((row) => {
            const obj: any = {};

            visibleGroupColumns.forEach((g) => {
                obj[g.replace(/_/g, " ")] = row[g] ?? "-";
            });

            obj["Stock Item"] = row.Stock_Item;

            dynamicColumns.forEach((c) => {
                obj[c.label] = row[c.key]
                    ? Number(row[c.key]).toFixed(2)
                    : "0.00";
            });

            obj["Total"] = row.Total?.toFixed(2) ?? "0.00";

            return obj;
        });
    }, [costingRows, visibleGroupColumns, dynamicColumns]);

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Costing Report"
        );

        XLSX.writeFile(
            workbook,
            `Costing_Report_${dayjs().format("DDMMYYYY")}.xlsx`
        );
    };

    const handleExportPDF = () => {
        const doc = new jsPDF("l", "mm", "a4");

        doc.text(
            "Costing Report",
            14,
            10
        );

        autoTable(doc, {
            startY: 15,
            head: [exportColumns.map(c => c.label)],
            body: exportRows.map(r =>
                exportColumns.map(c => r[c.label])
            ),
            styles: {
                fontSize: 7,
            },
            headStyles: {
                fillColor: [30, 58, 138],
            },
        });

        doc.save(
            `Costing_Report_${dayjs().format("DDMMYYYY")}.pdf`
        );
    };

    const getGroupSummary = (groupName: string) => {

        const cols = dynamicColumns.filter(
            (c) => c.group === groupName
        );

        let count = 0;
        let total = 0;

        costingRows.forEach((row) => {

            cols.forEach((col) => {

                const value = Number(row[col.key] || 0);

                if (value > 0) {
                    count++;
                    total += value;
                }
            });
        });

        return {
            count,
            total,
        };
    };

    const getColumnSummary = (columnKey: string) => {

        let count = 0;
        let total = 0;

        costingRows.forEach((row) => {

            const value = Number(row[columnKey] || 0);

            if (value > 0) {
                count++;
                total += value;
            }
        });

        return {
            count,
            total,
        };
    };

    let groupRowNo = 0;
    let groupHeaderNo = 0;

    /* =========================================
       RENDER
    ========================================= */

    return (
        <>
            <PageHeader
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}

                onReportChange={(template) => {


                    if (!template) {

                        setTemplateConfig(null);
                        setSelectedTemplateId(null);
                        setIsEditTemplate(false);
                        setReportName("");

                        return;
                    }

                    const reportId =
                        template.Report_Id ||
                        template.report_id ||
                        template.reportId;

                    setSelectedTemplateId(reportId);

                    setIsEditTemplate(true);

                    loadTemplate(reportId);
                }}

                onQuickSave={(parentName) => {

                    setParentReportName(parentName);

                    if (!selectedTemplateId) {
                        setReportName("");
                    }

                    setSaveDialogOpen(true);
                }}

                settingsSlot={
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
                        Date: {
                            from: fromDate,
                            to: toDate,
                        },
                    })
                }
            />

            <AppLayout fullWidth>
                {templateLoading && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 20,
                            background: "rgba(255,255,255,0.5)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <CircularProgress />
                    </Box>
                )}
                <Box sx={{ mt: 1 }}>

                    {/* LOADER */}

                    {loading && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 10,
                                background: "rgba(255,255,255,0.5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    )}

                    {/* TABLE */}

                    <TableContainer
                        component={Paper}
                        sx={{
                            maxHeight: "calc(100vh - 100px)",
                        }}
                    >
                        <Table
                            stickyHeader
                            size="small"
                        >
                            {/* =========================================
                                HEADER
                            ========================================= */}

                            <TableHead>
                                {/* ================= FIRST HEADER ================= */}

                                <TableRow>
                                    {/* S.NO */}

                                    <TableCell
                                        rowSpan={2}
                                        sx={{
                                            background: "#1E3A8A",
                                            color: "#fff",
                                            minWidth: 70,
                                            fontWeight: 700,
                                            whiteSpace: "nowrap",
                                            textAlign: "center",
                                            border: "1px solid #2247b5",
                                        }}
                                    >
                                        S.No
                                    </TableCell>

                                    {/* GROUPING COLUMNS FIRST */}

                                    {visibleGroupColumns.map((groupCol) => (
                                        <TableCell
                                            key={groupCol}
                                            rowSpan={2}
                                            onClick={(e) => {

                                                setActiveFilterColumn(groupCol);

                                                setColumnFilterAnchor(
                                                    e.currentTarget
                                                );
                                            }}
                                            sx={{
                                                background: "#1E3A8A",
                                                color: "#fff",
                                                minWidth: 180,
                                                fontWeight: 700,
                                                whiteSpace: "nowrap",
                                                border: "1px solid #2247b5",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {groupCol.replace(/_/g, " ")}
                                        </TableCell>
                                    ))}

                                    {/* STOCK ITEM */}

                                    <TableCell
                                        rowSpan={2}
                                        onClick={(e) => setFilterAnchor(e.currentTarget)}
                                        sx={{
                                            background: "#1E3A8A",
                                            color: "#fff",
                                            minWidth: 220,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            whiteSpace: "nowrap",
                                            border: "1px solid #2247b5",
                                        }}
                                    >
                                        Stock Item
                                    </TableCell>

                                    {/* TOTAL */}

                                    <TableCell
                                        rowSpan={2}
                                        align="right"
                                        sx={{
                                            background: "#1E3A8A",
                                            color: "#fff",
                                            minWidth: 140,
                                            fontWeight: 700,
                                            whiteSpace: "nowrap",
                                            border: "1px solid #2247b5",
                                        }}
                                    >
                                        <Box>
                                            <Typography fontWeight={700}>
                                                Total
                                            </Typography>

                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    display: "block",
                                                    color: "#dbeafe",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                (Rs.{" "}
                                                {formatINR(
                                                    costingRows.reduce(
                                                        (sum, row) => sum + Number(row.Total || 0),
                                                        0
                                                    )
                                                )}
                                                )
                                            </Typography>
                                        </Box>
                                    </TableCell>

                                    {/* GROUP HEADERS */}

                                    {Array.from(
                                        new Set(
                                            dynamicColumns
                                                .filter((c) =>
                                                    costingRows.some(
                                                        (r) => Number(r[c.key] || 0) > 0
                                                    )
                                                )
                                                .map((c) => c.group)
                                        )
                                    ).map((group) => {

                                        const cols = dynamicColumns.filter(
                                            (c) =>
                                                c.group === group &&
                                                costingRows.some(
                                                    (r) => Number(r[c.key] || 0) > 0
                                                )
                                        );

                                        if (!cols.length) return null;

                                        return (
                                            <TableCell
                                                key={group}
                                                align="center"
                                                colSpan={cols.length}
                                                sx={{
                                                    background: "#1E3A8A",
                                                    color: "#fff",
                                                    fontWeight: 700,
                                                    border: "1px solid #2247b5",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {(() => {

                                                    const summary = getGroupSummary(group);

                                                    return (
                                                        <Box>
                                                            <Typography fontWeight={700}>
                                                                {group}
                                                            </Typography>

                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    display: "block",
                                                                    color: "#dbeafe",
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                ({summary.count} Nos) (Rs. {formatINR(summary.total)})
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })()}
                                            </TableCell>
                                        );
                                    })}


                                </TableRow>

                                {/* ================= SECOND HEADER ================= */}

                                <TableRow>
                                    {dynamicColumns
                                        .filter((c) =>
                                            costingRows.some(
                                                (r) => Number(r[c.key] || 0) > 0
                                            )
                                        )
                                        .map((col) => (
                                            <TableCell
                                                key={col.key}
                                                align="right"
                                                sx={{
                                                    background: "#1E3A8A",
                                                    color: "#fff",
                                                    minWidth: 150,
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap",
                                                    border: "1px solid #2247b5",
                                                }}
                                            >
                                                {(() => {

                                                    const summary = getColumnSummary(col.key);

                                                    return (
                                                        <Box>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight={600}
                                                            >
                                                                {col.label}
                                                            </Typography>

                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    display: "block",
                                                                    color: "#dbeafe",
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                ({summary.count} Nos) (Rs. {formatINR(summary.total)})
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })()}
                                            </TableCell>
                                        ))}
                                </TableRow>
                            </TableHead>

                            {/* =========================================
                                BODY
                            ========================================= */}

                            <TableBody>

                                {paginatedRows
                                    .slice(
                                        (page - 1) * rowsPerPage,
                                        page * rowsPerPage
                                    )
                                    .map((row) => {

                                        if (row.__group) {
                                            groupHeaderNo++;
                                            groupRowNo = 0;
                                        } else {
                                            groupRowNo++;
                                        }

                                        {/* ================= GROUP ROW ================= */ }

                                        if (row.__group) {

                                            const isExpanded =
                                                expandedKeys.includes(row.__key);

                                            return (
                                                <React.Fragment key={row.__key}>

                                                    <TableRow
                                                        hover
                                                        onClick={() => {

                                                            setExpandedKeys((prev) =>

                                                                isExpanded
                                                                    ? prev.filter(
                                                                        (x) => x !== row.__key
                                                                    )
                                                                    : [...prev, row.__key]
                                                            );
                                                        }}
                                                        sx={{
                                                            background: "#e0e7ff",
                                                            cursor: "pointer",
                                                        }}
                                                    >

                                                        {/* S.NO */}
                                                        <TableCell align="center">
                                                            {groupHeaderNo}
                                                        </TableCell>

                                                        {/* GROUP COLUMNS */}
                                                        {visibleGroupColumns.map((groupCol, idx) => (

                                                            <TableCell
                                                                key={groupCol}
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    color: "#1E3A8A",
                                                                }}
                                                            >
                                                                {idx === visibleGroupColumns.length - 1
                                                                    ? row.__value
                                                                    : ""}
                                                            </TableCell>

                                                        ))}

                                                        {/* EMPTY STOCK ITEM COLUMN */}
                                                        <TableCell />

                                                        {/* TOTAL COLUMN */}
                                                        <TableCell
                                                            align="right"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: "#000000",
                                                                background: "#eef2ff",
                                                            }}
                                                        >
                                                            {formatINR(row.__total)}
                                                        </TableCell>

                                                        {/* DYNAMIC EXPENSE COLUMNS */}
                                                        {dynamicColumns
                                                            .filter((c) =>
                                                                costingRows.some(
                                                                    (r) =>
                                                                        Number(r[c.key] || 0) > 0
                                                                )
                                                            )
                                                            .map((col) => (
                                                                <TableCell
                                                                    key={col.key}
                                                                    align="right"
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        background: "#eef2ff",
                                                                    }}
                                                                >
                                                                    {row[col.key]
                                                                        ? formatINR(row[col.key])
                                                                        : "-"}
                                                                </TableCell>
                                                            ))}

                                                    </TableRow>

                                                </React.Fragment>
                                            );
                                        }

                                        /* =========================================
                                           STOCK ROW
                                        ========================================= */

                                        const uniqueStockKey =
                                            [
                                                ...visibleGroupColumns.map(
                                                    (g) => row[g]
                                                ),
                                                row.Stock_Item,
                                            ].join("|");

                                        const stockExpanded =
                                            expandedStockItems.includes(
                                                uniqueStockKey
                                            );

                                        const stockDetails =
                                            itemSummary.filter((x) => {

                                                if (
                                                    x.Stock_Item !== row.Stock_Item
                                                ) {
                                                    return false;
                                                }

                                                return visibleGroupColumns.every(
                                                    (groupCol) =>
                                                        x[groupCol] === row[groupCol]
                                                );
                                            });

                                        return (
                                            <React.Fragment
                                                key={uniqueStockKey}
                                            >

                                                {/* MAIN STOCK ROW */}

                                                <TableRow
                                                    hover
                                                    onClick={() => {

                                                        setExpandedStockItems((prev) =>

                                                            stockExpanded
                                                                ? prev.filter(
                                                                    (x) =>
                                                                        x !== uniqueStockKey
                                                                )
                                                                : [
                                                                    ...prev,
                                                                    uniqueStockKey,
                                                                ]
                                                        );
                                                    }}
                                                    sx={{
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <TableCell align="center">

                                                        {row.__group
                                                            ? groupHeaderNo
                                                            : groupRowNo}

                                                    </TableCell>

                                                    {/* GROUP COLUMNS */}

                                                    {visibleGroupColumns.map(
                                                        (groupCol) => (
                                                            <TableCell
                                                                key={groupCol}
                                                            >
                                                                {row[groupCol] || "-"}
                                                            </TableCell>
                                                        )
                                                    )}

                                                    {/* STOCK ITEM */}

                                                    <TableCell
                                                        sx={{
                                                            fontWeight: 700,
                                                            color: "#1E3A8A",
                                                        }}
                                                    >
                                                        {row.Stock_Item}
                                                    </TableCell>

                                                    {/* DYNAMIC COLUMNS */}

                                                    {/* TOTAL COLUMN */}
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: "#000000",
                                                        }}
                                                    >
                                                        {formatINR(row.Total)}
                                                    </TableCell>

                                                    {/* DYNAMIC EXPENSE COLUMNS */}
                                                    {dynamicColumns
                                                        .filter((c) =>
                                                            costingRows.some(
                                                                (r) =>
                                                                    Number(r[c.key] || 0) > 0
                                                            )
                                                        )
                                                        .map((col) => (
                                                            <TableCell
                                                                key={col.key}
                                                                align="right"
                                                            >
                                                                {row[col.key]
                                                                    ? formatINR(row[col.key])
                                                                    : "-"}
                                                            </TableCell>
                                                        ))}
                                                </TableRow>

                                                {/* EXPANDED DETAILS */}

                                                {stockExpanded && (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={
                                                                1 + // S.No
                                                                visibleGroupColumns.length +
                                                                1 + // Stock Item
                                                                1 + // Total
                                                                dynamicColumns.filter(
                                                                    (c) =>
                                                                        costingRows.some(
                                                                            (r) =>
                                                                                Number(r[c.key] || 0) > 0
                                                                        )
                                                                ).length
                                                            }
                                                        >
                                                            <Table
                                                                size="small"
                                                                sx={{
                                                                    width: "70%",
                                                                    border:
                                                                        "1px solid #dbeafe",
                                                                }}
                                                            >
                                                                <TableHead>
                                                                    <TableRow
                                                                        sx={{
                                                                            background:
                                                                                "#dbeafe",
                                                                        }}
                                                                    >
                                                                        <TableCell
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            S.No
                                                                        </TableCell>

                                                                        <TableCell
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            Invoice No
                                                                        </TableCell>

                                                                        <TableCell
                                                                            align="right"
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            Amount
                                                                        </TableCell>

                                                                        <TableCell
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            Voucher Type
                                                                        </TableCell>

                                                                        <TableCell
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                            }}
                                                                        >
                                                                            Narration
                                                                        </TableCell>
                                                                    </TableRow>
                                                                </TableHead>

                                                                <TableBody>
                                                                    {stockDetails.map(
                                                                        (
                                                                            detail,
                                                                            detailIndex
                                                                        ) => (
                                                                            <TableRow
                                                                                key={
                                                                                    detailIndex
                                                                                }
                                                                            >
                                                                                <TableCell>
                                                                                    {detailIndex +
                                                                                        1}
                                                                                </TableCell>

                                                                                <TableCell>
                                                                                    {detail.payment_invoice_no ||
                                                                                        "-"}
                                                                                </TableCell>

                                                                                <TableCell align="right">
                                                                                    {formatINR(
                                                                                        Number(
                                                                                            detail.expence_value ||
                                                                                            0
                                                                                        )
                                                                                    )}
                                                                                </TableCell>

                                                                                <TableCell>
                                                                                    {detail.voucher_name ||
                                                                                        "-"}
                                                                                </TableCell>

                                                                                <TableCell>
                                                                                    {detail.remarks ||
                                                                                        "-"}
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                {!loading &&
                                    paginatedRows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={
                                                    dynamicColumns.length +
                                                    visibleGroupColumns.length +
                                                    3
                                                }
                                                align="center"
                                            >
                                                <Typography
                                                    variant="body2"
                                                    py={2}
                                                >
                                                    No Records Found
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* PAGINATION */}

                    <CommonPagination
                        totalRows={costingRows.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </Box>
            </AppLayout>

            <Dialog
                open={groupDialogOpen}
                onClose={() => setGroupDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    Group By Columns
                </DialogTitle>

                <DialogContent>

                    {[0, 1, 2].map((level) => (

                        <TextField
                            key={level}
                            select
                            fullWidth
                            margin="dense"
                            label={`Level ${level + 1}`}
                            value={pendingGrouping[level] || ""}
                            onChange={(e) => {

                                const copy = [...pendingGrouping];

                                copy[level] = e.target.value;

                                setPendingGrouping(copy);
                            }}
                        >
                            <MenuItem value="">
                                No Grouping
                            </MenuItem>

                            {groupableColumns.map((col) => (
                                <MenuItem
                                    key={col}
                                    value={col}
                                    disabled={
                                        pendingGrouping.includes(col) &&
                                        pendingGrouping[level] !== col
                                    }
                                >
                                    {col.replace(/_/g, " ")}
                                </MenuItem>
                            ))}

                        </TextField>
                    ))}
                </DialogContent>

                <DialogActions>

                    <Button
                        onClick={() =>
                            setGroupDialogOpen(false)
                        }
                    >
                        Cancel
                    </Button>

                    <Button
                        variant="contained"
                        onClick={() => {

                            setGrouping(
                                pendingGrouping.filter(Boolean)
                            );

                            setExpandedKeys([]);

                            setGroupDialogOpen(false);
                        }}
                    >
                        Apply
                    </Button>

                </DialogActions>
            </Dialog>

            <HeaderFilterMenu
                anchorEl={filterAnchor}
                open={Boolean(filterAnchor)}
                onClose={() => setFilterAnchor(null)}
                columnLabel="Stock Item"
                options={Array.from(
                    new Set(costingRows.map((x) => x.Stock_Item))
                )
                    .filter(Boolean)
                    .map(String)}
                selectedValues={stockFilter}
                onFilterChange={(selected: string[] | undefined) => setStockFilter(selected)}
            />

            <HeaderFilterMenu
                anchorEl={columnFilterAnchor}
                open={Boolean(columnFilterAnchor)}
                onClose={() => setColumnFilterAnchor(null)}
                columnLabel={activeFilterColumn.replace(/_/g, " ")}
                options={
                    activeFilterColumn
                        ? Array.from(
                              new Set(
                                  costingRows.map(
                                      (x) => x[activeFilterColumn]
                                  )
                              )
                          )
                              .filter(Boolean)
                              .map(String)
                        : []
                }
                selectedValues={
                    activeFilterColumn
                        ? columnFilters[activeFilterColumn]
                        : undefined
                }
                onFilterChange={(selected: string[] | undefined) => {
                    if (activeFilterColumn) {
                        setColumnFilters((prev) => ({
                            ...prev,
                            [activeFilterColumn]: selected,
                        }));
                    }
                }}
            />

            {/* /////// TEMPLATE /////// */}
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

export default CostingReport;