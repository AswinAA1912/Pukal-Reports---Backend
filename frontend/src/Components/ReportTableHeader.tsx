import React from "react";
import {
  TableHead,
  TableRow,
  TableCell,
  Box,
  Typography,
} from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

/* ================= TYPES ================= */

export type ReportColumn = {
  label: string;              
  key: string;               
  align?: "left" | "right" | "center";
  filterType?: "date" | "text" | "numeric";
  width: number;
};

interface ReportTableHeaderProps {
  columns: ReportColumn[];
  onHeaderClick?: (
    e: React.MouseEvent<HTMLElement>,
    column: ReportColumn
  ) => void;

  /** Sorting support */
  sortKey?: string;
  sortOrder?: "asc" | "desc";
}

/* ================= STYLES ================= */

const headerCellStyle = {
  color: "#ffffff",
  fontWeight: 600,
  fontSize: "0.75rem",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const headerBg = "#1E3A8A";

/* ================= COMPONENT ================= */

const ReportTableHeader: React.FC<ReportTableHeaderProps> = ({
  columns,
  onHeaderClick,
  sortKey,
  sortOrder,
}) => {
  return (
    <TableHead sx={{ backgroundColor: headerBg }}>
      <TableRow>
        {columns.map((col) => {
          const isSortable = Boolean(col.filterType);
          const isActiveSort = sortKey === col.key;

          return (
            <TableCell
              key={col.key}
              align={col.align || "left"}
              sx={{
                ...headerCellStyle,
                cursor: isSortable ? "pointer" : "default",
              }}
              onClick={
                isSortable && onHeaderClick
                  ? (e) => onHeaderClick(e, col)
                  : undefined
              }
            >
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography
                  component="span"
                  sx={{ fontSize: "0.75rem", fontWeight: 600 }}
                >
                  {col.label}
                </Typography>

                {/* Sort Icon */}
                {isActiveSort && (
                  <>
                    {sortOrder === "asc" ? (
                      <ArrowDropUpIcon fontSize="small" />
                    ) : (
                      <ArrowDropDownIcon fontSize="small" />
                    )}
                  </>
                )}
              </Box>
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
};

export default ReportTableHeader;
