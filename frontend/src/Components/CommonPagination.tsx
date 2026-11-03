import React from "react";
import {
  Box,
  Pagination,
  Typography,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";

interface CommonPaginationProps {
  totalRows: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

const CommonPagination: React.FC<CommonPaginationProps> = ({
  totalRows,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) => {
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  return (
    <Box
      mt={2}
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={2}
    >
      {/* LEFT SIDE */}
      <Box display="flex" alignItems="center" gap={2}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: "#01050a",
            letterSpacing: 0.2,
          }}
        >
          {totalRows > 0 &&
            `Showing ${(page - 1) * rowsPerPage + 1}–${Math.min(
              page * rowsPerPage,
              totalRows
            )} of ${totalRows}`}
        </Typography>

        {/* Rows Per Page Dropdown */}
        <FormControl size="small">
          <Select
            value={rowsPerPage}
            onChange={(e) => {
              onRowsPerPageChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={25}>25</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
            <MenuItem value={200}>200</MenuItem>
            <MenuItem value={500}>500</MenuItem>
            <MenuItem value={1000}>1000</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* RIGHT SIDE (Only if multiple pages) */}
      {totalPages > 1 && (
        <Pagination
          count={totalPages}
          page={page}
          onChange={(_, value) => onPageChange(value)}
          shape="rounded"
          sx={{
            "& .MuiPaginationItem-root": {
              color: "#0D47A1",
              borderColor: "#0D47A1",
            },
            "& .Mui-selected": {
              backgroundColor: "#0D47A1",
              color: "#fff",
              "&:hover": {
                backgroundColor: "#08306B",
              },
            },
            "& .MuiPaginationItem-root:hover": {
              backgroundColor: "#E3F2FD",
            },
          }}
        />
      )}
    </Box>
  );
};

export default CommonPagination;