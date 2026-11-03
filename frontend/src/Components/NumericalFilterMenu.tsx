import React from "react";
import { Menu, Box, Typography, TextField, Slider, Button } from "@mui/material";

interface NumericalFilterMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  activeHeader: string | null;
  min: number;
  max: number;
  rangeFilter: Record<string, [number, number]>;
  onRangeChange: (key: string, range: [number, number]) => void;
  onClear: (key: string) => void;
}

export const NumericalFilterMenu: React.FC<NumericalFilterMenuProps> = ({
  anchorEl,
  open,
  onClose,
  activeHeader,
  min,
  max,
  rangeFilter,
  onRangeChange,
  onClear,
}) => {
  if (!activeHeader) return null;

  const currentRange = rangeFilter[activeHeader] || [min, max];

  const handleSliderChange = (newValue: number[]) => {
    onRangeChange(activeHeader, newValue as [number, number]);
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
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
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
                textAlign: "center",
              },
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
                textAlign: "center",
              },
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
            },
          }}
        />
        <Box display="flex" justifyContent="space-between">
          <Button
            size="small"
            onClick={() => {
              onClear(activeHeader);
              onClose();
            }}
            sx={{ textTransform: "none", color: "gray" }}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={onClose}
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
    </Menu>
  );
};
