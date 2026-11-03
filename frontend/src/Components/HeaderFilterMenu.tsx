import React, { useState } from "react";
import {
  Menu,
  Box,
  TextField,
  MenuItem,
  Checkbox,
  Typography,
  Divider,
  Button,
} from "@mui/material";

export interface HeaderFilterMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  columnKey?: string | null;
  columnLabel?: string;
  options: string[];
  selectedValues?: string[]; // undefined means ALL are selected
  onFilterChange: (newSelected: string[] | undefined) => void;

  // Optional date filter props
  isDateColumn?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateChange?: (dates: { from: string; to: string }) => void;
  onApplyDate?: () => void;
}

export const HeaderFilterMenu: React.FC<HeaderFilterMenuProps> = ({
  anchorEl,
  open,
  onClose,
  columnLabel,
  options,
  selectedValues,
  onFilterChange,
  isDateColumn = false,
  dateFrom = "",
  dateTo = "",
  onDateChange,
  onApplyDate,
}) => {
  const [searchText, setSearchText] = useState("");

  const handleClose = () => {
    setSearchText("");
    onClose();
  };

  // Date Column Mode
  if (isDateColumn) {
    return (
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 260,
            p: 1.5,
            borderRadius: 1.5,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: "#1E3A8A" }}>
          Filter by {columnLabel || "Date"}
        </Typography>
        <Box display="flex" flexDirection="column" gap={1.5}>
          <TextField
            type="date"
            label="From"
            size="small"
            fullWidth
            value={dateFrom}
            onChange={(e) =>
              onDateChange?.({ from: e.target.value, to: dateTo })
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="To"
            size="small"
            fullWidth
            value={dateTo}
            onChange={(e) =>
              onDateChange?.({ from: dateFrom, to: e.target.value })
            }
            InputLabelProps={{ shrink: true }}
          />
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              onApplyDate?.();
              handleClose();
            }}
            sx={{
              backgroundColor: "#1E3A8A",
              textTransform: "none",
              fontWeight: 600,
              mt: 0.5,
              "&:hover": { backgroundColor: "#1d4ed8" },
            }}
          >
            Apply
          </Button>
        </Box>
      </Menu>
    );
  }

  // String / Categorical Options Mode
  const filteredOptions = options.filter((val) =>
    String(val).toLowerCase().includes(searchText.toLowerCase())
  );

  const isAllSelected =
    selectedValues === undefined ||
    (options.length > 0 && selectedValues.length >= options.length);

  const isIndeterminate =
    selectedValues !== undefined &&
    selectedValues.length > 0 &&
    selectedValues.length < options.length;

  const isItemChecked = (val: string) => {
    if (selectedValues === undefined) return true;
    return selectedValues.includes(val);
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      // User clicked Select All while everything was selected -> Deselect All
      onFilterChange([]);
    } else {
      // User clicked Select All while some or none were selected -> Select All
      onFilterChange(undefined);
    }
  };

  const handleToggleItem = (val: string) => {
    if (isAllSelected) {
      // Currently all are selected. Unchecking this item removes it from the full list
      const remaining = options.filter((x) => x !== val);
      onFilterChange(remaining);
    } else {
      const current = selectedValues || [];
      if (current.includes(val)) {
        // Deselect item
        const remaining = current.filter((x) => x !== val);
        onFilterChange(remaining);
      } else {
        // Select item
        const next = [...current, val];
        if (next.length >= options.length) {
          // If all are selected, clean reset to undefined
          onFilterChange(undefined);
        } else {
          onFilterChange(next);
        }
      }
    }
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: 270,
          maxHeight: 390,
          p: 1,
          borderRadius: 1.5,
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        },
      }}
    >
      <Box sx={{ p: 0.5 }}>
        {/* SEARCH INPUT */}
        <TextField
          size="small"
          fullWidth
          placeholder={columnLabel ? `Search ${columnLabel}...` : "Search..."}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ mb: 1 }}
          autoFocus
        />

        {/* SELECT ALL OPTION */}
        <MenuItem
          dense
          onClick={handleToggleAll}
          sx={{
            fontWeight: 700,
            borderRadius: 1,
            py: 0.5,
            px: 1,
            backgroundColor: isAllSelected ? "rgba(30, 58, 138, 0.06)" : "transparent",
          }}
        >
          <Checkbox
            size="small"
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            sx={{ p: 0.5, mr: 1, color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }}
          />
          <Typography variant="body2" sx={{ fontWeight: 700, color: "#1E3A8A" }}>
            (Select All)
          </Typography>
        </MenuItem>

        <Divider sx={{ my: 0.8 }} />

        {/* OPTIONS LIST */}
        <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
          {filteredOptions.length === 0 ? (
            <Typography variant="caption" color="text.secondary" align="center" display="block" py={2}>
              No options found
            </Typography>
          ) : (
            filteredOptions.map((val) => {
              const checked = isItemChecked(val);
              return (
                <MenuItem
                  key={val}
                  dense
                  onClick={() => handleToggleItem(val)}
                  sx={{
                    borderRadius: 1,
                    py: 0.3,
                    px: 1,
                    backgroundColor: checked ? "rgba(30, 58, 138, 0.04)" : "transparent",
                    "&:hover": { backgroundColor: "rgba(30, 58, 138, 0.08)" },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={checked}
                    sx={{ p: 0.5, mr: 1, color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }}
                  />
                  <Typography variant="body2" noWrap title={val} sx={{ fontSize: "0.82rem" }}>
                    {val}
                  </Typography>
                </MenuItem>
              );
            })
          )}
        </Box>
      </Box>
    </Menu>
  );
};

export default HeaderFilterMenu;
