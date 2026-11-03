import React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import dayjs from "dayjs";
import { stockWiseReport } from "../services/stockWiseReport.service";

const ROWS_PER_PAGE = 25;

const NUMERIC_HEADERS = [
  "Opening Balance",
  "Stock In",
  "Stock Out",
  "Closing Balance",
];

interface StockTableProps {
  rows: stockWiseReport[];
  paginated: stockWiseReport[];
  page: number;
}

/* ================= UTIL ================= */

const formatNumber = (value: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2 });

/* ================= TOTAL CALC ================= */

const getTotal = (rows: stockWiseReport[], column: string) => {
  return rows.reduce((sum, r) => {
    switch (column) {
      case "Opening Balance":
        return sum + Number(r.OB_Bal_Qty || 0);
      case "Stock In":
        return sum + Number(r.Pur_Qty || 0);
      case "Stock Out":
        return sum + Number(r.Sal_Qty || 0);
      case "Closing Balance":
        return sum + Number(r.Bal_Qty || 0);
      default:
        return sum;
    }
  }, 0);
};

/* ================= COMPONENT ================= */

const StockTable: React.FC<StockTableProps> = ({
  rows,
  paginated,
  page,
}) => {
  const columns = [
    "S.No",
    "Date",
    "Name",
    "Opening Balance",
    "Stock In",
    "Stock Out",
    "Closing Balance",
  ];

  return (
    <Box
      sx={{
        overflow: "hidden",
        maxHeight: "calc(100vh - 140px)",
      }}
    >
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 0,
          position: "relative",
          maxHeight: "calc(100vh - 140px)",
          overflow: "auto",
        }}
      >
        <Table size="small">
          {/* ================= HEADER ================= */}
          <TableHead
            sx={{
              background: "#1E3A8A",
              position: "sticky",
              top: 0,
              zIndex: 2,
            }}
          >
            <TableRow>
              {columns.map((h) => (
                <TableCell
                  key={h}
                  sx={{
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor:
                      h === "Date" || h === "Name"
                        ? "pointer"
                        : "default",
                  }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          {/* ================= TOTAL ROW ================= */}
          <TableBody>
            <TableRow
              sx={{
                background: "#f3f4f6",
                fontWeight: 700,
                position: "sticky",
                top: 37,
                zIndex: 2,
              }}
            >
              <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>

              {columns.slice(1).map((c) => {
                if (NUMERIC_HEADERS.includes(c)) {
                  const value = getTotal(rows, c);
                  return (
                    <TableCell key={c} sx={{ fontWeight: 700 }}>
                      {formatNumber(value)}
                    </TableCell>
                  );
                }
                return <TableCell key={c} />;
              })}
            </TableRow>
          </TableBody>

          {/* ================= TABLE BODY ================= */}
          <TableBody>
            {paginated.map((row, i) => (
              <TableRow key={i}>
                {/* S.NO */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {(page - 1) * ROWS_PER_PAGE + i + 1}
                </TableCell>

                {/* DATE */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {row.Trans_Date
                    ? dayjs(row.Trans_Date).format("DD/MM/YYYY")
                    : ""}
                </TableCell>

                {/* ITEM NAME */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {row.stock_item_name ||
                    row.Item_Name_Modified ||
                    row.Stock_Item}
                </TableCell>

                {/* OPENING */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {formatNumber(Number(row.OB_Bal_Qty || 0))}
                </TableCell>

                {/* IN */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {formatNumber(Number(row.Pur_Qty || 0))}
                </TableCell>

                {/* OUT */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {formatNumber(Number(row.Sal_Qty || 0))}
                </TableCell>

                {/* CLOSING */}
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {formatNumber(Number(row.Bal_Qty || 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StockTable;
