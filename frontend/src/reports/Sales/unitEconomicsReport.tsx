import React, { useEffect, useState, useMemo } from "react";
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
  TextField,
  Button,
  Slider,
  Typography,
} from "@mui/material";
import HeaderFilterMenu from "../../Components/HeaderFilterMenu";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import dayjs from "dayjs";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import CommonPagination from "../../Components/CommonPagination";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import { mapForExport } from "../../utils/exportMapper";
import {
  UnitEconomicsReport,
  UnitEconomicsReportService,
} from "../../services/unitEconomicsReport.service";


/* ================= STYLES ================= */
const headStyle = {
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.75rem",
  cursor: "pointer",
};

const UnitEconomicsReportPage: React.FC = () => {
  const today = dayjs().format("YYYY-MM-DD");

  const [data, setData] = useState<UnitEconomicsReport[]>([]);
  const [rawApiData, setRawApiData] = useState<UnitEconomicsReport[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  /* -------- FILTERS -------- */
  const [filters, setFilters] = useState<{
    Date: { from: string; to: string };
    Product?: string[];
  }>({
    Date: { from: today, to: today },
    Product: undefined,
  });

  const [tempDate, setTempDate] = useState(filters.Date);

  /* -------- HEADER FILTER -------- */
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  /* -------- SUMMARY -------- */
  const [summaryColumn, setSummaryColumn] = useState<keyof UnitEconomicsReport | null>(null);

  /* -------- SORTING & RANGE FILTER -------- */
  const [sortConfig, setSortConfig] = useState<{
    key: keyof UnitEconomicsReport;
    direction: "asc" | "desc";
  } | null>(null);

  const [rangeFilter, setRangeFilter] = useState<Record<string, [number, number]>>({});

  const isNumericColumn = (key: string) => {
    return [
      "Bill_Qty",
      "Rate",
      "Amount",
      "Min_Rate",
      "List_Rate",
      "COGS"
    ].includes(key);
  };

  const getMinMax = (key: string) => {
    const nums = rawApiData
      .map((r) => Number(r[key as keyof UnitEconomicsReport]))
      .filter((v) => !isNaN(v));
    if (nums.length === 0) return { min: 0, max: 100 };
    const minVal = Math.min(...nums);
    const maxVal = Math.max(...nums);
    return {
      min: minVal,
      max: minVal === maxVal ? minVal + 1 : maxVal,
    };
  };

  const handleSort = (columnKey: keyof UnitEconomicsReport) => {
    setSortConfig((prev) => {
      if (prev && prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key: columnKey,
        direction: "asc",
      };
    });
  };

  const renderHeader = (label: string, key: keyof UnitEconomicsReport) => {
    const isActive = sortConfig?.key === key;
    const direction = sortConfig?.direction;

    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        <span onClick={(e) => { e.stopPropagation(); openFilter(e, key); }} style={{ cursor: "pointer" }}>{label}</span>
        <Box
          component="span"
          onClick={(e) => { e.stopPropagation(); handleSort(key); }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            marginLeft: 0.5,
            width: 16,
            height: 16,
            cursor: "pointer",
            opacity: isActive ? 1 : 0.2,
            transition: "opacity 0.2s",
            "th:hover &": {
              opacity: isActive ? 1 : 0.6,
            }
          }}
        >
          {isActive ? (
            direction === "asc" ? (
              <ArrowUpwardIcon sx={{ fontSize: "0.95rem" }} />
            ) : (
              <ArrowDownwardIcon sx={{ fontSize: "0.95rem" }} />
            )
          ) : (
            <ArrowUpwardIcon sx={{ fontSize: "0.95rem" }} />
          )}
        </Box>
      </Box>
    );
  };

  const EXPORT_COLUMNS = [
    { label: "S.No", key: "sno" },
    { label: "Date", key: "Trans_Date", type: "date" },
    { label: "Product", key: "Product_Name" },
    { label: "Quantity", key: "Bill_Qty", type: "number" },
    { label: "Rate", key: "Rate", type: "number" },
    { label: "Amount", key: "Amount", type: "number" },
    { label: "Min Rate", key: "Min_Rate", type: "number" },
    { label: "List Rate", key: "List_Rate", type: "number" },
    { label: "COGS", key: "COGS", type: "number" },
  ];

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const loadData = async () => {
      const res = await UnitEconomicsReportService.getReports({
        Fromdate: filters.Date.from,
        Todate: filters.Date.to,
      });

      const responseData = res.data.data;
      let rows: UnitEconomicsReport[] = responseData.rows || [];
      setRawApiData(rows);

      setLastSyncDate(
        responseData.lastStockValueDate?.Last_Stock_Value_Date ?? null
      );

      setPage(1);
      setSummaryColumn(null);
    };

    loadData();
  }, [filters.Date]);

  /* ================= FILTER & SORT DATA ================= */
  useEffect(() => {
    let rows = [...rawApiData];

    if (filters.Product !== undefined) {
      rows = rows.filter(
        (r) => filters.Product!.includes(r.Product_Name)
      );
    }

    // Apply Range Filter
    if (rangeFilter) {
      for (const [key, range] of Object.entries(rangeFilter)) {
        rows = rows.filter((r) => {
          const val = Number(r[key as keyof UnitEconomicsReport]);
          return isNaN(val) || (val >= range[0] && val <= range[1]);
        });
      }
    }

    // Apply Sorting
    if (sortConfig) {
      const { key, direction } = sortConfig;
      rows.sort((a, b) => {
        const valA = Number(a[key]) || 0;
        const valB = Number(b[key]) || 0;
        return direction === "asc" ? valA - valB : valB - valA;
      });
    }

    setData(rows);
    setPage(1);
  }, [rawApiData, filters.Product, sortConfig, rangeFilter]);

  /* ================= PAGINATION ================= */
  const paginatedData = data.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  /* ================= DROPDOWNS ================= */
  const products = useMemo(
    () =>
      [...new Set(rawApiData.map((d) => d.Product_Name))]
        .filter(Boolean),
    [rawApiData]
  );

  /* ================= SUMMARY ================= */
  const getTotal = (key: keyof UnitEconomicsReport) => {
    return data.reduce((sum, r) => sum + (Number(r[key]) || 0), 0);
  };

  /* ================= HEADER CLICK ================= */
  const openFilter = (e: React.MouseEvent<HTMLElement>, column: string) => {
    setActiveHeader(column);
    setFilterAnchor(e.currentTarget);

    if (["Bill_Qty", "Rate", "Amount", "COGS"].includes(column)) {
      if (summaryColumn === column) {
        setSummaryColumn(null);
      } else {
        setSummaryColumn(column as keyof UnitEconomicsReport);
      }
    }
  };

  useEffect(() => {
    setSummaryColumn(null);
    setRangeFilter({});
  }, [filters.Date, filters.Product]);



  /* ================= EXPORT ================= */
  const handleExportPDF = () => {
    const { headers, data: exportData } = mapForExport(EXPORT_COLUMNS, data);
    exportToPDF("Unit Economics Report", headers, exportData);
  };

  const handleExportExcel = () => {
    const { headers, data: exportData } = mapForExport(EXPORT_COLUMNS, data);
    exportToExcel("Unit Economics Report", headers, exportData);
  };

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value);
  };


  /* ================= RENDER ================= */
  return (
    <>
      <PageHeader
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        infoSlot={
          lastSyncDate && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.25,
                px: 0.5,
                py: 0.35,
                fontSize: "0.75rem",
                backgroundColor: "#e2eef0",
                color: "#000000",
                border: "1px solid #0b78f5",
                borderRadius: 1,
                whiteSpace: "nowrap",
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "3px",
                  backgroundColor: "#1d0a72",
                  color: "#f1f5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                ⟳
              </Box>

              {/* Text */}
              <Box sx={{ fontSize: "0.65rem" }}>
                Last Sync:
                <Box component="span" sx={{ fontWeight: 600, ml: 0.25 }}>
                  {dayjs(lastSyncDate).format("DD/MM/YYYY")}
                </Box>
              </Box>
            </Box>
          )
        }
      />

      <AppLayout fullWidth >
        <Box sx={{ overflow: "auto", mt: 0.5 }}>
          <TableContainer
            component={Paper}
            sx={{
              position: 'relative',
              maxHeight: "calc(100vh - 100px)",
              overflow: "auto"
            }}
          >
            <Table size="small">
              {/* ===== FIXED HEADER ===== */}
              <TableHead sx={{
                background: "#1E3A8A",
                position: "sticky",
                top: 0,
                zIndex: 2
              }}>
                <TableRow>
                  <TableCell sx={headStyle}>S.No</TableCell>
                  <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Date")}>Date</TableCell>
                  <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Product")}>Product</TableCell>
                  <TableCell align="right" sx={headStyle}>
                    {renderHeader("Quantity", "Bill_Qty")}
                  </TableCell>
                  <TableCell align="right" sx={headStyle}>
                    {renderHeader("Rate", "Rate")}
                  </TableCell>
                  <TableCell align="right" sx={headStyle}>
                    {renderHeader("Amount", "Amount")}
                  </TableCell>
                  <TableCell align="right" sx={headStyle}>
                    {renderHeader("Min Rate", "Min_Rate")}
                  </TableCell>
                  <TableCell align="right" sx={headStyle}>
                    {renderHeader("List Rate", "List_Rate")}
                  </TableCell>
                  <TableCell align="right" sx={headStyle}>
                    {renderHeader("COGS", "COGS")}
                  </TableCell>
                </TableRow>
                <TableRow
                  sx={{
                    background: "#f3f4f6",
                    "& .MuiTableCell-root": {
                      backgroundColor: "#f3f4f6",
                      color: "#374151",
                    }
                  }}
                >
                  {/* S.No */}
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>

                  {/* Date */}
                  <TableCell />

                  {/* Product */}
                  <TableCell />

                  {/* Quantity */}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {getTotal("Bill_Qty").toFixed(2)}
                  </TableCell>

                  {/* Rate (empty) */}
                  <TableCell />

                  {/* Amount */}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatINR(getTotal("Amount"))}
                  </TableCell>

                  {/* Min Rate (empty) */}
                  <TableCell />

                  {/* List Rate (empty) */}
                  <TableCell />

                  {/* COGS */}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {getTotal("COGS").toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableHead>

              {/* ===== BODY ===== */}
              <TableBody>
                {paginatedData.map((row, i) => (
                  <TableRow key={`${row.Product_Id}-${i}`}>
                    <TableCell sx={{ fontSize: "0.75rem" }}>
                      {(page - 1) * rowsPerPage + i + 1}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>
                      {dayjs(row.Trans_Date).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{row.Product_Name}</TableCell>
                    <TableCell align="right">{Number(row.Bill_Qty).toFixed(2)}</TableCell>
                    <TableCell align="right">{formatINR(Number(row.Rate))}</TableCell>
                    <TableCell align="right">{formatINR(Number(row.Amount))}</TableCell>
                    <TableCell align="right">{formatINR(Number(row.Min_Rate))}</TableCell>
                    <TableCell align="right">{formatINR(Number(row.List_Rate))}</TableCell>
                    <TableCell align="right">{Number(row.COGS).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Categorical / Date Filter Menu */}
          <HeaderFilterMenu
            anchorEl={filterAnchor}
            open={Boolean(filterAnchor) && Boolean(activeHeader) && !isNumericColumn(activeHeader!)}
            onClose={() => setFilterAnchor(null)}
            columnLabel={activeHeader || undefined}
            options={
              activeHeader === "Product"
                ? products
                : []
            }
            selectedValues={
              activeHeader === "Product"
                ? filters.Product
                : undefined
            }
            onFilterChange={(newSelected) => {
              if (activeHeader === "Product") {
                setFilters((p) => ({ ...p, Product: newSelected }));
              }
              setPage(1);
            }}
            isDateColumn={activeHeader === "Date"}
            dateFrom={tempDate.from}
            dateTo={tempDate.to}
            onDateChange={(dates) => setTempDate(dates)}
            onApplyDate={() => {
              setFilters((p) => ({ ...p, Date: tempDate }));
              setFilterAnchor(null);
            }}
          />

          {/* Numerical Filter Menu */}
          <Menu
            anchorEl={filterAnchor}
            open={Boolean(filterAnchor) && Boolean(activeHeader) && isNumericColumn(activeHeader!)}
            onClose={() => setFilterAnchor(null)}
          >

            {activeHeader && isNumericColumn(activeHeader) && (() => {
              const { min, max } = getMinMax(activeHeader);
              const currentRange = rangeFilter[activeHeader] || [min, max];

              const handleSliderChange = (newValue: number[]) => {
                setRangeFilter((prev) => ({
                  ...prev,
                  [activeHeader]: newValue as [number, number],
                }));
              };

              const handleFromChange = (value: string) => {
                let newFrom = Number(value);
                if (isNaN(newFrom)) return;
                newFrom = Math.max(min, Math.min(newFrom, currentRange[1]));
                handleSliderChange([newFrom, currentRange[1]]);
              };

              const handleToChange = (value: string) => {
                let newTo = Number(value);
                if (isNaN(newTo)) return;
                newTo = Math.min(max, Math.max(newTo, currentRange[0]));
                handleSliderChange([currentRange[0], newTo]);
              };

              return (
                <Box p={2} sx={{ minWidth: 250 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    Filter Range
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <TextField
                      type="number"
                      size="small"
                      label="Min"
                      value={currentRange[0]}
                      onChange={(e) => handleFromChange(e.target.value)}
                      inputProps={{ min, max: currentRange[1] }}
                      sx={{
                        width: 90,
                        "& input": {
                          py: 0.5,
                          fontSize: "0.75rem",
                          textAlign: "center"
                        }
                      }}
                    />
                    <Typography fontSize={12}>—</Typography>
                    <TextField
                      type="number"
                      size="small"
                      label="Max"
                      value={currentRange[1]}
                      onChange={(e) => handleToChange(e.target.value)}
                      inputProps={{ min: currentRange[0], max }}
                      sx={{
                        width: 90,
                        "& input": {
                          py: 0.5,
                          fontSize: "0.75rem",
                          textAlign: "center"
                        }
                      }}
                    />
                  </Box>
                  <Slider
                    value={currentRange}
                    min={min}
                    max={max}
                    step={0.01}
                    size="small"
                    onChange={(_, newValue) => handleSliderChange(newValue as number[])}
                    valueLabelDisplay="auto"
                    sx={{
                      mb: 1.5,
                      "& .MuiSlider-thumb": {
                        width: 12,
                        height: 12,
                      }
                    }}
                  />
                  <Box display="flex" justifyContent="space-between">
                    <Button
                      size="small"
                      onClick={() => {
                        setRangeFilter((prev) => {
                          const copy = { ...prev };
                          delete copy[activeHeader];
                          return copy;
                        });
                        setFilterAnchor(null);
                      }}
                      sx={{ textTransform: "none", color: "gray" }}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setFilterAnchor(null)}
                      sx={{
                        backgroundColor: "#1E3A8A",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Close
                    </Button>
                  </Box>
                </Box>
              );
            })()}

          </Menu>
        </Box>
        <CommonPagination
          totalRows={data.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </AppLayout>
    </>
  );
};

export default UnitEconomicsReportPage;
