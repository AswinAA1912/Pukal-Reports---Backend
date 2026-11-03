import React, { useState, useMemo } from "react";
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    IconButton,
    Collapse,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    Divider,
    LinearProgress,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { toast } from "react-toastify";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import {
    TodayArrivalItem,
    TripDetail,
    DeliveryStatus,
    PurchaseReportFilterType,
    PurchaseReportService,
} from "../../services/purchaseReport.service";

/* ================= HELPER FORMATTERS ================= */

const formatCurrency = (val: number): string => {
    return "₹ " + Number(val || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatTonnage = (val: number): string => {
    return Number(val || 0).toFixed(3) + " MT";
};

/* ================= ROW COMPONENT ================= */

interface RowProps {
    row: TodayArrivalItem;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onViewTrip: (trip: TripDetail, refName: string) => void;
}

const PurchaseRow: React.FC<RowProps> = ({
    row,
    index,
    isExpanded,
    onToggle,
    onViewTrip,
}) => {
    const getDeliveryStatusChip = (status: DeliveryStatus) => {
        if (status === "Arrived Today") {
            return (
                <Chip
                    size="small"
                    icon={<CheckCircleOutlineIcon sx={{ fontSize: 13 }} />}
                    label="Arrived Today"
                    sx={{
                        bgcolor: "#dcfce7",
                        color: "#15803d",
                        fontWeight: 700,
                        fontSize: "0.68rem",
                        height: 20,
                        border: "1px solid #86efac",
                        "& .MuiChip-icon": { color: "#16a34a" },
                    }}
                />
            );
        }
        if (status === "Arrived Earlier") {
            return (
                <Chip
                    size="small"
                    icon={<CheckCircleOutlineIcon sx={{ fontSize: 13 }} />}
                    label="Arrived Earlier"
                    sx={{
                        bgcolor: "#e0f2fe",
                        color: "#0369a1",
                        fontWeight: 700,
                        fontSize: "0.68rem",
                        height: 20,
                        border: "1px solid #bae6fd",
                        "& .MuiChip-icon": { color: "#0284c7" },
                    }}
                />
            );
        }
        if (status === "Pending Delivery") {
            return (
                <Chip
                    size="small"
                    icon={<AccessTimeIcon sx={{ fontSize: 13 }} />}
                    label="Pending Delivery"
                    sx={{
                        bgcolor: "#fff7ed",
                        color: "#c2410c",
                        fontWeight: 700,
                        fontSize: "0.68rem",
                        height: 20,
                        border: "1px solid #fed7aa",
                        "& .MuiChip-icon": { color: "#ea580c" },
                    }}
                />
            );
        }
        if (status === "In Transit") {
            return (
                <Chip
                    size="small"
                    icon={<LocalShippingIcon sx={{ fontSize: 13 }} />}
                    label="In Transit"
                    sx={{
                        bgcolor: "#fef3c7",
                        color: "#b45309",
                        fontWeight: 700,
                        fontSize: "0.68rem",
                        height: 20,
                        border: "1px solid #fde68a",
                        "& .MuiChip-icon": { color: "#d97706" },
                    }}
                />
            );
        }
        return (
            <Chip
                size="small"
                icon={<AccessTimeIcon sx={{ fontSize: 13 }} />}
                label="Not Delivered"
                sx={{
                    bgcolor: "#fef3c7",
                    color: "#b45309",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    height: 20,
                    border: "1px solid #fde68a",
                    "& .MuiChip-icon": { color: "#d97706" },
                }}
            />
        );
    };

    return (
        <React.Fragment>
            {/* PARENT ROW: TODAY'S ARRIVAL ITEM */}
            <TableRow
                hover
                onClick={onToggle}
                sx={{
                    cursor: "pointer",
                    backgroundColor: isExpanded ? "#f8fafc" : index % 2 === 1 ? "#fafbfc" : "#ffffff",
                    transition: "background-color 0.2s ease",
                    borderBottom: isExpanded ? "none" : "1px solid #e2e8f0",
                    "&:hover": {
                        backgroundColor: "#f1f5f9 !important",
                    },
                }}
            >
                {/* # CHEVRON */}
                <TableCell
                    align="center"
                    sx={{
                        width: 38,
                        py: 0.5,
                        px: 0.5,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    <IconButton
                        size="small"
                        aria-label="expand row"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                        sx={{
                            p: 0.2,
                            color: isExpanded ? "#1e3a8a" : "#64748b",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease, color 0.2s ease",
                        }}
                    >
                        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </TableCell>

                {/* S.NO */}
                <TableCell
                    sx={{
                        fontWeight: 600,
                        color: "#475569",
                        fontSize: "0.78rem",
                        width: 55,
                        py: 0.5,
                        px: 1,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    {row.sNo}
                </TableCell>

                {/* DATE (TODAY'S ARRIVAL DATE) */}
                <TableCell
                    sx={{
                        fontWeight: 600,
                        color: "#1e3a8a",
                        fontSize: "0.78rem",
                        width: 100,
                        py: 0.5,
                        px: 1,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    {row.date}
                </TableCell>

                {/* ORDER ID */}
                <TableCell
                    sx={{
                        width: 135,
                        py: 0.5,
                        px: 1,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    <Chip
                        size="small"
                        label={row.orderId}
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/purchaseItemPayment?orderId=${encodeURIComponent(row.orderId)}`, "_blank");
                        }}
                        title="Click to view Item & Invoice Payment details for this order in new tab"
                        sx={{
                            height: 20,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            bgcolor: "#e0f2fe",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                            cursor: "pointer",
                            "&:hover": {
                                bgcolor: "#bae6fd",
                                textDecoration: "underline",
                            },
                        }}
                    />
                </TableCell>

                {/* ITEM NAME */}
                <TableCell
                    sx={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.80rem",
                        py: 0.5,
                        px: 1,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 700, color: "#0f172a", fontSize: "0.80rem" }}>
                            {row.itemName}
                        </Typography>
                        {row.statusTag && (
                            <Chip
                                size="small"
                                label={row.statusTag}
                                sx={{
                                    height: 18,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    bgcolor: row.statusTag === "Pending Delivery"
                                        ? "#fff7ed"
                                        : row.statusTag === "In Transit"
                                            ? "#fef3c7"
                                            : row.statusTag.includes("Due") || row.statusTag === "Unpaid"
                                                ? "#fee2e2"
                                                : "#dcfce7",
                                    color: row.statusTag === "Pending Delivery"
                                        ? "#c2410c"
                                        : row.statusTag === "In Transit"
                                            ? "#b45309"
                                            : row.statusTag.includes("Due") || row.statusTag === "Unpaid"
                                                ? "#dc2626"
                                                : "#15803d",
                                    border: row.statusTag === "Pending Delivery"
                                        ? "1px solid #fed7aa"
                                        : row.statusTag === "In Transit"
                                            ? "1px solid #fde68a"
                                            : row.statusTag.includes("Due") || row.statusTag === "Unpaid"
                                                ? "1px solid #fca5a5"
                                                : "1px solid #86efac",
                                }}
                            />
                        )}
                    </Box>
                </TableCell>

                {/* RETAILER NAME */}
                <TableCell
                    sx={{
                        py: 0.5,
                        px: 1,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    <Box sx={{ display: "inline-flex", alignItems: "baseline" }}>
                        <Typography
                            component="span"
                            sx={{
                                fontWeight: 700,
                                fontSize: "0.78rem",
                                color: "#1e293b",
                            }}
                        >
                            {row.retailerName},
                        </Typography>
                        <Typography
                            component="span"
                            sx={{
                                color: "#64748b",
                                fontSize: "0.72rem",
                                fontWeight: 500,
                                ml: 0.5,
                            }}
                        >
                            {row.city}
                        </Typography>
                    </Box>
                </TableCell>

                {/* TONNAGE OF THAT ITEM */}
                <TableCell
                    align="right"
                    sx={{
                        fontWeight: 700,
                        color: "#0f172a",
                        fontSize: "0.80rem",
                        width: 120,
                        py: 0.5,
                        px: 1,
                        borderRight: "1px solid #eef2f6",
                    }}
                >
                    {formatTonnage(row.tonnage)}
                </TableCell>

                {/* INVOICE VALUE OF THAT PARTICULAR PRODUCT */}
                <TableCell
                    align="right"
                    sx={{
                        fontWeight: 700,
                        color: "#166534",
                        fontSize: "0.80rem",
                        width: 140,
                        py: 0.5,
                        px: 1,
                        borderRight: "none",
                    }}
                >
                    {formatCurrency(row.itemValue)}
                </TableCell>
            </TableRow>

            {/* EXPANDED ROW: WHOLE ORDER DETAILS */}
            <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                <TableCell
                    colSpan={8}
                    sx={{
                        py: 0,
                        px: { xs: 0.5, md: 2 },
                        backgroundColor: "#f8fafc",
                        borderBottom: isExpanded ? "2px solid #cbd5e1" : "none",
                    }}
                >
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box
                            sx={{
                                my: 1,
                                p: 1.2,
                                bgcolor: "#ffffff",
                                borderRadius: 1.5,
                                border: "1px solid #cbd5e1",
                                borderLeft: "4px solid #1e3a8a",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                            }}
                        >
                            {/* ORDER SUMMARY HEADER BAR */}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    bgcolor: "#f1f5f9",
                                    px: 1.5,
                                    py: 0.8,
                                    borderRadius: 1,
                                    mb: 1,
                                    gap: 1,
                                    border: "1px solid #e2e8f0",
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                        <ReceiptLongIcon sx={{ fontSize: 18, color: "#1e3a8a" }} />
                                        <Typography sx={{ fontWeight: 800, fontSize: "0.82rem", color: "#0f172a" }}>
                                            Order: {row.order.orderId}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                        Booked: <strong>{row.order.orderDate}</strong>
                                    </Typography>
                                    <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                        Retailer: <strong>{row.order.retailerName}</strong> ({row.order.city}, {row.order.state})
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={`${row.order.items.length} Items Ordered`}
                                        sx={{
                                            height: 18,
                                            fontSize: "0.65rem",
                                            fontWeight: 700,
                                            bgcolor: "#e2e8f0",
                                            color: "#334155",
                                        }}
                                    />
                                </Box>

                                {/* QUICK INTERLINK NAVIGATION ACTIONS (Open in New Tab) */}
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<LocalShippingOutlinedIcon sx={{ fontSize: 13 }} />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const effectiveFrom = row.order?.orderDate && dayjs(row.order.orderDate).isValid()
                                                ? dayjs(row.order.orderDate).format("YYYY-MM-DD")
                                                : "";
                                            const today = dayjs().format("YYYY-MM-DD");
                                            const url = effectiveFrom
                                                ? `/purchaseDelivery?orderId=${encodeURIComponent(row.order.orderId)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(today)}`
                                                : `/purchaseDelivery?orderId=${encodeURIComponent(row.order.orderId)}`;
                                            window.open(url, "_blank");
                                        }}
                                        sx={{
                                            textTransform: "none",
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            py: 0.2,
                                            px: 1,
                                            color: "#1e3a8a",
                                            borderColor: "#bfdbfe",
                                            bgcolor: "#ffffff",
                                            "&:hover": { bgcolor: "#eff6ff", borderColor: "#93c5fd" },
                                        }}
                                    >
                                        Delivery
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<PaymentOutlinedIcon sx={{ fontSize: 13 }} />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const effectiveFrom = row.order?.orderDate && dayjs(row.order.orderDate).isValid()
                                                ? dayjs(row.order.orderDate).format("YYYY-MM-DD")
                                                : "";
                                            const today = dayjs().format("YYYY-MM-DD");
                                            const url = effectiveFrom
                                                ? `/purchasePayment?orderId=${encodeURIComponent(row.order.orderId)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(today)}`
                                                : `/purchasePayment?orderId=${encodeURIComponent(row.order.orderId)}`;
                                            window.open(url, "_blank");
                                        }}
                                        sx={{
                                            textTransform: "none",
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            py: 0.2,
                                            px: 1,
                                            color: "#1e3a8a",
                                            borderColor: "#bfdbfe",
                                            bgcolor: "#ffffff",
                                            "&:hover": { bgcolor: "#eff6ff", borderColor: "#93c5fd" },
                                        }}
                                    >
                                        Payment
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<TableViewOutlinedIcon sx={{ fontSize: 13 }} />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`/purchaseItemPayment?orderId=${encodeURIComponent(row.order.orderId)}`, "_blank");
                                        }}
                                        sx={{
                                            textTransform: "none",
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            py: 0.2,
                                            px: 1,
                                            color: "#ffffff",
                                            bgcolor: "#1e3a8a",
                                            "&:hover": { bgcolor: "#1e40af" },
                                        }}
                                    >
                                        Item Payment
                                    </Button>
                                </Box>
                            </Box>

                            {/* WHOLE ORDER ITEMS SUBTABLE */}
                            <TableContainer sx={{ borderRadius: 1, border: "1px solid #edf2f7" }}>
                                <Table size="small" aria-label="whole order items">
                                    <TableHead>
                                        <TableRow
                                            sx={{
                                                "& th": {
                                                    bgcolor: "#1E3A8A",
                                                    color: "#ffffff",
                                                    fontWeight: 700,
                                                    fontSize: "0.74rem",
                                                    py: 0.5,
                                                    px: 1,
                                                    borderRight: "1px solid rgba(255, 255, 255, 0.15)",
                                                },
                                            }}
                                        >
                                            <TableCell sx={{ width: 40 }} align="center">#</TableCell>
                                            <TableCell>Item Name</TableCell>
                                            <TableCell sx={{ width: 110 }}>Order Qty</TableCell>
                                            <TableCell align="right" sx={{ width: 110 }}>Tonnage</TableCell>
                                            <TableCell align="right" sx={{ width: 110 }}>Rate / MT</TableCell>
                                            <TableCell align="right" sx={{ width: 130 }}>Item Value</TableCell>
                                            <TableCell align="center" sx={{ width: 110 }}>Arrival Date</TableCell>
                                            <TableCell align="center" sx={{ width: 130 }}>Delivery Status</TableCell>
                                            <TableCell align="center" sx={{ width: 90, borderRight: "none" }}>Trip Info</TableCell>
                                        </TableRow>

                                        {/* EXPANDED TOTAL ROW (TOTAL ORDER VALUE & TONNAGE) */}
                                        <TableRow
                                            sx={{
                                                bgcolor: "#f1f5f9",
                                                borderBottom: "2px solid #cbd5e1",
                                                "& td": {
                                                    fontWeight: 800,
                                                    fontSize: "0.75rem",
                                                    py: 0.5,
                                                    px: 1,
                                                    color: "#1e293b",
                                                    borderRight: "1px solid #e2e8f0",
                                                },
                                            }}
                                        >
                                            <TableCell colSpan={3} sx={{ color: "#1e3a8a", fontWeight: 800 }}>
                                                TOTAL ORDER ({row.order.items.length} Items)
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: "#0f172a" }}>
                                                {formatTonnage(row.order.totalOrderTonnage)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, color: "#475569", fontSize: "0.74rem" }}>
                                                {formatCurrency(row.order.totalOrderValue / (row.order.totalOrderTonnage || 1))}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: "#166534" }}>
                                                {formatCurrency(row.order.totalOrderValue)}
                                            </TableCell>
                                            <TableCell colSpan={3} align="center" sx={{ borderRight: "none", fontSize: "0.72rem", color: "#475569" }}>
                                                Paid: <strong>{formatCurrency(row.order.paidAmount)}</strong> | Balance: <strong style={{ color: row.order.balanceAmount > 0 ? "#dc2626" : "#166534" }}>{formatCurrency(row.order.balanceAmount)}</strong>
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {row.order.items.map((item, itemIdx) => (
                                            <TableRow
                                                key={item.id}
                                                hover
                                                sx={{
                                                    backgroundColor: item.status === "Arrived Today" ? "#f0fdf4" : "inherit",
                                                    "&:last-child td, &:last-child th": { border: 0 },
                                                    "&:hover": { bgcolor: item.status === "Arrived Today" ? "#dcfce7 !important" : "#f8fafc" },
                                                }}
                                            >
                                                {/* ITEM # */}
                                                <TableCell align="center" sx={{ fontSize: "0.74rem", color: "#64748b", py: 0.4, px: 0.5 }}>
                                                    {item.itemNo}
                                                </TableCell>

                                                {/* ITEM NAME */}
                                                <TableCell sx={{ py: 0.4, px: 1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography sx={{ fontWeight: item.status === "Arrived Today" ? 700 : 600, fontSize: "0.76rem", color: "#0f172a" }}>
                                                            {item.itemName}
                                                        </Typography>
                                                        {item.status === "Arrived Today" && (
                                                            <Chip
                                                                label="Arrived Today"
                                                                size="small"
                                                                sx={{ height: 16, fontSize: "0.60rem", bgcolor: "#166534", color: "#fff", fontWeight: 700 }}
                                                            />
                                                        )}
                                                    </Box>
                                                </TableCell>

                                                {/* ORDER QTY */}
                                                <TableCell sx={{ fontSize: "0.74rem", color: "#334155", py: 0.4, px: 1 }}>
                                                    {item.qty}
                                                </TableCell>

                                                {/* TONNAGE */}
                                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", color: "#0f172a", py: 0.4, px: 1 }}>
                                                    {formatTonnage(item.tonnage)}
                                                </TableCell>

                                                {/* RATE */}
                                                <TableCell align="right" sx={{ fontSize: "0.74rem", color: "#64748b", py: 0.4, px: 1 }}>
                                                    {formatCurrency(item.rate)}
                                                </TableCell>

                                                {/* ITEM VALUE */}
                                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "#166534", py: 0.4, px: 1 }}>
                                                    {formatCurrency(item.itemValue)}
                                                </TableCell>

                                                {/* ARRIVAL / DELIVERY DATE */}
                                                <TableCell align="center" sx={{ fontSize: "0.74rem", py: 0.4, px: 1 }}>
                                                    {item.arrivalDate !== "-" ? (
                                                        <Typography
                                                            sx={{
                                                                fontSize: "0.74rem",
                                                                fontWeight: item.status === "Arrived Today" ? 700 : 500,
                                                                color: item.status === "Arrived Today" ? "#15803d" : "#334155",
                                                            }}
                                                        >
                                                            {item.arrivalDate}
                                                        </Typography>
                                                    ) : (
                                                        <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8" }}>-</Typography>
                                                    )}
                                                </TableCell>

                                                {/* DELIVERY STATUS */}
                                                <TableCell align="center" sx={{ py: 0.4, px: 1 }}>
                                                    {getDeliveryStatusChip(item.status)}
                                                </TableCell>

                                                {/* TRIP DETAILS */}
                                                <TableCell align="center" sx={{ py: 0.4, px: 1 }}>
                                                    {item.tripDetail ? (
                                                        <Chip
                                                            size="small"
                                                            icon={<LocalShippingIcon sx={{ fontSize: 13 }} />}
                                                            label={`Trip - ${itemIdx + 1}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onViewTrip(item.tripDetail!, `${row.orderId} - ${item.itemName}`);
                                                            }}
                                                            sx={{
                                                                height: 20,
                                                                fontSize: "0.68rem",
                                                                fontWeight: 700,
                                                                bgcolor: "#eff6ff",
                                                                color: "#1e3a8a",
                                                                border: "1px solid #bfdbfe",
                                                                cursor: "pointer",
                                                                "&:hover": { bgcolor: "#dbeafe" },
                                                            }}
                                                        />
                                                    ) : (
                                                        <Typography sx={{ color: "#94a3b8", fontSize: "0.74rem" }}>-</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
};

/* ================= MAIN COMPONENT ================= */

const PurchaseReport: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Specific order passed from navigation
    const navOrderId =
        location.state?.orderId ||
        location.state?.altOrderId ||
        location.state?.searchQuery ||
        searchParams.get("orderId") ||
        searchParams.get("po") ||
        "";

    const [selectedOrderOnly, setSelectedOrderOnly] = useState<string>(navOrderId);
    const today = dayjs().format("YYYY-MM-DD");
    const currentMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");
    const [activeFilter, setActiveFilter] = useState<PurchaseReportFilterType>("today_arrival");
    const [fromDate, setFromDate] = useState(currentMonthStart);
    const [toDate, setToDate] = useState(today);
    const [tempFromDate, setTempFromDate] = useState(currentMonthStart);
    const [tempToDate, setTempToDate] = useState(today);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);
    const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(null);
    const [tripItemRef, setTripItemRef] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [dataMap, setDataMap] = useState<Record<PurchaseReportFilterType, TodayArrivalItem[]>>({
        today_arrival: [],
        pending_orders: [],
        pending_payments: [],
        completed: [],
    });

    // Load live dataset from APIs
    React.useEffect(() => {
        let isMounted = true;
        const loadReportData = async () => {
            setLoading(true);
            try {
                const [todayRes, pendingOrdersRes, pendingPaymentsRes, completedRes] = await Promise.all([
                    PurchaseReportService.getPurchaseReportData({ fromDate, toDate, filterType: "today_arrival" }),
                    PurchaseReportService.getPurchaseReportData({ fromDate, toDate, filterType: "pending_orders" }),
                    PurchaseReportService.getPurchaseReportData({ fromDate, toDate, filterType: "pending_payments" }),
                    PurchaseReportService.getPurchaseReportData({ fromDate, toDate, filterType: "completed" }),
                ]);

                if (isMounted) {
                    setDataMap({
                        today_arrival: todayRes.data || [],
                        pending_orders: pendingOrdersRes.data || [],
                        pending_payments: pendingPaymentsRes.data || [],
                        completed: completedRes.data || [],
                    });
                }
            } catch (err) {
                console.error("Failed to load live purchase report data:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadReportData();
        return () => {
            isMounted = false;
        };
    }, [fromDate, toDate]);

    // Keep selectedOrderOnly synced if location.state or query changes
    React.useEffect(() => {
        const oId =
            location.state?.orderId ||
            location.state?.altOrderId ||
            location.state?.purOrderNo ||
            location.state?.searchQuery ||
            searchParams.get("orderId") ||
            searchParams.get("po") ||
            "";
        if (oId) {
            setSelectedOrderOnly(oId);
            setPage(1);
        }
    }, [location.state, searchParams]);

    // Auto-expand and focus when navigated with a specific order
    React.useEffect(() => {
        if (selectedOrderOnly) {
            const q = selectedOrderOnly.toLowerCase().trim();
            const map: Record<string, boolean> = {};
            const allItems = [
                ...dataMap.today_arrival,
                ...dataMap.pending_orders,
                ...dataMap.pending_payments,
                ...dataMap.completed,
            ];
            allItems.forEach((row) => {
                if (
                    row.orderId?.toLowerCase().includes(q) ||
                    row.order?.orderId?.toLowerCase().includes(q) ||
                    (row.purOrderNo && row.purOrderNo.toLowerCase().includes(q))
                ) {
                    map[row.id] = true;
                }
            });
            setExpandedRows(map);
        }
    }, [selectedOrderOnly, dataMap]);

    // Toggle single row expansion
    const toggleRow = (id: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    // Filter counts for radio badges
    const filterCounts = useMemo(() => {
        return {
            today_arrival: dataMap.today_arrival.length,
            pending_orders: dataMap.pending_orders.length,
            pending_payments: dataMap.pending_payments.length,
            completed: dataMap.completed.length,
        };
    }, [dataMap]);

    // Change radio filter immediately upon clicking itself (no apply button needed for radio)
    const handleFilterChange = (newFilter: PurchaseReportFilterType) => {
        setActiveFilter(newFilter);
        setPage(1);
        setExpandedRows({});
    };

    const handleApplyFilter = () => {
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        setPage(1);
        setExpandedRows({});
        setDrawerOpen(false);
        toast.success("Filters applied successfully!");
    };

    // Base data based on selected Radio filter
    const rawData = useMemo(() => {
        return dataMap[activeFilter] || [];
    }, [dataMap, activeFilter]);

    // Filter by Date Range (From Date & To Date) or specific order
    const filteredData = useMemo(() => {
        if (selectedOrderOnly) {
            const q = selectedOrderOnly.toLowerCase().trim();
            const allItems = [
                ...dataMap.today_arrival,
                ...dataMap.pending_orders,
                ...dataMap.pending_payments,
                ...dataMap.completed,
            ];
            const seen = new Set<string>();
            return allItems.filter((row) => {
                if (seen.has(row.id)) return false;
                seen.add(row.id);
                return (
                    row.orderId?.toLowerCase().includes(q) ||
                    row.order?.orderId?.toLowerCase().includes(q) ||
                    (row.purOrderNo && row.purOrderNo.toLowerCase().includes(q))
                );
            });
        }

        if (!fromDate && !toDate) return rawData;

        // When default today-to-today date filter is active, display full dataset for pending orders / payments / completed
        if (activeFilter !== "today_arrival" && fromDate === today && toDate === today) {
            return rawData;
        }

        const from = fromDate ? dayjs(fromDate) : null;
        const to = toDate ? dayjs(toDate) : null;

        return rawData.filter((row) => {
            const parts = row.date.split("/");
            if (parts.length === 3) {
                const rowDate = dayjs(`${parts[2]}-${parts[1]}-${parts[0]}`);
                if (!rowDate.isValid()) return true;

                if (from && to) {
                    return (
                        (rowDate.isAfter(from) || rowDate.isSame(from, "day")) &&
                        (rowDate.isBefore(to) || rowDate.isSame(to, "day"))
                    );
                } else if (from) {
                    return rowDate.isAfter(from) || rowDate.isSame(from, "day");
                } else if (to) {
                    return rowDate.isBefore(to) || rowDate.isSame(to, "day");
                }
            }
            return true;
        });
    }, [rawData, fromDate, toDate, activeFilter, today]);

    // Dynamic metadata depending on active filter
    const filterMeta = useMemo(() => {
        switch (activeFilter) {
            case "today_arrival":
                return {
                    title: "Purchase Report - Today's Arrival List",
                    chipLabel: `${filteredData.length} Arrival Items`,
                    totalLabel: `TOTAL ARRIVALS TODAY (${filteredData.length} Items)`,
                    emptyMessage: "No arrival items recorded for today.",
                    excelSheetName: "Today's Arrivals",
                    pdfTitle: "PURCHASE REPORT - TODAY'S ARRIVAL LIST",
                    filePrefix: "Purchase_Today_Arrival_Report",
                };
            case "pending_orders":
                return {
                    title: "Purchase Report - Pending Orders",
                    chipLabel: `${filteredData.length} Pending Orders`,
                    totalLabel: `TOTAL PENDING ORDERS (${filteredData.length} Items)`,
                    emptyMessage: "No pending orders found.",
                    excelSheetName: "Pending Orders",
                    pdfTitle: "PURCHASE REPORT - PENDING ORDERS",
                    filePrefix: "Purchase_Pending_Orders_Report",
                };
            case "pending_payments":
                return {
                    title: "Purchase Report - Pending Payments",
                    chipLabel: `${filteredData.length} Pending Payments`,
                    totalLabel: `TOTAL PENDING PAYMENTS (${filteredData.length} Orders)`,
                    emptyMessage: "No pending payments found.",
                    excelSheetName: "Pending Payments",
                    pdfTitle: "PURCHASE REPORT - PENDING PAYMENTS",
                    filePrefix: "Purchase_Pending_Payments_Report",
                };
            case "completed":
                return {
                    title: "Purchase Report - Completed Orders",
                    chipLabel: `${filteredData.length} Completed Orders`,
                    totalLabel: `TOTAL COMPLETED PURCHASES (${filteredData.length} Orders)`,
                    emptyMessage: "No completed orders found.",
                    excelSheetName: "Completed Orders",
                    pdfTitle: "PURCHASE REPORT - COMPLETED ORDERS",
                    filePrefix: "Purchase_Completed_Report",
                };
            default:
                return {
                    title: "Purchase Report",
                    chipLabel: `${filteredData.length} Items`,
                    totalLabel: `TOTAL ITEMS (${filteredData.length})`,
                    emptyMessage: "No records found.",
                    excelSheetName: "Purchase Report",
                    pdfTitle: "PURCHASE REPORT",
                    filePrefix: "Purchase_Report",
                };
        }
    }, [activeFilter, filteredData.length]);

    // Paginated slice (1-indexed page)
    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    // Grand Totals for main table (Tonnage & Value)
    const grandTotals = useMemo(() => {
        let tonnage = 0;
        let value = 0;
        filteredData.forEach((p) => {
            tonnage += p.tonnage;
            value += p.itemValue;
        });
        return { tonnage, value };
    }, [filteredData]);

    const handleViewTrip = (trip: TripDetail, refName: string) => {
        setSelectedTrip(trip);
        setTripItemRef(refName);
    };

    /* ================= EXPORT HANDLERS ================= */

    const handleExportExcel = () => {
        try {
            const exportRows = filteredData.map((row) => ({
                "S.No": row.sNo,
                "Date": row.date,
                "Order ID": row.orderId,
                "Item Name": row.itemName,
                "Status": row.statusTag || "Arrived Today",
                "Retailer Name": row.retailerName,
                "City": row.city,
                "Tonnage (MT)": row.tonnage,
                "Value (₹)": row.itemValue,
                "Total Order Tonnage (MT)": row.order.totalOrderTonnage,
                "Total Order Value (₹)": row.order.totalOrderValue,
                "Payment Status": row.order.paymentStatus,
                "Paid Amount (₹)": row.order.paidAmount,
                "Balance Amount (₹)": row.order.balanceAmount,
            }));

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, filterMeta.excelSheetName);

            XLSX.writeFile(wb, `${filterMeta.filePrefix}_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
            toast.success("Excel report downloaded successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export Excel report.");
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF("landscape", "mm", "a4");

            doc.setFontSize(14);
            doc.setTextColor(30, 58, 138);
            doc.text(filterMeta.pdfTitle, 14, 15);

            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`Generated on: ${dayjs().format("DD/MM/YYYY HH:mm")} | Total Items: ${filteredData.length}`, 14, 21);

            const tableHeaders = [
                ["S.No", "Date", "Order ID", "Item Name", "Retailer", "City", "Tonnage (MT)", "Value (₹)", "Order Total (₹)", "Payment"]
            ];

            const tableData = filteredData.map((r) => [
                r.sNo,
                r.date,
                r.orderId,
                r.itemName,
                r.retailerName,
                r.city,
                formatTonnage(r.tonnage),
                formatCurrency(r.itemValue),
                formatCurrency(r.order.totalOrderValue),
                r.order.paymentStatus,
            ]);

            autoTable(doc, {
                head: tableHeaders,
                body: tableData,
                startY: 25,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
                alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            doc.save(`${filterMeta.filePrefix}_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
            toast.success("PDF report downloaded successfully!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export PDF report.");
        }
    };

    return (
        <Box
            sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: "#f8fafc",
            }}
        >
            {/* TOP NAVIGATION BAR */}
            <PageHeader
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                showPages={true}
            />

            {/* MAIN CONTENT WRAPPER */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    px: { xs: 2, md: 3 },
                    pt: 1.2,
                    pb: 1,
                    gap: 1,
                }}
            >
                {/* ACTIVE ORDER FILTER BANNER (No top tabs) */}
                {selectedOrderOnly && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            bgcolor: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: 1.5,
                            px: 1.5,
                            py: 0.8,
                            mb: 1.2,
                            flexShrink: 0,
                            gap: 1,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <ReceiptLongIcon sx={{ color: "#1e3a8a", fontSize: 18 }} />
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e3a8a" }}>
                                Showing Purchase Detailed for Order: <strong>{selectedOrderOnly}</strong> ({filteredData.length} records)
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setSelectedOrderOnly("");
                                navigate("/purchasereport", { replace: true });
                            }}
                            sx={{
                                textTransform: "none",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                py: 0.3,
                                px: 1.2,
                                bgcolor: "#ffffff",
                            }}
                        >
                            Clear Filter & View All Orders
                        </Button>
                    </Box>
                )}

                {/* OUTSIDE TABLE: TITLE & CONTROLS BAR */}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", lg: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", lg: "center" },
                        gap: 1.2,
                        mb: 1.2,
                        flexShrink: 0,
                    }}
                >
                    {/* TITLE ON LEFT */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 700,
                                color: "#1e3a8a",
                                fontSize: "1.05rem",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {filterMeta.title}
                        </Typography>
                        <Chip
                            size="small"
                            label={filterMeta.chipLabel}
                            sx={{
                                height: 22,
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                bgcolor: "#e2e8f0",
                                color: "#334155",
                            }}
                        />
                    </Box>
                </Box>

                {/* MAIN TABLE CARD (PAPER CONTAINS ONLY THE TABLE) */}
                <Paper
                    elevation={0}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 1.5,
                        border: "1px solid #e2e8f0",
                        bgcolor: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        overflow: "hidden",
                    }}
                >
                    {loading && <LinearProgress sx={{ height: 3 }} />}
                    {/* TABLE CONTAINER (INTERNAL SCROLL ONLY - PAGINATION REMAINS PINNED) */}
                    <TableContainer
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflow: "auto",
                        }}
                    >
                        <Table size="small" stickyHeader aria-label="purchase arrival table">
                            {/* TABLE HEADER (#1E3A8A UI MATCHING OTHER REPORTS) */}
                            <TableHead>
                                <TableRow
                                    sx={{
                                        "& th": {
                                            bgcolor: "#1E3A8A",
                                            fontWeight: 700,
                                            color: "#ffffff",
                                            fontSize: "0.78rem",
                                            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
                                            py: 0.7,
                                            px: 1,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 4,
                                        },
                                    }}
                                >
                                    <TableCell align="center" sx={{ width: 38, px: 0.5 }}>
                                        #
                                    </TableCell>

                                    <TableCell sx={{ width: 55 }}>
                                        SNo
                                    </TableCell>

                                    <TableCell sx={{ width: 100 }}>
                                        Date
                                    </TableCell>

                                    <TableCell sx={{ width: 135 }}>
                                        Order Id
                                    </TableCell>

                                    <TableCell>
                                        Item Name
                                    </TableCell>

                                    <TableCell sx={{ width: 220 }}>
                                        Retailer Name
                                    </TableCell>

                                    <TableCell align="right" sx={{ width: 120 }}>
                                        Tonnage
                                    </TableCell>

                                    <TableCell align="right" sx={{ width: 140, borderRight: "none" }}>
                                        Value
                                    </TableCell>
                                </TableRow>

                                {/* TOTAL ROW (PLACED IMMEDIATELY BELOW TABLE HEADER - STICKY AT TOP) */}
                                <TableRow
                                    sx={{
                                        bgcolor: "#f1f5f9",
                                        borderBottom: "2px solid #cbd5e1",
                                        "& th, & td": {
                                            fontWeight: 800,
                                            fontSize: "0.78rem",
                                            py: 0.6,
                                            px: 1,
                                            color: "#0f172a",
                                            borderRight: "1px solid #e2e8f0",
                                            position: "sticky",
                                            top: "31px",
                                            zIndex: 3,
                                            bgcolor: "#f1f5f9",
                                        },
                                    }}
                                >
                                    <TableCell colSpan={6} sx={{ color: "#1e3a8a", fontWeight: 800, px: 1.5 }}>
                                        {filterMeta.totalLabel}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800, color: "#0f172a" }}>
                                        {formatTonnage(grandTotals.tonnage)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800, color: "#166534", borderRight: "none" }}>
                                        {formatCurrency(grandTotals.value)}
                                    </TableCell>
                                </TableRow>
                            </TableHead>

                            {/* TABLE BODY */}
                            <TableBody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((row, idx) => (
                                        <PurchaseRow
                                            key={row.id}
                                            row={row}
                                            index={idx}
                                            isExpanded={Boolean(expandedRows[row.id])}
                                            onToggle={() => toggleRow(row.id)}
                                            onViewTrip={handleViewTrip}
                                        />
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                                            <Typography sx={{ color: "#64748b", fontWeight: 500 }}>
                                                {filterMeta.emptyMessage}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* OUTSIDE TABLE: PAGINATION (PINNED AT BOTTOM) */}
                <Box sx={{ flexShrink: 0 }}>
                    <CommonPagination
                        totalRows={filteredData.length}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={(rows) => {
                            setRowsPerPage(rows);
                            setPage(1);
                        }}
                    />
                </Box>
            </Box>

            {/* TRIP DETAILS MODAL / DIALOG */}
            <Dialog
                open={Boolean(selectedTrip)}
                onClose={() => setSelectedTrip(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2.5, p: 1 },
                }}
            >
                <DialogTitle
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        pb: 1,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "#eff6ff", color: "#1e3a8a" }}>
                            <LocalShippingIcon />
                        </Box>
                        <Box>
                            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>
                                Trip & Logistics Details
                            </Typography>
                            <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                                Ref: <strong>{tripItemRef}</strong>
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton size="small" onClick={() => setSelectedTrip(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers sx={{ py: 2 }}>
                    {selectedTrip && (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    VEHICLE / TRUCK NO
                                </Typography>
                                <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#1e3a8a", mt: 0.3 }}>
                                    {selectedTrip.vehicleNo}
                                </Typography>
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    TRIP STATUS
                                </Typography>
                                <Box sx={{ mt: 0.3 }}>
                                    <Chip
                                        label={selectedTrip.status}
                                        color={
                                            selectedTrip.status === "Delivered"
                                                ? "success"
                                                : selectedTrip.status === "In Transit"
                                                    ? "info"
                                                    : "secondary"
                                        }
                                        size="small"
                                        sx={{ fontWeight: 700 }}
                                    />
                                </Box>
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    TRANSPORTER
                                </Typography>
                                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e293b", mt: 0.3 }}>
                                    {selectedTrip.transporter}
                                </Typography>
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    LORRY RECEIPT (LR) NO
                                </Typography>
                                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#1e293b", mt: 0.3 }}>
                                    {selectedTrip.lrNo}
                                </Typography>
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    DRIVER NAME
                                </Typography>
                                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#1e293b", mt: 0.3 }}>
                                    {selectedTrip.driverName}
                                </Typography>
                                <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>
                                    {selectedTrip.driverPhone}
                                </Typography>
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    DISPATCH DATE
                                </Typography>
                                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#1e293b", mt: 0.3 }}>
                                    {selectedTrip.dispatchDate}
                                </Typography>
                                {selectedTrip.deliveryDate && (
                                    <Typography sx={{ fontSize: "0.75rem", color: "#166534" }}>
                                        Delivered: {selectedTrip.deliveryDate}
                                    </Typography>
                                )}
                            </Grid>

                            <Grid item xs={12}>
                                <Divider sx={{ my: 0.5 }} />
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    LOADING POINT
                                </Typography>
                                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", mt: 0.3 }}>
                                    {selectedTrip.loadingPoint}
                                </Typography>
                            </Grid>

                            <Grid item xs={6}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                    DESTINATION GODOWN
                                </Typography>
                                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155", mt: 0.3 }}>
                                    {selectedTrip.destinationGodown}
                                </Typography>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 1.5 }}>
                    <Button onClick={() => setSelectedTrip(null)} sx={{ textTransform: "none" }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* REPORT FILTER DRAWER */}
            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((prev) => !prev)}
                onClose={() => setDrawerOpen(false)}
                fromDate={tempFromDate}
                onFromDateChange={setTempFromDate}
                toDate={tempToDate}
                onToDateChange={setTempToDate}
                showPurchaseFilter={true}
                purchaseFilterValue={activeFilter}
                onPurchaseFilterChange={handleFilterChange}
                purchaseFilterCounts={filterCounts}
                onApply={handleApplyFilter}
            />
        </Box>
    );
};

export default PurchaseReport;
