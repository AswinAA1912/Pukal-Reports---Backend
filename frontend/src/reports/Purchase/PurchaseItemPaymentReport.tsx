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
    Tooltip,
    Divider,
    Collapse,
    LinearProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RefreshIcon from "@mui/icons-material/Refresh";
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
    PurchaseItemOrder,
    ArrivedInvoiceDetail,
    PurchaseItemPaymentService,
    cleanItemName,
    formatKgQuantity,
    formatKgQuantityCompact,
} from "../../services/purchaseItemPayment.service";
import {
    OnlinePurchaseReportItemByOrderIdService,
    OnlinePurchaseReportItemByOrderIdItem,
    PurchaseOrderPaymentService,
    PurchaseOrderPaymentItem,
} from "../../services/OnlinePurchaseReport.service";
import { deriveStockGroup } from "../../services/purchaseDataIntegration.service";

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

const cleanPoId = (id: any): string => {
    if (!id) return "";
    if (Array.isArray(id)) {
        const unique = Array.from(new Set(id.map((v) => String(v).trim()).filter(Boolean)));
        return unique[0] || "";
    }
    const s = String(id).trim();
    if (s.includes(",")) {
        const parts = Array.from(new Set(s.split(",").map((p) => p.trim()).filter(Boolean)));
        return parts[0] || "";
    }
    return s;
};

export const getOrderInvoiceCount = (
    order: PurchaseItemOrder,
    orderInvoicesMap: Record<string, ArrivedInvoiceDetail[]>
): number => {
    const fetchedInvoices = orderInvoicesMap[order.id];
    if (fetchedInvoices !== undefined) {
        const unique = new Set(
            fetchedInvoices
                .map((inv) => String(inv.invoiceNo || "").trim())
                .filter((no) => no && no !== "-" && no !== "No Invoices Arrived")
        );
        return unique.size;
    }
    const baseInvoices = order.arrivedInvoices || [];
    const uniqueBase = new Set(
        baseInvoices
            .map((inv) => String(inv.invoiceNo || "").trim())
            .filter((no) => no && no !== "-" && no !== "No Invoices Arrived")
    );
    if (uniqueBase.size > 0) return uniqueBase.size;
    if (order.inwardJouNo && !isNaN(Number(order.inwardJouNo)) && Number(order.inwardJouNo) > 0) {
        return Number(order.inwardJouNo);
    }
    return baseInvoices.length > 0 ? 1 : 0;
};

export const isOrderWithInvoices = (
    order: PurchaseItemOrder,
    orderInvoicesMap: Record<string, ArrivedInvoiceDetail[]>
): boolean => {
    return getOrderInvoiceCount(order, orderInvoicesMap) > 0;
};

/* ================= COMPONENT ================= */

const PurchaseItemPaymentReport: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Specific order and date range passed from navigation
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

    const initialFromDate = navFromDate && dayjs(navFromDate).isValid() ? navFromDate : currentMonthStart;
    const initialToDate = navToDate && dayjs(navToDate).isValid() ? navToDate : today;

    const [selectedOrderOnly, setSelectedOrderOnly] = useState<string>(navOrderId);

    // Filter Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fromDate, setFromDate] = useState<string>(initialFromDate);
    const [toDate, setToDate] = useState<string>(initialToDate);
    const [tempFromDate, setTempFromDate] = useState<string>(initialFromDate);
    const [tempToDate, setTempToDate] = useState<string>(initialToDate);

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
            setFromDate(fDate);
            setTempFromDate(fDate);
        }
        if (tDate && dayjs(tDate).isValid()) {
            setToDate(tDate);
            setTempToDate(tDate);
        }
    }, [location.state, searchParams]);

    // Data State - INITIALIZE WITH EMPTY ARRAY (NO DUMMY DATA)
    const [data, setData] = useState<PurchaseItemOrder[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [activeFilter, setActiveFilter] = useState<string>("ALL");

    // Expand/Collapse state for orders
    const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
    // Per-order invoice details loaded from PurchaseOrderTripItemDetails API
    const [orderInvoicesMap, setOrderInvoicesMap] = useState<Record<string, ArrivedInvoiceDetail[]>>({});
    const [orderLoadingMap, setOrderLoadingMap] = useState<Record<string, boolean>>({});

    // Payment lookup map from purchaseOrderPayment API
    const paymentsMapRef = React.useRef<Map<string, PurchaseOrderPaymentItem>>(new Map());

    // Per-order payment details overrides (mapped from matched invoices)
    const [orderPaymentsMap, setOrderPaymentsMap] = useState<Record<string, {
        totalValue: number;
        paidAmount: number;
        pendingPayment: number;
        paymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" | "OVERDUE";
    }>>({});

    // Helper to get effective payment info for an order
    const getOrderPaymentInfo = (order: PurchaseItemOrder) => {
        const override = orderPaymentsMap[order.id];
        return {
            totalValue: override !== undefined ? override.totalValue : (order.totalValue || 0),
            paidAmount: override !== undefined ? override.paidAmount : (order.paidAmount || 0),
            pendingPayment: override !== undefined ? override.pendingPayment : (order.pendingPayment || 0),
            paymentStatus: override !== undefined ? override.paymentStatus : (order.paymentStatus || "PENDING"),
        };
    };

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
    const fetchInvoicesForOrder = async (order: PurchaseItemOrder, forceRefresh = false) => {
        if (!forceRefresh && orderInvoicesMap[order.id] !== undefined) {
            return;
        }

        if (orderLoadingMap[order.id]) {
            return;
        }

        setOrderLoadingMap((prev) => ({ ...prev, [order.id]: true }));

        try {
            // Helper to extract a single clean scalar ID (never an array, never comma-separated)
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

            // 1. Check order.transId
            const fromTransId = toCleanSingleId(order.transId);
            if (
                fromTransId !== null &&
                String(fromTransId) !== String(order.purOrderNo).trim() &&
                (!String(fromTransId).includes("/") || typeof fromTransId === "number")
            ) {
                targetPoId = fromTransId;
            }

            // 2. If not found, check item-level Trans_Id / OrderId
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

            // 3. Check order.transIds if available
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

            let fetchedItems: OnlinePurchaseReportItemByOrderIdItem[] = [];

            // Trigger the API only once with the clean scalar Order ID / Trans_Id
            if (targetPoId !== null) {
                const res = await OnlinePurchaseReportItemByOrderIdService.getReportsitemByOrderId({
                    Po_Id: targetPoId,
                    company_id: 1,
                });
                fetchedItems = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            } else {
                console.warn(`No valid numeric/database ID found for order ${order.purOrderNo}, skipping API call.`);
            }

            if (fetchedItems.length > 0) {
                const activePaymentMap = paymentsMapRef.current;

                // Precompute total amounts per invoice reference for proportional allocation when multiple items share an invoice
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

                const mappedInvoices: ArrivedInvoiceDetail[] = fetchedItems.map((item, idx) => {
                    const invNo = String(item.invoice_no || "").trim();
                    const invDate = String(item.Ledger_Date || order.orderDate || "").trim();
                    const prodName = String(item.Product_Name || item.Stock_Item || item.POS_Item_Name || "Item").trim();
                    const qty = typeof item.Bill_Qty === "number" ? item.Bill_Qty : parseFloat(String(item.Bill_Qty || 0).replace(/,/g, "")) || 0;
                    const rate = typeof item.Rate === "number" ? item.Rate : parseFloat(String(item.Rate || 0).replace(/,/g, "")) || 0;
                    const rawAmount = typeof item.Amount === "number" ? item.Amount : parseFloat(String(item.Amount || 0).replace(/,/g, "")) || (qty * rate);
                    const batch = String(item.Batch || "").trim();
                    const godown = String(item.Godown_Name || "").trim();

                    // Check if vehicle or narration is available from matching arrivedInvoices
                    const matchingTrip = (order.arrivedInvoices || []).find((t) =>
                        (t.invoiceNo && invNo && t.invoiceNo.trim().toLowerCase() === invNo.trim().toLowerCase()) ||
                        (batch && t.batchNo && t.batchNo.trim().toLowerCase() === batch.trim().toLowerCase()) ||
                        (prodName && t.itemName && (t.itemName.toLowerCase().includes(prodName.toLowerCase()) || prodName.toLowerCase().includes(t.itemName.toLowerCase())))
                    );
                    const vehicle = String((item as any).Vehicle_No || (item as any).vehicle_no || matchingTrip?.inwardVehicle || "").trim();
                    const challan = String((item as any).Challan_No || matchingTrip?.challanNo || "").trim();

                    // Match Ref_Po_Inv_No with purchaseOrderPayment's invoice_no
                    const refNoRaw = String(item.Ref_Po_Inv_No !== undefined && item.Ref_Po_Inv_No !== null ? item.Ref_Po_Inv_No : "").trim();
                    const refKey = refNoRaw.toLowerCase();
                    const invKey = invNo.toLowerCase();

                    let payment = refKey ? activePaymentMap.get(refKey) : undefined;
                    if (!payment && refKey) {
                        const stripped = refKey.replace(/^0+/, "");
                        if (stripped && stripped !== refKey) {
                            payment = activePaymentMap.get(stripped);
                        }
                    }
                    if (!payment && invKey) {
                        payment = activePaymentMap.get(invKey);
                        if (!payment) {
                            const strippedInv = invKey.replace(/^0+/, "");
                            if (strippedInv && strippedInv !== invKey) {
                                payment = activePaymentMap.get(strippedInv);
                            }
                        }
                    }

                    let invValue = rawAmount;
                    let invPaid = 0;
                    let invPending = rawAmount;
                    let invStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" = "PENDING";

                    if (payment) {
                        const key = refKey || invKey;
                        const totalForRef = refAmountTotals[key] || 0;
                        const ratio = totalForRef > 0 ? (rawAmount / totalForRef) : 1;

                        const credit = typeof payment.Credit_Amt === "number" ? payment.Credit_Amt : parseFloat(String(payment.Credit_Amt || 0)) || 0;
                        const debit = typeof payment.Debit_Amt === "number" ? payment.Debit_Amt : parseFloat(String(payment.Debit_Amt || 0)) || 0;
                        const bal = typeof payment.Bal_Amount === "number" ? payment.Bal_Amount : parseFloat(String(payment.Bal_Amount || 0)) || 0;

                        invValue = Math.round(credit * ratio);
                        invPaid = Math.round(debit * ratio);
                        invPending = Math.round(Math.abs(bal) * ratio);

                        if (invPending <= 0 || bal === 0) {
                            invStatus = "PAID";
                            invPending = 0;
                        } else if (invPaid > 0) {
                            invStatus = "PARTIALLY_PAID";
                        } else {
                            invStatus = "PENDING";
                        }
                    }

                    return {
                        invoiceId: `inv-${invNo || "item"}-${item.Product_Id || idx}-${idx + 1}`,
                        invoiceNo: invNo || "-",
                        invoiceDate: invDate,
                        itemId: `item-${item.Product_Id || idx + 1}`,
                        itemName: prodName,
                        stockGroup: String(
                            (item.Stock_Group && item.Stock_Group !== "General Items")
                                ? item.Stock_Group
                                : (matchingTrip?.stockGroup || (matchingTrip as any)?.Stock_Group || deriveStockGroup(prodName))
                        ).trim(),
                        batchNo: batch,
                        batchLocation: godown || matchingTrip?.batchLocation || "",
                        arrivedQty: qty,
                        unit: "kg",
                        rate: rate,
                        amount: invValue,
                        paidAmount: invPaid,
                        pendingPayment: invPending,
                        paymentStatus: invStatus,
                        inwardVehicle: vehicle,
                        godown: godown || matchingTrip?.godown || "",
                        challanNo: challan,
                        tripId: (item as any).Trip_Id || matchingTrip?.tripId,
                        narration: String(item.Narration || matchingTrip?.narration || "").trim(),
                        tripStatus: String(item.Cancel_status || matchingTrip?.tripStatus || "").trim(),
                        billType: String((item as any).BillType || matchingTrip?.billType || "").trim(),
                    };
                });

                // Calculate order-level payment aggregation
                const orderTotalValue = mappedInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
                const orderPaidAmount = mappedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
                const orderPendingPayment = mappedInvoices.reduce((sum, inv) => sum + (inv.pendingPayment || 0), 0);
                const orderPaymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" =
                    orderPendingPayment <= 0 && orderPaidAmount > 0
                        ? "PAID"
                        : orderPaidAmount > 0
                            ? "PARTIALLY_PAID"
                            : "PENDING";

                setOrderInvoicesMap((prev) => ({
                    ...prev,
                    [order.id]: mappedInvoices,
                }));

                setOrderPaymentsMap((prev) => ({
                    ...prev,
                    [order.id]: {
                        totalValue: orderTotalValue,
                        paidAmount: orderPaidAmount,
                        pendingPayment: orderPendingPayment,
                        paymentStatus: orderPaymentStatus,
                    },
                }));

                // Update data in-place so all downstream calculations reflect new values
                setData((prevData) =>
                    prevData.map((o) =>
                        o.id === order.id
                            ? {
                                ...o,
                                totalValue: orderTotalValue,
                                paidAmount: orderPaidAmount,
                                pendingPayment: orderPendingPayment,
                                paymentStatus: orderPaymentStatus,
                            }
                            : o
                    )
                );
            } else {
                // If API returned 0 items for this PO, record empty list
                setOrderInvoicesMap((prev) => ({
                    ...prev,
                    [order.id]: [],
                }));
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
        const loadAll = async () => {
            setLoading(true);
            try {
                const [liveData] = await Promise.all([
                    PurchaseItemPaymentService.getPurchaseItemPayments({
                        Fromdate: fromDate,
                        Todate: toDate,
                    }),
                    loadPayments(toDate),
                ]);
                if (isMounted) {
                    setData(liveData || []);
                }
            } catch (err) {
                console.error("Failed to load live purchase item payment data:", err);
                if (isMounted) {
                    setData([]);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadAll();
        return () => {
            isMounted = false;
        };
    }, [fromDate, toDate]);

    // Auto-expand order when navigated with specific order
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

    // Base dataset with search query, selected order, and date filters applied
    const baseData = useMemo(() => {
        return data.filter((item) => {
            // 0. Selected Order Filter (passed from other tabs / reports)
            if (selectedOrderOnly.trim() !== "") {
                const so = selectedOrderOnly.toLowerCase().trim();
                const matchPO = item.purOrderNo?.toLowerCase().includes(so);
                const matchInv = item.purInvNo?.toLowerCase().includes(so);
                const activeInvs = orderInvoicesMap[item.id] || item.arrivedInvoices || [];
                const matchArrived = activeInvs.some((inv) => inv.invoiceNo?.toLowerCase().includes(so));
                if (!matchPO && !matchInv && !matchArrived) return false;
            }

            // 1. Date Filter (Order Date) - only apply if NOT viewing a specific order
            if (!selectedOrderOnly && (fromDate || toDate)) {
                if (item.orderDate) {
                    const itemDate = dayjs(item.orderDate);
                    if (itemDate.isValid()) {
                        if (fromDate && itemDate.isBefore(dayjs(fromDate), "day")) return false;
                        if (toDate && itemDate.isAfter(dayjs(toDate), "day")) return false;
                    }
                }
            }

            // 2. Search Query
            if (searchQuery.trim() !== "") {
                const q = searchQuery.toLowerCase().trim();
                const matchPO = item.purOrderNo?.toLowerCase().includes(q);
                const matchSupplier = item.supplierName?.toLowerCase().includes(q);
                const matchPayNo = item.paymentNo?.toLowerCase().includes(q);
                const matchInv = item.purInvNo?.toLowerCase().includes(q);
                const matchStatus = item.paymentStatus?.toLowerCase().includes(q);
                const matchItems = item.items?.some(
                    (it) =>
                        cleanItemName(it.itemName).toLowerCase().includes(q) ||
                        it.itemName.toLowerCase().includes(q) ||
                        it.stockGroup.toLowerCase().includes(q) ||
                        (it.inwardBatch && it.inwardBatch.toLowerCase().includes(q))
                );
                const activeInvs = orderInvoicesMap[item.id] !== undefined
                    ? orderInvoicesMap[item.id]
                    : (item.arrivedInvoices || []);
                const matchArrivedInvoices = activeInvs.some(
                    (inv) =>
                        inv.invoiceNo.toLowerCase().includes(q) ||
                        inv.batchNo.toLowerCase().includes(q) ||
                        cleanItemName(inv.itemName).toLowerCase().includes(q) ||
                        inv.itemName.toLowerCase().includes(q)
                );

                if (
                    !matchPO &&
                    !matchSupplier &&
                    !matchPayNo &&
                    !matchInv &&
                    !matchStatus &&
                    !matchItems &&
                    !matchArrivedInvoices
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [data, searchQuery, fromDate, toDate, selectedOrderOnly, orderInvoicesMap]);

    // Dynamic status filter counts strictly matching the active baseData
    const filterCounts = useMemo(() => {
        let withInvoices = 0;
        let pendingInward = 0;
        let paid = 0;
        let partial = 0;
        let pendingPayment = 0;

        baseData.forEach((item) => {
            if (isOrderWithInvoices(item, orderInvoicesMap)) {
                withInvoices++;
            } else {
                pendingInward++;
            }

            const pay = getOrderPaymentInfo(item);
            if (pay.paymentStatus === "PAID") paid++;
            if (pay.paymentStatus === "PARTIALLY_PAID") partial++;
            if (pay.pendingPayment > 0) pendingPayment++;
        });

        return {
            all: baseData.length,
            withInvoices,
            pendingInward,
            paid,
            partial,
            pendingPayment,
        };
    }, [baseData, orderInvoicesMap, orderPaymentsMap]);

    // Filtered dataset for table display
    const filteredData = useMemo(() => {
        if (activeFilter === "ALL") return baseData;
        return baseData.filter((item) => {
            if (activeFilter === "WITH_INVOICES") {
                return isOrderWithInvoices(item, orderInvoicesMap);
            }
            if (activeFilter === "PENDING_INWARD") {
                return !isOrderWithInvoices(item, orderInvoicesMap);
            }
            const pay = getOrderPaymentInfo(item);
            if (activeFilter === "PAID") {
                return pay.paymentStatus === "PAID";
            }
            if (activeFilter === "PARTIAL") {
                return pay.paymentStatus === "PARTIALLY_PAID";
            }
            if (activeFilter === "PENDING_PAYMENT") {
                return pay.pendingPayment > 0;
            }
            return true;
        });
    }, [baseData, activeFilter, orderInvoicesMap, orderPaymentsMap]);

    // Metrics summary calculation for Grand Totals row
    const metrics = useMemo(() => {
        const total = filteredData.length;
        let totalOrderedTons = 0;
        let totalArrivedTons = 0;
        let totalValue = 0;
        let totalPaidAmt = 0;
        let totalPendingAmt = 0;
        let totalArrivedInvoicesCount = 0;

        filteredData.forEach((item) => {
            const pay = getOrderPaymentInfo(item);
            totalOrderedTons += item.orderedTons || 0;
            totalArrivedTons += item.arrivedTons || 0;
            totalValue += pay.totalValue || 0;
            totalPaidAmt += pay.paidAmount || 0;
            totalPendingAmt += pay.pendingPayment || 0;

            const itemInvCount = getOrderInvoiceCount(item, orderInvoicesMap);
            totalArrivedInvoicesCount += itemInvCount;
        });

        const overallTonsPercentage =
            totalOrderedTons > 0 ? Math.round((totalArrivedTons / totalOrderedTons) * 100) : 0;
        const paymentClearancePercentage =
            totalValue > 0 ? Math.round((totalPaidAmt / totalValue) * 100) : 0;

        return {
            total,
            totalOrderedTons,
            totalArrivedTons,
            totalPendingTons: Math.max(0, totalOrderedTons - totalArrivedTons),
            overallTonsPercentage,
            totalValue,
            totalPaidAmt,
            totalPendingAmt,
            paymentClearancePercentage,
            totalArrivedInvoicesCount,
        };
    }, [filteredData]);

    // Paginated Data
    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    // Background prefetch invoice details from onlinePurchaseReportItemByOrderId for visible page orders
    useEffect(() => {
        if (!paginatedData || paginatedData.length === 0) return;
        let isCancelled = false;

        const prefetchPageOrders = async () => {
            const candidates = paginatedData.filter((ord) => {
                const hasId = ord.transId || (ord.items && ord.items.some((it: any) => it.Trans_Id || it.trans_id || it.OrderId || it.order_id));
                return hasId && orderInvoicesMap[ord.id] === undefined && !orderLoadingMap[ord.id];
            });

            // Parallel batch fetch in groups of 5
            const batchSize = 5;
            for (let i = 0; i < candidates.length; i += batchSize) {
                if (isCancelled) break;
                const batch = candidates.slice(i, i + batchSize);
                await Promise.all(batch.map((ord) => fetchInvoicesForOrder(ord)));
            }
        };

        prefetchPageOrders();

        return () => {
            isCancelled = true;
        };
    }, [paginatedData]);

    // Toggle expand for a specific order
    const toggleOrderExpand = (order: PurchaseItemOrder) => {
        const willExpand = !expandedOrderIds[order.id];
        setExpandedOrderIds((prev) => ({
            ...prev,
            [order.id]: willExpand,
        }));
        if (willExpand) {
            fetchInvoicesForOrder(order);
        }
    };

    // Quick status chip styles
    const getPaymentStatusChip = (status: string) => {
        switch (status) {
            case "PAID":
                return (
                    <Chip
                        icon={<CheckCircleOutlineIcon sx={{ fontSize: "0.85rem !important", color: "#15803d !important" }} />}
                        label="PAID"
                        size="small"
                        sx={{
                            bgcolor: "#dcfce7",
                            color: "#15803d",
                            fontWeight: 800,
                            fontSize: "0.68rem",
                            height: 22,
                            border: "1px solid #86efac",
                        }}
                    />
                );
            case "PARTIALLY_PAID":
                return (
                    <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: "0.85rem !important", color: "#c2410c !important" }} />}
                        label="PARTIALLY PAID"
                        size="small"
                        sx={{
                            bgcolor: "#ffedd5",
                            color: "#c2410c",
                            fontWeight: 800,
                            fontSize: "0.68rem",
                            height: 22,
                            border: "1px solid #fdba74",
                        }}
                    />
                );
            case "OVERDUE":
                return (
                    <Chip
                        icon={<ErrorOutlineIcon sx={{ fontSize: "0.85rem !important", color: "#b91c1c !important" }} />}
                        label="OVERDUE"
                        size="small"
                        sx={{
                            bgcolor: "#fee2e2",
                            color: "#b91c1c",
                            fontWeight: 800,
                            fontSize: "0.68rem",
                            height: 22,
                            border: "1px solid #fca5a5",
                        }}
                    />
                );
            default:
                return (
                    <Chip
                        label="PENDING"
                        size="small"
                        sx={{
                            bgcolor: "#f1f5f9",
                            color: "#475569",
                            fontWeight: 700,
                            fontSize: "0.68rem",
                            height: 22,
                        }}
                    />
                );
        }
    };



    /* ================= EXPORT FUNCTIONS ================= */

    const handleExportExcel = () => {
        try {
            const excelRows: any[] = [];

            filteredData.forEach((order) => {
                const pay = getOrderPaymentInfo(order);
                // Summary of order items
                const itemNamesWithQty = order.items
                    .map((it) => `${cleanItemName(it.itemName)} (${it.orderedTons} T)`)
                    .join(", ");

                const invList = orderInvoicesMap[order.id] !== undefined
                    ? orderInvoicesMap[order.id]
                    : (order.arrivedInvoices || []);

                if (invList.length > 0) {
                    invList.forEach((inv, idx) => {
                        excelRows.push({
                            "S.No": idx === 0 ? order.sNo : "",
                            "Purchase Order": idx === 0 ? order.purOrderNo : "",
                            "PO ID / Trans ID": idx === 0 ? (cleanPoId(order.transId) || "") : "",
                            "Supplier Name": idx === 0 ? order.supplierName : "",
                            "Order Date": idx === 0 ? (order.orderDate && dayjs(order.orderDate).isValid() ? dayjs(order.orderDate).format("DD/MM/YYYY") : order.orderDate) : "",
                            "Item Details (Ordered Qty)": idx === 0 ? itemNamesWithQty : "",
                            "Order Value (₹)": idx === 0 ? pay.totalValue : "",
                            "Order Paid (₹)": idx === 0 ? pay.paidAmount : "",
                            "Order Pending Payment (₹)": idx === 0 ? pay.pendingPayment : "",
                            "Order Payment Status": idx === 0 ? pay.paymentStatus : "",
                            "Arrived Invoice No": inv.invoiceNo,
                            "Invoice Date": inv.invoiceDate && dayjs(inv.invoiceDate).isValid() ? dayjs(inv.invoiceDate).format("DD/MM/YYYY") : inv.invoiceDate,
                            "Batch": inv.batchNo || "-",
                            "Batch Location": inv.batchLocation || inv.godown || "",
                            "Arrived Item": cleanItemName(inv.itemName),
                            "Arrived Qty (KG)": inv.arrivedQty,
                            "Rate (₹)": inv.rate,
                            "Arrived Value / Amt (₹)": inv.amount,
                            "Invoice Paid (₹)": inv.paidAmount,
                            "Invoice Pending Payment (₹)": inv.pendingPayment,
                            "Vehicle No": inv.inwardVehicle || "",
                        });
                    });
                } else {
                    excelRows.push({
                        "S.No": order.sNo,
                        "Purchase Order": order.purOrderNo,
                        "PO ID / Trans ID": cleanPoId(order.transId) || "",
                        "Supplier Name": order.supplierName,
                        "Order Date": order.orderDate && dayjs(order.orderDate).isValid() ? dayjs(order.orderDate).format("DD/MM/YYYY") : order.orderDate,
                        "Item Details (Ordered Qty)": itemNamesWithQty,
                        "Order Value (₹)": pay.totalValue,
                        "Order Paid (₹)": pay.paidAmount,
                        "Order Pending Payment (₹)": pay.pendingPayment,
                        "Order Payment Status": pay.paymentStatus,
                        "Arrived Invoice No": "No Invoices Arrived",
                        "Invoice Date": "-",
                        "Batch": "-",
                        "Arrived Item": "-",
                        "Arrived Qty (Tons)": 0,
                        "Rate (₹)": 0,
                        "Arrived Value / Amt (₹)": 0,
                        "Invoice Paid (₹)": 0,
                        "Invoice Pending Payment (₹)": 0,
                    });
                }
            });

            const ws = XLSX.utils.json_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Item & Invoice Payments");
            XLSX.writeFile(wb, `Purchase_Item_Invoice_Payment_Report_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
            toast.success("Excel exported successfully!");
        } catch (error) {
            console.error("Export Excel error", error);
            toast.error("Failed to export Excel.");
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF("landscape", "mm", "a4");
            doc.setFontSize(13);
            doc.text("Purchase Order Item & Invoice Payment Report", 14, 15);
            doc.setFontSize(8.5);
            doc.text(`Generated on: ${dayjs().format("DD/MM/YYYY HH:mm")} | Total Orders: ${filteredData.length}`, 14, 21);

            const tableRows: any[] = [];
            filteredData.forEach((order) => {
                const pay = getOrderPaymentInfo(order);
                const itemSummary = order.items.map((it) => `${cleanItemName(it.itemName)}: ${it.orderedTons} T`).join("\n");
                const invList = orderInvoicesMap[order.id] !== undefined
                    ? orderInvoicesMap[order.id]
                    : (order.arrivedInvoices || []);
                const arrivedInvoicesSummary =
                    invList.length > 0
                        ? invList
                            .map(
                                (inv) =>
                                    `${inv.invoiceNo} (${inv.invoiceDate && dayjs(inv.invoiceDate).isValid() ? dayjs(inv.invoiceDate).format("DD/MM") : inv.invoiceDate}): ${inv.batchNo ? `Batch ${inv.batchNo}` : "No Batch"} | ${formatKgQuantity(inv.arrivedQty)} @ ₹${inv.rate} = ₹${inv.amount.toLocaleString("en-IN")}${inv.inwardVehicle ? ` | ${inv.inwardVehicle}` : ""}`
                            )
                            .join("\n")
                        : "No Invoices Arrived (Pending Inward)";

                tableRows.push([
                    order.sNo,
                    `${order.purOrderNo}\n${order.supplierName}`,
                    itemSummary,
                    `₹ ${pay.totalValue.toLocaleString("en-IN")}`,
                    `₹ ${pay.pendingPayment.toLocaleString("en-IN")}\nPaid: ₹ ${pay.paidAmount.toLocaleString("en-IN")}\n(${pay.paymentStatus})`,
                    arrivedInvoicesSummary,
                ]);
            });

            autoTable(doc, {
                head: [["S.No", "Purchase Order", "Item Details (Ordered Qty)", "Value", "Pending Payment", "Arrived Invoice Details (Rate, Amt, Batch, Qty, Value, Pending)"]],
                body: tableRows,
                startY: 26,
                theme: "grid",
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
            });

            doc.save(`Purchase_Item_Invoice_Payment_Report_${dayjs().format("YYYYMMDD_HHmm")}.pdf`);
            toast.success("PDF exported successfully!");
        } catch (error) {
            console.error("Export PDF error", error);
            toast.error("Failed to export PDF.");
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
            {/* 1. TOP HEADER */}
            <PageHeader
                showPages={true}
                parentReportName="Purchase Item & Invoice Payment Report"
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
            />

            {/* MAIN CONTENT WRAPPER - FILLS VIEWPORT, ZERO WINDOW SCROLL */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    px: { xs: 1.5, md: 2 },
                    pt: 1,
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
                                Showing Item & Invoice Payment Details for Order: <strong>{selectedOrderOnly}</strong> ({filteredData.length} records)
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setSelectedOrderOnly("");
                                navigate("/purchaseItemPayment", { replace: true });
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

                {/* 2. COMPACT REPORT TITLE & CONTROLS BAR */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 1,
                        px: 1.5,
                        borderRadius: 2,
                        border: "1px solid #e2e8f0",
                        bgcolor: "#ffffff",
                        display: "flex",
                        flexDirection: { xs: "column", lg: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "stretch", lg: "center" },
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    {/* Title & Quick Status Chips on Left */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Inventory2OutlinedIcon sx={{ color: "#1e3a8a", fontSize: 20 }} />
                        <Typography sx={{ fontWeight: 800, color: "#1e3a8a", fontSize: "0.92rem", letterSpacing: -0.2 }}>
                            Purchase Item & Invoice Payment Report
                        </Typography>
                        <Chip
                            size="small"
                            label={`${filteredData.length} Orders`}
                            sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 700, height: 22, fontSize: "0.70rem" }}
                        />

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 18, alignSelf: "center", display: { xs: "none", sm: "block" } }} />

                        {/* Quick Filter Chips */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
                            <Chip
                                label={`All (${filterCounts.all})`}
                                size="small"
                                clickable
                                color={activeFilter === "ALL" ? "primary" : "default"}
                                onClick={() => { setActiveFilter("ALL"); setPage(1); }}
                                sx={{ fontWeight: 700, fontSize: "0.70rem", height: 22 }}
                            />
                            <Chip
                                label={`With Invoices (${filterCounts.withInvoices})`}
                                size="small"
                                clickable
                                color={activeFilter === "WITH_INVOICES" ? "primary" : "default"}
                                onClick={() => { setActiveFilter("WITH_INVOICES"); setPage(1); }}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.70rem",
                                    height: 22,
                                    bgcolor: activeFilter === "WITH_INVOICES" ? undefined : "#ecfdf5",
                                    color: activeFilter === "WITH_INVOICES" ? undefined : "#047857",
                                }}
                            />
                            <Chip
                                label={`Pending Inward (${filterCounts.pendingInward})`}
                                size="small"
                                clickable
                                color={activeFilter === "PENDING_INWARD" ? "primary" : "default"}
                                onClick={() => { setActiveFilter("PENDING_INWARD"); setPage(1); }}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.70rem",
                                    height: 22,
                                    bgcolor: activeFilter === "PENDING_INWARD" ? undefined : "#fffbeb",
                                    color: activeFilter === "PENDING_INWARD" ? undefined : "#b45309",
                                }}
                            />
                            <Chip
                                label={`Paid (${filterCounts.paid})`}
                                size="small"
                                clickable
                                color={activeFilter === "PAID" ? "primary" : "default"}
                                onClick={() => { setActiveFilter("PAID"); setPage(1); }}
                                sx={{ fontWeight: 700, fontSize: "0.70rem", height: 22 }}
                            />
                            <Chip
                                label={`Partial (${filterCounts.partial})`}
                                size="small"
                                clickable
                                color={activeFilter === "PARTIAL" ? "primary" : "default"}
                                onClick={() => { setActiveFilter("PARTIAL"); setPage(1); }}
                                sx={{ fontWeight: 700, fontSize: "0.70rem", height: 22 }}
                            />
                            <Chip
                                label={`Pending Pay (${filterCounts.pendingPayment})`}
                                size="small"
                                clickable
                                color={activeFilter === "PENDING_PAYMENT" ? "primary" : "default"}
                                onClick={() => { setActiveFilter("PENDING_PAYMENT"); setPage(1); }}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "0.70rem",
                                    height: 22,
                                    bgcolor: activeFilter === "PENDING_PAYMENT" ? undefined : "#fee2e2",
                                    color: activeFilter === "PENDING_PAYMENT" ? undefined : "#b91c1c",
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Search Box on Right */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <TextField
                            size="small"
                            placeholder="Search PO, Supplier, Item, Batch, Invoice..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: "#94a3b8", fontSize: 18 }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchQuery ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchQuery("")} sx={{ p: 0.2 }}>
                                            <ClearIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            }}
                            sx={{
                                width: { xs: "100%", sm: 260 },
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 1.5,
                                    fontSize: "0.76rem",
                                    height: 32,
                                    bgcolor: "#f8fafc",
                                },
                            }}
                        />
                    </Box>
                </Paper>

                {/* 3. MAIN DATA TABLE & PINNED PAGINATION */}
                <Paper
                    elevation={0}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 2,
                        border: "1px solid #e2e8f0",
                        overflow: "hidden",
                        bgcolor: "#ffffff",
                    }}
                >
                    {loading && <LinearProgress sx={{ height: 3 }} />}
                    <TableContainer sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                        <Table stickyHeader size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                            {/* TABLE HEAD (FIXED WITH GRAND TOTALS ROW) */}
                            <TableHead>
                                {/* 1. MAIN COLUMN HEADERS ROW */}
                                <TableRow
                                    sx={{
                                        "& th": {
                                            bgcolor: "#1e3a8a",
                                            color: "#ffffff",
                                            fontWeight: 700,
                                            fontSize: "0.76rem",
                                            py: 0.9,
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
                                    <TableCell sx={{ width: "5%", textAlign: "center" }}>S.NO</TableCell>
                                    <TableCell sx={{ width: "22%" }}>PURCHASE ORDER</TableCell>
                                    <TableCell sx={{ width: "25%" }}>ITEM DETAILS</TableCell>
                                    <TableCell sx={{ width: "12%", textAlign: "right" }}>VALUE</TableCell>
                                    <TableCell sx={{ width: "16%", textAlign: "right" }}>PENDING PAYMENT</TableCell>
                                    <TableCell sx={{ width: "10%", textAlign: "center" }}>ACTIONS</TableCell>
                                </TableRow>

                                {/* 2. STICKY GRAND TOTALS ROW (FIXED DIRECTLY UNDER HEADERS) */}
                                <TableRow
                                    sx={{
                                        bgcolor: "#f1f5f9",
                                        borderBottom: "2px solid #cbd5e1",
                                        "& th, & td": {
                                            fontWeight: 800,
                                            fontSize: "0.78rem",
                                            color: "#0f172a",
                                            py: 0.8,
                                            px: 1,
                                            position: "sticky",
                                            top: "39px",
                                            zIndex: 4,
                                            bgcolor: "#f1f5f9",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        },
                                    }}
                                >
                                    <TableCell sx={{ textAlign: "center" }}>
                                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#1e3a8a" }}>
                                            TOTAL
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#1e3a8a" }}>
                                            {metrics.total} Orders
                                        </Typography>
                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>
                                            {metrics.totalArrivedInvoicesCount} Invoices
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#0369a1" }}>
                                                {formatKgQuantity(metrics.totalOrderedTons)} Ordered
                                            </Typography>
                                            <Typography sx={{ fontSize: "0.72rem", color: "#15803d", fontWeight: 700 }}>
                                                • {formatKgQuantity(metrics.totalArrivedTons)} Arrived ({metrics.overallTonsPercentage}%)
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ fontSize: "0.66rem", color: "#b91c1c", fontWeight: 600 }}>
                                            {formatKgQuantity(metrics.totalPendingTons)} Pending Inward
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textAlign: "right" }}>
                                        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a" }}>
                                            {formatCurrency(metrics.totalValue)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textAlign: "right" }}>
                                        <Typography sx={{ fontSize: "0.90rem", fontWeight: 900, color: metrics.totalPendingAmt > 0 ? "#b91c1c" : "#15803d" }}>
                                            {formatCurrency(metrics.totalPendingAmt)}
                                        </Typography>
                                        <Typography sx={{ fontSize: "0.66rem", color: "#15803d", fontWeight: 600 }}>
                                            Paid: {formatCurrency(metrics.totalPaidAmt)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ textAlign: "center" }}>

                                    </TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>

                                {/* ROWS */}
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                                <ErrorOutlineIcon sx={{ fontSize: 36, color: "#94a3b8" }} />
                                                <Typography sx={{ color: "#64748b", fontWeight: 600 }}>
                                                    No purchase orders matching the filter criteria.
                                                </Typography>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => {
                                                        setSelectedOrderOnly("");
                                                        setSearchQuery("");
                                                        setActiveFilter("ALL");
                                                    }}
                                                    sx={{ textTransform: "none", mt: 0.5 }}
                                                >
                                                    Clear All Filters
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((order) => {
                                        const isExpanded = Boolean(expandedOrderIds[order.id]);
                                        const isOrderLoading = Boolean(orderLoadingMap[order.id]);

                                        // Source for invoices in expanded table:
                                        // When fetched from onlinePurchaseReportItemByOrderId, ALWAYS use them!
                                        const baseInvoices = order.arrivedInvoices || [];
                                        const fetchedInvoices = orderInvoicesMap[order.id];
                                        const hasFetched = fetchedInvoices !== undefined;
                                        const displayInvoices = hasFetched
                                            ? fetchedInvoices
                                            : baseInvoices;

                                        const invoiceCount = getOrderInvoiceCount(order, orderInvoicesMap);
                                        const hasInvoices = invoiceCount > 0;
                                        const payInfo = getOrderPaymentInfo(order);

                                        return (
                                            <React.Fragment key={order.id}>
                                                {/* PARENT ORDER ROW */}
                                                <TableRow
                                                    hover
                                                    sx={{
                                                        bgcolor: isExpanded ? "#f8fafc" : "#ffffff",
                                                        "&:hover": { bgcolor: "#f1f5f9" },
                                                        transition: "background-color 0.15s ease",
                                                    }}
                                                >
                                                    {/* 1. S.NO with EXPAND CHEVRON */}
                                                    <TableCell sx={{ textAlign: "center", verticalAlign: "middle", py: 0.8, px: 0.5 }}>
                                                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.3 }}>
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.2 }}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => toggleOrderExpand(order)}
                                                                    sx={{
                                                                        p: 0.2,
                                                                        color: isExpanded ? "#0284c7" : "#64748b",
                                                                        bgcolor: isExpanded ? "#e0f2fe" : "transparent",
                                                                        "&:hover": { bgcolor: "#e0f2fe" },
                                                                    }}
                                                                >
                                                                    {isExpanded ? (
                                                                        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                                                                    ) : (
                                                                        <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                                                                    )}
                                                                </IconButton>
                                                                <Typography sx={{ fontWeight: 700, fontSize: "0.78rem", color: "#334155" }}>
                                                                    {order.sNo}
                                                                </Typography>
                                                            </Box>

                                                            {/* Inward status tag */}
                                                            {hasInvoices ? (
                                                                <Chip
                                                                    size="small"
                                                                    label={`${invoiceCount} Inv`}
                                                                    sx={{
                                                                        height: 16,
                                                                        fontSize: "0.58rem",
                                                                        fontWeight: 700,
                                                                        bgcolor: "#ecfdf5",
                                                                        color: "#059669",
                                                                        border: "1px solid #a7f3d0",
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Chip
                                                                    size="small"
                                                                    label="Pending"
                                                                    sx={{
                                                                        height: 16,
                                                                        fontSize: "0.58rem",
                                                                        fontWeight: 700,
                                                                        bgcolor: "#fffbeb",
                                                                        color: "#d97706",
                                                                        border: "1px solid #fde68a",
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>
                                                    </TableCell>

                                                    {/* 2. PURCHASE ORDER */}
                                                    <TableCell sx={{ verticalAlign: "middle", py: 0.8, px: 1, wordBreak: "break-word" }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
                                                            <Typography
                                                                sx={{
                                                                    fontSize: "0.85rem",
                                                                    fontWeight: 800,
                                                                    color: "#1e3a8a",
                                                                }}
                                                            >
                                                                {order.purOrderNo}
                                                            </Typography>
                                                        </Box>
                                                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a", mt: 0.1 }}>
                                                            {order.supplierName}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", mt: 0.2 }}>
                                                            Order Date: <strong>{order.orderDate && dayjs(order.orderDate).isValid() ? dayjs(order.orderDate).format("DD/MM/YYYY") : (order.orderDate || "-")}</strong>
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 3. ITEM DETAILS (CRISP ITEM LIST WITH ORDERED QTY FROM PurchaseOrderReportItem) */}
                                                    <TableCell sx={{ verticalAlign: "middle", py: 0.8, px: 1.2 }}>
                                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                                                            {order.items && order.items.length > 0 ? (
                                                                order.items.map((it, idx) => (
                                                                    <Box
                                                                        key={it.itemId || idx}
                                                                        sx={{
                                                                            display: "flex",
                                                                            justifyContent: "space-between",
                                                                            alignItems: "center",
                                                                            py: 0.25,
                                                                            px: 0.6,
                                                                            borderRadius: 1,
                                                                            bgcolor: idx % 2 === 0 ? "rgba(241, 245, 249, 0.7)" : "transparent",
                                                                            borderBottom: idx < order.items.length - 1 ? "1px dashed #e2e8f0" : "none",
                                                                        }}
                                                                    >
                                                                        <Box sx={{ minWidth: 0, pr: 1 }}>
                                                                            <Typography
                                                                                sx={{
                                                                                    fontSize: "0.78rem",
                                                                                    fontWeight: 700,
                                                                                    color: "#0f172a",
                                                                                    overflow: "hidden",
                                                                                    textOverflow: "ellipsis",
                                                                                    whiteSpace: "nowrap",
                                                                                }}
                                                                            >
                                                                                {cleanItemName(it.itemName) || it.itemName || "Item"}
                                                                            </Typography>
                                                                            {it.stockGroup && (
                                                                                <Typography sx={{ fontSize: "0.64rem", color: "#64748b", lineHeight: 1.1 }}>
                                                                                    {it.stockGroup}
                                                                                </Typography>
                                                                            )}

                                                                        </Box>
                                                                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                                                                            <Chip
                                                                                size="small"
                                                                                label={formatKgQuantityCompact(it.orderedTons)}
                                                                                sx={{
                                                                                    height: 20,
                                                                                    fontSize: "0.72rem",
                                                                                    fontWeight: 800,
                                                                                    bgcolor: "#e0f2fe",
                                                                                    color: "#0369a1",
                                                                                    border: "1px solid #bae6fd",
                                                                                }}
                                                                            />
                                                                            {it.ratePerTon > 0 && (
                                                                                <Typography sx={{ fontSize: "0.62rem", color: "#64748b", mt: 0.2 }}>
                                                                                    @ {formatCurrency(it.ratePerTon)}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Box>
                                                                ))
                                                            ) : (
                                                                <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8" }}>-</Typography>
                                                            )}
                                                        </Box>
                                                    </TableCell>

                                                    {/* 4. VALUE */}
                                                    <TableCell sx={{ textAlign: "right", verticalAlign: "middle", py: 0.8, px: 1 }}>
                                                        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a" }}>
                                                            {formatCurrency(payInfo.totalValue)}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b", mt: 0.2 }}>
                                                            {formatKgQuantity(order.orderedTons)}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 5. PENDING PAYMENT */}
                                                    <TableCell sx={{ textAlign: "right", verticalAlign: "middle", py: 0.8, px: 1 }}>
                                                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.3 }}>
                                                            <Typography
                                                                sx={{
                                                                    fontSize: "0.90rem",
                                                                    fontWeight: 900,
                                                                    color: payInfo.pendingPayment > 0 ? "#b91c1c" : "#15803d",
                                                                }}
                                                            >
                                                                {formatCurrency(payInfo.pendingPayment)}
                                                            </Typography>

                                                            {getPaymentStatusChip(payInfo.paymentStatus)}

                                                            <Typography sx={{ fontSize: "0.66rem", color: "#15803d", fontWeight: 600 }}>
                                                                Paid: {formatCurrency(payInfo.paidAmount)}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>

                                                    {/* 6. ACTIONS */}
                                                    <TableCell sx={{ textAlign: "center", verticalAlign: "middle", py: 0.8, px: 0.5 }}>
                                                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.4 }}>
                                                            {/* Delivery Report Navigation */}
                                                            <Tooltip title={`Delivery Funnel (${order.purOrderNo}) - Open in New Tab`}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        const effectiveFrom = order.orderDate && dayjs(order.orderDate).isValid() && dayjs(order.orderDate).isBefore(dayjs(fromDate))
                                                                            ? dayjs(order.orderDate).format("YYYY-MM-DD")
                                                                            : fromDate;
                                                                        const url = `/purchaseDelivery?orderId=${encodeURIComponent(order.purOrderNo)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(toDate)}`;
                                                                        window.open(url, "_blank");
                                                                    }}
                                                                    sx={{
                                                                        color: "#0369a1",
                                                                        bgcolor: "#f0f9ff",
                                                                        p: 0.4,
                                                                        "&:hover": { bgcolor: "#e0f2fe" },
                                                                    }}
                                                                >
                                                                    <LocalShippingOutlinedIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>

                                                            {/* Purchase Payment Report Navigation */}
                                                            <Tooltip title={`Purchase Payment (${order.purOrderNo}) - Open in New Tab`}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        const effectiveFrom = order.orderDate && dayjs(order.orderDate).isValid() && dayjs(order.orderDate).isBefore(dayjs(fromDate))
                                                                            ? dayjs(order.orderDate).format("YYYY-MM-DD")
                                                                            : fromDate;
                                                                        const url = `/purchasePayment?orderId=${encodeURIComponent(order.purOrderNo)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(toDate)}`;
                                                                        window.open(url, "_blank");
                                                                    }}
                                                                    sx={{
                                                                        color: "#a21caf",
                                                                        bgcolor: "#fdf4ff",
                                                                        p: 0.4,
                                                                        "&:hover": { bgcolor: "#fae8ff" },
                                                                    }}
                                                                >
                                                                    <PaymentOutlinedIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>

                                                {/* EXPANDABLE ARRIVED INVOICE DETAILS ROW (NO GODOWN DETAILS, FITS SCREEN) */}
                                                <TableRow>
                                                    <TableCell colSpan={6} sx={{ p: 0, borderBottom: isExpanded ? "2px solid #cbd5e1" : "none" }}>
                                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                            <Box
                                                                sx={{
                                                                    p: 1.5,
                                                                    bgcolor: "#f8fafc",
                                                                    borderLeft: "4px solid #0284c7",
                                                                    borderTop: "1px dashed #cbd5e1",
                                                                }}
                                                            >
                                                                {/* ARRIVED INVOICE DETAILS SECTION HEADER (ONLY MAPPED INVOICES SHOWN) */}
                                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}>
                                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                                        <ReceiptLongOutlinedIcon sx={{ color: "#0369a1", fontSize: 18 }} />
                                                                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase" }}>
                                                                            Arrived Invoice Details for {order.purOrderNo}
                                                                        </Typography>
                                                                        {cleanPoId(order.transId) && (
                                                                            <Chip
                                                                                size="small"
                                                                                label={`Po_Id: ${cleanPoId(order.transId)}`}
                                                                                sx={{
                                                                                    height: 18,
                                                                                    fontSize: "0.62rem",
                                                                                    fontWeight: 700,
                                                                                    bgcolor: "#e0f2fe",
                                                                                    color: "#0369a1",
                                                                                    border: "1px solid #bae6fd",
                                                                                }}
                                                                            />
                                                                        )}
                                                                        <Chip
                                                                            size="small"
                                                                            label={
                                                                                isOrderLoading
                                                                                    ? "Loading Details..."
                                                                                    : hasInvoices
                                                                                        ? `${invoiceCount} Invoice${invoiceCount > 1 ? "s" : ""} Arrived`
                                                                                        : "0 Invoices Arrived"
                                                                            }
                                                                            sx={{
                                                                                fontWeight: 800,
                                                                                fontSize: "0.64rem",
                                                                                height: 18,
                                                                                bgcolor: isOrderLoading ? "#e0f2fe" : hasInvoices ? "#dbeafe" : "#fffbeb",
                                                                                color: isOrderLoading ? "#0369a1" : hasInvoices ? "#1e40af" : "#b45309",
                                                                            }}
                                                                        />
                                                                        <Tooltip title="Refresh invoice details from server">
                                                                            <span>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => fetchInvoicesForOrder(order, true)}
                                                                                    disabled={isOrderLoading}
                                                                                    sx={{ p: 0.3, color: "#0284c7" }}
                                                                                >
                                                                                    <RefreshIcon sx={{ fontSize: 16 }} />
                                                                                </IconButton>
                                                                            </span>
                                                                        </Tooltip>
                                                                    </Box>

                                                                    <Typography sx={{ fontSize: "0.70rem", color: "#64748b" }}>
                                                                        Supplier: <strong>{order.supplierName}</strong>
                                                                    </Typography>
                                                                </Box>

                                                                {/* CONDITION: LOADING OR INVOICES TABLE OR NO INVOICES */}
                                                                {isOrderLoading ? (
                                                                    <Box sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, bgcolor: "#ffffff", borderRadius: 1.5, border: "1px solid #cbd5e1" }}>
                                                                        <LinearProgress sx={{ width: "50%", height: 6, borderRadius: 3 }} />
                                                                        <Typography sx={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
                                                                            Fetching invoice details for {order.purOrderNo} {cleanPoId(order.transId) ? `(Po_Id: ${cleanPoId(order.transId)})` : ""}...
                                                                        </Typography>
                                                                    </Box>
                                                                ) : hasInvoices ? (
                                                                    <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #cbd5e1", borderRadius: 1.5, overflowX: "hidden" }}>
                                                                        <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                                                                            <TableHead>
                                                                                <TableRow sx={{ "& th": { bgcolor: "#e2e8f0", color: "#1e293b", fontWeight: 800, fontSize: "0.70rem", py: 0.6, px: 0.8 } }}>
                                                                                    <TableCell sx={{ width: "4%", textAlign: "center" }}>#</TableCell>
                                                                                    <TableCell sx={{ width: "18%" }}>INVOICE NO & DATE</TableCell>
                                                                                    <TableCell sx={{ width: "14%" }}>BATCH</TableCell>
                                                                                    <TableCell sx={{ width: "26%" }}>ITEM DESCRIPTION</TableCell>
                                                                                    <TableCell sx={{ width: "10%", textAlign: "right" }}>ARRIVED QTY</TableCell>
                                                                                    <TableCell sx={{ width: "12%", textAlign: "right" }}>RATE (₹)</TableCell>
                                                                                    <TableCell sx={{ width: "14%", textAlign: "right" }}>AMT / VALUE (₹)</TableCell>
                                                                                    <TableCell sx={{ width: "14%", textAlign: "right" }}>PAYMENT PENDING (₹)</TableCell>
                                                                                </TableRow>
                                                                            </TableHead>

                                                                            <TableBody>
                                                                                {displayInvoices.map((inv, idx) => (
                                                                                    <TableRow
                                                                                        key={inv.invoiceId || idx}
                                                                                        sx={{
                                                                                            "&:nth-of-type(even)": { bgcolor: "#f8fafc" },
                                                                                            "&:hover": { bgcolor: "#eff6ff" },
                                                                                            "& td": { py: 0.6, px: 0.8, fontSize: "0.72rem" },
                                                                                        }}
                                                                                    >
                                                                                        {/* # */}
                                                                                        <TableCell sx={{ textAlign: "center", fontWeight: 700, color: "#64748b" }}>
                                                                                            {idx + 1}
                                                                                        </TableCell>

                                                                                        {/* INVOICE NO & DATE */}
                                                                                        <TableCell>
                                                                                            <Typography
                                                                                                sx={{
                                                                                                    fontSize: "0.74rem",
                                                                                                    fontWeight: 800,
                                                                                                    color: "#0369a1",
                                                                                                }}
                                                                                            >
                                                                                                {inv.invoiceNo || "-"}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: "0.64rem", color: "#64748b" }}>
                                                                                                {inv.invoiceDate && dayjs(inv.invoiceDate).isValid() ? dayjs(inv.invoiceDate).format("DD/MM/YYYY") : inv.invoiceDate}
                                                                                                {inv.inwardVehicle && <> • <strong>{inv.inwardVehicle}</strong></>}
                                                                                            </Typography>
                                                                                        </TableCell>

                                                                                        {/* BATCH */}
                                                                                        <TableCell>
                                                                                            {inv.batchNo ? (
                                                                                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                                                                                                    <Chip
                                                                                                        size="small"
                                                                                                        label={inv.batchNo}
                                                                                                        sx={{
                                                                                                            fontFamily: "monospace",
                                                                                                            fontWeight: 700,
                                                                                                            fontSize: "0.64rem",
                                                                                                            height: 18,
                                                                                                            bgcolor: "#f1f5f9",
                                                                                                            color: "#334155",
                                                                                                            width: "fit-content",
                                                                                                        }}
                                                                                                    />
                                                                                                    {inv.batchLocation && (
                                                                                                        <Typography sx={{ fontSize: "0.60rem", color: "#64748b" }}>
                                                                                                            {inv.batchLocation}
                                                                                                        </Typography>
                                                                                                    )}
                                                                                                </Box>
                                                                                            ) : (
                                                                                                <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8" }}>-</Typography>
                                                                                            )}
                                                                                        </TableCell>

                                                                                        {/* ITEM DESCRIPTION */}
                                                                                        <TableCell>
                                                                                            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                                                {cleanItemName(inv.itemName)}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: "0.64rem", color: "#64748b" }}>
                                                                                                {inv.stockGroup}
                                                                                            </Typography>
                                                                                        </TableCell>

                                                                                        {/* QTY */}
                                                                                        <TableCell sx={{ textAlign: "right" }}>
                                                                                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#0369a1" }}>
                                                                                                {formatKgQuantity(inv.arrivedQty)}
                                                                                            </Typography>
                                                                                        </TableCell>

                                                                                        {/* RATE */}
                                                                                        <TableCell sx={{ textAlign: "right" }}>
                                                                                            <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#334155" }}>
                                                                                                {formatCurrency(inv.rate)}
                                                                                            </Typography>
                                                                                        </TableCell>

                                                                                        {/* AMT / VALUE */}
                                                                                        <TableCell sx={{ textAlign: "right" }}>
                                                                                            <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#0f172a" }}>
                                                                                                {formatCurrency(inv.amount)}
                                                                                            </Typography>
                                                                                        </TableCell>

                                                                                        {/* PAYMENT PENDING */}
                                                                                        <TableCell sx={{ textAlign: "right" }}>
                                                                                            <Typography
                                                                                                sx={{
                                                                                                    fontSize: "0.78rem",
                                                                                                    fontWeight: 800,
                                                                                                    color: inv.pendingPayment > 0 ? "#b91c1c" : "#15803d",
                                                                                                }}
                                                                                            >
                                                                                                {formatCurrency(inv.pendingPayment)}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: "0.62rem", color: "#15803d", fontWeight: 600 }}>
                                                                                                Paid: {formatCurrency(inv.paidAmount)}
                                                                                            </Typography>
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ))}

                                                                                {/* ARRIVED INVOICES SUBTOTAL ROW (WITHOUT GODOWN) */}
                                                                                <TableRow sx={{ bgcolor: "#eff6ff", "& td": { fontWeight: 800, fontSize: "0.72rem", borderTop: "2px solid #bfdbfe", py: 0.6, px: 0.8 } }}>
                                                                                    <TableCell colSpan={4} sx={{ textAlign: "right", color: "#1e3a8a" }}>
                                                                                        Total Arrived ({displayInvoices.length} {displayInvoices.length === 1 ? "Item" : "Items"}{new Set(displayInvoices.map((i) => i.invoiceNo)).size > 1 ? ` / ${new Set(displayInvoices.map((i) => i.invoiceNo)).size} Invoices` : ""}):
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ textAlign: "right", color: "#0369a1" }}>
                                                                                        {formatKgQuantity(displayInvoices.reduce((acc, cur) => acc + (cur.arrivedQty || 0), 0))}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ textAlign: "right" }}>-</TableCell>
                                                                                    <TableCell sx={{ textAlign: "right", color: "#0f172a" }}>
                                                                                        {formatCurrency(displayInvoices.reduce((acc, cur) => acc + (cur.amount || 0), 0))}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ textAlign: "right" }}>
                                                                                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: displayInvoices.reduce((acc, cur) => acc + (cur.pendingPayment || 0), 0) > 0 ? "#b91c1c" : "#15803d" }}>
                                                                                            {formatCurrency(displayInvoices.reduce((acc, cur) => acc + (cur.pendingPayment || 0), 0))}
                                                                                        </Typography>
                                                                                        <Typography sx={{ fontSize: "0.62rem", color: "#15803d", fontWeight: 700 }}>
                                                                                            Paid: {formatCurrency(displayInvoices.reduce((acc, cur) => acc + (cur.paidAmount || 0), 0))}
                                                                                        </Typography>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            </TableBody>
                                                                        </Table>
                                                                    </TableContainer>
                                                                ) : (
                                                                    /* IF NO INVOICES ARRIVED YET */
                                                                    <Box
                                                                        sx={{
                                                                            p: 1.5,
                                                                            borderRadius: 1.5,
                                                                            bgcolor: "#fffbeb",
                                                                            border: "1px dashed #fcd34d",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            gap: 1.2,
                                                                        }}
                                                                    >
                                                                        <AccessTimeIcon sx={{ color: "#d97706", fontSize: 20 }} />
                                                                        <Box>
                                                                            <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#92400e" }}>
                                                                                No Invoices Arrived Yet (Pending Delivery)
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: "0.70rem", color: "#b45309" }}>
                                                                                All {order.orderedTons} Tons for Purchase Order <strong>{order.purOrderNo}</strong> {cleanPoId(order.transId) ? `(Po_Id: ${cleanPoId(order.transId)})` : ""} are currently pending dispatch / inward arrival from supplier.
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* PAGINATION (OUTSIDE THE TABLE) */}
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



            {/* 5. FILTER DRAWER (DATE RANGE) */}
            <ReportFilterDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((prev) => !prev)}
                onClose={() => setDrawerOpen(false)}
                fromDate={tempFromDate}
                toDate={tempToDate}
                onFromDateChange={setTempFromDate}
                onToDateChange={setTempToDate}
                onApply={() => {
                    setFromDate(tempFromDate);
                    setToDate(tempToDate);
                    setDrawerOpen(false);
                    setPage(1);
                }}
            />
        </Box>
    );
};

export default PurchaseItemPaymentReport;
