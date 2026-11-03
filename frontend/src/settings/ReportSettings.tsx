import React, { useEffect, useState } from "react";
import {
    Box,
    TextField,
    MenuItem,
    Typography,
    Switch,
    Button,
    CircularProgress,
    Paper,
    Grid
} from "@mui/material";
import { AxiosError } from "axios";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSearchParams, useNavigate, } from "react-router-dom";
import { SettingsService, Settings, SaveReportPayload } from "../services/reportSettings.services";

/* ================= TYPES ================= */

type ColumnConfig = {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
    groupBy: number;
    dataType?: string;
};

/* ================= COMPONENT ================= */

const ReportSettings: React.FC = () => {
    const today = dayjs().format("YYYY-MM-DD");

    /* ===== STATE ===== */

    const [settingsList, setSettingsList] = useState<Settings[]>([]);
    const [selectedSetting, setSelectedSetting] = useState<Settings | null>(null);

    const [reportName, setReportName] = useState("");
    const [type, setType] = useState<"Abstract" | "Expanded" | "">("");

    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [loading, setLoading] = useState(false);

    const [abstractColumns, setAbstractColumns] = useState<ColumnConfig[]>([]);

    const [searchParams] = useSearchParams();

    const reportId = searchParams.get("reportId");
    const typeId = searchParams.get("typeId");
    const userData = localStorage.getItem("user");
    const parsedUser = userData ? JSON.parse(userData) : null;
    const createdBy = parsedUser?.id || 0;

    const navigate = useNavigate();

    /* ================= LOAD SETTINGS ================= */
    const mapToSqlType = (value: any): string => {
        if (value === null || value === undefined) return "nvarchar";

        // 🔥 detect number types
        if (typeof value === "number") {
            return Number.isInteger(value) ? "int" : "decimal";
        }

        // 🔥 detect boolean
        if (typeof value === "boolean") return "bit";

        // 🔥 detect date
        if (value instanceof Date) return "datetime";

        // 🔥 detect string (default)
        return "nvarchar";
    };

    useEffect(() => {
        SettingsService.getMenuSP()
            .then((res) => {
                if (res.data.success) {
                    setSettingsList(res.data.data || []);
                }
            })
            .catch((err: AxiosError) => {
                console.error("Settings Load Error:", err.message);
            });
    }, []);

    /* ================= LOAD COLUMNS FROM SP ================= */

    useEffect(() => {
        // ❌ No type → stop
        if (!type) return;

        // ❌ EDIT MODE → DO NOT CALL SP
        if (reportId) return;

        // ❌ No selectedSetting → stop
        if (!selectedSetting) return;

        // ✅ SAFE ACCESS (no TS error)
        const spName =
            type === "Abstract"
                ? selectedSetting.Abstract_SP
                : selectedSetting.Expanded_SP;

        if (!spName) return;

        setLoading(true);

        SettingsService.executeSP({
            spName,
            params: {
                Fromdate: today,
                Todate: today,
            }
        })
            .then((res) => {
                const rows = res.data.data || [];

                if (!rows.length) {
                    setColumns([]);
                    return;
                }

                const cols: ColumnConfig[] = Object.keys(rows[0]).map((key, index) => ({
                    key,
                    label: key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase()),
                    enabled: true,
                    order: index + 1,
                    groupBy: 0,
                    dataType: mapToSqlType(rows[0][key])
                }));

                setColumns(cols);

                if (type === "Abstract" && abstractColumns.length === 0) {
                    setAbstractColumns(cols);
                }
            })
            .catch((err: AxiosError) => {
                console.error("SP Load Error:", err.message);
            })
            .finally(() => setLoading(false));

    }, [selectedSetting, type, today, reportId]);

    const loadReportForEdit = async (reportId: number, typeId: number) => {
        try {
            setLoading(true);

            if (settingsList.length === 0) return;

            // 🔥 STEP 1: CALL API FIRST (NO spName)
            const res = await SettingsService.getReportEditData({
                reportId,
                typeId
            });

            if (!res.data.success) {
                toast.error("Failed to load report");
                return;
            }

            const { reportInfo, columns } = res.data.data;

            // 🔥 STEP 2: SET REPORT NAME
            setReportName(reportInfo.Report_Name);

            // 🔥 STEP 3: FIND PARENT SETTING
            const parentSetting = settingsList.find(
                s => s.Report_Name === reportInfo.Parent_Report
            );

            if (!parentSetting) {
                toast.error("Parent setting not found");
                return;
            }

            setSelectedSetting(parentSetting);

            // 🔥 STEP 4: SET TYPE
            const detectedType = typeId === 1 ? "Abstract" : "Expanded";
            setType(detectedType);

            // 🔥 STEP 5: SET COLUMNS
            setColumns(columns);

            if (detectedType === "Abstract") {
                setAbstractColumns(columns);
            }

        } catch (err) {
            console.error(err);
            toast.error("Error loading report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!reportId || !typeId) return;
        if (settingsList.length === 0) return;

        loadReportForEdit(Number(reportId), Number(typeId));
    }, [reportId, typeId, settingsList]);

    /* ================= HANDLERS ================= */

    const updateColumn = (
        key: string,
        field: keyof ColumnConfig,
        value: number | boolean
    ) => {
        setColumns((prev) => {
            const updated = prev.map((col) =>
                col.key === key ? { ...col, [field]: value } : col
            );

            // ✅ Only store Abstract separately
            if (type === "Abstract") {
                setAbstractColumns(updated);
            }

            return updated;
        });
    };

    /* ================= SAVE ================= */

    const handleSave = async () => {
        try {
            // 🔥 EDIT MODE
            if (reportId && typeId) {
                try {
                    const res = await SettingsService.updateReport({
                        reportId: Number(reportId),
                        typeId: Number(typeId),
                        reportName: reportName.trim(),
                        columns
                    });

                    if (res.data.success) {
                        toast.success("Updated Successfully");

                        setTimeout(() => {
                            navigate("/templateList");
                        }, 1200); // ⏳ delay
                    } else {
                        toast.error("Update failed ❌");
                    }

                } catch (err) {
                    toast.error("Update error ❌");
                }

                return;
            }
            if (!selectedSetting) return toast.error("Select Parent Report");
            if (!selectedSetting) return toast.error("Select Report");
            if (!reportName.trim()) return toast.error("Enter Report Name");

            /* ===== STEP 1: ABSTRACT ===== */
            if (type === "Abstract") {
                if (!columns.some((c) => c.enabled)) {
                    return toast.error("Enable at least one column");
                }

                setAbstractColumns(columns);
                setType("Expanded");
                return;
            }

            /* ===== STEP 2: FINAL SAVE ===== */
            if (type === "Expanded") {
                if (!columns.some((c) => c.enabled)) {
                    return toast.error("Enable at least one column");
                }

                const payload: SaveReportPayload = {
                    reportName,
                    parentReport: selectedSetting.Report_Name,
                    abstractSP: selectedSetting.Abstract_SP,
                    expandedSP: selectedSetting.Expanded_SP,
                    abstractColumns: abstractColumns.filter(c => c.enabled),
                    expandedColumns: columns.filter(c => c.enabled),
                    createdBy 
                };

                const res = await SettingsService.saveReport(payload);

                if (res.data.success) {
                    toast.success("Report Saved Successfully");

                    setTimeout(() => {
                        navigate("/templateList");
                    }, 1200); // ⏳ delay

                    setReportName("");
                    setColumns([]);
                    setAbstractColumns([]);
                    setType("");
                    setSelectedSetting(null);
                } else {
                    toast.error("Save failed ❌");
                }
            }

        } catch (err: unknown) {
            const error = err as AxiosError;
            console.error("Save Error:", error.response?.data || error.message);
            toast.error("Error saving report ❌");
        }
    };
    /* ================= VALIDATION ================= */

    const isValid =
        selectedSetting &&
        reportName.trim() &&
        type &&
        columns.some((c) => c.enabled);

    const changeOrder = (key: string, direction: "inc" | "dec") => {
        setColumns((prev) =>
            prev.map((col) => {
                if (col.key !== key) return col;

                let value = col.order || 0;
                value = direction === "inc" ? value + 1 : value - 1;

                return { ...col, order: Math.max(1, value) };
            })
        );
    };

    const changeGroup = (key: string, direction: "inc" | "dec") => {
        setColumns((prev) =>
            prev.map((col) => {
                if (col.key !== key) return col;

                let value = col.groupBy || 0;
                value = direction === "inc" ? value + 1 : value - 1;

                // limit 0 → 3
                if (value < 0) value = 0;
                if (value > 3) value = 3;

                return { ...col, groupBy: value };
            })
        );
    };

    /* ================= UI ================= */

    return (
        <Box
            p={2}
            sx={{
                backgroundColor: "#f4f6f8",
                height: "100%",
                maxHeight: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <ToastContainer position="top-right" autoClose={3000} />
            <Paper sx={{ p: 3, flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Grid container spacing={2} sx={{ flex: 1, minHeight: 0, height: "100%" }}>

                    {/* LEFT SIDE */}
                    <Grid item xs={12} md={4} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <Box
                            sx={{
                                borderRight: "1px solid #ddd",
                                pr: 2,
                                height: "100%",
                                overflowY: "auto",
                            }}
                        >
                            <Typography variant="subtitle2" mb={2} color="text.secondary">
                                REPORT SETTINGS
                            </Typography>

                            {/* Menus / Pages */}
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Menus / Pages"
                                value={selectedSetting?.Report_Name || ""}
                                onChange={(e) => {
                                    if (reportId) return; // ❌ Prevent change in edit mode

                                    const selected =
                                        settingsList.find(
                                            (s) => s.Report_Name === e.target.value
                                        ) || null;

                                    setSelectedSetting(selected);
                                    setType("");
                                    setColumns([]);
                                    setAbstractColumns([]);
                                }}
                                sx={{ mb: 2 }}
                                disabled={!!reportId} // ✅ Disable in edit mode
                            >
                                {settingsList.map((s) => (
                                    <MenuItem key={s.Report_Name} value={s.Report_Name}>
                                        {s.Report_Name}
                                    </MenuItem>
                                ))}
                            </TextField>

                            {/* Report Name */}
                            <TextField
                                fullWidth
                                size="small"
                                label="Report Name"
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                                sx={{ mb: 2 }}
                            />

                            {/* Type */}
                            {selectedSetting && (
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Type"
                                    value={type}
                                    onChange={(e) => {
                                        if (reportId) return; // ❌ Prevent change in edit mode
                                        const newType = e.target.value as "Abstract" | "Expanded";
                                        setType(newType);
                                        if (!reportId) {
                                            setColumns([]);
                                        }
                                    }}
                                    disabled={!!reportId} // ✅ Disable in edit mode
                                >
                                    <MenuItem value="Abstract">Abstract</MenuItem>
                                    <MenuItem value="Expanded">Expanded</MenuItem>
                                </TextField>
                            )}
                        </Box>
                    </Grid>

                    {/* RIGHT SIDE */}
                    <Grid item xs={12} md={8} sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                        {/* TOP BAR */}
                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mb={2}
                            flexShrink={0}
                        >
                            <Typography variant="subtitle2" color="text.secondary">
                                COLUMNS
                            </Typography>

                            {isValid && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleSave}
                                    sx={{
                                        textTransform: "none",
                                        borderRadius: 1,
                                        px: 3,
                                    }}
                                >
                                    {type === "Abstract" ? "Next" : "Save"}
                                </Button>
                            )}
                        </Box>

                        {/* SCROLLABLE COLUMNS LIST */}
                        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
                            {loading ? (
                                <CircularProgress />
                            ) : (
                                <Grid container spacing={2}>

                                {/* 🔥 COLUMN BLOCK (Header + Items together) */}
                                {columns.map((col, index) => (
                                    <Grid item xs={12} sm={6} key={col.key}>

                                        {/* ✅ HEADER ONLY FOR FIRST ROW ITEMS */}
                                        {index < 2 && (
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns: "1fr 80px 80px 60px",
                                                    px: 2,
                                                    py: 1,
                                                    borderBottom: "1px solid #ccc",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: "#666",
                                                    mb: 1
                                                }}
                                            >
                                                <Typography>Column</Typography>
                                                <Typography textAlign="center">Order</Typography>
                                                <Typography textAlign="center">Group</Typography>
                                                <Typography textAlign="center">Enable</Typography>
                                            </Box>
                                        )}

                                        {/* CARD */}
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 80px 80px 60px",
                                                alignItems: "center",
                                                border: "1px solid #e0e0e0",
                                                borderRadius: 2,
                                                px: 2,
                                                py: 1,
                                                backgroundColor: col.enabled ? "#ffffff" : "#f5f5f5",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                                transition: "0.2s",
                                            }}
                                        >
                                            {/* NAME */}
                                            <Typography fontSize={13}>
                                                {col.label}
                                            </Typography>

                                            {/* ORDER */}
                                            <Box display="flex" justifyContent="center">
                                                <Button
                                                    size="small"
                                                    onClick={() => changeOrder(col.key, "dec")}
                                                    disabled={!col.enabled}
                                                    sx={{ minWidth: 24 }}
                                                >
                                                    {"<"}
                                                </Button>

                                                <TextField
                                                    value={col.order ?? 0}
                                                    size="small"
                                                    disabled={!col.enabled}
                                                    onChange={(e) =>
                                                        updateColumn(col.key, "order", Number(e.target.value))
                                                    }
                                                    sx={{ width: 40 }}
                                                    inputProps={{ style: { textAlign: "center", padding: 4 } }}
                                                />

                                                <Button
                                                    size="small"
                                                    onClick={() => changeOrder(col.key, "inc")}
                                                    disabled={!col.enabled}
                                                    sx={{ minWidth: 24 }}
                                                >
                                                    {">"}
                                                </Button>
                                            </Box>

                                            {/* GROUP */}
                                            <Box display="flex" justifyContent="center">
                                                <Button
                                                    size="small"
                                                    onClick={() => changeGroup(col.key, "dec")}
                                                    disabled={!col.enabled}
                                                    sx={{ minWidth: 24 }}
                                                >
                                                    {"<"}
                                                </Button>

                                                <TextField
                                                    value={col.groupBy ?? 0}
                                                    size="small"
                                                    disabled={!col.enabled}
                                                    onChange={(e) =>
                                                        updateColumn(col.key, "groupBy", Number(e.target.value))
                                                    }
                                                    sx={{ width: 40 }}
                                                    inputProps={{ style: { textAlign: "center", padding: 4 } }}
                                                />

                                                <Button
                                                    size="small"
                                                    onClick={() => changeGroup(col.key, "inc")}
                                                    disabled={!col.enabled}
                                                    sx={{ minWidth: 24 }}
                                                >
                                                    {">"}
                                                </Button>
                                            </Box>

                                            {/* SWITCH */}
                                            <Box textAlign="center">
                                                <Switch
                                                    size="small"
                                                    checked={col.enabled}
                                                    onChange={() =>
                                                        updateColumn(col.key, "enabled", !col.enabled)
                                                    }
                                                />
                                            </Box>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                        </Box>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default ReportSettings;