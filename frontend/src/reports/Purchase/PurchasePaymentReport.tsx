/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useState, useMemo, useEffect } from "react";
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
    Chip,
    Button,
    TextField,
    InputAdornment,
    IconButton,
    LinearProgress,
    Tooltip,
    Collapse,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { toast } from "react-toastify";
import PageHeader from "../../Layout/PageHeader";
import ReportFilterDrawer from "../../Components/ReportFilterDrawer";
import CommonPagination from "../../Components/CommonPagination";
import {
    PurchasePaymentItem,
    PurchasePaymentService,
    formatKgQuantity,
    formatKgQuantityCompact,
} from "../../services/purchasePayment.service";
import {
    OnlinePurchaseReportItemByOrderIdService,
    OnlinePurchaseReportItemByOrderIdItem,
    PurchaseOrderPaymentService,
    PurchaseOrderPaymentItem,
} from "../../services/OnlinePurchaseReport.service";
import { deriveStockGroup, cleanItemName } from "../../services/purchaseDataIntegration.service";

/* ================= HELPER FORMATTERS ================= */

const formatCurrency = (val: number | string): string => {
    if (!val && val !== 0) return "₹\u00A00.00";
    const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : val;
    if (isNaN(num)) return String(val);
    return "₹\u00A0" + num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

/* ================= COMPONENT ================= */

const PurchasePaymentReport: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Specific order and date range passed from navigation (e.g. from PurchaseItemPaymentReport or PurchaseDelivery)
    const navOrderId =
        location.state?.orderId ||
        location.state?.purOrderNo ||
        location.state?.searchQuery ||
        searchParams.get("orderId") ||
        searchParams.get("po") ||
        "";

    const navFromDate =
        location.state?.fromDate ||
        searchParams.get("fromDate") ||
        searchParams.get("Fromdate") ||
        "";

    const navToDate =
        location.state?.toDate ||
        searchParams.get("toDate") ||
        searchParams.get("Todate") ||
        "";

    const today = dayjs().format("YYYY-MM-DD");
    const currentMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");

    const initialFromDate = navFromDate && dayjs(navFromDate).isValid()
        ? dayjs(navFromDate).format("YYYY-MM-DD")
        : currentMonthStart;
    const initialToDate = navToDate && dayjs(navToDate).isValid()
        ? dayjs(navToDate).format("YYYY-MM-DD")
        : today;

    const [selectedOrderOnly, setSelectedOrderOnly] = useState<string>(navOrderId);

    // Filter Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState<string>(initialFromDate);
    const [toDate, setToDate] = useState<string>(initialToDate);
    const [tempFromDate, setTempFromDate] = useState<string>(initialFromDate);
    const [tempToDate, setTempToDate] = useState<string>(initialToDate);

    // Keep temp drawer dates in sync whenever fromDate or toDate changes
    useEffect(() => {
        setTempFromDate(fromDate);
        setTempToDate(toDate);
    }, [fromDate, toDate]);

    // Keep selectedOrderOnly and dates synced if location.state or query changes
    useEffect(() => {
        const oId =
            location.state?.orderId ||
            location.state?.purOrderNo ||
            location.state?.searchQuery ||
            searchParams.get("orderId") ||
            searchParams.get("po") ||
            "";
        const fDate =
            location.state?.fromDate ||
            searchParams.get("fromDate") ||
            searchParams.get("Fromdate") ||
            "";
        const tDate =
            location.state?.toDate ||
            searchParams.get("toDate") ||
            searchParams.get("Todate") ||
            "";

        if (oId) {
            setSelectedOrderOnly(oId);
            setPage(1);
        }
        if (fDate && dayjs(fDate).isValid()) {
            const formatted = dayjs(fDate).format("YYYY-MM-DD");
            setFromDate(formatted);
            setTempFromDate(formatted);
        }
        if (tDate && dayjs(tDate).isValid()) {
            const formatted = dayjs(tDate).format("YYYY-MM-DD");
            setToDate(formatted);
            setTempToDate(formatted);
        }
    }, [location.state, searchParams]);

    // Data State - INITIALIZE WITH EMPTY ARRAY (NO DUMMY DATA)
    const [data, setData] = useState<PurchasePaymentItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [activeFilter, setActiveFilter] = useState<string>("ALL");

    // Expand/Collapse state for orders with 2 or more items
    const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

    // Per-order invoice details loaded from OnlinePurchaseReportItemByOrderId API
    const [orderInvoicesMap, setOrderInvoicesMap] = useState<Record<string, OnlinePurchaseReportItemByOrderIdItem[]>>({});
    const [orderLoadingMap, setOrderLoadingMap] = useState<Record<string, boolean>>({});

    // Payment lookup map from purchaseOrderPayment API
    const paymentsMapRef = React.useRef<Map<string, PurchaseOrderPaymentItem>>(new Map());

    // Load purchase order payments from external API
    const loadPayments = async (targetToDate: string): Promise<Map<string, PurchaseOrderPaymentItem>> => {
        try {
            const res = await PurchaseOrderPaymentService.getPurchaseOrderPayments({
                Todate: targetToDate,
                company_id: 1,
            });
            const rawList = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            const map = new Map<string, PurchaseOrderPaymentItem>();
            rawList.forEach((p) => {
                if (p && p.invoice_no !== undefined && p.invoice_no !== null) {
                    const k = String(p.invoice_no).trim().toLowerCase();
                    if (k) {
                        map.set(k, p);
                        if (k.startsWith("ps/")) {
                            map.set("mia/" + k.slice(3), p);
                        }
                        const cleanNo = k.replace(/^[a-z]+\//, "");
                        if (cleanNo && cleanNo !== k) {
                            map.set(cleanNo, p);
                            const digits = cleanNo.split("/")[0].replace(/^0+/, "");
                            if (digits) map.set(digits, p);
                        }
                    }
                }
            });
            paymentsMapRef.current = map;
            return map;
        } catch (err) {
            console.error("Failed to load purchaseOrderPayment:", err);
            return new Map();
        }
    };

    // Fetch invoices for an order using OnlinePurchaseReportItemByOrderIdService
    const fetchInvoicesForOrder = async (order: PurchasePaymentItem, forceRefresh = false) => {
        if (!forceRefresh && orderInvoicesMap[order.id] !== undefined) {
            return;
        }

        if (orderLoadingMap[order.id]) {
            return;
        }

        setOrderLoadingMap((prev) => ({ ...prev, [order.id]: true }));

        try {
            const toCleanSingleId = (val: any): string | number | null => {
                if (val === undefined || val === null) return null;
                if (Array.isArray(val)) {
                    return val.length > 0 ? toCleanSingleId(val[0]) : null;
                }
                const s = String(val).trim();
                if (!s || s === "-" || s === "PO-UNKNOWN") return null;
                if (s.includes(",")) {
                    return toCleanSingleId(s.split(",")[0].trim());
                }
                if (!isNaN(Number(s))) {
                    return Number(s);
                }
                return s;
            };

            let targetPoId: string | number | null = null;
            const fromTransId = toCleanSingleId(order.transId);
            if (
                fromTransId !== null &&
                String(fromTransId) !== String(order.purOrderNo).trim() &&
                (!String(fromTransId).includes("/") || typeof fromTransId === "number")
            ) {
                targetPoId = fromTransId;
            }

            if (targetPoId === null && order.items && order.items.length > 0) {
                for (const it of order.items) {
                    const candidates = [
                        (it as any).Trans_Id,
                        (it as any).trans_id,
                        (it as any).OrderId,
                        (it as any).order_id,
                        (it as any).Id,
                        (it as any).id,
                    ];
                    for (const c of candidates) {
                        const parsed = toCleanSingleId(c);
                        if (
                            parsed !== null &&
                            String(parsed) !== String(order.purOrderNo).trim() &&
                            (!String(parsed).includes("/") || typeof parsed === "number")
                        ) {
                            targetPoId = parsed;
                            break;
                        }
                    }
                    if (targetPoId !== null) break;
                }
            }

            if (targetPoId === null && order.transIds && order.transIds.length > 0) {
                for (const tid of order.transIds) {
                    const parsed = toCleanSingleId(tid);
                    if (
                        parsed !== null &&
                        String(parsed) !== String(order.purOrderNo).trim() &&
                        (!String(parsed).includes("/") || typeof parsed === "number")
                    ) {
                        targetPoId = parsed;
                        break;
                    }
                }
            }

            if (targetPoId === null && !isNaN(Number(order.id))) {
                targetPoId = Number(order.id);
            }

            let fetchedItems: OnlinePurchaseReportItemByOrderIdItem[] = [];
            if (targetPoId !== null) {
                const res = await OnlinePurchaseReportItemByOrderIdService.getReportsitemByOrderId({
                    Po_Id: targetPoId,
                    company_id: 1,
                });
                fetchedItems = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            }

            if (fetchedItems.length > 0) {
                const activePaymentMap = paymentsMapRef.current;

                const refAmountTotals: Record<string, number> = {};
                fetchedItems.forEach((it) => {
                    const refKey = String(it.Ref_Po_Inv_No || "").trim().toLowerCase();
                    const invKey = String(it.invoice_no || "").trim().toLowerCase();
                    const key = refKey || invKey;
                    if (key) {
                        const amt = typeof it.Amount === "number" ? it.Amount : parseFloat(String(it.Amount || 0).replace(/,/g, "")) || 0;
                        refAmountTotals[key] = (refAmountTotals[key] || 0) + amt;
                    }
                });

                let orderTotalValue = 0;
                let orderPaidAmount = 0;
                let orderPendingPayment = 0;

                fetchedItems.forEach((item) => {
                    const invNo = String(item.invoice_no || "").trim();
                    const rawAmount = typeof item.Amount === "number" ? item.Amount : parseFloat(String(item.Amount || 0).replace(/,/g, "")) || 0;
                    const refNoRaw = String(item.Ref_Po_Inv_No !== undefined && item.Ref_Po_Inv_No !== null ? item.Ref_Po_Inv_No : "").trim();
                    const refKey = refNoRaw.toLowerCase();
                    const invKey = invNo.toLowerCase();

                    let payment = refKey ? activePaymentMap.get(refKey) : undefined;
                    if (!payment && refKey) {
                        const stripped = refKey.replace(/^0+/, "");
                        if (stripped && stripped !== refKey) payment = activePaymentMap.get(stripped);
                    }
                    if (!payment && invKey) {
                        payment = activePaymentMap.get(invKey);
                        if (!payment) {
                            const strippedInv = invKey.replace(/^0+/, "");
                            if (strippedInv && strippedInv !== invKey) payment = activePaymentMap.get(strippedInv);
                        }
                    }

                    if (!payment && invKey) {
                        payment = activePaymentMap.get(invKey.replace(/^mia\//, "ps/")) || activePaymentMap.get(invKey.replace(/^[a-z]+\//, ""));
                    }

                    let invVal = rawAmount;
                    let invPaid = 0;
                    let invBal = rawAmount;

                    if (payment) {
                        const key = refKey || invKey;
                        const totalForRef = refAmountTotals[key] || 0;
                        const ratio = totalForRef > 0 ? (rawAmount / totalForRef) : 1;
                        const credit = typeof payment.Credit_Amt === "number" ? payment.Credit_Amt : parseFloat(String(payment.Credit_Amt || 0)) || 0;
                        const debit = typeof payment.Debit_Amt === "number" ? payment.Debit_Amt : parseFloat(String(payment.Debit_Amt || 0)) || 0;
                        const bal = typeof payment.Bal_Amount === "number" ? payment.Bal_Amount : parseFloat(String(payment.Bal_Amount || 0)) || 0;

                        invVal = Math.round(credit * ratio);
                        invPaid = Math.round(debit * ratio);
                        invBal = Math.round(Math.abs(bal) * ratio);
                    }

                    (item as any).paidAmount = invPaid;
                    (item as any).pendingAmount = invBal;
                    (item as any).paymentStatus = invBal <= 0 && invPaid > 0 ? "PAID" : invPaid > 0 ? "PARTIAL" : "PENDING";
                    (item as any).paymentInvoiceNo = payment?.invoice_no || invNo || "-";

                    orderTotalValue += invVal;
                    orderPaidAmount += invPaid;
                    orderPendingPayment += invBal;
                });

                const orderPaymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" =
                    orderPendingPayment <= 0 && orderPaidAmount > 0
                        ? "PAID"
                        : orderPaidAmount > 0
                            ? "PARTIALLY_PAID"
                            : "PENDING";

                setOrderInvoicesMap((prev) => ({ ...prev, [order.id]: fetchedItems }));

                setData((prevData) =>
                    prevData.map((o) =>
                        o.id === order.id
                            ? {
                                ...o,
                                totalPayment: orderTotalValue > 0 ? orderTotalValue : o.totalPayment,
                                paidPayment: orderPaidAmount,
                                pendingPayment: orderPendingPayment,
                                paymentStatus: orderPaymentStatus,
                            }
                            : o
                    )
                );
            } else {
                setOrderInvoicesMap((prev) => ({ ...prev, [order.id]: [] }));
            }
        } catch (err) {
            console.error(`Failed to load onlinePurchaseReportItemByOrderId for order ${order.purOrderNo}:`, err);
            setOrderInvoicesMap((prev) => ({ ...prev, [order.id]: [] }));
        } finally {
            setOrderLoadingMap((prev) => ({ ...prev, [order.id]: false }));
        }
    };

    // Load live dataset from APIs
    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setLoading(true);
            try {
                const [liveData] = await Promise.all([
                    PurchasePaymentService.getPurchasePayments({
                        Fromdate: fromDate,
                        Todate: toDate,
                    }),
                    loadPayments(toDate),
                ]);
                if (isMounted) {
                    setData(liveData || []);
                }
            } catch (err) {
                console.error("Failed to load live purchase payment data:", err);
                if (isMounted) {
                    setData([]);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => {
            isMounted = false;
        };
    }, [fromDate, toDate]);

    // Auto-expand and focus when navigated with a specific order
    useEffect(() => {
        if (selectedOrderOnly && data.length > 0) {
            const q = selectedOrderOnly.toLowerCase().trim();
            const map: Record<string, boolean> = {};
            data.forEach((row) => {
                if (row.purOrderNo?.toLowerCase().includes(q) || row.id?.toLowerCase().includes(q)) {
                    map[row.id] = true;
                    fetchInvoicesForOrder(row);
                }
            });
            setExpandedOrderIds(map);
        }
    }, [selectedOrderOnly, data]);



    // Pagination State
    const [page, setPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(100);

    // Filtered dataset
    const filteredData = useMemo(() => {
        return data.filter((item) => {
            // 1. Search Query (Matches PO, Supplier, or any nested Item name / stock group)
            if (searchQuery.trim() !== "") {
                const q = searchQuery.toLowerCase().trim();
                const matchPO = item.purOrderNo?.toLowerCase().includes(q);
                const matchSupplier = item.supplierName?.toLowerCase().includes(q);
                const matchPayNo = item.paymentNo?.toLowerCase().includes(q);
                const matchInv = item.purInvNo?.toLowerCase().includes(q);
                const matchStatus = item.paymentStatus?.toLowerCase().includes(q);
                const matchItems = item.items?.some(
                    (it) =>
                        it.itemName.toLowerCase().includes(q) ||
                        it.stockGroup.toLowerCase().includes(q) ||
                        (it.inwardBatch && it.inwardBatch.toLowerCase().includes(q))
                );

                if (
                    !matchPO &&
                    !matchSupplier &&
                    !matchPayNo &&
                    !matchInv &&
                    !matchStatus &&
                    !matchItems
                ) {
                    return false;
                }
            }

            // 2. Status Quick Filter
            if (activeFilter === "PAID") {
                if (item.paymentStatus !== "PAID") return false;
            } else if (activeFilter === "PARTIAL") {
                if (item.paymentStatus !== "PARTIALLY_PAID") return false;
            } else if (activeFilter === "PENDING") {
                if (item.pendingPayment <= 0) return false;
            } else if (activeFilter === "OVERDUE") {
                if (item.paymentStatus !== "OVERDUE") return false;
            } else if (activeFilter === "PARTIAL_TONS") {
                // Shows orders where delivery is partial (e.g. 2/8 tons arrived)
                if (item.arrivedTons >= item.orderedTons || item.arrivedTons === 0) return false;
            } else if (activeFilter === "MULTI_ITEM") {
                // Shows orders with 2 or more items
                if (!item.items || item.items.length < 2) return false;
            }

            // 0. Selected Order Filter (passed from other tabs / reports)
            if (selectedOrderOnly && selectedOrderOnly.trim() !== "") {
                const so = selectedOrderOnly.toLowerCase().trim();
                const matchPO = item.purOrderNo?.toLowerCase().includes(so);
                const matchInv = item.purInvNo?.toLowerCase().includes(so);
                if (!matchPO && !matchInv) return false;
            }

            // 3. Date Filter (Order Date) - only apply if NOT viewing a specific order
            if (!selectedOrderOnly && (fromDate || toDate)) {
                if (item.orderDate) {
                    const itemDate = dayjs(item.orderDate);
                    if (itemDate.isValid()) {
                        if (fromDate && itemDate.isBefore(dayjs(fromDate), "day")) return false;
                        if (toDate && itemDate.isAfter(dayjs(toDate), "day")) return false;
                    }
                }
            }

            return true;
        });
    }, [data, searchQuery, activeFilter, fromDate, toDate, selectedOrderOnly]);

    // Metrics summary calculation for Grand Totals row
    const metrics = useMemo(() => {
        const total = filteredData.length;
        let totalOrderedTons = 0;
        let totalArrivedTons = 0;
        let totalPaymentAmt = 0;
        let totalPaidAmt = 0;
        let totalPendingAmt = 0;

        filteredData.forEach((item) => {
            totalOrderedTons += item.orderedTons || 0;
            totalArrivedTons += item.arrivedTons || 0;
            totalPaymentAmt += item.totalPayment || 0;
            totalPaidAmt += item.paidPayment || 0;
            totalPendingAmt += item.pendingPayment || 0;
        });

        const overallTonsPercentage =
            totalOrderedTons > 0 ? Math.round((totalArrivedTons / totalOrderedTons) * 100) : 0;
        const paymentClearancePercentage =
            totalPaymentAmt > 0 ? Math.round((totalPaidAmt / totalPaymentAmt) * 100) : 0;

        return {
            total,
            totalOrderedTons,
            totalArrivedTons,
            totalPendingTons: Math.max(0, totalOrderedTons - totalArrivedTons),
            overallTonsPercentage,
            totalPaymentAmt,
            totalPaidAmt,
            totalPendingAmt,
            paymentClearancePercentage,
        };
    }, [filteredData]);

    // Paginated Data
    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    // Toggle expand for a specific order
    const toggleOrderExpand = (orderId: string) => {
        const nextState = !expandedOrderIds[orderId];
        setExpandedOrderIds((prev) => ({
            ...prev,
            [orderId]: nextState,
        }));
        if (nextState) {
            const targetOrder = data.find((o) => o.id === orderId);
            if (targetOrder) {
                fetchInvoicesForOrder(targetOrder);
            }
        }
    };
    // Reset filters
    const handleResetFilters = () => {
        setSearchQuery("");
        setActiveFilter("ALL");
        setFromDate(currentMonthStart);
        setToDate(today);
        setTempFromDate(currentMonthStart);
        setTempToDate(today);
        setPage(1);
    };

    // Filter Drawer Handlers
    const handleToggleDrawer = () => {
        setDrawerOpen((prev) => {
            if (!prev) {
                // When opening the drawer, always sync temp dates with current applied filtered dates
                setTempFromDate(fromDate);
                setTempToDate(toDate);
            }
            return !prev;
        });
    };

    const handleCloseDrawer = () => {
        setTempFromDate(fromDate);
        setTempToDate(toDate);
        setDrawerOpen(false);
    };

    const handleApplyFilters = () => {
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        setPage(1);
        setDrawerOpen(false);
        toast.success("Date filters applied successfully!");
    };

    /* ================= EXPORT HANDLERS ================= */

    const handleExportExcel = () => {
        try {
            if (!filteredData.length) {
                toast.warning("No data to export");
                return;
            }

            const excelRows: any[][] = [];

            // Title Banner
            excelRows.push(["PURCHASE PAYMENT REPORT"]);
            excelRows.push([
                `Generated on: ${dayjs().format("DD-MM-YYYY HH:mm")} | Total Orders: ${filteredData.length} | Arrived Tons: ${metrics.totalArrivedTons.toFixed(2)} / ${metrics.totalOrderedTons.toFixed(2)} Tons (${metrics.overallTonsPercentage}%) | Total Payment: ${formatCurrency(metrics.totalPaymentAmt)} | Pending Payment: ${formatCurrency(metrics.totalPendingAmt)}`,
            ]);
            excelRows.push([]);

            // Table Header row (Matching User's Specified Columns)
            excelRows.push([
                "S.NO",
                "PURCHASE ORDER",
                "SUPPLIER NAME",
                "ORDER DATE",
                "ITEM COUNT",
                "ITEM DETAILS & BREAKDOWN",
                "TONS (ARRIVED / ORDERED)",
                "ARRIVED TONS",
                "ORDERED TONS",
                "DELIVERY %",
                "TOTAL PAYMENT (₹)",
                "PAID PAYMENT (₹)",
                "PENDING PAYMENT (₹)",
                "PAYMENT STATUS",
                "PAYMENT NO",
                "PUR INV NO",
            ]);

            // Data Rows (includes multi-item breakdown)
            filteredData.forEach((row, idx) => {
                const itemSummary = (row.items || [])
                    .map((it) => `${it.itemName} [${it.arrivedTons}/${it.orderedTons} T]`)
                    .join("; ");

                excelRows.push([
                    idx + 1,
                    row.purOrderNo,
                    row.supplierName,
                    row.orderDate,
                    row.items?.length || 1,
                    itemSummary,
                    `${row.arrivedTons} / ${row.orderedTons} Tons`,
                    row.arrivedTons,
                    row.orderedTons,
                    `${row.deliveryPercentage}%`,
                    row.totalPayment,
                    row.paidPayment,
                    row.pendingPayment,
                    row.paymentStatus,
                    row.paymentNo,
                    row.purInvNo,
                ]);
            });

            // Grand Total Row
            excelRows.push([
                "TOTAL",
                `${filteredData.length} Orders`,
                "-",
                "-",
                "-",
                "-",
                `${metrics.totalArrivedTons.toFixed(1)} / ${metrics.totalOrderedTons.toFixed(1)} Tons`,
                metrics.totalArrivedTons,
                metrics.totalOrderedTons,
                `${metrics.overallTonsPercentage}%`,
                metrics.totalPaymentAmt,
                metrics.totalPaidAmt,
                metrics.totalPendingAmt,
                `${metrics.paymentClearancePercentage}% Cleared`,
                "-",
                "-",
            ]);

            const ws = XLSX.utils.aoa_to_sheet(excelRows);

            if (ws && ws["!ref"]) {
                const range = XLSX.utils.decode_range(ws["!ref"]);
                const borderStyle = {
                    top: { style: "thin", color: { rgb: "CFCFCF" } },
                    bottom: { style: "thin", color: { rgb: "CFCFCF" } },
                    left: { style: "thin", color: { rgb: "CFCFCF" } },
                    right: { style: "thin", color: { rgb: "CFCFCF" } },
                };

                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                        if (!cell) continue;

                        cell.s = {
                            font: { name: "Arial", sz: 10 },
                            border: borderStyle,
                        };

                        if (R === 0) {
                            cell.s.font = { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } };
                            cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                            cell.s.alignment = { horizontal: "center" };
                        } else if (R === 1) {
                            cell.s.font = { name: "Arial", sz: 9, italic: true, color: { rgb: "334155" } };
                            cell.s.alignment = { horizontal: "left" };
                        } else if (R === 3) {
                            cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
                            cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                            cell.s.alignment = { horizontal: "center" };
                        } else if (R === range.e.r) {
                            cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "0F172A" } };
                            cell.s.fill = { fgColor: { rgb: "E2E8F0" } };
                        }
                    }
                }

                ws["!cols"] = [
                    { wch: 8 },  // S.NO
                    { wch: 18 }, // PO
                    { wch: 28 }, // Supplier
                    { wch: 12 }, // Date
                    { wch: 10 }, // Item Count
                    { wch: 42 }, // Item Details
                    { wch: 22 }, // Tons
                    { wch: 14 }, // Arrived
                    { wch: 14 }, // Ordered
                    { wch: 12 }, // Delivery %
                    { wch: 18 }, // Total Payment
                    { wch: 18 }, // Paid
                    { wch: 18 }, // Pending Payment
                    { wch: 16 }, // Status
                    { wch: 16 }, // Payment No
                    { wch: 16 }, // Pur Inv No
                ];
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "PurchasePayment");
            XLSX.writeFile(wb, `PurchasePayment_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
            toast.success("Excel report exported successfully! 📊");
        } catch (err) {
            console.error(err);
            toast.error("Failed to export Excel report");
        }
    };

    const handleExportPDF = () => {
        try {
            if (!filteredData.length) {
                toast.warning("No data to export");
                return;
            }

            const doc = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4",
            });

            // Title Banner
            doc.setFillColor(30, 58, 138);
            doc.rect(0, 0, 297, 18, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("PURCHASE PAYMENT REPORT", 14, 11);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(
                `Generated on: ${dayjs().format("DD-MM-YYYY HH:mm")} | Total Orders: ${filteredData.length} | Arrived: ${metrics.totalArrivedTons.toFixed(1)} / ${metrics.totalOrderedTons.toFixed(1)} Tons | Total: ${formatCurrency(metrics.totalPaymentAmt)} | Pending: ${formatCurrency(metrics.totalPendingAmt)}`,
                14,
                16
            );

            const tableHeaders = [
                [
                    "S.NO",
                    "Purchase Order",
                    "Supplier",
                    "Items Summary",
                    "Tons (Arrived / Ordered)",
                    "Total Payment",
                    "Paid Payment",
                    "Pending Payment",
                    "Status",
                ],
            ];

            const tableBody = filteredData.map((row, idx) => {
                const itemSummary = (row.items || [])
                    .map((it) => `${it.itemName} (${it.arrivedTons}/${it.orderedTons} T)`)
                    .join("\n");

                return [
                    idx + 1,
                    row.purOrderNo,
                    row.supplierName,
                    itemSummary,
                    `${row.arrivedTons} / ${row.orderedTons} Tons (${row.deliveryPercentage}%)`,
                    formatCurrency(row.totalPayment),
                    formatCurrency(row.paidPayment),
                    formatCurrency(row.pendingPayment),
                    row.paymentStatus,
                ];
            });

            // Add Grand Total Row
            tableBody.push([
                "TOTAL",
                `${filteredData.length} Orders`,
                "-",
                "-",
                `${metrics.totalArrivedTons.toFixed(1)} / ${metrics.totalOrderedTons.toFixed(1)} Tons`,
                formatCurrency(metrics.totalPaymentAmt),
                formatCurrency(metrics.totalPaidAmt),
                formatCurrency(metrics.totalPendingAmt),
                `${metrics.paymentClearancePercentage}% Paid`,
            ]);

            autoTable(doc, {
                head: tableHeaders,
                body: tableBody,
                startY: 22,
                theme: "grid",
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                didParseCell: (cellData) => {
                    if (cellData.section === "body" && cellData.column.index === 7) {
                        const rowIdx = cellData.row.index;
                        if (rowIdx < filteredData.length) {
                            const val = filteredData[rowIdx].pendingPayment;
                            if (val > 0) {
                                cellData.cell.styles.textColor = [185, 28, 28];
                                cellData.cell.styles.fontStyle = "bold";
                            } else {
                                cellData.cell.styles.textColor = [21, 128, 61];
                            }
                        }
                    }
                    if (
                        cellData.section === "body" &&
                        cellData.row.index === tableBody.length - 1
                    ) {
                        cellData.cell.styles.fontStyle = "bold";
                        cellData.cell.styles.fillColor = [241, 245, 249];
                        cellData.cell.styles.textColor = [15, 23, 42];
                    }
                },
            });

            doc.save(`PurchasePayment_Report_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
            toast.success("PDF report downloaded successfully! ✅");
        } catch (err) {
            console.error(err);
            toast.error("Failed to export PDF report ❌");
        }
    };

    return (
        <Box
            sx={{
                width: "100%",
                height: "100%",
                maxHeight: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: "#f8fafc",
            }}
        >
            {/* 1. TOP PAGE HEADER */}
            <PageHeader
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                showPages={true}
                parentReportName="Purchase Payment Report"
            />

            {/* 2. FILTER DRAWER */}
            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={handleToggleDrawer}
                onClose={handleCloseDrawer}
                fromDate={tempFromDate}
                onFromDateChange={setTempFromDate}
                toDate={tempToDate}
                onToDateChange={setTempToDate}
                fromDateLabel="From Date"
                toDateLabel="To Date"
                onApply={handleApplyFilters}
            />

            {/* 3. MAIN CONTENT CONTAINER (CARDS REMOVED AS REQUESTED) */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    px: { xs: 1.5, md: 2.5 },
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
                            flexShrink: 0,
                            gap: 1,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <ReceiptLongOutlinedIcon sx={{ color: "#1e3a8a", fontSize: 18 }} />
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e3a8a" }}>
                                Showing Payment Details for Order: <strong>{selectedOrderOnly}</strong> ({filteredData.length} records)
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setSelectedOrderOnly("");
                                navigate("/purchasePayment", { replace: true });
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

                {/* 3A. TITLE & TOOLBAR CONTROLS */}
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", md: "center" },
                        gap: 1.2,
                        flexShrink: 0,
                    }}
                >
                    {/* Left: Title, Count, Expand All, & Quick Filter Chips */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                color: "#1e3a8a",
                                fontSize: { xs: "1.05rem", md: "1.15rem" },
                                letterSpacing: "-0.01em",
                            }}
                        >
                            Purchase Payment Report
                        </Typography>

                        <Chip
                            size="small"
                            label={`${filteredData.length} Orders`}
                            sx={{
                                bgcolor: "#1e3a8a",
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                height: 24,
                            }}
                        />

                        {/* Quick Filter Chips */}
                        <Chip
                            size="small"
                            label={`All (${data.length})`}
                            onClick={() => {
                                setActiveFilter("ALL");
                                setPage(1);
                            }}
                            variant={activeFilter === "ALL" ? "filled" : "outlined"}
                            sx={{
                                height: 26,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeFilter === "ALL" ? "#e0f2fe" : "transparent",
                                color: activeFilter === "ALL" ? "#0369a1" : "#475569",
                                borderColor: activeFilter === "ALL" ? "#0284c7" : "#cbd5e1",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Fully Paid (${data.filter((i) => i.paymentStatus === "PAID").length})`}
                            onClick={() => {
                                setActiveFilter("PAID");
                                setPage(1);
                            }}
                            variant={activeFilter === "PAID" ? "filled" : "outlined"}
                            sx={{
                                height: 26,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeFilter === "PAID" ? "#dcfce7" : "transparent",
                                color: activeFilter === "PAID" ? "#15803d" : "#475569",
                                borderColor: activeFilter === "PAID" ? "#86efac" : "#cbd5e1",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Partially Paid (${data.filter((i) => i.paymentStatus === "PARTIALLY_PAID").length})`}
                            onClick={() => {
                                setActiveFilter("PARTIAL");
                                setPage(1);
                            }}
                            variant={activeFilter === "PARTIAL" ? "filled" : "outlined"}
                            sx={{
                                height: 26,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeFilter === "PARTIAL" ? "#fef3c7" : "transparent",
                                color: activeFilter === "PARTIAL" ? "#b45309" : "#475569",
                                borderColor: activeFilter === "PARTIAL" ? "#fde68a" : "#cbd5e1",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Pending Payment (${data.filter((i) => i.pendingPayment > 0).length})`}
                            onClick={() => {
                                setActiveFilter("PENDING");
                                setPage(1);
                            }}
                            variant={activeFilter === "PENDING" ? "filled" : "outlined"}
                            sx={{
                                height: 26,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeFilter === "PENDING" ? "#fee2e2" : "transparent",
                                color: activeFilter === "PENDING" ? "#b91c1c" : "#475569",
                                borderColor: activeFilter === "PENDING" ? "#fca5a5" : "#cbd5e1",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Partial Arrived Tons (${data.filter((i) => i.arrivedTons < i.orderedTons && i.arrivedTons > 0).length})`}
                            onClick={() => {
                                setActiveFilter("PARTIAL_TONS");
                                setPage(1);
                            }}
                            variant={activeFilter === "PARTIAL_TONS" ? "filled" : "outlined"}
                            sx={{
                                height: 26,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeFilter === "PARTIAL_TONS" ? "#f3e8ff" : "transparent",
                                color: activeFilter === "PARTIAL_TONS" ? "#7e22ce" : "#475569",
                                borderColor: activeFilter === "PARTIAL_TONS" ? "#d8b4fe" : "#cbd5e1",
                            }}
                        />
                    </Box>

                    {/* Right: Search Input & Date Filter Button */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: { xs: "100%", md: "auto" },
                        }}
                    >
                        <TextField
                            size="small"
                            placeholder="Search Order No, Supplier, Item, Batch..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: "#64748b", fontSize: 18 }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchQuery ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchQuery("")}>
                                            <ClearIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            }}
                            sx={{
                                width: { xs: "100%", sm: 280 },
                                "& .MuiOutlinedInput-root": {
                                    bgcolor: "#ffffff",
                                    borderRadius: 1.5,
                                    fontSize: "0.80rem",
                                    height: 34,
                                },
                            }}
                        />
                    </Box>
                </Box>

                {/* 3B. MAIN REPORT TABLE */}
                <Paper
                    elevation={0}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 2,
                        border: "1px solid #e2e8f0",
                        bgcolor: "#ffffff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                    }}
                >
                    {loading && <LinearProgress sx={{ height: 3 }} />}
                    <TableContainer
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            overflowX: "auto",
                        }}
                    >
                        <Table
                            size="small"
                            stickyHeader
                            aria-label="purchase payment report table"
                            sx={{ minWidth: 950, width: "100%", tableLayout: "fixed" }}
                        >
                            {/* TABLE HEAD */}
                            <TableHead>
                                <TableRow
                                    sx={{
                                        "& th": {
                                            bgcolor: "#1E3A8A",
                                            fontWeight: 700,
                                            color: "#ffffff",
                                            fontSize: "0.78rem",
                                            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
                                            py: 1,
                                            px: 1,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 5,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        },
                                    }}
                                >
                                    <TableCell align="center" sx={{ width: "3.5%" }} />
                                    <TableCell align="center" sx={{ width: "4.5%" }}>
                                        S.NO
                                    </TableCell>
                                    <TableCell sx={{ width: "27%" }}>
                                        Purchase Order
                                    </TableCell>
                                    <TableCell sx={{ width: "22%" }}>
                                        Tons (Arrived / Ordered)
                                    </TableCell>
                                    <TableCell align="right" sx={{ width: "16%" }}>
                                        Payment (Total)
                                    </TableCell>
                                    <TableCell align="right" sx={{ width: "16%" }}>
                                        Pending Payment
                                    </TableCell>
                                    <TableCell align="center" sx={{ width: "11%", borderRight: "none" }}>
                                        Actions
                                    </TableCell>
                                </TableRow>

                                {/* STICKY GRAND TOTALS ROW DIRECTLY UNDER TABLE HEADER */}
                                <TableRow
                                    sx={{
                                        bgcolor: "#f1f5f9",
                                        borderBottom: "2px solid #cbd5e1",
                                        "& th, & td": {
                                            fontWeight: 800,
                                            fontSize: "0.76rem",
                                            py: 0.8,
                                            px: 1,
                                            color: "#0f172a",
                                            borderRight: "1px solid #e2e8f0",
                                            position: "sticky",
                                            top: "39px",
                                            zIndex: 4,
                                            bgcolor: "#f1f5f9",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        },
                                    }}
                                >
                                    <TableCell align="center" />
                                    <TableCell align="center">TOTAL</TableCell>
                                    <TableCell sx={{ color: "#1e3a8a", fontWeight: 800 }}>
                                        {filteredData.length} Orders
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <Typography sx={{ fontWeight: 800, fontSize: "0.78rem", color: "#0369a1" }}>
                                                {formatKgQuantity(metrics.totalArrivedTons)} / {formatKgQuantity(metrics.totalOrderedTons)}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={`${metrics.overallTonsPercentage}% Arrived`}
                                                sx={{
                                                    height: 19,
                                                    fontSize: "0.64rem",
                                                    fontWeight: 800,
                                                    bgcolor: "#e0f2fe",
                                                    color: "#0369a1",
                                                }}
                                            />
                                        </Box>
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{
                                            color: "#0f172a",
                                            fontWeight: 800,
                                            fontSize: "0.80rem",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {formatCurrency(metrics.totalPaymentAmt)}
                                        <Typography sx={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700 }}>
                                            Paid: {formatCurrency(metrics.totalPaidAmt)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{
                                            color: "#b91c1c",
                                            fontWeight: 800,
                                            fontSize: "0.80rem",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {formatCurrency(metrics.totalPendingAmt)}
                                        <Typography sx={{ fontSize: "0.68rem", color: "#b91c1c", fontWeight: 600 }}>
                                            Remaining to pay
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={{ borderRight: "none" }}>
                                        <Chip
                                            size="small"
                                            label={`${metrics.paymentClearancePercentage}% Paid`}
                                            sx={{
                                                bgcolor: metrics.paymentClearancePercentage >= 80 ? "#dcfce7" : "#fef3c7",
                                                color: metrics.paymentClearancePercentage >= 80 ? "#15803d" : "#b45309",
                                                fontWeight: 800,
                                                fontSize: "0.68rem",
                                                height: 20,
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            </TableHead>

                            {/* TABLE BODY */}
                            <TableBody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((row, idx) => {
                                        const isPaid = row.paymentStatus === "PAID";
                                        const isOverdue = row.paymentStatus === "OVERDUE";
                                        const isPartialPaid = row.paymentStatus === "PARTIALLY_PAID";
                                        const isFullDelivery = row.arrivedTons >= row.orderedTons;
                                        const isExpanded = !!expandedOrderIds[row.id];
                                        const itemCount = row.items?.length || 1;

                                        return (
                                            <React.Fragment key={row.id}>
                                                {/* MAIN ORDER SUMMARY ROW */}
                                                <TableRow
                                                    hover
                                                    sx={{
                                                        bgcolor: isExpanded
                                                            ? "#f0fdf4"
                                                            : idx % 2 === 1
                                                                ? "#fafbfc"
                                                                : "#ffffff",
                                                        borderBottom: isExpanded ? "none" : "1px solid #e2e8f0",
                                                        "&:hover": {
                                                            bgcolor: "#f1f5f9 !important",
                                                        },
                                                    }}
                                                >
                                                    {/* EXPAND TOGGLE */}
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            py: 0.6,
                                                            px: 0.5,
                                                            borderRight: "1px solid #eef2f6",
                                                        }}
                                                    >
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => toggleOrderExpand(row.id)}
                                                            sx={{
                                                                color: isExpanded ? "#1e3a8a" : "#64748b",
                                                                p: 0.4,
                                                            }}
                                                        >
                                                            {isExpanded ? (
                                                                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                                                            ) : (
                                                                <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                                                            )}
                                                        </IconButton>
                                                    </TableCell>

                                                    {/* 1. S.NO */}
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            fontWeight: 700,
                                                            color: "#475569",
                                                            fontSize: "0.78rem",
                                                            py: 0.9,
                                                            px: 0.8,
                                                            borderRight: "1px solid #eef2f6",
                                                        }}
                                                    >
                                                        {(page - 1) * rowsPerPage + idx + 1}
                                                    </TableCell>

                                                    {/* 2. PURCHASE ORDER (With Supplier, Items Count & Order Date) */}
                                                    <TableCell
                                                        sx={{
                                                            py: 0.9,
                                                            px: 1,
                                                            borderRight: "1px solid #eef2f6",
                                                        }}
                                                    >
                                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                                                <Typography
                                                                    sx={{
                                                                        fontWeight: 700,
                                                                        color: "#1e3a8a",
                                                                        fontSize: "0.82rem",
                                                                    }}
                                                                >
                                                                    {row.purOrderNo}
                                                                </Typography>

                                                                {/* Item count chip (e.g. 2 Items or 3 Items) */}
                                                                <Chip
                                                                    size="small"
                                                                    label={`${itemCount} Item${itemCount > 1 ? "s" : ""}`}
                                                                    onClick={() => toggleOrderExpand(row.id)}
                                                                    sx={{
                                                                        height: 18,
                                                                        fontSize: "0.62rem",
                                                                        fontWeight: 700,
                                                                        bgcolor: isExpanded ? "#1e3a8a" : "#e2e8f0",
                                                                        color: isExpanded ? "#ffffff" : "#334155",
                                                                        cursor: "pointer",
                                                                    }}
                                                                />
                                                            </Box>

                                                            {/* Supplier Name */}
                                                            <Typography
                                                                sx={{
                                                                    fontSize: "0.78rem",
                                                                    fontWeight: 600,
                                                                    color: "#0f172a",
                                                                    lineHeight: 1.25,
                                                                    wordBreak: "break-word",
                                                                }}
                                                            >
                                                                {row.supplierName}
                                                            </Typography>

                                                            {/* Order Date */}
                                                            <Typography
                                                                sx={{
                                                                    fontSize: "0.70rem",
                                                                    color: "#64748b",
                                                                    lineHeight: 1.2,
                                                                }}
                                                            >
                                                                Order Date: {dayjs(row.orderDate).format("DD/MM/YYYY")} • Due: {dayjs(row.dueDate).format("DD/MM/YYYY")}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>

                                                    {/* 3. TONS (e.g. 2/8 Tons) */}
                                                    <TableCell
                                                        sx={{
                                                            py: 0.9,
                                                            px: 1,
                                                            borderRight: "1px solid #eef2f6",
                                                        }}
                                                    >
                                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                                                            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                                                {/* User-requested 2/8 format */}
                                                                <Typography
                                                                    sx={{
                                                                        fontSize: "0.84rem",
                                                                        fontWeight: 800,
                                                                        color: isFullDelivery ? "#15803d" : "#0369a1",
                                                                    }}
                                                                >
                                                                    {formatKgQuantityCompact(row.arrivedTons)} / {formatKgQuantityCompact(row.orderedTons)}
                                                                </Typography>

                                                                <Typography
                                                                    sx={{
                                                                        fontSize: "0.68rem",
                                                                        fontWeight: 700,
                                                                        color: isFullDelivery ? "#15803d" : "#64748b",
                                                                    }}
                                                                >
                                                                    {row.deliveryPercentage}% Arrived
                                                                </Typography>
                                                            </Box>

                                                            {/* Visual Progress Bar */}
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={row.deliveryPercentage}
                                                                sx={{
                                                                    height: 6,
                                                                    borderRadius: 3,
                                                                    bgcolor: "#e2e8f0",
                                                                    "& .MuiLinearProgress-bar": {
                                                                        bgcolor:
                                                                            isFullDelivery
                                                                                ? "#16a34a"
                                                                                : row.deliveryPercentage > 0
                                                                                    ? "#0284c7"
                                                                                    : "#94a3b8",
                                                                    },
                                                                }}
                                                            />

                                                            <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#64748b" }}>
                                                                <span>Arrived: <strong style={{ color: "#0369a1" }}>{formatKgQuantityCompact(row.arrivedTons)}</strong></span>
                                                                <span>Pending: <strong style={{ color: row.pendingTons > 0 ? "#b91c1c" : "#15803d" }}>{formatKgQuantityCompact(row.pendingTons)}</strong></span>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>

                                                    {/* 4. PAYMENT (Total Payment & Paid Amount) */}
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            py: 0.9,
                                                            px: 1,
                                                            borderRight: "1px solid #eef2f6",
                                                        }}
                                                    >
                                                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.2 }}>
                                                            <Typography
                                                                sx={{
                                                                    fontWeight: 800,
                                                                    color: "#0f172a",
                                                                    fontSize: "0.82rem",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {formatCurrency(row.totalPayment)}
                                                            </Typography>

                                                            <Typography
                                                                sx={{
                                                                    fontSize: "0.70rem",
                                                                    color: "#15803d",
                                                                    fontWeight: 600,
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                Paid: {formatCurrency(row.paidPayment)}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>

                                                    {/* 5. PENDING PAYMENT (Remaining Wants to Pay & Status) */}
                                                    <TableCell
                                                        align="right"
                                                        sx={{
                                                            py: 0.9,
                                                            px: 1,
                                                            borderRight: "1px solid #eef2f6",
                                                        }}
                                                    >
                                                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.3 }}>
                                                            <Typography
                                                                sx={{
                                                                    fontWeight: 800,
                                                                    color: row.pendingPayment > 0 ? "#b91c1c" : "#15803d",
                                                                    fontSize: "0.84rem",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {formatCurrency(row.pendingPayment)}
                                                            </Typography>

                                                            {/* Payment Status Chip */}
                                                            <Chip
                                                                size="small"
                                                                icon={
                                                                    isPaid ? (
                                                                        <CheckCircleOutlineIcon sx={{ fontSize: 12 }} />
                                                                    ) : isOverdue ? (
                                                                        <ErrorOutlineIcon sx={{ fontSize: 12 }} />
                                                                    ) : (
                                                                        <AccessTimeIcon sx={{ fontSize: 12 }} />
                                                                    )
                                                                }
                                                                label={
                                                                    isPaid
                                                                        ? "PAID"
                                                                        : isOverdue
                                                                            ? "OVERDUE"
                                                                            : isPartialPaid
                                                                                ? "PARTIAL PAID"
                                                                                : "UNPAID"
                                                                }
                                                                sx={{
                                                                    fontWeight: 800,
                                                                    fontSize: "0.64rem",
                                                                    height: 20,
                                                                    bgcolor: isPaid
                                                                        ? "#dcfce7"
                                                                        : isOverdue
                                                                            ? "#fee2e2"
                                                                            : isPartialPaid
                                                                                ? "#fef3c7"
                                                                                : "#fee2e2",
                                                                    color: isPaid
                                                                        ? "#15803d"
                                                                        : isOverdue
                                                                            ? "#be123c"
                                                                            : isPartialPaid
                                                                                ? "#b45309"
                                                                                : "#b91c1c",
                                                                    border: "1px solid",
                                                                    borderColor: isPaid
                                                                        ? "#86efac"
                                                                        : isOverdue
                                                                            ? "#fca5a5"
                                                                            : isPartialPaid
                                                                                ? "#fde68a"
                                                                                : "#fca5a5",
                                                                    "& .MuiChip-icon": {
                                                                        color: isPaid
                                                                            ? "#16a34a"
                                                                            : isOverdue
                                                                                ? "#dc2626"
                                                                                : isPartialPaid
                                                                                    ? "#d97706"
                                                                                    : "#dc2626",
                                                                    },
                                                                }}
                                                            />
                                                        </Box>
                                                    </TableCell>

                                                    {/* 6. ACTIONS (Direct Links to Purchase Delivery & Purchase Report) */}
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            py: 0.9,
                                                            px: 0.8,
                                                            borderRight: "none",
                                                        }}
                                                    >
                                                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.6 }}>
                                                            {/* 1. Navigate to Purchase Delivery in New Tab */}
                                                            <Tooltip title={`Purchase Delivery (${row.purOrderNo}) - Open in New Tab`}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        const effectiveFrom = row.orderDate && dayjs(row.orderDate).isValid() && dayjs(row.orderDate).isBefore(dayjs(fromDate))
                                                                            ? dayjs(row.orderDate).format("YYYY-MM-DD")
                                                                            : fromDate;
                                                                        const url = `/purchaseDelivery?orderId=${encodeURIComponent(row.purOrderNo)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(toDate)}`;
                                                                        window.open(url, "_blank");
                                                                    }}
                                                                    sx={{
                                                                        bgcolor: "#f0fdf4",
                                                                        color: "#16a34a",
                                                                        border: "1px solid #bbf7d0",
                                                                        p: 0.6,
                                                                        "&:hover": { bgcolor: "#dcfce7" },
                                                                    }}
                                                                >
                                                                    <LocalShippingOutlinedIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>

                                                            {/* 2. Navigate to Item & Invoice Payment in New Tab */}
                                                            <Tooltip title={`Item & Invoice Payment (${row.purOrderNo}) - Open in New Tab`}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        const effectiveFrom = row.orderDate && dayjs(row.orderDate).isValid() && dayjs(row.orderDate).isBefore(dayjs(fromDate))
                                                                            ? dayjs(row.orderDate).format("YYYY-MM-DD")
                                                                            : fromDate;
                                                                        const url = `/purchaseItemPayment?orderId=${encodeURIComponent(row.purOrderNo)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(toDate)}`;
                                                                        window.open(url, "_blank");
                                                                    }}
                                                                    sx={{
                                                                        bgcolor: "#f0f9ff",
                                                                        color: "#0369a1",
                                                                        border: "1px solid #bae6fd",
                                                                        p: 0.6,
                                                                        "&:hover": { bgcolor: "#e0f2fe" },
                                                                    }}
                                                                >
                                                                    <TableViewOutlinedIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>

                                                        </Box>
                                                    </TableCell>
                                                </TableRow>

                                                {/* NESTED EXPANDED ROW SHOWING 2 OR MORE ITEMS WITH VARYING QTY & ARRIVALS */}
                                                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                                                    <TableCell colSpan={7} sx={{ p: 0, borderBottom: "1px solid #e2e8f0" }}>
                                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                            <Box sx={{ p: 1.5, pl: 4, pr: 2, bgcolor: "#f8fafc", borderLeft: "4px solid #1e3a8a" }}>
                                                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
                                                                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a" }}>
                                                                        Item-Wise Tonnage & Arrival Breakdown for {row.purOrderNo}
                                                                        {orderInvoicesMap[row.id] && orderInvoicesMap[row.id].length > 0 ? (
                                                                            <span> ({orderInvoicesMap[row.id].length} Items / Invoices)</span>
                                                                        ) : (
                                                                            <span> ({row.items?.length || 1} Items)</span>
                                                                        )}:
                                                                    </Typography>

                                                                </Box>

                                                                {orderLoadingMap[row.id] && (
                                                                    <Box sx={{ py: 1, mb: 1 }}>
                                                                        <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
                                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", mt: 0.5, textAlign: "center" }}>
                                                                            Fetching invoice details from OnlinePurchaseReportItemByOrderId API...
                                                                        </Typography>
                                                                    </Box>
                                                                )}

                                                                {orderInvoicesMap[row.id] && orderInvoicesMap[row.id].length > 0 ? (
                                                                    <Table size="small" sx={{ bgcolor: "#ffffff", borderRadius: 1.5, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                                                        <TableHead>
                                                                            <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>#</TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Item Name & Stock Group</TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Inward Batch</TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Pur Inv No</TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Payment Inv No</TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Godown</TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Arrived Qty</TableCell>
                                                                                <TableCell align="right" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Rate</TableCell>
                                                                                <TableCell align="right" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Item Value</TableCell>
                                                                                <TableCell align="right" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Paid Amt</TableCell>
                                                                                <TableCell align="right" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Pending</TableCell>
                                                                                <TableCell align="center" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>Status</TableCell>
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {orderInvoicesMap[row.id].map((inv, invIdx) => {
                                                                                const rawProd = cleanItemName(inv.Product_Name || inv.Stock_Item || "Item");
                                                                                const qty = typeof inv.Bill_Qty === "number" ? inv.Bill_Qty : parseFloat(String(inv.Bill_Qty || 0).replace(/,/g, "")) || 0;
                                                                                const rate = typeof inv.Rate === "number" ? inv.Rate : parseFloat(String(inv.Rate || 0).replace(/,/g, "")) || 0;
                                                                                const amt = typeof inv.Amount === "number" ? inv.Amount : parseFloat(String(inv.Amount || 0).replace(/,/g, "")) || 0;

                                                                                const invNo = String(inv.invoice_no || "").trim();
                                                                                const refNo = String(inv.Ref_Po_Inv_No || "").trim();
                                                                                const invK = invNo.toLowerCase();
                                                                                const refK = refNo.toLowerCase();
                                                                                const activePay: PurchaseOrderPaymentItem | undefined =
                                                                                    (refK ? paymentsMapRef.current.get(refK) : undefined) ||
                                                                                    (invK ? paymentsMapRef.current.get(invK) : undefined) ||
                                                                                    (invK ? paymentsMapRef.current.get(invK.replace(/^mia\//, "ps/")) : undefined) ||
                                                                                    (invK ? paymentsMapRef.current.get(invK.replace(/^[a-z]+\//, "")) : undefined);

                                                                                const paid = (inv as any).paidAmount !== undefined && (inv as any).paidAmount > 0
                                                                                    ? (inv as any).paidAmount
                                                                                    : (activePay && activePay.Debit_Amt > 0 ? activePay.Debit_Amt : 0);
                                                                                const pending = (inv as any).pendingAmount !== undefined
                                                                                    ? (inv as any).pendingAmount
                                                                                    : (activePay ? Math.abs(activePay.Bal_Amount) : (amt > paid ? amt - paid : 0));
                                                                                const status = (inv as any).paymentStatus || (pending <= 0 && paid > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING");
                                                                                const paymentInvNo = (inv as any).paymentInvoiceNo || activePay?.invoice_no || invNo || "-";

                                                                                return (
                                                                                    <TableRow key={invIdx} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                                                                                        <TableCell sx={{ fontSize: "0.72rem", color: "#64748b", py: 0.7 }}>{invIdx + 1}</TableCell>
                                                                                        <TableCell sx={{ py: 0.7 }}>
                                                                                            <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a" }}>
                                                                                                {rawProd}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b" }}>
                                                                                                Group: {(inv.Stock_Group && inv.Stock_Group !== "General Items") ? inv.Stock_Group : (deriveStockGroup(rawProd) || "-")}
                                                                                            </Typography>
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#334155", py: 0.7 }}>
                                                                                            {inv.Batch || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#0369a1", py: 0.7 }}>
                                                                                            {inv.invoice_no || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#16a34a", py: 0.7 }}>
                                                                                            {paymentInvNo}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ fontSize: "0.72rem", color: "#475569", py: 0.7 }}>
                                                                                            {inv.Godown_Name || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0369a1", py: 0.7 }}>
                                                                                            {formatKgQuantity(qty)}
                                                                                        </TableCell>
                                                                                        <TableCell align="right" sx={{ fontSize: "0.74rem", color: "#475569", py: 0.7 }}>
                                                                                            ₹ {rate.toLocaleString("en-IN")}
                                                                                        </TableCell>
                                                                                        <TableCell align="right" sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", py: 0.7 }}>
                                                                                            {formatCurrency(amt)}
                                                                                        </TableCell>
                                                                                        <TableCell align="right" sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#15803d", py: 0.7 }}>
                                                                                            {paid > 0 ? formatCurrency(paid) : "-"}
                                                                                        </TableCell>
                                                                                        <TableCell align="right" sx={{ fontSize: "0.74rem", fontWeight: 700, color: pending > 0 ? "#b91c1c" : "#15803d", py: 0.7 }}>
                                                                                            {formatCurrency(pending)}
                                                                                        </TableCell>
                                                                                        <TableCell align="center" sx={{ py: 0.7 }}>
                                                                                            <Chip
                                                                                                size="small"
                                                                                                label={status}
                                                                                                sx={{
                                                                                                    height: 18,
                                                                                                    fontSize: "0.60rem",
                                                                                                    fontWeight: 800,
                                                                                                    bgcolor: status === "PAID" ? "#dcfce7" : status === "PARTIAL" ? "#fef3c7" : "#fee2e2",
                                                                                                    color: status === "PAID" ? "#15803d" : status === "PARTIAL" ? "#b45309" : "#b91c1c",
                                                                                                }}
                                                                                            />
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                );
                                                                            })}
                                                                        </TableBody>
                                                                    </Table>
                                                                ) : (
                                                                    <Table size="small" sx={{ bgcolor: "#ffffff", borderRadius: 1.5, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                                                        <TableHead>
                                                                            <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    #
                                                                                </TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    Item Name & Stock Group
                                                                                </TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    Inward Batch
                                                                                </TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    Tons (Arrived / Ordered)
                                                                                </TableCell>
                                                                                <TableCell sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    Arrival Status
                                                                                </TableCell>
                                                                                <TableCell align="right" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    Rate / Ton
                                                                                </TableCell>
                                                                                <TableCell align="right" sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#475569", py: 0.6 }}>
                                                                                    Item Value
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {row.items?.map((item, itemIdx) => {
                                                                                const isItemComplete = item.arrivedTons >= item.orderedTons;
                                                                                const isItemPending = item.arrivedTons === 0;

                                                                                return (
                                                                                    <TableRow key={item.itemId || itemIdx} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                                                                                        <TableCell sx={{ fontSize: "0.72rem", color: "#64748b", py: 0.7 }}>
                                                                                            {itemIdx + 1}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ py: 0.7 }}>
                                                                                            <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a" }}>
                                                                                                {item.itemName}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b" }}>
                                                                                                Group: {item.stockGroup}
                                                                                            </Typography>
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#334155", py: 0.7 }}>
                                                                                            {item.inwardBatch || "-"}
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ py: 0.7, width: 200 }}>
                                                                                            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 0.3 }}>
                                                                                                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: isItemComplete ? "#15803d" : "#0369a1" }}>
                                                                                                    {formatKgQuantityCompact(item.arrivedTons)} / {formatKgQuantityCompact(item.orderedTons)}
                                                                                                </Typography>
                                                                                                <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: "#64748b" }}>
                                                                                                    {item.deliveryPercentage}%
                                                                                                </Typography>
                                                                                            </Box>
                                                                                            <LinearProgress
                                                                                                variant="determinate"
                                                                                                value={item.deliveryPercentage}
                                                                                                sx={{
                                                                                                    height: 5,
                                                                                                    borderRadius: 2.5,
                                                                                                    bgcolor: "#e2e8f0",
                                                                                                    "& .MuiLinearProgress-bar": {
                                                                                                        bgcolor: isItemComplete
                                                                                                            ? "#16a34a"
                                                                                                            : item.arrivedTons > 0
                                                                                                                ? "#0284c7"
                                                                                                                : "#94a3b8",
                                                                                                    },
                                                                                                }}
                                                                                            />
                                                                                        </TableCell>
                                                                                        <TableCell sx={{ py: 0.7 }}>
                                                                                            <Chip
                                                                                                size="small"
                                                                                                label={
                                                                                                    isItemComplete
                                                                                                        ? "Delivered (100%)"
                                                                                                        : isItemPending
                                                                                                            ? "Pending Arrival"
                                                                                                            : `Partially Arrived (${item.arrivedTons} T)`
                                                                                                }
                                                                                                sx={{
                                                                                                    height: 20,
                                                                                                    fontSize: "0.62rem",
                                                                                                    fontWeight: 800,
                                                                                                    bgcolor: isItemComplete
                                                                                                        ? "#dcfce7"
                                                                                                        : isItemPending
                                                                                                            ? "#fee2e2"
                                                                                                            : "#fef3c7",
                                                                                                    color: isItemComplete
                                                                                                        ? "#15803d"
                                                                                                        : isItemPending
                                                                                                            ? "#b91c1c"
                                                                                                            : "#b45309",
                                                                                                }}
                                                                                            />
                                                                                        </TableCell>
                                                                                        <TableCell align="right" sx={{ fontSize: "0.74rem", color: "#475569", py: 0.7 }}>
                                                                                            ₹ {item.ratePerTon.toLocaleString("en-IN")}/T
                                                                                        </TableCell>
                                                                                        <TableCell align="right" sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", py: 0.7 }}>
                                                                                            {formatCurrency(item.itemAmount)}
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                );
                                                                            })}
                                                                        </TableBody>
                                                                    </Table>
                                                                )}
                                                            </Box>
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                                <ErrorOutlineIcon sx={{ fontSize: 36, color: "#94a3b8" }} />
                                                <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>
                                                    No matching purchase payment records found
                                                </Typography>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={handleResetFilters}
                                                    sx={{ textTransform: "none", mt: 0.5 }}
                                                >
                                                    Clear All Filters
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* 3C. PINNED PAGINATION */}
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
        </Box>
    );
};

export default PurchasePaymentReport;
