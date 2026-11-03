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
    Switch,
    Typography,
    Tooltip,
    CircularProgress,
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";

import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
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

const formatCreatedOn = (dateString: any): string => {
  if (!dateString) return "-";
  
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
import { useNumericalFilter } from "../../hooks/useNumericalFilter";
import { NumericalFilterMenu } from "../../Components/NumericalFilterMenu";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import {
    StaffBasedCountReportService,
} from "../../services/staffBasedReport.services";

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
    isNumeric?: boolean;
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
            <IconButton
                size="small"
                {...listeners}
                {...attributes}
            >
                <DragIndicatorIcon fontSize="small" />
            </IconButton>

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

            <Switch
                checked={column.enabled}
                onChange={() =>
                    onToggle(column.key)
                }
                sx={{
                    "& .MuiSwitch-switchBase.Mui-checked":
                    {
                        color: "#1E3A8A",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                    {
                        backgroundColor:
                            "#b5b9c4",
                    },
                    "& .MuiSwitch-track": {
                        backgroundColor:
                            "#CBD5E1",
                    },
                }}
            />
        </Box>
    );
};

/* ================= HELPERS ================= */

const buildColumns = (): ColumnConfig[] => [
    {
        key: "Staff_Name",
        label: "Staff Name",
        enabled: true,
        order: 1,
    },
    {
        key: "Count",
        label: "Count",
        enabled: true,
        order: 2,
        isNumeric: true,
    },
    {
        key: "Bill_type",
        label: "Bill Type",
        enabled: false,
        order: 3,
    },
    {
        key: "Stock_Journal_Voucher_type",
        label: "Voucher Type",
        enabled: false,
        order: 4,
    },
    {
        key: "Invoice_Month",
        label: "Invoice Month",
        enabled: false,
        order: 5,
    },
    {
        key: "Invoice_Year",
        label: "Invoice Year",
        enabled: false,
        order: 6,
    },
    {
        key: "Month_Year",
        label: "Month Year",
        enabled: false,
        order: 7,
    },
    {
        key: "Narration",
        label: "Narration",
        enabled: false,
        order: 8,
    },
    {
        key: "Journal_no",
        label: "Journal No",
        enabled: false,
        order: 9,
    },
    {
        key: "Invoice_no",
        label: "Invoice No",
        enabled: false,
        order: 10,
    },
    {
        key: "Stock_Journal_date",
        label: "Stock Journal Date",
        enabled: false,
        order: 11,
    },
    {
        key: "Created_on",
        label: "Created On",
        enabled: false,
        order: 12,
    },
];

const StaffBasedCountReport: React.FC =
    () => {
        const today =
            dayjs().format("YYYY-MM-DD");

        const { toggleMode, setToggleMode, } = useToggleMode();

        const HEADER_HEIGHT = 36;

        /* ================= STATE ================= */

        const [rawRows, setRawRows] =
            useState<any[]>([]);

        const [columns, setColumns] =
            useState<ColumnConfig[]>(buildColumns());

        const [page, setPage] = useState(1);

        const [rowsPerPage, setRowsPerPage,] = useState(100);

        const [loading, setLoading] = useState(false);

        const [drawerOpen, setDrawerOpen,] = useState(false);

        const [fromDate, setFromDate] = useState(today);

        const [toDate, setToDate] = useState(today);

        const [settingsAnchor, setSettingsAnchor,] =
            useState<null | HTMLElement>(null);

        const [filters, setFilters,] =
            useState({
                Date: {
                    from: today,
                    to: today,
                },
            });

        /* ================= HEADER FILTER ================= */

        const [filterAnchor, setFilterAnchor] =
            useState<null | HTMLElement>(null);

        const [activeHeader, setActiveHeader] =
            useState<string>("");

        const [headerFilters, setHeaderFilters] =
            useState<Record<string, string[] | undefined>>({});

        /* ================= API LOAD ================= */

        useEffect(() => {
            setLoading(true);

            StaffBasedCountReportService
                .getStaffBasedCountReport({
                    Fromdate:
                        filters.Date.from,
                    Todate:
                        filters.Date.to,
                })
                .then((res) => {
                    setRawRows(
                        res.data.data || []
                    );
                })
                .finally(() => {
                    setLoading(false);
                });
        }, [
            filters.Date.from,
            filters.Date.to,
        ]);

        /* ================= HEADER FILTER DATA ================= */

        const filteredRows = useMemo(() => {
            return rawRows.filter((row) => {
                return Object.entries(headerFilters).every(
                    ([key, selected]) => {
                        if (selected === undefined) {
                            return true;
                        }

                        // FIX FIELD MAPPING
                        const actualKey =
                            key === "Staff_Name"
                                ? "Created_By"
                                : key;

                        const value =
                            row[actualKey] ?? "-";

                        return selected.includes(
                            String(value)
                        );
                    }
                );
            });
        }, [rawRows, headerFilters]);

        /* ================= AGGREGATION ================= */

        const processedRows =
            useMemo(() => {
                if (!filteredRows.length)
                    return [];

                const enabledCols =
                    columns
                        .filter(
                            (c) =>
                                c.enabled &&
                                ![
                                    "Staff_Name",
                                    "Count",
                                ].includes(
                                    c.key
                                )
                        )
                        .map(
                            (c) => c.key
                        );

                /* ========= ABSTRACT ========= */

                if (
                    toggleMode ===
                    "Abstract"
                ) {
                    const grouped =
                        new Map<
                            string,
                            any
                        >();

                    filteredRows.forEach(
                        (
                            row: any
                        ) => {
                            const key =
                                [
                                    row.Created_By,
                                    ...enabledCols.map(
                                        (
                                            col
                                        ) =>
                                            row[
                                            col
                                            ] ??
                                            "-"
                                    ),
                                ].join(
                                    "|"
                                );

                            if (
                                !grouped.has(
                                    key
                                )
                            ) {
                                const obj: any =
                                {
                                    Staff_Name:
                                        row.Created_By,
                                    Count: 0,
                                };

                                enabledCols.forEach(
                                    (
                                        col
                                    ) => {
                                        obj[
                                            col
                                        ] =
                                            row[
                                            col
                                            ] ??
                                            "-";
                                    }
                                );

                                grouped.set(
                                    key,
                                    obj
                                );
                            }

                            grouped.get(
                                key
                            ).Count += 1;
                        }
                    );

                    return Array.from(
                        grouped.values()
                    );
                }

                /* ========= EXPANDED ========= */

                const grouped =
                    new Map<
                        string,
                        any
                    >();

                filteredRows.forEach(
                    (row: any) => {
                        const staff =
                            row.Created_By ??
                            "Unknown";

                        if (
                            !grouped.has(
                                staff
                            )
                        ) {
                            grouped.set(
                                staff,
                                {
                                    Staff_Name:
                                        staff,
                                    Total_Count:
                                        0,
                                }
                            );
                        }

                        const obj =
                            grouped.get(
                                staff
                            );

                        obj.Total_Count +=
                            1;

                        enabledCols.forEach(
                            (
                                col
                            ) => {
                                const val =
                                    row[
                                    col
                                    ];

                                if (
                                    !val
                                )
                                    return;

                                if (
                                    !obj[
                                    val
                                    ]
                                ) {
                                    obj[
                                        val
                                    ] = 0;
                                }

                                obj[
                                    val
                                ] += 1;
                            }
                        );
                    }
                );

                return Array.from(
                    grouped.values()
                );
            }, [
                filteredRows,
                columns,
                toggleMode,
            ]);

        const filterOptions = useMemo(() => {
            if (!activeHeader) {
                return [];
            }

            const actualKey =
                activeHeader === "Staff_Name"
                    ? "Created_By"
                    : activeHeader;

            return Array.from(
                new Set(
                    rawRows
                        .map(
                            (row) =>
                                row[actualKey] ?? "-"
                        )
                        .filter(Boolean)
                )
            );
        }, [rawRows, activeHeader]);

        /* ================= DYNAMIC COLUMNS ================= */

        const enabledColumns =
            useMemo(() => {
                /* ===== ABSTRACT ===== */
                if (
                    toggleMode ===
                    "Abstract"
                ) {
                    return [...columns]
                        .filter(
                            (c) =>
                                c.enabled
                        )
                        .sort(
                            (
                                a,
                                b
                            ) =>
                                a.order -
                                b.order
                        );
                }

                /* ===== EXPANDED ===== */

                const dynamicKeys =
                    new Set<string>();

                processedRows.forEach(
                    (
                        row: any
                    ) => {
                        Object.keys(
                            row
                        ).forEach(
                            (
                                key
                            ) => {
                                if (
                                    ![
                                        "Staff_Name",
                                        "Total_Count",
                                    ].includes(
                                        key
                                    )
                                ) {
                                    dynamicKeys.add(
                                        key
                                    );
                                }
                            }
                        );
                    }
                );

                return [
                    {
                        key: "Staff_Name",
                        label:
                            "Staff Name",
                        enabled: true,
                        order: 1,
                    },
                    {
                        key: "Total_Count",
                        label:
                            "Total Count",
                        enabled: true,
                        order: 2,
                        isNumeric:
                            true,
                    },
                    ...Array.from(
                        dynamicKeys
                    ).map(
                        (
                            k,
                            i
                        ) => ({
                            key: k,
                            label: k,
                            enabled: true,
                            order:
                                i + 3,
                            isNumeric:
                                true,
                        })
                    ),
                ];
            }, [
                columns,
                processedRows,
                toggleMode,
            ]);

        /* ================= SORT ================= */

        const [
            sortConfig,
            setSortConfig,
        ] = useState<{
            key: string | null;
            order:
            | "asc"
            | "desc";
        }>({
            key: null,
            order: "asc",
        });

        const numericKeys = useMemo(() => {
            return enabledColumns.filter((c) => c.isNumeric).map((c) => c.key);
        }, [enabledColumns]);

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
        } = useNumericalFilter(processedRows, numericKeys);

        const sortedRows =
            useMemo(() => {
                if (numSortConfig) {
                    return numFilteredAndSortedRows;
                }

                if (
                    !sortConfig.key
                )
                    return numFilteredAndSortedRows;

                return [
                    ...numFilteredAndSortedRows,
                ].sort(
                    (
                        a,
                        b
                    ) => {
                        const aVal =
                            a[
                            sortConfig.key!
                            ];

                        const bVal =
                            b[
                            sortConfig.key!
                            ];

                        if (
                            aVal ==
                            null
                        )
                            return 1;

                        if (
                            bVal ==
                            null
                        )
                            return -1;

                        if (
                            typeof aVal ===
                            "number" &&
                            typeof bVal ===
                            "number"
                        ) {
                            return sortConfig.order ===
                                "asc"
                                ? aVal -
                                bVal
                                : bVal -
                                aVal;
                        }

                        return sortConfig.order ===
                            "asc"
                            ? String(
                                aVal
                            ).localeCompare(
                                String(
                                    bVal
                                )
                            )
                            : String(
                                bVal
                            ).localeCompare(
                                String(
                                    aVal
                                )
                            );
                    }
                );
            }, [
                numFilteredAndSortedRows,
                numSortConfig,
                sortConfig,
                processedRows
            ]);

        /* ================= PAGINATION ================= */

        const finalRows =
            useMemo(() => {
                const start =
                    (page -
                        1) *
                    rowsPerPage;

                const end =
                    start +
                    rowsPerPage;

                return sortedRows.slice(
                    start,
                    end
                );
            }, [
                sortedRows,
                page,
                rowsPerPage,
            ]);

        /* ================= DND ================= */

        const sensors =
            useSensors(
                useSensor(
                    PointerSensor,
                    {
                        activationConstraint:
                        {
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
                active.id ===
                over.id
            )
                return;

            setColumns(
                (cols) => {
                    const enabled =
                        cols.filter(
                            (
                                c
                            ) =>
                                c.enabled
                        );

                    const disabled =
                        cols.filter(
                            (
                                c
                            ) =>
                                !c.enabled
                        );

                    const activeList =
                        enabled.some(
                            (
                                c
                            ) =>
                                c.key ===
                                active.id
                        )
                            ? enabled
                            : disabled;

                    const oldIndex =
                        activeList.findIndex(
                            (
                                c
                            ) =>
                                c.key ===
                                active.id
                        );

                    const newIndex =
                        activeList.findIndex(
                            (
                                c
                            ) =>
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
                        (
                            c,
                            i
                        ) => {
                            c.order =
                                i;
                        }
                    );

                    return [
                        ...reordered,
                        ...(!activeList[0]
                            ?.enabled
                            ? enabled
                            : disabled),
                    ];
                }
            );
        };

        const abstractTotalCount = useMemo(() => {
            if (toggleMode !== "Abstract") {
                return 0;
            }

            return processedRows.reduce(
                (sum, row) => sum + (row.Count || 0),
                0
            );
        }, [processedRows, toggleMode]);

        /* ================= EXPORT ================= */

        const exportColumns =
            enabledColumns.map(
                (c) => ({
                    key: c.key,
                    label:
                        c.label,
                })
            );

        const exportRows =
            sortedRows.map(
                (row: any) => {
                    const obj: any =
                        {};

                    exportColumns.forEach(
                        (
                            col
                        ) => {
                            if (col.key === "Created_on" && row[col.key]) {
                                obj[col.label] = formatCreatedOn(row[col.key]);
                            } else {
                                obj[col.label] = row[col.key] ?? "";
                            }
                        }
                    );

                    return obj;
                }
            );

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
                    `StaffBasedCount_${toggleMode}`
                );

                XLSX.writeFile(
                    workbook,
                    `StaffBasedCount_${toggleMode}_${dayjs().format(
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
                    `Staff Based Count Report (${toggleMode})`,
                    14,
                    10
                );

                autoTable(
                    doc,
                    {
                        startY: 15,
                        head: [
                            exportColumns.map(
                                (
                                    c
                                ) =>
                                    c.label
                            ),
                        ],
                        body: exportRows.map(
                            (
                                r
                            ) =>
                                Object.values(
                                    r
                                )
                        ),
                        styles: {
                            fontSize: 7,
                        },
                        headStyles:
                        {
                            fillColor:
                                [
                                    30,
                                    58,
                                    138,
                                ],
                        },
                    }
                );

                doc.save(
                    `StaffBasedCount_${toggleMode}.pdf`
                );
            };

        /* ================= RESET ================= */

        const handleResetSettings =
            () => {
                setColumns(
                    buildColumns()
                );

                setPage(1);
            };

        /* ================= COLUMN TOGGLE ================= */

        const handleToggleColumn =
            (
                key: string
            ) => {
                setColumns(
                    (
                        cols
                    ) =>
                        cols.map(
                            (
                                c
                            ) =>
                                c.key ===
                                    key
                                    ? {
                                        ...c,
                                        enabled:
                                            !c.enabled,
                                    }
                                    : c
                        )
                );
            };

        /* ================= RENDER ================= */

        return (
            <>
                <PageHeader
                    toggleMode={toggleMode}
                    onToggleChange={setToggleMode}
                    onExportExcel={
                        handleExportExcel
                    }
                    onExportPDF={
                        handleExportPDF
                    }
                    settingsSlot={
                        <Box
                            display="flex"
                            gap={1}
                        >
                            <Tooltip title="Table Settings">
                                <IconButton
                                    size="small"
                                    onClick={(
                                        e
                                    ) =>
                                        setSettingsAnchor(
                                            e.currentTarget
                                        )
                                    }
                                    sx={{
                                        height: 24,
                                        width: 24,
                                        backgroundColor:
                                            "#fff",
                                        borderRadius:
                                            0.5,
                                    }}
                                >
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    }
                />

                {/* FILTER DRAWER */}

                <ReportFilterDrawer
                    open={
                        drawerOpen
                    }
                    onToggle={() =>
                        setDrawerOpen(
                            (
                                p
                            ) =>
                                !p
                        )
                    }
                    onClose={() =>
                        setDrawerOpen(
                            false
                        )
                    }
                    fromDate={
                        fromDate
                    }
                    toDate={toDate}
                    onFromDateChange={
                        setFromDate
                    }
                    onToDateChange={
                        setToDate
                    }
                    onApply={() =>
                        setFilters({
                            Date: {
                                from:
                                    fromDate,
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
                        {loading && (
                            <Box
                                sx={{
                                    position:
                                        "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background:
                                        "rgba(255,255,255,0.5)",
                                    zIndex: 10,
                                    display:
                                        "flex",
                                    alignItems:
                                        "center",
                                    justifyContent:
                                        "center",
                                }}
                            >
                                <CircularProgress
                                    size={
                                        40
                                    }
                                />
                            </Box>
                        )}

                        <TableContainer
                            component={
                                Paper
                            }
                            sx={{
                                maxHeight:
                                    "calc(100vh - 100px)",
                                "& th, & td":
                                {
                                    fontSize:
                                        "0.75rem",
                                },
                            }}
                        >
                            <Table size="small">
                                <TableHead
                                    sx={{
                                        background:
                                            "#1E3A8A",
                                        position:
                                            "sticky",
                                        top: 0,
                                        zIndex: 3,
                                        height:
                                            HEADER_HEIGHT,
                                    }}
                                >
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                color:
                                                    "#fff",
                                                fontWeight: 600,
                                            }}
                                        >
                                            S.No
                                        </TableCell>

                                        {enabledColumns.map((c) => {
                                            const isSorted =
                                                sortConfig.key === c.key;

                                            return (
                                                <TableCell
                                                    key={c.key}
                                                    sx={{
                                                        color: "#fff",
                                                        fontWeight: 600,
                                                        cursor: "pointer",
                                                        userSelect: "none",
                                                    }}
                                                >
                                                    <Box
                                                        display="flex"
                                                        alignItems="center"
                                                        justifyContent="space-between"
                                                        width="100%"
                                                    >
                                                        {/* HEADER CLICK = FILTER */}
                                                        <Box
                                                            display="flex"
                                                            alignItems="center"
                                                            gap={0.5}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (c.isNumeric) {
                                                                    openNumFilter(e, c.key);
                                                                } else {
                                                                    setActiveHeader(c.key);
                                                                    setFilterAnchor(
                                                                        e.currentTarget as HTMLElement
                                                                    );
                                                                }
                                                            }}
                                                            sx={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            <Typography
                                                                sx={{
                                                                    color: "#fff",
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                {c.label}
                                                            </Typography>
                                                        </Box>

                                                        {/* SORT ICON */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (c.isNumeric) {
                                                                    setSortConfig({ key: null, order: "asc" });
                                                                    handleNumSort(c.key);
                                                                } else {
                                                                    setSortConfig(
                                                                        (prev) => ({
                                                                            key: c.key,
                                                                            order:
                                                                                prev.key ===
                                                                                    c.key &&
                                                                                    prev.order ===
                                                                                    "asc"
                                                                                    ? "desc"
                                                                                    : "asc",
                                                                        })
                                                                    );
                                                                }
                                                            }}
                                                            sx={{
                                                                p: 0,
                                                                color: "#fff",
                                                            }}
                                                        >
                                                            {c.isNumeric && numSortConfig?.key === c.key ? (
                                                                numSortConfig.direction === "asc" ? (
                                                                    <ArrowDropUpIcon fontSize="small" />
                                                                ) : (
                                                                    <ArrowDropDownIcon fontSize="small" />
                                                                )
                                                            ) : !c.isNumeric && isSorted ? (
                                                                sortConfig.order === "asc" ? (
                                                                    <ArrowDropUpIcon fontSize="small" />
                                                                ) : (
                                                                    <ArrowDropDownIcon fontSize="small" />
                                                                )
                                                            ) : (
                                                                <ArrowDropDownIcon sx={{ opacity: 0.4 }} fontSize="small" />
                                                            )}
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {/* ABSTRACT TOTAL ROW */}
                                    {toggleMode === "Abstract" && (
                                        <TableRow
                                            sx={{
                                                backgroundColor: "#E8EEF9",
                                                position: "sticky",
                                                top: HEADER_HEIGHT,
                                                zIndex: 2,
                                            }}
                                        >
                                            <TableCell
                                                sx={{
                                                    fontWeight: 700,
                                                }}
                                            >
                                            </TableCell>

                                            {enabledColumns.map((c) => (
                                                <TableCell
                                                    key={c.key}
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: "#1E3A8A",
                                                    }}
                                                >
                                                    {c.key ===
                                                        "Staff_Name"
                                                        ? "TOTAL"
                                                        : c.key ===
                                                            "Count"
                                                            ? abstractTotalCount
                                                            : ""}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )}

                                    {finalRows.map(
                                        (
                                            row,
                                            index
                                        ) => (
                                            <TableRow
                                                key={
                                                    index
                                                }
                                            >
                                                <TableCell>
                                                    {(page - 1) *
                                                        rowsPerPage +
                                                        index +
                                                        1}
                                                </TableCell>

                                                {enabledColumns.map(
                                                    (
                                                        c
                                                    ) => (
                                                        <TableCell
                                                            key={
                                                                c.key
                                                            }
                                                        >
                                                             {c.key === "Created_on"
                                                                 ? formatCreatedOn(row[c.key])
                                                                 : (row[c.key] ?? 0)}
                                                        </TableCell>
                                                    )
                                                )}
                                            </TableRow>
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <HeaderFilterMenu
                            anchorEl={filterAnchor}
                            open={Boolean(filterAnchor)}
                            onClose={() => setFilterAnchor(null)}
                            columnLabel={activeHeader || undefined}
                            options={filterOptions.map(String)}
                            selectedValues={activeHeader ? headerFilters[activeHeader] : undefined}
                            onFilterChange={(newSelected) => {
                                if (!activeHeader) return;
                                setHeaderFilters((prev) => {
                                    const copy = { ...prev };
                                    if (newSelected === undefined) {
                                        delete copy[activeHeader];
                                    } else {
                                        copy[activeHeader] = newSelected;
                                    }
                                    return copy;
                                });
                                setPage(1);
                            }}
                        />

                        <CommonPagination
                            totalRows={
                                sortedRows.length
                            }
                            page={
                                page
                            }
                            rowsPerPage={
                                rowsPerPage
                            }
                            onPageChange={
                                setPage
                            }
                            onRowsPerPageChange={
                                setRowsPerPage
                            }
                        />
                    </Box>
                </AppLayout>

                {/* COLUMN SETTINGS */}

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
                        minWidth={
                            320
                        }
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            justifyContent="space-between"
                            mb={1}
                        >
                            <Typography fontWeight={600}>
                                Column
                                Settings
                            </Typography>

                            <Typography
                                sx={{
                                    cursor:
                                        "pointer",
                                    color:
                                        "#0284C7",
                                    fontSize:
                                        "0.75rem",
                                }}
                                onClick={
                                    handleResetSettings
                                }
                            >
                                Reset
                            </Typography>
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
                                fontSize="0.7rem"
                                fontWeight={600}
                                mb={
                                    1
                                }
                            >
                                Enabled
                                Columns
                            </Typography>

                            <SortableContext
                                items={columns
                                    .filter(
                                        (
                                            c
                                        ) =>
                                            c.enabled
                                    )
                                    .map(
                                        (
                                            c
                                        ) =>
                                            c.key
                                    )}
                                strategy={
                                    verticalListSortingStrategy
                                }
                            >
                                {columns
                                    .filter(
                                        (
                                            c
                                        ) =>
                                            c.enabled
                                    )
                                    .sort(
                                        (
                                            a,
                                            b
                                        ) =>
                                            a.order -
                                            b.order
                                    )
                                    .map(
                                        (
                                            c
                                        ) => (
                                            <SortableColumnRow
                                                key={
                                                    c.key
                                                }
                                                column={
                                                    c
                                                }
                                                onToggle={
                                                    handleToggleColumn
                                                }
                                            />
                                        )
                                    )}
                            </SortableContext>

                            <Typography
                                fontSize="0.7rem"
                                fontWeight={600}
                                mt={2}
                                mb={
                                    1
                                }
                            >
                                Disabled
                                Columns
                            </Typography>

                            <SortableContext
                                items={columns
                                    .filter(
                                        (
                                            c
                                        ) =>
                                            !c.enabled
                                    )
                                    .map(
                                        (
                                            c
                                        ) =>
                                            c.key
                                    )}
                                strategy={
                                    verticalListSortingStrategy
                                }
                            >
                                {columns
                                    .filter(
                                        (
                                            c
                                        ) =>
                                            !c.enabled
                                    )
                                    .sort(
                                        (
                                            a,
                                            b
                                        ) =>
                                            a.order -
                                            b.order
                                    )
                                    .map(
                                        (
                                            c
                                        ) => (
                                            <SortableColumnRow
                                                key={
                                                    c.key
                                                }
                                                column={
                                                    c
                                                }
                                                onToggle={
                                                    handleToggleColumn
                                                }
                                            />
                                        )
                                    )}
                            </SortableContext>
                        </DndContext>
                    </Box>
                </Menu>

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

export default StaffBasedCountReport;