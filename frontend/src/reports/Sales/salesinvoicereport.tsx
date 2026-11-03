import React, { useState, useEffect, useMemo } from "react";
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
  TableFooter,
  Paper,
  Menu,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import dayjs from "dayjs";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import CommonPagination from "../../Components/CommonPagination";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";
import { mapForExport, formatCreatedOn } from "../../utils/exportMapper";
import {
  SalesInvoiceReport,
  SalesInvoiceReportService,
} from "../../services/salesinvoicereports.service";

/* ================= STYLES ================= */
const headStyle = {
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.75rem",
  cursor: "pointer",
};

const SalesInvoiceReportPage: React.FC = () => {
  const today = dayjs().format("YYYY-MM-DD");

  /* -------- RAW DATA -------- */
  const [rawData, setRawData] = useState<SalesInvoiceReport[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);

  /* -------- FILTERS -------- */
  const [filters, setFilters] = useState({
    Date: { from: today, to: today },
    Invoice: "",
    Customer: "",
    Voucher: "",
  });

  const [tempDate, setTempDate] = useState(filters.Date);

  /* -------- HEADER FILTER -------- */
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  /* -------- SUMMARY -------- */
  const [summaryType, setSummaryType] = useState<"sum" | "avg" | null>(null);

  const EXPORT_COLUMNS = [
    { label: "S.No", key: "sno" },
    { label: "Date", key: "Created_on", type: "date" },
    { label: "Invoice", key: "Do_Inv_No" },
    { label: "Customer", key: "Retailer_Name" },
    { label: "Voucher", key: "VoucherTypeGet" },
    { label: "Before Tax", key: "Total_Before_Tax", type: "number" },
    { label: "Tax", key: "Total_Tax", type: "number" },
    { label: "Invoice Amount", key: "Total_Invoice_value", type: "number" },
  ];

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const loadData = async () => {
      const res = await SalesInvoiceReportService.getReports({
        Fromdate: filters.Date.from,
        Todate: filters.Date.to,
      });
      setRawData(res.data.data || []);
      setPage(1);
      setSummaryType(null);
    };
    loadData();
  }, [filters.Date]);

  /* ================= APPLY FILTERS ================= */
  const data = useMemo(() => {
    let rows = rawData;

    if (filters.Invoice)
      rows = rows.filter((r) => r.Do_Inv_No === filters.Invoice);

    if (filters.Customer)
      rows = rows.filter((r) => r.Retailer_Name === filters.Customer);

    if (filters.Voucher)
      rows = rows.filter((r) => r.VoucherTypeGet === filters.Voucher);

    return rows;
  }, [rawData, filters]);

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
  } = useNumericalFilter(data, ["Total_Before_Tax", "Total_Tax", "Total_Invoice_value"]);

  /* ================= DROPDOWNS ================= */
  const invoices = useMemo(
    () =>
      [...new Set(rawData.map((d) => d.Do_Inv_No))].filter(
        (v) => v && v.toLowerCase().includes(searchText.toLowerCase())
      ),
    [rawData, searchText]
  );

  const customers = useMemo(
    () =>
      [...new Set(rawData.map((d) => d.Retailer_Name))].filter(
        (v) => v && v.toLowerCase().includes(searchText.toLowerCase())
      ),
    [rawData, searchText]
  );

  const vouchers = useMemo(
    () =>
      [...new Set(rawData.map((d) => d.VoucherTypeGet))].filter(
        (v) => v && v.toLowerCase().includes(searchText.toLowerCase())
      ),
    [rawData, searchText]
  );

  /* ================= PAGINATION ================= */
  const paginatedData = numFilteredAndSortedRows.slice(
    (page - 1) * rowsPerPage ,
    page * rowsPerPage 
  );

  /* ================= SUMMARY ================= */
  const getSummary = (field: keyof SalesInvoiceReport) => {
    if (!summaryType) return 0;
    const values = numFilteredAndSortedRows.map((r) => Number(r[field]) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    return summaryType === "sum"
      ? total
      : values.length
        ? total / values.length
        : 0;
  };

  /* ================= HEADER CLICK ================= */
  const openFilter = (
    e: React.MouseEvent<HTMLElement>,
    column: string
  ) => {
    setActiveHeader(column);
    setFilterAnchor(e.currentTarget);
    setSummaryType(null);
    setSearchText("");
  };

  /* ================= EXPORT ================= */
  const handleExportPDF = () => {
    const { headers, data: exportData } = mapForExport(EXPORT_COLUMNS, numFilteredAndSortedRows);

    exportToPDF("Sales Invoice Report", headers, exportData);
  };

  const handleExportExcel = () => {
    const { headers, data: exportData } = mapForExport(EXPORT_COLUMNS, numFilteredAndSortedRows);

    exportToExcel("Sales Invoice Report", headers, exportData);
  };


  /* ================= RENDER ================= */
  return (
    <>
      {/* ===== FIXED HEADER ===== */}
      <PageHeader
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />

      {/* ===== SCROLLABLE CONTENT ===== */}
      <AppLayout fullWidth>
        <Box sx={{ flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", p: 1 }}>
          <TableContainer component={Paper} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ background: "#1E3A8A" }}>
                <TableRow>
                  <TableCell sx={headStyle}>S.No</TableCell>
                  <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Date")}>Date</TableCell>
                  <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Invoice")}>Invoice</TableCell>
                  <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Customer")}>Customer</TableCell>
                  <TableCell sx={headStyle} onClick={(e) => openFilter(e, "Voucher")}>Voucher</TableCell>
                  <TableCell align="right" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.75rem" }}>
                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                      <SortableHeaderLabel
                        label="Before Tax"
                        columnKey="Total_Before_Tax"
                        sortConfig={numSortConfig}
                        onSort={handleNumSort}
                        onOpenFilter={(e) => openNumFilter(e, "Total_Before_Tax")}
                      />
                      <Button
                        size="small"
                        sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.6rem", minWidth: 0, p: 0, ml: 0.5, "&:hover": { color: "#fff" } }}
                        onClick={(e) => openFilter(e, "BeforeTax")}
                      >
                        Sum/Avg
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.75rem" }}>
                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                      <SortableHeaderLabel
                        label="Tax"
                        columnKey="Total_Tax"
                        sortConfig={numSortConfig}
                        onSort={handleNumSort}
                        onOpenFilter={(e) => openNumFilter(e, "Total_Tax")}
                      />
                      <Button
                        size="small"
                        sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.6rem", minWidth: 0, p: 0, ml: 0.5, "&:hover": { color: "#fff" } }}
                        onClick={(e) => openFilter(e, "Tax")}
                      >
                        Sum/Avg
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ color: "#fff", fontWeight: 600, fontSize: "0.75rem" }}>
                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                      <SortableHeaderLabel
                        label="Invoice Amount"
                        columnKey="Total_Invoice_value"
                        sortConfig={numSortConfig}
                        onSort={handleNumSort}
                        onOpenFilter={(e) => openNumFilter(e, "Total_Invoice_value")}
                      />
                      <Button
                        size="small"
                        sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.6rem", minWidth: 0, p: 0, ml: 0.5, "&:hover": { color: "#fff" } }}
                        onClick={(e) => openFilter(e, "InvoiceAmount")}
                      >
                        Sum/Avg
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedData.map((row, i) => (
                  <TableRow key={row.Do_Id}>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{(page - 1) * rowsPerPage  + i + 1}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{formatCreatedOn(row.Created_on)}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{row.Do_Inv_No}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{row.Retailer_Name}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{row.VoucherTypeGet}</TableCell>
                    <TableCell align="right">{Number(row.Total_Before_Tax).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(row.Total_Tax).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(row.Total_Invoice_value).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>

              {summaryType && (
                <TableFooter>
                  <TableRow sx={{ background: "#f3f4f6" }}>
                    <TableCell colSpan={5} sx={{ fontWeight: 600 }}>
                      {summaryType === "sum" ? "Total" : "Average"}
                    </TableCell>
                    <TableCell align="right">{getSummary("Total_Before_Tax").toFixed(2)}</TableCell>
                    <TableCell align="right">{getSummary("Total_Tax").toFixed(2)}</TableCell>
                    <TableCell align="right">{getSummary("Total_Invoice_value").toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableContainer>

          <CommonPagination
            totalRows={numFilteredAndSortedRows.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={setRowsPerPage}
          />

          {/* ===== FILTER MENU ===== */}
          <Menu
            anchorEl={filterAnchor}
            open={Boolean(filterAnchor)}
            onClose={() => setFilterAnchor(null)}
          >
            {["Invoice", "Customer", "Voucher"].includes(activeHeader || "") && (
              <Box p={2} sx={{ minWidth: 220 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  sx={{ mb: 1 }}
                />

                {(activeHeader === "Invoice"
                  ? invoices
                  : activeHeader === "Customer"
                    ? customers
                    : vouchers
                ).map((v) => (
                  <MenuItem
                    key={v}
                    onClick={() => {
                      setFilters((p) => ({ ...p, [activeHeader!]: v }));
                      setPage(1);
                      setFilterAnchor(null);
                    }}
                  >
                    {v}
                  </MenuItem>
                ))}

                <MenuItem
                  onClick={() => {
                    setFilters((p) => ({ ...p, [activeHeader!]: "" }));
                    setPage(1);
                    setFilterAnchor(null);
                  }}
                >
                  All
                </MenuItem>
              </Box>
            )}

            {activeHeader === "Date" && (
              <Box p={2} display="flex" flexDirection="column" gap={1}>
                <TextField type="date" value={tempDate.from} onChange={(e) => setTempDate((p) => ({ ...p, from: e.target.value }))} />
                <TextField type="date" value={tempDate.to} onChange={(e) => setTempDate((p) => ({ ...p, to: e.target.value }))} />
                <Button variant="contained" sx={{
                  backgroundColor: "#1E3A8A",
                  fontWeight: 600,
                }} onClick={() => { setFilters((p) => ({ ...p, Date: tempDate })); setFilterAnchor(null); }}>
                  Apply
                </Button>
              </Box>
            )}

            {["BeforeTax", "Tax", "InvoiceAmount"].includes(activeHeader || "") && (
              <>
                <MenuItem onClick={() => { setSummaryType("sum"); setFilterAnchor(null); }}>Sum</MenuItem>
                <MenuItem onClick={() => { setSummaryType("avg"); setFilterAnchor(null); }}>Avg</MenuItem>
              </>
            )}
          </Menu>
        </Box>
      </AppLayout>

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

export default SalesInvoiceReportPage;
