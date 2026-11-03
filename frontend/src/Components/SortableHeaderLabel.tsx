import React from "react";
import { Box } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

interface SortableHeaderLabelProps {
  label: string;
  columnKey: string;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  onSort: (key: string) => void;
  onOpenFilter: (e: React.MouseEvent<HTMLElement>) => void;
  disableLabelFilterClick?: boolean;
}

export const SortableHeaderLabel: React.FC<SortableHeaderLabelProps> = ({
  label,
  columnKey,
  sortConfig,
  onSort,
  onOpenFilter,
  disableLabelFilterClick = false,
}) => {
  const isActive = sortConfig?.key === columnKey;
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
      <span
        onClick={(e) => {
          if (disableLabelFilterClick) {
            return;
          }
          e.stopPropagation();
          onOpenFilter(e);
        }}
        style={{ cursor: "pointer" }}
      >
        {label}
      </span>
      <Box
        component="span"
        onClick={(e) => {
          e.stopPropagation();
          onSort(columnKey);
        }}
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
          },
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
