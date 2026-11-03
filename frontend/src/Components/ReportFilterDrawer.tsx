import React from "react";
import dayjs from "dayjs";
import {
    Box,
    Drawer,
    Typography,
    TextField,
    MenuItem,
    Button,
    IconButton,
    RadioGroup,
    FormControlLabel,
    Radio,
    FormControl,
    FormLabel,
    Autocomplete,
    Checkbox
} from "@mui/material";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";

const formatDateForInput = (val?: string): string => {
    if (!val) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const parsed = dayjs(val);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : val;
};

export interface DropdownOption {
    label: string;
    value: string | number;
}

interface ReportFilterDrawerProps {
    open: boolean;
    onToggle: () => void;
    onClose: () => void;

    fromDate?: string;
    onFromDateChange?: (value: string) => void;
    hideFromDate?: boolean;
    fromDateLabel?: string;
    toDateLabel?: string;

    // OLD (keep for compatibility)
    dropdownLabel?: string;
    dropdownValue?: string | number | (string | number)[];
    dropdownOptions?: DropdownOption[];
    dropdownMultiple?: boolean;
    dropdownSearchable?: boolean;
    onDropdownChange?: (value: any) => void;

    // NEW ✅
    filterLevels?: Record<number, any[]>;
    selectedFilters?: Record<string, any>;
    onFilterChange?: (column: string, value: any) => void;
    level1Multiple?: boolean;

    stockFilter?: "hasValues" | "zero" | "all";
    onStockFilterChange?: (val: "hasValues" | "zero" | "all") => void;

    onApply: () => void;

    toDate?: string;
    onToDateChange?: (value: string) => void;

    // SALE ORDER STATUS FILTER PROPS SPECIFIC TO PENDING SALE ORDER SCREEN
    showSaleOrderStatusFilter?: boolean;
    saleOrderStatusValue?: "pending" | "cancelled";
    onSaleOrderStatusChange?: (value: "pending" | "cancelled") => void;

    // STAFF BASED REPORT VALUE DISPLAY MODE
    showStaffBasedDisplayMode?: boolean;
    staffBasedDisplayMode?: "qty" | "count";
    onStaffBasedDisplayModeChange?: (value: "qty" | "count") => void;

    // RATE TYPE FILTER
    showRateTypeFilter?: boolean;
    rateTypeValue?: "cogs" | "min";
    onRateTypeChange?: (value: "cogs" | "min") => void;

    // UNIT FILTER
    showUnitFilter?: boolean;
    unitValue?: "kgs_ton" | "bags";
    onUnitChange?: (value: "kgs_ton" | "bags") => void;

    // QTY MODE FILTER (Qty vs Act Qty vs Bags)
    showQtyModeFilter?: boolean;
    qtyModeValue?: "qty" | "actQty" | "bags" | string;
    onQtyModeChange?: (value: any) => void;

    // PRODUCTION STAFF BASED REPORT VALUE DISPLAY MODE
    showProductionDisplayMode?: boolean;
    productionDisplayModeValue?: "tonnage" | "count";
    onProductionDisplayModeChange?: (value: "tonnage" | "count") => void;

    // PURCHASE REPORT RADIO FILTER
    showPurchaseFilter?: boolean;
    purchaseFilterValue?: "today_arrival" | "pending_orders" | "pending_payments" | "completed";
    onPurchaseFilterChange?: (value: "today_arrival" | "pending_orders" | "pending_payments" | "completed") => void;
    purchaseFilterCounts?: {
        today_arrival?: number;
        pending_orders?: number;
        pending_payments?: number;
        completed?: number;
    };

    children?: React.ReactNode;
}

const ReportFilterDrawer: React.FC<ReportFilterDrawerProps> = ({
    open,
    onToggle,
    onClose,
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
    hideFromDate = false,
    fromDateLabel = "From Date",
    toDateLabel = "To Date",

    // OLD
    dropdownLabel,
    dropdownValue,
    dropdownOptions,
    dropdownMultiple = false,
    dropdownSearchable = false,
    onDropdownChange,

    // NEW ✅
    filterLevels,
    selectedFilters,
    onFilterChange,
    level1Multiple = true,

    stockFilter,
    onStockFilterChange,
    onApply,

    // SALE ORDER STATUS FILTER PROPS SPECIFIC TO PENDING SALE ORDER SCREEN
    showSaleOrderStatusFilter,
    saleOrderStatusValue,
    onSaleOrderStatusChange,

    // STAFF BASED REPORT VALUE DISPLAY MODE
    showStaffBasedDisplayMode,
    staffBasedDisplayMode,
    onStaffBasedDisplayModeChange,

        showRateTypeFilter,
    rateTypeValue,
    onRateTypeChange,

    // UNIT FILTER
    showUnitFilter,
    unitValue,
    onUnitChange,

    // QTY MODE FILTER
    showQtyModeFilter,
    qtyModeValue,
    onQtyModeChange,

    // PRODUCTION STAFF BASED REPORT VALUE DISPLAY MODE
    showProductionDisplayMode,
    productionDisplayModeValue,
    onProductionDisplayModeChange,

    // PURCHASE REPORT RADIO FILTER
    showPurchaseFilter,
    purchaseFilterValue,
    onPurchaseFilterChange,
    purchaseFilterCounts,

    children,
}) => {
    return (
        <>
            {/* 🔥 FIXED TOGGLE ARROW */}
            <IconButton
                onClick={onToggle}
                sx={{
                    position: "fixed",
                    right: 1,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 25,
                    height: 30,
                    bgcolor: "#1E3A8A",
                    color: "#fff",
                    zIndex: 1300,
                    borderRadius: "6px",
                    boxShadow: 2,
                    "&:hover": {
                        bgcolor: "#162E6E",
                    },
                }}
            >
                <KeyboardArrowLeftIcon
                    sx={{
                        fontSize: 22,
                        transition: "0.25s",
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                />
            </IconButton>

            {/* DRAWER */}
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        backgroundColor: "#F1F5F9",
                        width: 320,
                        maxWidth: "100vw",
                        overflowX: "hidden",
                        overflowY: "auto",
                        "&::-webkit-scrollbar": {
                            width: "6px",
                        },
                        "&::-webkit-scrollbar-track": {
                            backgroundColor: "#F1F5F9",
                        },
                        "&::-webkit-scrollbar-thumb": {
                            backgroundColor: "#CBD5E1",
                            borderRadius: "3px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                            backgroundColor: "#94A3B8",
                        },
                    },
                }}
            >
                <Box
                    p={2}
                    sx={{
                        width: "100%",
                        backgroundColor: "#F1F5F9",
                        minHeight: "100%",
                        display: "flex",
                        flexDirection: "column",
                        boxSizing: "border-box",
                        overflowX: "hidden",
                    }}
                >
                    <Typography variant="h6" mb={2} fontWeight={700}>
                        Filters
                    </Typography>

                    {!hideFromDate && fromDate !== undefined && onFromDateChange && (
                        <TextField
                            type="date"
                            label={fromDateLabel}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={formatDateForInput(fromDate)}
                            onChange={(e) => onFromDateChange(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                    )}

                    {toDate !== undefined && onToDateChange && (
                        <TextField
                            type="date"
                            label={toDateLabel}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={formatDateForInput(toDate)}
                            onChange={(e) => onToDateChange(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                    )}

                    {/* PURCHASE REPORT FILTER (RADIO TYPE) */}
                    {showPurchaseFilter && onPurchaseFilterChange && (
                        <FormControl sx={{ mb: 2.5, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 700, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 1 }}>
                                Purchase Filter
                            </FormLabel>
                            <RadioGroup
                                value={purchaseFilterValue || "today_arrival"}
                                onChange={(e) =>
                                    onPurchaseFilterChange(
                                        e.target.value as "today_arrival" | "pending_orders" | "pending_payments" | "completed"
                                    )
                                }
                                sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}
                            >
                                {[
                                    {
                                        value: "today_arrival",
                                        label: "Today's Arrival",
                                        count: purchaseFilterCounts?.today_arrival,
                                        isDefault: true,
                                    },
                                    {
                                        value: "pending_orders",
                                        label: "Pending Orders",
                                        count: purchaseFilterCounts?.pending_orders,
                                    },
                                    {
                                        value: "pending_payments",
                                        label: "Pending Payments",
                                        count: purchaseFilterCounts?.pending_payments,
                                    },
                                    {
                                        value: "completed",
                                        label: "Completed",
                                        count: purchaseFilterCounts?.completed,
                                    },
                                ].map((opt) => {
                                    const isSelected = (purchaseFilterValue || "today_arrival") === opt.value;
                                    return (
                                        <Box
                                            key={opt.value}
                                            onClick={() =>
                                                onPurchaseFilterChange(
                                                    opt.value as "today_arrival" | "pending_orders" | "pending_payments" | "completed"
                                                )
                                            }
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                px: 1.5,
                                                py: 0.8,
                                                borderRadius: 1.5,
                                                cursor: "pointer",
                                                bgcolor: isSelected ? "#eff6ff" : "#ffffff",
                                                border: "1.5px solid",
                                                borderColor: isSelected ? "#1E3A8A" : "#e2e8f0",
                                                boxShadow: isSelected ? "0 1px 3px rgba(30, 58, 138, 0.12)" : "none",
                                                transition: "all 0.15s ease",
                                                "&:hover": {
                                                    borderColor: isSelected ? "#1E3A8A" : "#cbd5e1",
                                                    bgcolor: isSelected ? "#eff6ff" : "#f8fafc",
                                                },
                                            }}
                                        >
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Radio
                                                    size="small"
                                                    checked={isSelected}
                                                    value={opt.value}
                                                    sx={{
                                                        p: 0,
                                                        color: "#64748b",
                                                        "&.Mui-checked": { color: "#1E3A8A" },
                                                    }}
                                                />
                                                <Box>
                                                    <Typography
                                                        sx={{
                                                            fontSize: "0.82rem",
                                                            fontWeight: isSelected ? 700 : 600,
                                                            color: isSelected ? "#1E3A8A" : "#1e293b",
                                                        }}
                                                    >
                                                        {opt.label}
                                                    </Typography>
                                                    {opt.isDefault && (
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b" }}>
                                                            Default
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                            {opt.count !== undefined && (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        fontSize: "0.72rem",
                                                        fontWeight: 700,
                                                        px: 1,
                                                        py: "2px",
                                                        borderRadius: "12px",
                                                        bgcolor: isSelected ? "#1E3A8A" : "#e2e8f0",
                                                        color: isSelected ? "#ffffff" : "#475569",
                                                    }}
                                                >
                                                    {opt.count}
                                                </Box>
                                            )}
                                        </Box>
                                    );
                                })}
                            </RadioGroup>
                        </FormControl>
                    )}

                    {/* SALE ORDER STATUS FILTER FOR PENDING SALE ORDER REPORT */}
                    {showSaleOrderStatusFilter && onSaleOrderStatusChange && (
                        <FormControl sx={{ mb: 2, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                                Sale Order Status
                            </FormLabel>
                            <RadioGroup
                                value={saleOrderStatusValue || "pending"}
                                onChange={(e) =>
                                    onSaleOrderStatusChange(e.target.value as "pending" | "cancelled")
                                }
                            >
                                <FormControlLabel
                                    value="pending"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Pending Sale Order</Typography>}
                                />
                                <FormControlLabel
                                    value="cancelled"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Cancelled</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    )}

                    {/* ✅ DYNAMIC FILTERS */}

                    {filterLevels && filterLevels[1] && (
                        <Box mb={2}>
                            <Typography fontWeight={600} mb={1}>
                                Filter Level-1
                            </Typography>

                            {filterLevels[1].map((filter: any) => {
                                if (!level1Multiple) {
                                    const rawVal = selectedFilters?.[filter.columnName];
                                    const currentVal = Array.isArray(rawVal) ? rawVal[0] : rawVal;
                                    const selectedOption =
                                        filter.options?.find(
                                            (opt: any) => String(opt.value) === String(currentVal)
                                        ) || null;

                                    return (
                                        <Autocomplete
                                            key={filter.columnName || filter.filterType}
                                            options={filter.options || []}
                                            getOptionLabel={(option: any) => option?.label || ""}
                                            isOptionEqualToValue={(option: any, val: any) =>
                                                val != null && String(option?.value) === String(val?.value)
                                            }
                                            filterOptions={(options, { inputValue }) => {
                                                const search = inputValue
                                                    .toLowerCase()
                                                    .replace(/\s+/g, "")
                                                    .replace(/[^a-z0-9]/gi, "");

                                                return options.filter((option: any) => {
                                                    const label = (option?.label || "")
                                                        .toLowerCase()
                                                        .replace(/\s+/g, "")
                                                        .replace(/[^a-z0-9]/gi, "");

                                                    return label.includes(search);
                                                });
                                            }}
                                            value={selectedOption}
                                            onChange={(_, newValue: any) => {
                                                onFilterChange?.(
                                                    filter.columnName,
                                                    newValue != null ? newValue.value : undefined
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={filter.columnName}
                                                    placeholder="Search..."
                                                />
                                            )}
                                            sx={{ mb: 2 }}
                                        />
                                    );
                                }

                                return (
                                    <Autocomplete
                                        key={filter.columnName || filter.filterType}
                                        multiple
                                        options={filter.options || []}
                                        getOptionLabel={(option: any) => option?.label || ""}
                                        filterOptions={(options, { inputValue }) => {
                                            const search = inputValue
                                                .toLowerCase()
                                                .replace(/\s+/g, "")
                                                .replace(/[^a-z0-9]/gi, "");

                                            return options.filter((option: any) => {
                                                const label = (option?.label || "")
                                                    .toLowerCase()
                                                    .replace(/\s+/g, "")
                                                    .replace(/[^a-z0-9]/gi, "");

                                                return label.includes(search);
                                            });
                                        }}
                                        value={
                                            filter.options?.filter((opt: any) =>
                                                (selectedFilters?.[filter.columnName] || []).includes(opt.value)
                                            ) || []
                                        }
                                        onChange={(_, newValue) => {
                                            const values = newValue.map((opt: any) => opt.value);
                                            onFilterChange?.(filter.columnName, values);
                                        }}
                                        disableCloseOnSelect
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label={filter.columnName}
                                                placeholder="Search..."
                                            />
                                        )}
                                        sx={{ mb: 2 }}
                                    />
                                );
                            })}
                        </Box>
                    )}

                    {/* ✅ FALLBACK (OLD SUPPORT) */}
                    {!filterLevels &&
                        dropdownOptions &&
                        dropdownOptions.length > 0 && (
                            dropdownMultiple ? (
                                <Autocomplete
                                    multiple
                                    options={dropdownOptions}
                                    disableCloseOnSelect
                                    getOptionLabel={(option) => option.label}
                                    isOptionEqualToValue={(option, val) => String(option.value) === String(val.value)}
                                    value={
                                        dropdownOptions.filter((opt) =>
                                            Array.isArray(dropdownValue)
                                                ? dropdownValue.some((v) => String(v) === String(opt.value))
                                                : false
                                        )
                                    }
                                    onChange={(_, newValue) => {
                                        const values = newValue.map((opt) => opt.value);
                                        onDropdownChange?.(values);
                                    }}
                                    renderOption={(props, option, { selected }) => (
                                        <li {...props} key={option.value}>
                                            <Checkbox
                                                size="small"
                                                checked={selected}
                                                sx={{ mr: 1 }}
                                            />
                                            {option.label}
                                        </li>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={dropdownLabel}
                                            placeholder={`Select ${dropdownLabel || "options"}...`}
                                        />
                                    )}
                                    sx={{ mb: 2 }}
                                />
                            ) : dropdownSearchable ? (
                                (() => {
                                    const hasAllOption = dropdownOptions.some(
                                        (opt) => opt.value === "" || opt.value === 0 || opt.label.toLowerCase() === "all"
                                    );
                                    const singleOptions = hasAllOption
                                        ? dropdownOptions
                                        : [{ label: "All", value: "" }, ...dropdownOptions];

                                    const currentSelected =
                                        singleOptions.find((opt) => String(opt.value) === String(dropdownValue)) ||
                                        (String(dropdownValue) === "0" || dropdownValue === "" || dropdownValue === undefined
                                            ? singleOptions[0]
                                            : null);

                                    return (
                                        <Autocomplete
                                            options={singleOptions}
                                            getOptionLabel={(option) =>
                                                typeof option === "string" ? option : option.label || ""
                                            }
                                            isOptionEqualToValue={(option, val) => {
                                                const valValue = val && typeof val === "object" ? val.value : val;
                                                return String(option.value) === String(valValue);
                                            }}
                                            value={currentSelected}
                                            onChange={(_, newValue) => {
                                                onDropdownChange?.(newValue ? newValue.value : singleOptions[0]?.value ?? "");
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={dropdownLabel}
                                                    placeholder={`Search ${dropdownLabel || "options"}...`}
                                                />
                                            )}
                                            sx={{ mb: 2 }}
                                        />
                                    );
                                })()
                            ) : (
                                <TextField
                                    select
                                    label={dropdownLabel}
                                    fullWidth
                                    value={dropdownValue ?? ""}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const option = dropdownOptions.find(
                                            (opt) => String(opt.value) === value
                                        );
                                        onDropdownChange?.(option ? option.value : "");
                                    }}
                                    sx={{ mb: 2 }}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    {dropdownOptions.map((opt) => (
                                        <MenuItem key={opt.value} value={String(opt.value)}>
                                            {opt.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )
                        )}

                    {stockFilter && onStockFilterChange && (
                        <FormControl sx={{ mb: 2 }}>
                            <FormLabel sx={{ fontWeight: 600 }}>
                                Stock Filter
                            </FormLabel>

                            <RadioGroup
                                value={stockFilter}
                                onChange={(e) =>
                                    onStockFilterChange(e.target.value as any)
                                }
                            >
                                <FormControlLabel
                                    value="hasValues"
                                    control={<Radio size="small" />}
                                    label="Data only has values"
                                />
                                <FormControlLabel
                                    value="zero"
                                    control={<Radio size="small" />}
                                    label="Data with 0"
                                />
                                <FormControlLabel
                                    value="all"
                                    control={<Radio size="small" />}
                                    label="All"
                                />
                            </RadioGroup>
                        </FormControl>
                    )}
                    {showStaffBasedDisplayMode && onStaffBasedDisplayModeChange && (
                        <FormControl sx={{ mb: 2, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                                Value Display Mode
                            </FormLabel>
                            <RadioGroup
                                value={staffBasedDisplayMode || "qty"}
                                onChange={(e) =>
                                    onStaffBasedDisplayModeChange(e.target.value as "qty" | "count")
                                }
                            >
                                <FormControlLabel
                                    value="qty"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Quantity</Typography>}
                                />
                                <FormControlLabel
                                    value="count"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Invoice Count</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    )}
                    {showProductionDisplayMode && onProductionDisplayModeChange && (
                        <FormControl sx={{ mb: 2, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                                Value Display Mode
                            </FormLabel>
                            <RadioGroup
                                value={productionDisplayModeValue || "tonnage"}
                                onChange={(e) =>
                                    onProductionDisplayModeChange(e.target.value as "tonnage" | "count")
                                }
                            >
                                <FormControlLabel
                                    value="tonnage"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Tonnage</Typography>}
                                />
                                <FormControlLabel
                                    value="count"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Count</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    )}

                                        {showRateTypeFilter && onRateTypeChange && (
                        <FormControl sx={{ mb: 2, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                                Rate Type
                            </FormLabel>
                            <RadioGroup
                                value={rateTypeValue || "cogs"}
                                onChange={(e) =>
                                    onRateTypeChange(e.target.value as "cogs" | "min")
                                }
                            >
                                <FormControlLabel
                                    value="cogs"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>COGS Rate</Typography>}
                                />
                                <FormControlLabel
                                    value="min"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Min Rate</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    )}

                    {showUnitFilter && onUnitChange && (
                        <FormControl sx={{ mb: 2, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                                Quantity Unit
                            </FormLabel>
                            <RadioGroup
                                value={unitValue || "kgs_ton"}
                                onChange={(e) =>
                                    onUnitChange(e.target.value as "kgs_ton" | "bags")
                                }
                            >
                                <FormControlLabel
                                    value="kgs_ton"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Qty in Kgs/Ton</Typography>}
                                />
                                <FormControlLabel
                                    value="bags"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Qty in Bags</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    )}

                    {showQtyModeFilter && onQtyModeChange && (
                        <FormControl sx={{ mb: 2, display: "block" }}>
                            <FormLabel sx={{ fontWeight: 600, color: "#1E3A8A", fontSize: "0.875rem", display: "block", mb: 0.5 }}>
                                Quantity Mode
                            </FormLabel>
                            <RadioGroup
                                value={qtyModeValue || "qty"}
                                onChange={(e) =>
                                    onQtyModeChange(e.target.value as any)
                                }
                            >
                                <FormControlLabel
                                    value="qty"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Qty</Typography>}
                                />
                                <FormControlLabel
                                    value="actQty"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Act Qty</Typography>}
                                />
                                <FormControlLabel
                                    value="bags"
                                    control={<Radio size="small" sx={{ color: "#1E3A8A", "&.Mui-checked": { color: "#1E3A8A" } }} />}
                                    label={<Typography sx={{ fontSize: "0.825rem" }}>Bags</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    )}

                    {children}

                    <Button
                        fullWidth
                        sx={{
                            backgroundColor: "#1E3A8A",
                            color: "#fff",
                            fontWeight: 600,
                            mt: 1,
                            mb: 2,
                            "&:hover": { backgroundColor: "#162E6E" },
                        }}
                        onClick={() => {
                            onApply();
                            onClose();
                        }}
                    >
                        Apply Filter
                    </Button>

                </Box>
            </Drawer>
        </>
    );
};

export default ReportFilterDrawer;
