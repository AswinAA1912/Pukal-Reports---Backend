import React, { useEffect, useState } from "react";
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableContainer,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp, Edit, Delete } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { SettingsService } from "../services/reportSettings.services";
import { toast, ToastContainer } from "react-toastify";

// ✅ IMPORT HEADER
import Header from "../Layout/Header";

/* ================= TYPES ================= */

type TemplateType = {
    Type_Id: number;
    Report_Type: string;
};

type ReportItem = {
    Report_Id: number;
    Report_Name: string;
    templates: TemplateType[];
    CreatedBy: number;
    CreatedByName: string;
    CreatedAt: string;
};

type GroupedReports = Record<string, ReportItem[]>;

/* ================= COMPONENT ================= */

const ReportList: React.FC = () => {
    const [grouped, setGrouped] = useState<GroupedReports>({});
    const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await SettingsService.getReportList();
            setGrouped(res.data.data || {});
        } catch (err) {
            console.error(err);
            toast.error("Failed to load reports");
        } finally {
            setLoading(false);
        }
    };

    const toggleRow = (parent: string) => {
        setOpenRows((prev) => ({
            ...prev,
            [parent]: !prev[parent]
        }));
    };

    const handleCreate = () => {
        navigate("/settings");
    };

    const handleEdit = (reportId: number, typeId: number) => {
        navigate(`/settings?reportId=${reportId}&typeId=${typeId}`);
    };

    const handleDeleteClick = (reportId: number) => {
        setSelectedId(reportId);
        setDeleteOpen(true);
    };

    const confirmDelete = async () => {
        try {
            if (!selectedId) return;

            await SettingsService.deleteReport(selectedId);

            toast.success("Template Deleted Successfully");

            setDeleteOpen(false);
            setSelectedId(null);

            fetchReports();

        } catch (err) {
            toast.error("Delete Failed");
        }
    };

    const formatDateTime = (dateString: string) => {
        if (!dateString) return "-";

        const clean = dateString.replace("Z", "");

        const date = new Date(clean);

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");

        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;

        return `${day}-${month}-${year} ${String(hours).padStart(2, "0")}.${minutes} ${ampm}`;
    };

    return (
        <Box
            sx={{
                height: "100%",
                maxHeight: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxSizing: "border-box",
                backgroundColor: "#F1F5F9",
            }}
        >
            {/* ✅ HEADER */}
            <Header headerColor="#1E3A8A" />

            {/* ✅ PAGE CONTENT */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    p: 2,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxSizing: "border-box",
                }}
            >
                <ToastContainer />

                {/* TOP BAR */}
                <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                    flexShrink={0}
                >
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "#1E3A8A" }}>
                        Report Templates
                    </Typography>

                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        sx={{
                            textTransform: "none",
                            backgroundColor: "#1E3A8A",
                            "&:hover": { backgroundColor: "#1d4ed8" }
                        }}
                    >
                        Create Template
                    </Button>
                </Box>

                <Paper
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 2,
                        overflow: "hidden",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                >
                    {loading ? (
                        <Box p={3} textAlign="center" sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TableContainer
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                height: "100%",
                                overflow: "auto",
                            }}
                        >
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow
                                        sx={{
                                            backgroundColor: "#1E3A8A",
                                            "& th": {
                                                color: "#fff",
                                                backgroundColor: "#1E3A8A",
                                                fontWeight: 600,
                                                borderBottom: "none",
                                                whiteSpace: "nowrap",
                                                zIndex: 3,
                                            }
                                        }}
                                    >
                                        <TableCell width={50}></TableCell>
                                        <TableCell>Parent Report</TableCell>
                                        <TableCell>Template Name</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Created By</TableCell>
                                        <TableCell>Created At</TableCell>
                                        <TableCell align="center">Action</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {Object.keys(grouped).map((parent) => (
                                        <React.Fragment key={parent}>

                                            {/* 🔷 PARENT ROW */}
                                            <TableRow
                                                sx={{
                                                    backgroundColor: "#EEF2FF",
                                                    "& td": { borderBottom: "1px solid #e0e0e0" }
                                                }}
                                            >
                                                <TableCell>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => toggleRow(parent)}
                                                    >
                                                        {openRows[parent] ? (
                                                            <KeyboardArrowUp />
                                                        ) : (
                                                            <KeyboardArrowDown />
                                                        )}
                                                    </IconButton>
                                                </TableCell>

                                                <TableCell colSpan={6}>
                                                    <Typography fontWeight={600}>
                                                        {parent}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>

                                            {/* ✅ CHILD ROWS DIRECTLY */}
                                            {openRows[parent] &&
                                                grouped[parent].map((report) =>
                                                    report.templates.map((type) => (
                                                        <TableRow
                                                            key={`${report.Report_Id}-${type.Type_Id}`}
                                                            hover
                                                            sx={{
                                                                "&:hover": {
                                                                    backgroundColor: "#F9FAFB"
                                                                }
                                                            }}
                                                        >
                                                            {/* 1️⃣ Expand column */}
                                                            <TableCell width={50}></TableCell>

                                                            {/* 2️⃣ Parent column */}
                                                            <TableCell></TableCell>

                                                            {/* 3️⃣ Template Name */}
                                                            <TableCell sx={{ fontWeight: 500 }}>
                                                                {report.Report_Name}
                                                            </TableCell>

                                                            {/* 4️⃣ Type */}
                                                            <TableCell>
                                                                <Typography
                                                                    sx={{
                                                                        px: 1.5,
                                                                        py: 0.5,
                                                                        borderRadius: 1,
                                                                        display: "inline-block",
                                                                        backgroundColor:
                                                                            type.Report_Type === "Abstract"
                                                                                ? "#E0F2FE"
                                                                                : "#EDE9FE",
                                                                        color:
                                                                            type.Report_Type === "Abstract"
                                                                                ? "#0369A1"
                                                                                : "#5B21B6",
                                                                        fontSize: 13,
                                                                        fontWeight: 500
                                                                    }}
                                                                >
                                                                    {type.Report_Type}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell>
                                                                {report.CreatedByName || "-"}
                                                            </TableCell>

                                                            <TableCell>
                                                                {formatDateTime(report.CreatedAt)}
                                                            </TableCell>

                                                            {/* 5️⃣ Action */}
                                                            <TableCell align="center">
                                                                <Box display="flex" justifyContent="center" gap={1}>
                                                                    <IconButton
                                                                        color="primary"
                                                                        onClick={() =>
                                                                            handleEdit(report.Report_Id, type.Type_Id)
                                                                        }
                                                                        sx={{
                                                                            backgroundColor: "#EEF2FF",
                                                                            "&:hover": { backgroundColor: "#E0E7FF" }
                                                                        }}
                                                                    >
                                                                        <Edit fontSize="small" />
                                                                    </IconButton>

                                                                    <IconButton
                                                                        color="error"
                                                                        onClick={() =>
                                                                            handleDeleteClick(report.Report_Id)
                                                                        }
                                                                        sx={{
                                                                            backgroundColor: "#FEF2F2",
                                                                            "&:hover": { backgroundColor: "#FEE2E2" }
                                                                        }}
                                                                    >
                                                                        <Delete fontSize="small" />
                                                                    </IconButton>
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}

                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            </Box>

            <Dialog
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
            >
                <DialogTitle>Delete Template</DialogTitle>

                <DialogContent>
                    Are you sure want to delete this template?
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)}>
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={confirmDelete}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ReportList;