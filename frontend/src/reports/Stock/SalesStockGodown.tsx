import React, { useMemo, useState, useEffect } from "react";
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Card,
    CardContent,
    Grid,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Checkbox,
    ListItemText,
    OutlinedInput,
    InputAdornment,
    CircularProgress
} from "@mui/material";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import SearchIcon from "@mui/icons-material/Search";
import { toast } from "react-toastify";
import axios from "axios";
import { getBaseURL } from "../../config/portalBaseURL";
import { useAuth } from "../../auth/authContext";
import { SalesDeliveryReportService, GodownItem } from "../../services/salesDeliveryReport.service";
import { StockAbstractReportService } from "../../services/dayStockAbstract.service";
import dayjs from "dayjs";
import AppLayout from "../../Layout/appLayout";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import { exportToPDF } from "../../utils/exportToPDF";
import { exportToExcel } from "../../utils/exportToExcel";

/* ================= COMPONENT ================= */
const SalesStockGodown: React.FC = () => {
    const parentReportName = "Sales Stock Godown Tonnage Report";
    const [fromDate, setFromDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { user } = useAuth();

    // Group Creation & Settings States
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupType, setGroupType] = useState<string>("");
    const [subGroupType, setSubGroupType] = useState<string>("");
    const [selectedGodownIds, setSelectedGodownIds] = useState<string[]>([]);
    const [godowns, setGodowns] = useState<GodownItem[]>([]);
    const [loadingGodowns, setLoadingGodowns] = useState(false);
    const [godownSearch, setGodownSearch] = useState<string>("");

    const [groupSettings, setGroupSettings] = useState<any[]>([]);

    // API Data state
    const [reportApiData, setReportApiData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleCloseDialog = () => {
        setGroupType("");
        setSubGroupType("");
        setSelectedGodownIds([]);
        setGodownSearch("");
        setGroupDialogOpen(false);
    };

    const isGroupExists = useMemo(() => {
        return groupSettings.some(
            (g) => g.SalesStockGroup === groupType && g.SaleStock === subGroupType
        );
    }, [groupType, subGroupType, groupSettings]);

    const dateLabel = useMemo(() => {
        if (fromDate === toDate) {
            return dayjs(fromDate).format("DD-MM-YYYY");
        }
        return `${dayjs(fromDate).format("DD-MM-YYYY")} to ${dayjs(toDate).format("DD-MM-YYYY")}`;
    }, [fromDate, toDate]);

    const fetchGroupSettings = async () => {
        try {
            const res = await axios.get<{ success: boolean; data: any[] }>(
                `${getBaseURL()}api/reports/settings/salesstockgodown`
            );
            if (res.data && res.data.success) {
                setGroupSettings(res.data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch group settings", err);
        }
    };

    const fetchReportData = async () => {
        if (!fromDate || !toDate) return;
        const fromD = new Date(fromDate);
        const toD = new Date(toDate);
        if (isNaN(fromD.getTime()) || isNaN(toD.getTime())) return;

        try {
            setLoading(true);
            const d = new Date(fromDate);
            d.setDate(d.getDate() - 1);
            const predateStr = d.toISOString().split("T")[0];

            const data = await StockAbstractReportService.getGodownSummaryInstock({
                Predate: predateStr,
                Fromdate: fromDate,
                Todate: toDate
            });

            setReportApiData(data || []);
        } catch (err) {
            console.error("Failed to fetch report data", err);
            toast.error("Failed to fetch report data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroupSettings();
        fetchReportData();
    }, []);

    // Prepopulate dialog selection if group already exists
    useEffect(() => {
        if (groupType && subGroupType) {
            const mapped = groupSettings
                .filter((g) => g.SalesStockGroup === groupType && g.SaleStock === subGroupType)
                .map((g) => String(g.Godown_Id));
            setSelectedGodownIds(mapped);
        } else {
            setSelectedGodownIds([]);
        }
    }, [groupType, subGroupType, groupSettings]);

    useEffect(() => {
        if (groupDialogOpen) {
            setGodownSearch("");
            const fetchGodownsData = async () => {
                try {
                    setLoadingGodowns(true);
                    const res = await SalesDeliveryReportService.getGodowns();
                    if (res.data && res.data.success) {
                        setGodowns(res.data.data || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch godowns", err);
                    toast.error("Failed to load godowns");
                } finally {
                    setLoadingGodowns(false);
                }
            };
            fetchGodownsData();
        }
    }, [groupDialogOpen]);

    const filteredGodowns = useMemo(() => {
        if (!godownSearch.trim()) return godowns;
        return godowns.filter((g) =>
            g.Godown_Name.toLowerCase().includes(godownSearch.toLowerCase())
        );
    }, [godowns, godownSearch]);

    const handleGroupTypeChange = (e: any) => {
        setGroupType(e.target.value);
        setSubGroupType("");
    };

    const subGroupOptions = useMemo(() => {
        if (groupType === "Inwards") {
            return ["Purchase", "AC Godowns", "Other Godowns"];
        }
        if (groupType === "Internal") {
            return ["Process In", "Process Out"];
        }
        if (groupType === "Outwards") {
            return ["Sales", "AC Godowns", "Other Godowns"];
        }
        return [];
    }, [groupType]);

    const handleSaveGroup = async () => {
        if (!groupType) {
            toast.error("Please select a Group Type");
            return;
        }
        if (!subGroupType) {
            toast.error("Please select a Sub Group Type");
            return;
        }
        if (selectedGodownIds.length === 0) {
            toast.error("Please select at least one Godown");
            return;
        }

        try {
            const payload = {
                salesStockGroup: groupType,
                saleStock: subGroupType,
                godownIds: selectedGodownIds.map(Number),
                createdBy: user?.id || null
            };

            let res;
            if (isGroupExists) {
                res = await axios.put(`${getBaseURL()}api/reports/settings/salesstockgodown`, payload);
            } else {
                res = await axios.post(`${getBaseURL()}api/reports/settings/salesstockgodown`, payload);
            }

            if (res.data && res.data.success) {
                toast.success(res.data.message || "Group settings saved successfully");
                await fetchGroupSettings();
                await fetchReportData();
                handleCloseDialog();
            } else {
                toast.error(res.data.message || "Failed to save group settings");
            }
        } catch (err: any) {
            console.error("Save group error", err);
            toast.error(err.response?.data?.message || "Failed to save group settings");
        }
    };

    // Normalization helper for matching group names
    const normalize = (val: string) => (val || "").toLowerCase().replace(/['\s_-]/g, "");

    // 1. Inwards values calculation
    const inwardsValues = useMemo(() => {
        let purchase = 0;
        let acGodownPurchase = 0;
        let otherGodownPurchase = 0;

        reportApiData.forEach((item) => {
            const godownId = Number(item.godown_id);
            const inQty = Number(item.IN_Qty || 0);

            const mapping = groupSettings.find(
                (g) => g.SalesStockGroup === "Inwards" && Number(g.Godown_Id) === godownId
            );

            if (mapping) {
                const subType = normalize(mapping.SaleStock);
                if (subType === "purchase") {
                    purchase += inQty;
                } else if (subType === "acgodowns" || subType === "acgodown") {
                    acGodownPurchase += inQty;
                } else if (subType === "othergodowns" || subType === "othergodown") {
                    otherGodownPurchase += inQty;
                }
            }
        });

        return {
            purchase: Math.round(purchase * 100) / 100,
            acGodownPurchase: Math.round(acGodownPurchase * 100) / 100,
            otherGodownPurchase: Math.round(otherGodownPurchase * 100) / 100
        };
    }, [reportApiData, groupSettings]);

    // 2. Outwards values calculation
    const outwardsValues = useMemo(() => {
        let sales = 0;
        let acGodownSales = 0;
        let otherGodownSales = 0;

        reportApiData.forEach((item) => {
            const godownId = Number(item.godown_id);
            const outQty = Number(item.Out_Qty || 0);

            const mapping = groupSettings.find(
                (g) => g.SalesStockGroup === "Outwards" && Number(g.Godown_Id) === godownId
            );

            if (mapping) {
                const subType = normalize(mapping.SaleStock);
                if (subType === "sales") {
                    sales += outQty;
                } else if (subType === "acgodowns" || subType === "acgodown") {
                    acGodownSales += outQty;
                } else if (subType === "othergodowns" || subType === "othergodown") {
                    otherGodownSales += outQty;
                }
            }
        });

        return {
            sales: Math.round(sales * 100) / 100,
            acGodownSales: Math.round(acGodownSales * 100) / 100,
            otherGodownSales: Math.round(otherGodownSales * 100) / 100
        };
    }, [reportApiData, groupSettings]);

    // 3. Internal values calculation: "Process In" & "Process Out" using all godowns
    const internalValues = useMemo(() => {
        let processIn = 0;
        let processOut = 0;

        reportApiData.forEach((item) => {
            processIn += Number(item.SOU_In_Qty || 0);
            processOut += Number(item.SOU_Out_Qty || 0);
        });

        return {
            processIn: Math.round(processIn * 100) / 100,
            processOut: Math.round(processOut * 100) / 100
        };
    }, [reportApiData]);

    // Subsection totals
    const inwardsTotal = useMemo(() => {
        return Math.round((inwardsValues.purchase + inwardsValues.acGodownPurchase + inwardsValues.otherGodownPurchase) * 100) / 100;
    }, [inwardsValues]);

    const todayInternalTotal = useMemo(() => {
        return Math.round((internalValues.processIn + internalValues.processOut) * 100) / 100;
    }, [internalValues]);

    const outwardsTotal = useMemo(() => {
        return Math.round((outwardsValues.sales + outwardsValues.acGodownSales + outwardsValues.otherGodownSales) * 100) / 100;
    }, [outwardsValues]);

    const overallTotal = useMemo(() => {
        return Math.round((inwardsTotal + todayInternalTotal + outwardsTotal) * 100) / 100;
    }, [inwardsTotal, todayInternalTotal, outwardsTotal]);


    /* ================= EXPORT LOGIC ================= */
    const exportHeaders = ["Section", "Particulars", "Tonnage"];

    const getExportRows = () => [
        ["TOTAL TONNAGE", `All Sections (as of ${dateLabel})`, overallTotal],
        ["IN WARDS", "PURCHASE", inwardsValues.purchase],
        ["IN WARDS", "AC GODOWN'S", inwardsValues.acGodownPurchase],
        ["IN WARDS TOTAL", "OTHER GODOWN'S (Total: " + inwardsTotal + ")", inwardsValues.otherGodownPurchase],
        ["INTERNAL", "PROCESS IN", internalValues.processIn],
        ["INTERNAL TOTAL", "PROCESS OUT (Total: " + todayInternalTotal + ")", internalValues.processOut],
        ["OUT WARDS", "SALES", outwardsValues.sales],
        ["OUT WARDS", "AC GODOWN'S", outwardsValues.acGodownSales || "-"],
        ["OUT WARDS TOTAL", "OTHER GODOWN'S (Total: " + outwardsTotal + ")", outwardsValues.otherGodownSales]
    ];

    const handleExportPDF = () => {
        const rows = getExportRows().map(row => [row[0], row[1], String(row[2])]);
        exportToPDF(`Sales_Stock_Godown_${fromDate}_${toDate}`, exportHeaders, rows);
    };

    const handleExportExcel = () => {
        const rows = getExportRows().map(row => [row[0], row[1], row[2]]);
        exportToExcel(`Sales_Stock_Godown_${fromDate}_${toDate}`, exportHeaders, rows);
    };

    /* ================= STYLING TOKENS (BLUISH THEME) ================= */
    const colors = {
        primaryAccent: "#1E3A8A",
        lightAccent: "#3B82F6",
        bgBlueLight: "#eff6ff",
        bgBlueMedium: "#dbeafe",
        dangerText: "#b91c1c",
        dangerBg: "#fef2f2",
        tableBorder: "#cbd5e1",
    };

    return (
        <>
            {loading && (
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
            <PageHeader
                parentReportName={parentReportName}
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
                settingsSlot={
                    <Tooltip title="Group Creation Settings">
                        <IconButton
                            size="small"
                            onClick={() => setGroupDialogOpen(true)}
                            sx={{
                                height: 24,
                                width: 24,
                                backgroundColor: "#fff",
                                borderRadius: 0.5,
                            }}
                        >
                            <GroupAddIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                }
            />

            {/* GROUP CREATION DIALOG */}
            <Dialog
                open={groupDialogOpen}
                onClose={handleCloseDialog}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle sx={{ color: colors.primaryAccent, fontWeight: "bold" }}>
                    Group Creation
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
                        {/* 1st Input: Group Type */}
                        <TextField
                            select
                            label="Group Type"
                            fullWidth
                            value={groupType}
                            onChange={handleGroupTypeChange}
                        >
                            <MenuItem value="Inwards">Inwards</MenuItem>
                            <MenuItem value="Internal">Internal</MenuItem>
                            <MenuItem value="Outwards">Outwards</MenuItem>
                        </TextField>

                        {/* 2nd Input: Sub Group Type */}
                        <TextField
                            select
                            label="Sub Group Type"
                            fullWidth
                            disabled={!groupType}
                            value={subGroupType}
                            onChange={(e) => setSubGroupType(e.target.value)}
                        >
                            {subGroupOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>
                                    {opt}
                                </MenuItem>
                            ))}
                        </TextField>

                        {/* 3rd Input: Godowns Multiselect */}
                        <FormControl fullWidth disabled={!subGroupType}>
                            <InputLabel id="godown-multiselect-label">Select Godowns</InputLabel>
                            <Select
                                labelId="godown-multiselect-label"
                                multiple
                                value={selectedGodownIds}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSelectedGodownIds(typeof value === "string" ? value.split(",") : value);
                                }}
                                input={<OutlinedInput label="Select Godowns" />}
                                renderValue={(selected) =>
                                    selected
                                        .map((id) => godowns.find((g) => g.Godown_Id === id)?.Godown_Name || id)
                                        .join(", ")
                                }
                                MenuProps={{
                                    autoFocus: false,
                                    PaperProps: {
                                        style: {
                                            maxHeight: 300,
                                        }
                                    }
                                }}
                            >
                                {/* Search box inside dropdown */}
                                <Box
                                    px={2}
                                    py={1}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <TextField
                                        size="small"
                                        fullWidth
                                        placeholder="Search Godown..."
                                        value={godownSearch}
                                        onChange={(e) => setGodownSearch(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Box>
                                {loadingGodowns ? (
                                    <MenuItem disabled>Loading godowns...</MenuItem>
                                ) : filteredGodowns.length === 0 ? (
                                    <MenuItem disabled>No godowns found</MenuItem>
                                ) : (
                                    filteredGodowns.map((godown) => (
                                        <MenuItem key={godown.Godown_Id} value={godown.Godown_Id}>
                                            <Checkbox checked={selectedGodownIds.indexOf(godown.Godown_Id) > -1} />
                                            <ListItemText primary={godown.Godown_Name} />
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button color="error" onClick={handleCloseDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        sx={{ bgcolor: colors.primaryAccent, "&:hover": { bgcolor: colors.lightAccent } }}
                        onClick={handleSaveGroup}
                    >
                        {isGroupExists ? "Update Group" : "Create Group"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* FLOATING FILTER DRAWER */}
            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((p) => !p)}
                onClose={() => setDrawerOpen(false)}
                fromDate={fromDate}
                onFromDateChange={setFromDate}
                toDate={toDate}
                onToDateChange={setToDate}
                onApply={fetchReportData}
            />

            <AppLayout fullWidth>
                <Box
                    p={3}
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2.5,
                        boxSizing: "border-box"
                    }}
                >
                    {/* QUICK METRICS CARDS */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={8} md={4}>
                            <Card sx={{ borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `5px solid ${colors.primaryAccent}` }}>
                                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                        INWARDS TONNAGE
                                    </Typography>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color: colors.primaryAccent }}>
                                        {inwardsTotal}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={8} md={4}>
                            <Card sx={{ borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `5px solid ${colors.lightAccent}` }}>
                                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                        TODAY'S INTERNAL
                                    </Typography>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color: colors.lightAccent }}>
                                        {todayInternalTotal}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={8} md={4}>
                            <Card sx={{ borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: "5px solid #16a34a" }}>
                                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                        OUTWARDS TONNAGE
                                    </Typography>
                                    <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color: "#16a34a" }}>
                                        {outwardsTotal}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* TABLE LAYOUT */}
                    <TableContainer
                        component={Paper}
                        elevation={2}
                        sx={{
                            borderRadius: 3,
                            border: `1px solid ${colors.tableBorder}`,
                            maxHeight: "calc(100vh - 190px)",
                            overflow: "auto",
                            boxShadow: "0 4px 18px rgba(0, 0, 0, 0.08)"
                        }}
                    >
                        <Table
                            stickyHeader
                            sx={{
                                tableLayout: "fixed",
                                "& td, & th": {
                                    border: `1px solid ${colors.tableBorder}`,
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                    py: 1.2,
                                    px: 2,
                                    textAlign: "center",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }
                            }}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell
                                        sx={{
                                            width: "30%",
                                            bgcolor: colors.primaryAccent,
                                            color: "#fff",
                                            fontWeight: 800,
                                            fontSize: "1.05rem",
                                            letterSpacing: 0.5,
                                            borderBottom: `2px solid ${colors.primaryAccent}`,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 5
                                        }}
                                    >
                                        {overallTotal}
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            width: "40%",
                                            bgcolor: colors.primaryAccent,
                                            color: "#fff",
                                            fontWeight: 800,
                                            letterSpacing: 0.5,
                                            borderBottom: `2px solid ${colors.primaryAccent}`,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 5
                                        }}
                                    >
                                        {dateLabel}
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            width: "30%",
                                            bgcolor: colors.primaryAccent,
                                            color: "#fff",
                                            fontWeight: 800,
                                            letterSpacing: 1,
                                            borderBottom: `2px solid ${colors.primaryAccent}`,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 5
                                        }}
                                    >
                                        TONNAGE
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {/* Row 2-4: Inwards Section */}
                                <TableRow>
                                    <TableCell rowSpan={3} sx={{ bgcolor: "#f8fafc", verticalAlign: "middle", borderBottom: `2px solid ${colors.primaryAccent}` }}>
                                        <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
                                            <Typography variant="body2" fontWeight={700} color="text.secondary">
                                                IN WARDS
                                            </Typography>
                                            <Typography variant="body1" fontWeight={800} sx={{ color: colors.primaryAccent }}>
                                                {inwardsTotal}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        PURCHASE
                                    </TableCell>
                                    <TableCell>
                                        {inwardsValues.purchase}
                                    </TableCell>
                                </TableRow>

                                <TableRow>
                                    <TableCell>AC GODOWN'S</TableCell>
                                    <TableCell>{inwardsValues.acGodownPurchase}</TableCell>
                                </TableRow>

                                <TableRow>
                                    <TableCell sx={{ borderBottom: `2px solid ${colors.primaryAccent}` }}>OTHER GODOWN'S</TableCell>
                                    <TableCell sx={{ borderBottom: `2px solid ${colors.primaryAccent}` }}>{inwardsValues.otherGodownPurchase}</TableCell>
                                </TableRow>

                                {/* Row 5-6: Internal Section (Only Process In and Process Out) */}
                                <TableRow>
                                    <TableCell rowSpan={2} sx={{ bgcolor: "#f8fafc", verticalAlign: "middle", borderBottom: `2px solid ${colors.primaryAccent}` }}>
                                        <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
                                            <Typography variant="body2" fontWeight={700} color="text.secondary">
                                                INTERNAL
                                            </Typography>
                                            <Typography variant="body1" fontWeight={800} sx={{ color: colors.primaryAccent }}>
                                                {todayInternalTotal}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        PROCESS IN
                                    </TableCell>
                                    <TableCell>
                                        {internalValues.processIn}
                                    </TableCell>
                                </TableRow>

                                <TableRow>
                                    <TableCell sx={{ borderBottom: `2px solid ${colors.primaryAccent}` }}>PROCESS OUT</TableCell>
                                    <TableCell sx={{ borderBottom: `2px solid ${colors.primaryAccent}` }}>{internalValues.processOut}</TableCell>
                                </TableRow>

                                {/* Row 7-9: Outwards Section */}
                                <TableRow>
                                    <TableCell rowSpan={3} sx={{ bgcolor: "#f8fafc", verticalAlign: "middle", borderBottom: `2px solid ${colors.primaryAccent}` }}>
                                        <Box display="flex" flexDirection="column" gap={0.5} alignItems="center">
                                            <Typography variant="body2" fontWeight={700} color="text.secondary">
                                                OUT WARDS
                                            </Typography>
                                            <Typography variant="body1" fontWeight={800} sx={{ color: colors.primaryAccent }}>
                                                {outwardsTotal}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        SALES
                                    </TableCell>
                                    <TableCell>
                                        {outwardsValues.sales}
                                    </TableCell>
                                </TableRow>

                                <TableRow>
                                    <TableCell>AC GODOWN'S</TableCell>
                                    <TableCell>{outwardsValues.acGodownSales || "-"}</TableCell>
                                </TableRow>

                                <TableRow>
                                    <TableCell sx={{ borderBottom: `2px solid ${colors.primaryAccent}` }}>OTHER GODOWN'S</TableCell>
                                    <TableCell sx={{ borderBottom: `2px solid ${colors.primaryAccent}` }}>{outwardsValues.otherGodownSales}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </AppLayout>
        </>
    );
};

export default SalesStockGodown;
