import React, { useState, useEffect, useMemo } from "react";
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
  Menu,
  Button,
  TextField,
  Tooltip,
  IconButton,
  Typography,
  Switch,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import dayjs from "dayjs";
import SettingsIcon from "@mui/icons-material/Settings";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import AppLayout, { useToggleMode } from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import { toast } from "react-toastify";
import CommonPagination from "../../Components/CommonPagination";
import {
  OnlineSalesReportService,
  OnlineSalesReportItemService,
} from "../../services/OnlineSalesReport.service";
import { DndContext, closestCenter, } from "@dnd-kit/core";
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { SettingsService } from "../../services/reportSettings.services";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";

type ColumnConfig = {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
  groupBy?: number;
  type?: "date" | "number" | "text";
};

const isSnoCol = (col: { key?: string; label?: string }): boolean => {
  const normKey = (col.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normLabel = (col.label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    normKey === "sno" ||
    normKey === "slno" ||
    normKey === "serialno" ||
    normKey === "rowno" ||
    normLabel === "sno" ||
    normLabel === "slno" ||
    normLabel === "serialno" ||
    normLabel === "rowno"
  );
};

const OnlineSalesReportPage: React.FC = () => {
  const { toggleMode, setToggleMode } = useToggleMode();

  const [rawAbstract, setRawAbstract] = useState<any[]>([]);
  const [rawExpanded, setRawExpanded] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [expandedPage, setExpandedPage] = useState(1);

  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const [settingsAnchor, setSettingsAnchor] =
    useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const today = dayjs().format("YYYY-MM-DD");
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({
    Ledger_Date: {
      from: today,
      to: today,
    },
  });

  const [templateConfig, setTemplateConfig] = useState<{
    abstract: ColumnConfig[];
    expanded: ColumnConfig[];
  } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isEditTemplate, setIsEditTemplate] = useState(false);

  const ABSTRACT_INITIAL_COLUMNS: ColumnConfig[] = [
    { key: "sno", label: "S.No", enabled: true, order: 0 },
    { key: "Ledger_Date", label: "Date", enabled: true, order: 1, type: "date" },
    { key: "invoice_no", label: "Invoice", enabled: true, order: 2 },
    { key: "Retailer_Name", label: "Customer", enabled: true, order: 3 },
    { key: "Item_Count", label: "Count", enabled: true, order: 4, type: "number" },
    { key: "Total_Invoice_value", label: "Amount", enabled: true, order: 5, type: "number" },
    { key: "Created_on", label: "Created On", enabled: true, order: 6, type: "date" },
  ];

  const EXPANDED_INITIAL_COLUMNS: ColumnConfig[] = [
    { key: "sno", label: "S.No", enabled: true, order: 0 },
    { key: "Ledger_Date", label: "Date", enabled: true, order: 1, type: "date" },
    { key: "invoice_no", label: "Invoice", enabled: true, order: 2 },
    { key: "Retailer_Name", label: "Customer", enabled: true, order: 3 },
    { key: "Product_Name", label: "Product", enabled: true, order: 4 },
    { key: "Bill_Qty", label: "Quantity", enabled: true, order: 5, type: "number" },
    { key: "Rate", label: "Rate", enabled: true, order: 6, type: "number" },
    { key: "Total_Invoice_value", label: "Amount", enabled: true, order: 7, type: "number" },
    { key: "Created_on", label: "Created On", enabled: true, order: 8, type: "date" },
  ];

  const [abstractColumns, setAbstractColumns] = useState<ColumnConfig[]>(ABSTRACT_INITIAL_COLUMNS);
  const [expandedColumns, setExpandedColumns] = useState<ColumnConfig[]>(EXPANDED_INITIAL_COLUMNS);

  const columns =
    toggleMode === "Abstract"
      ? abstractColumns
      : expandedColumns;


  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [parentReportName, setParentReportName] = useState("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [tempFromDate, setTempFromDate] = useState(columnFilters?.Ledger_Date?.from || today);
  const [tempToDate, setTempToDate] = useState(columnFilters?.Ledger_Date?.to || today);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (drawerOpen) {
      setTempFromDate(columnFilters?.Ledger_Date?.from || today);
      setTempToDate(columnFilters?.Ledger_Date?.to || today);
    }
  }, [drawerOpen, columnFilters, today]);
  const spConfig = {
    abstractSP: "Reporting_Online_Sales_VW",
    expandedSP: "Reporting_Online_Sales_Item_VW"
  };

  const setColumns =
    toggleMode === "Abstract"
      ? setAbstractColumns
      : setExpandedColumns;

  const loadTemplate = async (
    reportId: number,
    templateName?: string
  ) => {
    try {
      setTemplateLoading(true);

      // ✅ mark selected template as edit mode
      setSelectedTemplateId(reportId);
      setIsEditTemplate(true);

      // ✅ preload existing template name
      if (templateName) {
        setReportName(templateName);
      }

      const absRes = await SettingsService.getReportEditData({
        reportId,
        typeId: 1
      });

      const expRes = await SettingsService.getReportEditData({
        reportId,
        typeId: 2
      });

      const abstractCols = absRes?.data?.data?.columns || [];
      const expandedCols = expRes?.data?.data?.columns || [];

      setTemplateConfig({
        abstract: abstractCols,
        expanded: expandedCols
      });

      // ✅ Apply template immediately
      setAbstractColumns(
        applyTemplateToColumns(
          ABSTRACT_INITIAL_COLUMNS,
          abstractCols
        )
      );

      setExpandedColumns(
        applyTemplateToColumns(
          EXPANDED_INITIAL_COLUMNS,
          expandedCols
        )
      );

    } catch (err) {
      console.error(err);
      toast.error("Failed to load template ❌");
    } finally {
      setTemplateLoading(false);
    }
  };

  const applyTemplateToColumns = (
    baseCols: ColumnConfig[],
    templateCols: ColumnConfig[]
  ): ColumnConfig[] => {
    // 1. Deduplicate template columns (in case DB already has duplicates)
    const seenTemplateKeys = new Set<string>();
    const uniqueTemplateCols: ColumnConfig[] = [];

    for (const t of templateCols) {
      if (isSnoCol(t)) continue; // Never keep any S.No in template columns array
      const normKey = (t.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!normKey || seenTemplateKeys.has(normKey)) continue;
      seenTemplateKeys.add(normKey);
      uniqueTemplateCols.push(t);
    }

    // 2. Find template-level S.No configuration if present
    const templateSno = templateCols.find((t) => isSnoCol(t));

    const snoCol: ColumnConfig = {
      key: "sno",
      label: "S.No",
      enabled: templateSno ? templateSno.enabled : true,
      order: 0,
    };

    // 3. Merge base columns (for types etc.)
    const merged = uniqueTemplateCols.map((col) => {
      const base = baseCols.find(
        (b) =>
          (b.key || "").toLowerCase().replace(/[^a-z0-9]/g, "") ===
          (col.key || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      );

      return {
        key: col.key,
        label: col.label || base?.label || col.key,
        enabled: col.enabled,
        order: col.order ?? 0,
        groupBy: col.groupBy ?? 0,
        type: base?.type,
      };
    });

    // 4. Add missing base columns as disabled (excluding sno)
    const missingBase = baseCols
      .filter(
        (b) =>
          !isSnoCol(b) &&
          !seenTemplateKeys.has(
            (b.key || "").toLowerCase().replace(/[^a-z0-9]/g, "")
          )
      )
      .map((b) => ({
        ...b,
        enabled: false,
      }));

    return [snoCol, ...merged, ...missingBase];
  };

  const enabledColumns = useMemo(() => {
    const seen = new Set<string>();
    let hasSno = false;

    return columns
      .filter((c) => {
        if (!c.enabled) return false;

        // Ensure strictly only ONE serial number column is ever enabled/rendered
        if (isSnoCol(c)) {
          if (hasSno) return false;
          hasSno = true;
          return true;
        }

        const normKey = (c.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seen.has(normKey)) return false;
        seen.add(normKey);
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [columns]);

  const handleExportPDF = () => {
    const rows =
      toggleMode === "Abstract"
        ? filteredAbstract
        : filteredExpanded;

    const headers = enabledColumns.map(c => c.label);

    const data = rows.map(row =>
      enabledColumns.map(c => {
        switch (c.key) {
          case "Ledger_Date":
            return dayjs(row.Ledger_Date).format("DD/MM/YYYY");
          case "Total_Invoice_value":
            return toggleMode === "Abstract"
              ? row.Total_Invoice_value
              : row.Amount;
          case "Created_on":
            return formatISTDateTime(row.Created_on);
          default:
            return row[c.key] ?? "";
        }
      })
    );

    exportToPDF(
      `Online Sales Report (${toggleMode})`,
      headers,
      data
    );
  };

  const handleExportExcel = () => {
    const rows =
      toggleMode === "Abstract"
        ? filteredAbstract
        : filteredExpanded;

    const headers = enabledColumns.map(c => c.label);

    const data = rows.map(row =>
      enabledColumns.map(c => {
        switch (c.key) {
          case "Ledger_Date":
            return dayjs(row.Ledger_Date).format("DD/MM/YYYY");
          case "Total_Invoice_value":
            return toggleMode === "Abstract"
              ? row.Total_Invoice_value
              : row.Amount;
          case "Created_on":
            return formatISTDateTime(row.Created_on);
          default:
            return row[c.key] ?? "";
        }
      })
    );

    exportToExcel(
      `Online Sales Report (${toggleMode})`,
      headers,
      data
    );
  };

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value);
  };

  const mergeColumns = (
    newCols: ColumnConfig[],
    currentCols: ColumnConfig[]
  ) => {
    let hasSno = false;
    const seen = new Set<string>();
    const deduplicatedNewCols = newCols.filter((col) => {
      if (isSnoCol(col)) {
        if (hasSno) return false;
        hasSno = true;
        return true;
      }
      const normKey = (col.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!normKey || seen.has(normKey)) return false;
      seen.add(normKey);
      return true;
    });

    return deduplicatedNewCols.map((col) => {
      const existing = currentCols.find(
        (c) =>
          (c.key || "").toLowerCase().replace(/[^a-z0-9]/g, "") ===
          (col.key || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      );

      return {
        ...col,
        enabled: existing ? existing.enabled : col.enabled,
        order: existing ? existing.order : col.order,
        groupBy: existing ? existing.groupBy : col.groupBy,
      };
    });
  };

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const fromDate = columnFilters?.Ledger_Date?.from || dayjs().format("YYYY-MM-DD");
    const toDate = columnFilters?.Ledger_Date?.to || dayjs().format("YYYY-MM-DD");

    setDataLoading(true);

    if (toggleMode === "Abstract") {
      OnlineSalesReportService.getReports({ Fromdate: fromDate, Todate: toDate })
        .then((res) => {
          const rows = res.data.data || [];
          setRawAbstract(rows);

          let cols = generateColumns(rows, ABSTRACT_INITIAL_COLUMNS);

          if (templateConfig?.abstract) {
            cols = applyTemplateToColumns(cols, templateConfig.abstract);
          }

          setAbstractColumns(prev => mergeColumns(cols, prev));
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to load data ❌");
        })
        .finally(() => setDataLoading(false));
    } else {
      OnlineSalesReportItemService.getReportsitem({ Fromdate: fromDate, Todate: toDate })
        .then((res) => {
          const rows = res.data.data || [];
          setRawExpanded(rows);

          let cols = generateColumns(rows, EXPANDED_INITIAL_COLUMNS);

          if (templateConfig?.expanded) {
            cols = applyTemplateToColumns(cols, templateConfig.expanded);
          }

          setExpandedColumns(prev => mergeColumns(cols, prev));
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to load data ❌");
        })
        .finally(() => setDataLoading(false));
    }
  }, [toggleMode, columnFilters["Ledger_Date"], templateConfig]);

  /* ================= APPLY FILTERS ================= */

  const applyFilters = (rows: any[]) => {
    return rows.filter((row) => {
      return Object.entries(columnFilters).every(([key, value]) => {

        if (value === "" || value === null || value === undefined) return true;

        // ✅ DATE RANGE
        if (key === "Ledger_Date" && value) {
          const rowDate = dayjs(row[key]).startOf("day");

          const from = value?.from ? dayjs(value.from).startOf("day") : null;
          const to = value?.to ? dayjs(value.to).endOf("day") : null;

          if (from && rowDate.isBefore(from)) return false;
          if (to && rowDate.isAfter(to)) return false;

          return true;
        }

        // ✅ MULTI SELECT SUPPORT
        if (Array.isArray(value)) {
          if (value.length === 0) return false;
          return value.includes(row[key]);
        }

        // ✅ SINGLE VALUE (fallback)
        return String(row[key] ?? "")
          .toLowerCase()
          .includes(String(value).toLowerCase());
      });
    });
  };

  const {
    sortConfig: absSortConfig,
    rangeFilter: absRangeFilter,
    setRangeFilter: setAbsRangeFilter,
    filterAnchor: absFilterAnchor,
    setFilterAnchor: setAbsFilterAnchor,
    activeHeader: absActiveHeader,
    handleSort: handleAbsSort,
    openFilter: openAbsFilter,
    filteredAndSortedData: absFilteredAndSortedRows,
    getMinMax: getAbsMinMax,
    clearRangeFilter: clearAbsRangeFilter,
  } = useNumericalFilter(useMemo(() => applyFilters(rawAbstract), [rawAbstract, columnFilters]), ["Item_Count", "Total_Invoice_value"]);

  const {
    sortConfig: expSortConfig,
    rangeFilter: expRangeFilter,
    setRangeFilter: setExpRangeFilter,
    filterAnchor: expFilterAnchor,
    setFilterAnchor: setExpFilterAnchor,
    activeHeader: expActiveHeader,
    handleSort: handleExpSort,
    openFilter: openExpFilter,
    filteredAndSortedData: expFilteredAndSortedRows,
    getMinMax: getExpMinMax,
    clearRangeFilter: clearExpRangeFilter,
  } = useNumericalFilter(useMemo(() => applyFilters(rawExpanded), [rawExpanded, columnFilters]), ["Bill_Qty", "Rate", "Total_Invoice_value"]);

  const filteredAbstract = useMemo(() => {
    if (absSortConfig) {
      return absFilteredAndSortedRows;
    }
    return [...absFilteredAndSortedRows].sort((a, b) =>
      dayjs(b.Ledger_Date).valueOf() - dayjs(a.Ledger_Date).valueOf()
    );
  }, [absFilteredAndSortedRows, absSortConfig]);

  const filteredExpanded = useMemo(() => {
    if (expSortConfig) {
      return expFilteredAndSortedRows;
    }
    return [...expFilteredAndSortedRows].sort((a, b) =>
      dayjs(b.Ledger_Date).valueOf() - dayjs(a.Ledger_Date).valueOf()
    );
  }, [expFilteredAndSortedRows, expSortConfig]);

  const isNumericCol = (key: string) => {
    if (toggleMode === "Abstract") {
      return ["Item_Count", "Total_Invoice_value"].includes(key);
    } else {
      return ["Bill_Qty", "Rate", "Total_Invoice_value"].includes(key);
    }
  };


  /* ================= PAGINATION ================= */
  const paginatedAbstract = filteredAbstract.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const paginatedExpanded = filteredExpanded.slice(
    (expandedPage - 1) * rowsPerPage,
    expandedPage * rowsPerPage
  );

  /* ================= SUMMARY ================= */
  const getTotal = (rows: any[], key: string) => {
    return rows.reduce((sum, r) => {
      switch (key) {
        case "Item_Count":
          return sum + Number(r.Item_Count || 0);

        case "Total_Invoice_value":
          return sum + Number(
            toggleMode === "Abstract"
              ? r.Total_Invoice_value
              : r.Amount
          );

        case "Rate":
          return sum + Number(r.Rate || 0);

        case "Bill_Qty":
          return sum + Number(r.Bill_Qty || 0);

        default:
          return sum;
      }
    }, 0);
  };


  /* ================= HEADER CLICK ================= */
  const handleHeaderClick = (
    e: React.MouseEvent<HTMLElement>,
    columnKey: string
  ) => {
    setActiveHeader(columnKey);
    setFilterAnchor(e.currentTarget);
  };

  const formatISTDateTime = (dateString: string) => {
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

  /* ================= TABLE ================= */
  const renderTable = (
    rows: any[],
    paginated: any[],
    pageNo: number
  ) => (
    <Box
      sx={{
        overflow: "hidden",
        maxHeight: "calc(100vh - 100px)",
      }}
    >
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 0,
          position: 'relative',
          maxHeight: "calc(100vh - 100px)",
          overflow: "auto"
        }}
      >
        <Table size="small">
          {/* ===== FIXED HEADER ===== */}
          <TableHead
            sx={{
              background: "#1E3A8A",
              position: "sticky",
              top: 0,
              zIndex: 2
            }}
          >
            <TableRow>
              {enabledColumns.map((col) => (
                <TableCell
                  key={col.key}
                  align={isNumericCol(col.key) ? "right" : "left"}
                  sx={{
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    if (isNumericCol(col.key)) {
                      if (toggleMode === "Abstract") {
                        openAbsFilter(e, col.key);
                      } else {
                        openExpFilter(e, col.key);
                      }
                    } else {
                      handleHeaderClick(e, col.key);
                    }
                  }}
                >
                  {isNumericCol(col.key) ? (
                    <SortableHeaderLabel
                      label={col.label}
                      columnKey={col.key}
                      sortConfig={toggleMode === "Abstract" ? absSortConfig : expSortConfig}
                      onSort={toggleMode === "Abstract" ? handleAbsSort : handleExpSort}
                      onOpenFilter={(e) => {
                        if (toggleMode === "Abstract") {
                          openAbsFilter(e, col.key);
                        } else {
                          openExpFilter(e, col.key);
                        }
                      }}
                    />
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          {/* ===== FIXED SUMMARY ROW ABOVE BODY ===== */}
          <TableBody>

            {/* ===== TOTAL ROW (ALWAYS VISIBLE) ===== */}
            <TableRow
              sx={{
                background: "#f3f4f6",
                fontWeight: 600,
                position: "sticky",
                top: 37,
                zIndex: 2,
              }}
            >
              <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>

              {enabledColumns.slice(1).map(col => {
                if (col.type === "number") {
                  const value = getTotal(rows, col.key);
                  return (
                    <TableCell key={col.key} align="right">
                      {col.label === "Amount" || col.label === "Rate"
                        ? formatINR(value)
                        : value.toFixed(2)}
                    </TableCell>
                  );
                }
                return <TableCell key={col.key} align={isNumericCol(col.key) ? "right" : "left"} />;
              })}
            </TableRow>
          </TableBody>


          {/* ===== TABLE BODY ===== */}
          <TableBody
            sx={{
              "& .MuiTableCell-root": {
                fontSize: "12px",
                padding: "6px 8px"
              }
            }}
          >
            {paginated.map((row, i) => (
              <TableRow key={i}>
                {enabledColumns.map((col) => {
                  const align = isNumericCol(col.key) ? "right" : "left";

                  if (isSnoCol(col)) {
                    return (
                      <TableCell key={col.key} align={align}>
                        {(pageNo - 1) * rowsPerPage + i + 1}
                      </TableCell>
                    );
                  }

                  switch (col.key) {
                    case "Ledger_Date":
                      return (
                        <TableCell key={col.key} align={align}>
                          {dayjs(row.Ledger_Date).format("DD/MM/YYYY")}
                        </TableCell>
                      );

                    case "invoice_no":
                      return <TableCell key={col.key} align={align}>{row.invoice_no}</TableCell>;

                    case "Retailer_Name":
                      return <TableCell key={col.key} align={align}>{row.Retailer_Name}</TableCell>;

                    case "Product_Name":
                      return <TableCell key={col.key} align={align}>{row.Product_Name}</TableCell>;

                    case "Item_Count":
                      return <TableCell key={col.key} align={align}>{row.Item_Count}</TableCell>;

                    case "Bill_Qty":
                      return <TableCell key={col.key} align={align}>{row.Bill_Qty}</TableCell>;

                    case "Rate":
                      return <TableCell key={col.key} align={align}>{formatINR(row.Rate)}</TableCell>;

                    case "Total_Invoice_value":
                      return (
                        <TableCell key={col.key} align={align}>
                          {formatINR(
                            toggleMode === "Abstract"
                              ? row.Total_Invoice_value
                              : row.Amount
                          )}
                        </TableCell>
                      );

                    case "Created_on":
                      return (
                        <TableCell key={col.key} align={align}>
                          {formatISTDateTime(row.Created_on)}
                        </TableCell>
                      );

                    default:
                      return <TableCell key={col.key} align={align}>{row[col.key]}</TableCell>;
                  }
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box >
  );


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

  const generateColumns = (
    data: any[],
    baseColumns: ColumnConfig[]
  ): ColumnConfig[] => {
    if (!data.length) return baseColumns;

    const existingKeys = new Set(
      baseColumns.map((c) => (c.key || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    );

    const dynamicCols: ColumnConfig[] = Object.keys(data[0])
      .filter((key) => {
        if (isSnoCol({ key })) return false;
        const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        return !existingKeys.has(norm);
      })
      .map((key, index) => ({
        key,
        label: key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        enabled: false,
        order: baseColumns.length + index,
      }));

    return [...baseColumns, ...dynamicCols];
  };

  const handleQuickSave = async () => {
    try {
      /* ===============================
         VALIDATION
      =============================== */

      if (!reportName.trim()) {
        toast.error("Enter Report Name");
        return;
      }

      if (!parentReportName.trim()) {
        toast.error("Parent Report Missing");
        return;
      }

      /* ===============================
         CREATE NEW TEMPLATE
      =============================== */

      if (!isEditTemplate || !selectedTemplateId) {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");

        const cleanColumns = (cols: ColumnConfig[]) => {
          let hasSno = false;
          const seen = new Set<string>();
          return cols
            .filter((c) => {
              if (isSnoCol(c)) {
                if (hasSno) return false;
                hasSno = true;
                return true;
              }
              const normKey = (c.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
              if (!normKey || seen.has(normKey)) return false;
              seen.add(normKey);
              return true;
            })
            .map((c) => ({
              key: isSnoCol(c) ? "sno" : c.key,
              label: isSnoCol(c) ? "S.No" : c.label,
              enabled: c.enabled,
              order: c.order,
              groupBy: c.groupBy ?? 0,
              dataType: "nvarchar"
            }));
        };

        const createPayload = {
          reportName: reportName.trim(),
          parentReport: parentReportName,
          abstractSP: spConfig.abstractSP,
          expandedSP: spConfig.expandedSP,
          createdBy: Number(userData.id || 0),

          abstractColumns: cleanColumns(abstractColumns),
          expandedColumns: cleanColumns(expandedColumns)
        };

        await SettingsService.saveReportSettings(createPayload);
        console.log("CREATE PAYLOAD:", createPayload);

        toast.success("Template Saved ✅");
        setIsEditTemplate(true);
        setSaveDialogOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 500);
        return;
      }

      /* ===============================
         EDIT EXISTING TEMPLATE
         Using existing service only
      =============================== */

      const cleanEditColumns = (cols: ColumnConfig[]) => {
        let hasSno = false;
        const seen = new Set<string>();
        return cols
          .filter((c) => {
            if (isSnoCol(c)) {
              if (hasSno) return false;
              hasSno = true;
              return true;
            }
            const normKey = (c.key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (!normKey || seen.has(normKey)) return false;
            seen.add(normKey);
            return true;
          })
          .map((c) => ({
            key: isSnoCol(c) ? "sno" : c.key,
            label: isSnoCol(c) ? "S.No" : c.label,
            enabled: c.enabled,
            order: c.order,
            groupBy: c.groupBy ?? 0
          }));
      };

      await SettingsService.updateReport({
        reportId: selectedTemplateId,
        typeId: 1,
        reportName: reportName.trim(),
        columns: cleanEditColumns(abstractColumns)
      });

      await SettingsService.updateReport({
        reportId: selectedTemplateId,
        typeId: 2,
        reportName: reportName.trim(),
        columns: cleanEditColumns(expandedColumns)
      });

      toast.success("Template Saved Successfully ✅");
      setSaveDialogOpen(false);

      setSaveDialogOpen(false);

      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error(error);
      toast.error("Error saving ❌");
    }
  };

  /* ================= RENDER ================= */
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
            setIsEditTemplate(false);
            setReportName("");
            setTemplateConfig(null);

            setAbstractColumns(ABSTRACT_INITIAL_COLUMNS);
            setExpandedColumns(EXPANDED_INITIAL_COLUMNS);

            setToggleMode("Abstract");

            return;
          }

          loadTemplate(
            template.Report_Id,
            template.Report_Name
          );
        }}
        onQuickSave={(parentName) => {
          setParentReportName(parentName);

          if (!isEditTemplate) {
            setReportName("");
          }

          setSaveDialogOpen(true);
        }}
        settingsSlot={
          <Box display="flex" gap={1}>
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
        fromDate={tempFromDate}
        toDate={tempToDate}
        onFromDateChange={(v) => setTempFromDate(v)}
        onToDateChange={(v) => setTempToDate(v)}
        onApply={() => {
          setColumnFilters((prev) => ({
            ...prev,
            Ledger_Date: {
              from: tempFromDate,
              to: tempToDate,
            },
          }));
          setDrawerOpen(false);
        }}
      />
      {(templateLoading || dataLoading) && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <AppLayout fullWidth >

        <Box sx={{ mt: 1 }}>
          {toggleMode === "Abstract" ? (
            <>
              {renderTable(
                filteredAbstract,
                paginatedAbstract,
                page
              )}
              <CommonPagination
                totalRows={filteredAbstract.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={setPage}
                onRowsPerPageChange={setRowsPerPage}
              />
            </>
          ) : (
            <>
              {renderTable(
                filteredExpanded,
                paginatedExpanded,
                expandedPage
              )}
              {toggleMode == "Expanded" && (
                <CommonPagination
                  totalRows={filteredExpanded.length}
                  page={expandedPage}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setExpandedPage}
                  onRowsPerPageChange={setRowsPerPage}
                />
              )}
            </>
          )}

          {/* ================= FILTER MENU ================= */}
          <HeaderFilterMenu
              anchorEl={filterAnchor}
              open={Boolean(filterAnchor)}
              onClose={() => setFilterAnchor(null)}
              columnLabel={activeHeader || undefined}
              options={
                activeHeader
                  ? Array.from(
                      new Set(
                        (toggleMode === "Abstract" ? rawAbstract : rawExpanded)
                          .map((r) => r[activeHeader])
                          .filter(Boolean)
                          .map(String)
                      )
                    )
                  : []
              }
              selectedValues={activeHeader ? columnFilters[activeHeader] : undefined}
              onFilterChange={(newSelected) => {
                if (!activeHeader) return;
                setColumnFilters((prev) => {
                  const copy = { ...prev };
                  if (newSelected === undefined) {
                    delete copy[activeHeader];
                  } else {
                    copy[activeHeader] = newSelected;
                  }
                  return copy;
                });
              }}
              isDateColumn={activeHeader === "Ledger_Date"}
              dateFrom={columnFilters[activeHeader || ""]?.from || ""}
              dateTo={columnFilters[activeHeader || ""]?.to || ""}
              onDateChange={(dates) =>
                setColumnFilters((prev) => ({
                  ...prev,
                  [activeHeader!]: {
                    ...prev[activeHeader!],
                    from: dates.from,
                    to: dates.to,
                  },
                }))
              }
              onApplyDate={() => setFilterAnchor(null)}
            />
        </Box>
      </AppLayout>

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
                  showFilter={
                    col.key === "Ledger_Date"
                      ? !!columnFilters[col.key]?.from || !!columnFilters[col.key]?.to
                      : columnFilters[col.key] !== undefined
                  }
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
                  setColumns(prev =>
                    prev.map(c =>
                      c.key === col.key
                        ? { ...c, enabled: true }
                        : c
                    )
                  )
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
        anchorEl={absFilterAnchor}
        open={Boolean(absFilterAnchor)}
        onClose={() => setAbsFilterAnchor(null)}
        activeHeader={absActiveHeader}
        min={absActiveHeader ? getAbsMinMax(absActiveHeader).min : 0}
        max={absActiveHeader ? getAbsMinMax(absActiveHeader).max : 100}
        rangeFilter={absRangeFilter}
        onRangeChange={(key, range) => setAbsRangeFilter(p => ({ ...p, [key]: range }))}
        onClear={clearAbsRangeFilter}
      />

      <NumericalFilterMenu
        anchorEl={expFilterAnchor}
        open={Boolean(expFilterAnchor)}
        onClose={() => setExpFilterAnchor(null)}
        activeHeader={expActiveHeader}
        min={expActiveHeader ? getExpMinMax(expActiveHeader).min : 0}
        max={expActiveHeader ? getExpMinMax(expActiveHeader).max : 100}
        rangeFilter={expRangeFilter}
        onRangeChange={(key, range) => setExpRangeFilter(p => ({ ...p, [key]: range }))}
        onClear={clearExpRangeFilter}
      />
    </>
  );
};

export default OnlineSalesReportPage;
