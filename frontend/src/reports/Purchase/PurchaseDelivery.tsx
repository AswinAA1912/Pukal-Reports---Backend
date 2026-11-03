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
    LinearProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PurchaseTransactionDetailsDialog from "./PurchaseTransactionDetailsDialog";
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
    PurchaseDeliveryItem,
    PurchaseDeliveryService,
} from "../../services/purchaseDelivery.service";
import {
    OnlinePurchaseReportItemByOrderIdService,
    OnlinePurchaseReportItemByOrderIdItem,
    PurchaseOrderPaymentService,
    PurchaseOrderPaymentItem,
} from "../../services/OnlinePurchaseReport.service";
import {
    deriveStockGroup,
    cleanItemName,
    cleanStr,
    fetchRawPurchaseDatasets,
    formatKgQuantity,
    formatTonsOnly,
    formatKgOnly,
    extractTonsAndKg,
    parseNum,
} from "../../services/purchaseDataIntegration.service";
import {
    PurchaseOrderTripItemService,
    PurchaseOrderTripItem,
} from "../../services/purchaseOrderTripItem.service";

/* ================= COMPONENT ================= */

const PurchaseDelivery: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Specific order and date range passed from navigation (e.g. from PurchaseItemPaymentReport or PurchasePaymentReport)
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
    const [data, setData] = useState<PurchaseDeliveryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>("All");

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

    // Pagination State
    const [page, setPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(100);

    // Transaction Details Dialog State
    const [selectedItemForDialog, setSelectedItemForDialog] = useState<PurchaseDeliveryItem | null>(null);
    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [dialogInitialTab, setDialogInitialTab] = useState<number>(0);

    const handleOpenDetails = (it: PurchaseDeliveryItem, tab: number = 0) => {
        setSelectedItemForDialog(it);
        setDialogInitialTab(tab);
        setDialogOpen(true);
    };

    const handleCloseDetails = () => {
        setDialogOpen(false);
        setSelectedItemForDialog(null);
        setDialogInitialTab(0);
    };

    // Payment lookup map from purchaseOrderPayment API
    const paymentsMapRef = React.useRef<Map<string, PurchaseOrderPaymentItem>>(new Map());
    // Live items fetched from OnlinePurchaseReportItemByOrderId API for specific orders
    const [liveOrderDeliveryMap, setLiveOrderDeliveryMap] = useState<Record<string, PurchaseDeliveryItem[]>>({});
    const [liveOrderLoading, setLiveOrderLoading] = useState<boolean>(false);

    // Helper to extract a single clean scalar ID
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
            console.error("Failed to load purchaseOrderPayment for delivery:", err);
            return new Map();
        }
    };

    // Fetch live delivery records for an order using OnlinePurchaseReportItemByOrderIdService
    const fetchLiveDeliveryForOrder = async (orderIdentifier: string) => {
        if (!orderIdentifier) return;
        const cleanOrder = orderIdentifier.trim();
        if (liveOrderDeliveryMap[cleanOrder] !== undefined) return;

        setLiveOrderLoading(true);
        try {
            let targetPoId: string | number | null = null;
            if (!isNaN(Number(cleanOrder))) {
                targetPoId = Number(cleanOrder);
            } else {
                const matching = data.find((d) =>
                    d.purOrderNo?.toLowerCase().includes(cleanOrder.toLowerCase()) ||
                    d.purInvNo?.toLowerCase().includes(cleanOrder.toLowerCase()) ||
                    d.id?.toLowerCase().includes(cleanOrder.toLowerCase())
                );
                if (matching) {
                    const fromTrans = toCleanSingleId((matching as any).transId || (matching as any).OrderId || (matching as any).trans_id);
                    if (fromTrans !== null && String(fromTrans) !== String(matching.purOrderNo).trim()) {
                        targetPoId = fromTrans;
                    }
                }
            }

            if (targetPoId === null) {
                const raw = await fetchRawPurchaseDatasets({ Fromdate: fromDate, Todate: toDate }).catch(() => null);
                if (raw && raw.purchaseOrders) {
                    const poMatch = raw.purchaseOrders.find((po: any) =>
                        cleanOrder.toLowerCase().includes(String(po.invoice_no || "").toLowerCase()) ||
                        String(po.invoice_no || "").toLowerCase().includes(cleanOrder.toLowerCase())
                    );
                    if (poMatch) {
                        targetPoId = toCleanSingleId((poMatch as any).Trans_Id || (poMatch as any).trans_id || poMatch.invoice_no);
                    }
                }
            }

            if (targetPoId !== null) {
                let payMap = paymentsMapRef.current;
                if (!payMap || payMap.size === 0) {
                    payMap = await loadPayments(toDate);
                }

                const [res, tripsRes] = await Promise.all([
                    OnlinePurchaseReportItemByOrderIdService.getReportsitemByOrderId({
                        Po_Id: targetPoId,
                        company_id: 1,
                    }),
                    PurchaseOrderTripItemService.getPurchaseOrderTripItemDetails({
                        Fromdate: fromDate,
                        Todate: toDate,
                    }).catch(() => ({ data: { data: [] } })),
                ]);
                const fetchedItems: OnlinePurchaseReportItemByOrderIdItem[] = res.data?.data || (Array.isArray(res.data) ? res.data : []);
                const rawTrips: PurchaseOrderTripItem[] = (tripsRes.data as any)?.data || (Array.isArray(tripsRes.data) ? tripsRes.data : []);
                const orderTrips = rawTrips.filter((t) => String(t.OrderId) === String(targetPoId));

                if (fetchedItems.length > 0) {
                    const totalBatchAmount = fetchedItems.reduce((acc, it) => {
                        const a = typeof it.Amount === "number" ? it.Amount : parseFloat(String(it.Amount || 0).replace(/,/g, "")) || 0;
                        return acc + a;
                    }, 0);

                    const rawLiveRows: PurchaseDeliveryItem[] = fetchedItems.map((item, idx) => {
                        const rawProd = cleanItemName(item.Product_Name || item.Stock_Item || item.POS_Item_Name || "Item");
                        const qty = typeof item.Bill_Qty === "number" ? item.Bill_Qty : parseFloat(String(item.Bill_Qty || 0).replace(/,/g, "")) || 0;
                        const qtyText = qty > 0 ? ` (${formatKgQuantity(qty)})` : "";
                        const batchText = item.Batch ? ` [Batch: ${item.Batch}]` : "";
                        const invNo = String(item.invoice_no || "").trim();

                        const matchedTrip = orderTrips.find((t) =>
                            (t.Product_Id && item.Product_Id && String(t.Product_Id) === String(item.Product_Id)) ||
                            (t.Batch_No && item.Batch && String(t.Batch_No).trim() === String(item.Batch).trim()) ||
                            (t.Product_Name && item.Product_Name && cleanItemName(t.Product_Name).toLowerCase() === rawProd.toLowerCase())
                        ) || orderTrips[idx];

                        const inwardJou = cleanStr(matchedTrip?.TR_INV_ID || (item as any).TR_INV_ID || item.Ref_Po_Inv_No || item.Trans_Id || "-").replace(/[\r\n]+/g, ", ");

                        const invK = invNo.toLowerCase();
                        const refK = String(item.Ref_Po_Inv_No || item.Trans_Id || "").trim().toLowerCase();
                        let matchedPay = (invK && payMap.get(invK)) ||
                            (refK && payMap.get(refK)) ||
                            (invK && payMap.get(invK.replace(/^mia\//, "ps/"))) ||
                            (invK && payMap.get(invK.replace(/^[a-z]+\//, ""))) ||
                            (refK && payMap.get(refK.replace(/^[a-z]+\//, "")));

                        if (!matchedPay && cleanOrder) {
                            matchedPay = payMap.get(cleanOrder.toLowerCase());
                        }

                        const itemAmt = typeof item.Amount === "number" ? item.Amount : parseFloat(String(item.Amount || 0).replace(/,/g, "")) || 0;
                        let paidAmt: number | string = "";
                        let paymentInvoiceNo = "-";

                        if (matchedPay) {
                            paymentInvoiceNo = matchedPay.invoice_no || "-";
                            if (matchedPay.Debit_Amt > 0) {
                                if (totalBatchAmount > 0 && fetchedItems.length > 1) {
                                    paidAmt = Math.round(matchedPay.Debit_Amt * (itemAmt / totalBatchAmount));
                                } else {
                                    paidAmt = matchedPay.Debit_Amt;
                                }
                            }
                        }

                        const isCancelled = Boolean(item.Cancel_status && item.Cancel_status !== "0");
                        const numPaid = typeof paidAmt === "number" ? paidAmt : parseFloat(String(paidAmt || 0).replace(/,/g, "")) || 0;
                        const isPaymentDone = Boolean(
                            !isCancelled &&
                            numPaid > 0 &&
                            matchedPay &&
                            parseNum(matchedPay.Debit_Amt) > 0 &&
                            parseNum(matchedPay.Bal_Amount) <= 0
                        );

                        const rawStockGroup = cleanStr(
                            item.Stock_Group ||
                            (item as any).stockGroup ||
                            (matchedTrip as any)?.Stock_Group ||
                            (matchedTrip as any)?.stockGroup
                        );
                        const finalStockGroup = (rawStockGroup && rawStockGroup.toLowerCase() !== "general items")
                            ? rawStockGroup
                            : deriveStockGroup(rawProd);

                        const batchStr = item.Batch ? String(item.Batch).trim() : (matchedTrip?.Batch_No ? String(matchedTrip.Batch_No).trim() : "-");
                        const tonnageStr = qty > 0 ? formatKgQuantity(qty) : "-";

                        return {
                            id: `pd-live-${item.invoice_no || idx}-${idx + 1}`,
                            sNo: idx + 1,
                            stockGroup: finalStockGroup,
                            inwardItem: rawProd,
                            batch: batchStr,
                            tonnage: tonnageStr,
                            tonnageKg: qty || 0,
                            inwardBatchWithItemName: `${rawProd}${qtyText}${batchText}`,
                            purOrderNo: cleanOrder,
                            inwardJouNo: inwardJou,
                            purInvNo: (paymentInvoiceNo && paymentInvoiceNo !== "-") ? paymentInvoiceNo : "-",
                            paymentNo: "-",
                            paymentAmt: paidAmt,
                            status: (!isCancelled && isPaymentDone) ? "COMPLETED" : "NOT COMPLETED",
                            orderDate: item.Ledger_Date ? dayjs(item.Ledger_Date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),

                            retailerName: item.Retailer_Name || item.Party_Name || "-",
                            partyAddress: item.Reatailer_Address || item.Party_Address || "-",
                            remarks: item.Narration || "-",
                        };
                    });

                    // Combine live rows for identical products in this order
                    const liveProdMap = new Map<string, PurchaseDeliveryItem[]>();
                    rawLiveRows.forEach((r) => {
                        const key = cleanItemName(r.inwardItem).toLowerCase();
                        if (!liveProdMap.has(key)) liveProdMap.set(key, []);
                        liveProdMap.get(key)!.push(r);
                    });

                    const combinedLiveRows: PurchaseDeliveryItem[] = [];
                    let cIdx = 1;
                    liveProdMap.forEach((rows) => {
                        const first = rows[0];
                        let sumKg = 0;
                        const inwardJous: string[] = [];
                        const invNos: string[] = [];
                        const batches: string[] = [];
                        let sumPaid = 0;
                        let allDone = rows.length > 0;

                        rows.forEach((r) => {
                            sumKg += (r.tonnageKg || 0);
                            if (r.inwardJouNo && r.inwardJouNo !== "-" && !inwardJous.includes(String(r.inwardJouNo))) {
                                inwardJous.push(String(r.inwardJouNo));
                            }
                            if (r.purInvNo && r.purInvNo !== "-" && !invNos.includes(r.purInvNo)) {
                                invNos.push(r.purInvNo);
                            }
                            if (r.batch && r.batch !== "-" && !batches.includes(r.batch)) {
                                batches.push(r.batch);
                            }
                            if (r.paymentAmt) sumPaid += parseNum(r.paymentAmt);
                            if (r.status !== "COMPLETED") allDone = false;
                        });

                        const inwardCount = inwardJous.length > 0 ? inwardJous.length : rows.length;
                        const invoiceCount = invNos.length;
                        const batchCount = batches.length;

                        const livePoItems = fetchedItems.map((it, pIdx) => ({
                            sNo: pIdx + 1,
                            itemName: cleanItemName(it.Product_Name || it.Stock_Item || "Item"),
                            orderedQty: it.Bill_Qty || 0,
                            tonnage: it.Bill_Qty ? formatKgQuantity(it.Bill_Qty) : "-",
                            rate: it.Rate || "As recorded",
                            amount: it.Amount || 0,
                            unit: it.Bag || "Bags",
                            discount: it.Discount || "-",
                            qualityCondition: it.Grade_Item_Group || "Standard",
                        }));

                        combinedLiveRows.push({
                            ...first,
                            sNo: cIdx++,
                            tonnage: sumKg > 0 ? formatKgQuantity(sumKg) : first.tonnage,
                            tonnageKg: sumKg,
                            inwardJouNo: inwardCount > 1 ? `${inwardCount} Inwards` : (inwardJous[0] || "-"),
                            purInvNo: invoiceCount > 1 ? `${invoiceCount} Invoices` : (invNos[0] || "-"),
                            paymentNo: "-",
                            paymentAmt: sumPaid > 0 ? sumPaid : "",
                            batch: batchCount > 1 ? `${batchCount} Batches` : (batches[0] || "-"),
                            status: allDone ? "COMPLETED" : "NOT COMPLETED",
                            inwardCount,
                            invoiceCount,
                            paymentCount: 0,
                            batchCount,
                            allBatches: batches,
                            allInwardJous: inwardJous,
                            allPurInvNos: invNos,
                            allPaymentNos: [],
                            poItems: livePoItems,
                        });
                    });

                    setLiveOrderDeliveryMap((prev) => ({
                        ...prev,
                        [cleanOrder]: combinedLiveRows,
                    }));
                }
            }
        } catch (err) {
            console.error("Failed to fetch live delivery for order:", cleanOrder, err);
        } finally {
            setLiveOrderLoading(false);
        }
    };

    // Load live dataset from APIs
    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setLoading(true);
            try {
                const [liveData] = await Promise.all([
                    PurchaseDeliveryService.getPurchaseDeliveries({
                        Fromdate: fromDate,
                        Todate: toDate,
                    }),
                    loadPayments(toDate),
                ]);
                if (isMounted) {
                    setData(liveData || []);
                }
            } catch (err) {
                console.error("Failed to load live purchase delivery data:", err);
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

    // Automatically fetch live delivery details when viewing specific order
    useEffect(() => {
        if (selectedOrderOnly) {
            fetchLiveDeliveryForOrder(selectedOrderOnly);
        }
    }, [selectedOrderOnly, data]);


    // Filtered dataset
    // Base filtered dataset applying navigation order filter, search query, and date range (without status filter)
    const baseFilteredData = useMemo(() => {
        // If specific order is passed from navigation, filter ONLY that exact order's records
        let list = data;
        if (selectedOrderOnly) {
            const cleanSo = selectedOrderOnly.trim();
            const liveItems = liveOrderDeliveryMap[cleanSo];
            if (liveItems && liveItems.length > 0) {
                list = liveItems;
            } else {
                const q = cleanSo.toLowerCase();
                list = data.filter((item) =>
                    item.purOrderNo?.toLowerCase().includes(q) ||
                    item.purInvNo?.toLowerCase().includes(q) ||
                    item.inwardItem?.toLowerCase().includes(q) ||
                    item.batch?.toLowerCase().includes(q) ||
                    item.inwardBatchWithItemName?.toLowerCase().includes(q)
                );
            }
        }

        return list.filter((item) => {
            // 1. Search Query
            if (searchQuery.trim() !== "") {
                const q = searchQuery.toLowerCase().trim();
                const matchStockGroup = item.stockGroup?.toLowerCase().includes(q);
                const matchInwardItem = item.inwardItem?.toLowerCase().includes(q);
                const matchBatch =
                    item.batch?.toLowerCase().includes(q) ||
                    item.inwardBatchWithItemName?.toLowerCase().includes(q) ||
                    Boolean(item.allBatches?.some((b) => b.toLowerCase().includes(q)));
                const matchTonnage = item.tonnage?.toLowerCase().includes(q);
                const matchPurOrder = item.purOrderNo?.toLowerCase().includes(q);
                const matchInwardJou =
                    String(item.inwardJouNo).toLowerCase().includes(q) ||
                    Boolean(item.allInwardJous?.some((j) => j.toLowerCase().includes(q)));
                const matchPurInv =
                    item.purInvNo?.toLowerCase().includes(q) ||
                    Boolean(item.allPurInvNos?.some((p) => p.toLowerCase().includes(q)));
                const matchPaymentNo =
                    item.paymentNo?.toLowerCase().includes(q) ||
                    Boolean(item.allPaymentNos?.some((p) => p.toLowerCase().includes(q)));
                const matchStatus = item.status?.toLowerCase().includes(q);

                if (
                    !matchStockGroup &&
                    !matchInwardItem &&
                    !matchBatch &&
                    !matchTonnage &&
                    !matchPurOrder &&
                    !matchInwardJou &&
                    !matchPurInv &&
                    !matchPaymentNo &&
                    !matchStatus
                ) {
                    return false;
                }
            }

            // 2. Date filter (Order Date) - only apply if NOT explicitly viewing a selected order
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
    }, [data, selectedOrderOnly, liveOrderDeliveryMap, searchQuery, fromDate, toDate]);

    // Quick status counts derived from baseFilteredData
    const statusCounts = useMemo(() => {
        const all = baseFilteredData.length;
        const completed = baseFilteredData.filter((i) => i.status === "COMPLETED").length;
        const notCompleted = all - completed;
        return { all, completed, notCompleted };
    }, [baseFilteredData]);

    // Final filtered dataset applying the activeStatusFilter
    const filteredData = useMemo(() => {
        if (activeStatusFilter === "COMPLETED") {
            return baseFilteredData.filter((item) => item.status === "COMPLETED");
        }
        if (activeStatusFilter === "NOT_COMPLETED") {
            return baseFilteredData.filter((item) => item.status !== "COMPLETED");
        }
        return baseFilteredData;
    }, [baseFilteredData, activeStatusFilter]);

    // Metrics summary
    const metrics = useMemo(() => {
        const total = filteredData.length;
        const completed = filteredData.filter((i) => i.status === "COMPLETED").length;
        const notCompleted = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        let totalTonnageKg = 0;
        let totalPaymentAmt = 0;
        filteredData.forEach((item) => {
            if (item.tonnageKg !== undefined && item.tonnageKg > 0) {
                totalTonnageKg += item.tonnageKg;
            } else if (item.tonnage && item.tonnage !== "-") {
                const match = item.tonnage.match(/([\d,.]+)\s*(?:T|KG)/i);
                if (match) {
                    const n = parseFloat(match[1].replace(/,/g, "")) || 0;
                    if (/T/i.test(item.tonnage) && !item.tonnage.includes("KG")) {
                        totalTonnageKg += n * 1000;
                    } else if (item.tonnage.includes("KG")) {
                        const kgMatch = item.tonnage.match(/\(([\d,.]+)\s*KG\)/i) || item.tonnage.match(/([\d,.]+)\s*KG/i);
                        if (kgMatch) {
                            totalTonnageKg += parseFloat(kgMatch[1].replace(/,/g, "")) || 0;
                        } else {
                            totalTonnageKg += n;
                        }
                    } else {
                        totalTonnageKg += n;
                    }
                }
            }

            if (item.paymentAmt) {
                const num =
                    typeof item.paymentAmt === "string"
                        ? parseFloat(item.paymentAmt.replace(/,/g, ""))
                        : item.paymentAmt;
                if (!isNaN(num)) totalPaymentAmt += num;
            }
        });

        return {
            total,
            completed,
            notCompleted,
            completionRate,
            totalTonnageKg,
            totalPaymentAmt,
        };
    }, [filteredData]);

    // Paginated Data
    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    // Reset filters
    const handleResetFilters = () => {
        setSearchQuery("");
        setActiveStatusFilter("ALL");
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
        toast.success("Filters applied successfully!");
    };

    /* ================= EXPORT HANDLERS ================= */

    const handleExportExcel = () => {
        try {
            if (!filteredData.length) {
                toast.warning("No data to export");
                return;
            }

            const excelRows: any[][] = [];

            // Header Banner
            excelRows.push(["PURCHASE DELIVERY REPORT"]);
            excelRows.push([
                `Generated on: ${dayjs().format("DD-MM-YYYY HH:mm")} | Total Orders: ${filteredData.length} | Completed: ${metrics.completed} | Pending: ${metrics.notCompleted}`,
            ]);
            excelRows.push([]);

            // Table Header row (matching user's request)
            excelRows.push([
                "S.no",
                "Stock group",
                "Inward Item",
                "Batch",
                "Tonnage",
                "Qty (KG)",
                "Pur .order no",
                "Inward Jou no",
                "Pur Inv no",
                "Payment invoice",
                "status",
            ]);

            // Data Rows
            filteredData.forEach((row, idx) => {
                const { tons, kg } = extractTonsAndKg(row.tonnage, row.tonnageKg);
                excelRows.push([
                    idx + 1,
                    row.stockGroup,
                    row.inwardItem || row.inwardBatchWithItemName || "-",
                    row.batch || "-",
                    tons,
                    kg,
                    row.purOrderNo,
                    row.inwardJouNo,
                    row.purInvNo,
                    row.paymentNo,
                    row.status,
                ]);
            });

            // Totals summary row
            excelRows.push([
                "TOTAL",
                "-",
                `${filteredData.length} Records`,
                "-",
                metrics.totalTonnageKg > 0 ? formatTonsOnly(metrics.totalTonnageKg) : "-",
                metrics.totalTonnageKg > 0 ? formatKgOnly(metrics.totalTonnageKg) : "-",
                "-",
                "-",
                "-",
                "-",
                `${metrics.completionRate}% Done`,
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
                            cell.s.font = { name: "Arial", sz: 13, bold: true, color: { rgb: "FFFFFF" } };
                            cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                            cell.s.alignment = { horizontal: "center" };
                        } else if (R === 1) {
                            cell.s.font = { name: "Arial", sz: 9, italic: true, color: { rgb: "334155" } };
                            cell.s.fill = { fgColor: { rgb: "F1F5F9" } };
                        } else if (R === 3) {
                            cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } };
                            cell.s.fill = { fgColor: { rgb: "1E3A8A" } };
                            cell.s.alignment = { horizontal: "center", vertical: "center" };
                        } else if (R === range.e.r) {
                            cell.s.font = { name: "Arial", sz: 10, bold: true, color: { rgb: "0F172A" } };
                            cell.s.fill = { fgColor: { rgb: "E2E8F0" } };
                        } else if (R > 3) {
                            if (C === 10) {
                                const isCompleted = cell.v === "COMPLETED";
                                cell.s.font = {
                                    name: "Arial",
                                    sz: 10,
                                    bold: true,
                                    color: { rgb: isCompleted ? "15803D" : "B91C1C" },
                                };
                                cell.s.fill = { fgColor: { rgb: isCompleted ? "DCFCE7" : "FEE2E2" } };
                                cell.s.alignment = { horizontal: "center" };
                            }
                        }
                    }
                }
            }

            // Column widths
            ws["!cols"] = [
                { wch: 8 },  // S.no
                { wch: 16 }, // Stock group
                { wch: 28 }, // Inward Item
                { wch: 16 }, // Batch
                { wch: 14 }, // Tonnage
                { wch: 14 }, // Qty (KG)
                { wch: 18 }, // Pur .order no
                { wch: 15 }, // Inward Jou no
                { wch: 18 }, // Pur Inv no
                { wch: 18 }, // Payment invoice
                { wch: 16 }, // status
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "PurchaseDelivery");
            XLSX.writeFile(wb, `PurchaseDelivery_Report_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`);
            toast.success("Excel report downloaded successfully! ✅");
        } catch (err) {
            console.error(err);
            toast.error("Failed to export Excel report ❌");
        }
    };

    const handleExportPDF = () => {
        try {
            if (!filteredData.length) {
                toast.warning("No data to export");
                return;
            }

            const doc = new jsPDF("landscape", "mm", "a4");

            // Title & Metadata
            doc.setFontSize(14);
            doc.setTextColor(30, 58, 138);
            doc.text("PURCHASE DELIVERY REPORT", 14, 15);

            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(
                `Generated: ${dayjs().format("DD-MM-YYYY HH:mm")} | Total: ${filteredData.length} | Completed: ${metrics.completed} (${metrics.completionRate}%)`,
                14,
                21
            );

            const tableHeaders = [
                [
                    "S.no",
                    "Stock group",
                    "Inward Item",
                    "Batch",
                    "Tonnage",
                    "Qty (KG)",
                    "Pur .order no",
                    "Inward Jou no",
                    "Pur Inv no",
                    "Payment invoice",
                    "status",
                ],
            ];

            const tableBody = filteredData.map((row, idx) => {
                const { tons, kg } = extractTonsAndKg(row.tonnage, row.tonnageKg);
                return [
                    idx + 1,
                    row.stockGroup,
                    row.inwardItem || row.inwardBatchWithItemName || "-",
                    row.batch || "-",
                    tons,
                    kg,
                    row.purOrderNo,
                    row.inwardJouNo,
                    row.purInvNo,
                    row.paymentNo,
                    row.status,
                ];
            });

            tableBody.push([
                "TOTAL",
                "-",
                `${filteredData.length} Records`,
                "-",
                metrics.totalTonnageKg > 0 ? formatTonsOnly(metrics.totalTonnageKg) : "-",
                metrics.totalTonnageKg > 0 ? formatKgOnly(metrics.totalTonnageKg) : "-",
                "-",
                "-",
                "-",
                "-",
                `${metrics.completionRate}% Done`,
            ]);

            autoTable(doc, {
                head: tableHeaders,
                body: tableBody,
                startY: 26,
                theme: "grid",
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                didParseCell: (cellData) => {
                    if (cellData.section === "body" && cellData.column.index === 9) {
                        const val = String(cellData.cell.raw);
                        if (val === "COMPLETED") {
                            cellData.cell.styles.textColor = [21, 128, 61];
                            cellData.cell.styles.fontStyle = "bold";
                        } else if (val === "NOT COMPLETED") {
                            cellData.cell.styles.textColor = [185, 28, 28];
                            cellData.cell.styles.fontStyle = "bold";
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

            doc.save(`PurchaseDelivery_Report_${dayjs().format("YYYYMMDD_HHmmss")}.pdf`);
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

            {/* 3. MAIN CONTENT CONTAINER */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    px: { xs: 1.5, md: 2.5 },
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
                            <LocalShippingOutlinedIcon sx={{ color: "#1e3a8a", fontSize: 18 }} />
                            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e3a8a" }}>
                                Showing Delivery Details for Order: <strong>{selectedOrderOnly}</strong> ({filteredData.length} records)
                            </Typography>
                            {liveOrderDeliveryMap[selectedOrderOnly.trim()] && liveOrderDeliveryMap[selectedOrderOnly.trim()].length > 0 && (
                                <Chip
                                    size="small"
                                    label="Live Order Item API"
                                    sx={{
                                        bgcolor: "#dcfce7",
                                        color: "#15803d",
                                        fontWeight: 800,
                                        fontSize: "0.62rem",
                                        height: 20,
                                    }}
                                />
                            )}
                            {liveOrderLoading && (
                                <Typography sx={{ fontSize: "0.70rem", color: "#64748b" }}>
                                    (Loading live items...)
                                </Typography>
                            )}
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setSelectedOrderOnly("");
                                navigate("/purchaseDelivery", { replace: true });
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

                {/* TITLE & CONTROLS BAR */}
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
                    {/* Title & Badges */}
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
                            Purchase Delivery Report
                        </Typography>

                        <Chip
                            size="small"
                            label={`${filteredData.length} Records`}
                            sx={{
                                bgcolor: "#1e3a8a",
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                height: 22,
                            }}
                        />

                        {/* Quick Status Chips */}
                        <Chip
                            size="small"
                            label={`All (${statusCounts.all})`}
                            onClick={() => {
                                setActiveStatusFilter("ALL");
                                setPage(1);
                            }}
                            variant={activeStatusFilter === "ALL" ? "filled" : "outlined"}
                            sx={{
                                height: 24,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeStatusFilter === "ALL" ? "#e0f2fe" : "transparent",
                                color: activeStatusFilter === "ALL" ? "#0369a1" : "#64748b",
                                borderColor: activeStatusFilter === "ALL" ? "#0284c7" : "#cbd5e1",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Completed (${statusCounts.completed})`}
                            onClick={() => {
                                setActiveStatusFilter("COMPLETED");
                                setPage(1);
                            }}
                            variant={activeStatusFilter === "COMPLETED" ? "filled" : "outlined"}
                            sx={{
                                height: 24,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeStatusFilter === "COMPLETED" ? "#dcfce7" : "transparent",
                                color: activeStatusFilter === "COMPLETED" ? "#15803d" : "#64748b",
                                borderColor: activeStatusFilter === "COMPLETED" ? "#86efac" : "#cbd5e1",
                            }}
                        />
                        <Chip
                            size="small"
                            label={`Not Completed (${statusCounts.notCompleted})`}
                            onClick={() => {
                                setActiveStatusFilter("NOT_COMPLETED");
                                setPage(1);
                            }}
                            variant={activeStatusFilter === "NOT_COMPLETED" ? "filled" : "outlined"}
                            sx={{
                                height: 24,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                bgcolor: activeStatusFilter === "NOT_COMPLETED" ? "#fee2e2" : "transparent",
                                color: activeStatusFilter === "NOT_COMPLETED" ? "#b91c1c" : "#64748b",
                                borderColor: activeStatusFilter === "NOT_COMPLETED" ? "#fca5a5" : "#cbd5e1",
                            }}
                        />
                    </Box>

                    {/* Search Input */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: { xs: "100%", md: "auto" },
                            flexWrap: "wrap",
                        }}
                    >
                        <TextField
                            size="small"
                            placeholder="Search Order, Batch, Group, Invoice..."
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



                {/* 4. MAIN TABLE (FLAT TABLE WITHOUT EXPANSION MATCHING USER IMAGE) */}
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
                            overflowX: "hidden",
                            width: "100%",
                        }}
                    >
                        <Table
                            size="small"
                            stickyHeader
                            aria-label="purchase delivery table"
                            sx={{ width: "100%", tableLayout: "fixed" }}
                        >
                            {/* TABLE HEAD */}
                            <TableHead>
                                {/* HEADER MATCHING USER IMAGE */}
                                <TableRow
                                    sx={{
                                        "& th": {
                                            bgcolor: "#1E3A8A",
                                            fontWeight: 700,
                                            color: "#ffffff",
                                            fontSize: "0.76rem",
                                            borderRight: "1px solid rgba(255, 255, 255, 0.15)",
                                            py: 0.8,
                                            px: 0.6,
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 5,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        },
                                    }}
                                >
                                    <TableCell align="center" sx={{ width: "3.5%" }}>
                                        S.no
                                    </TableCell>
                                    <TableCell sx={{ width: "8%" }}>
                                        Stock group
                                    </TableCell>
                                    <TableCell sx={{ width: "18.5%" }}>
                                        Inward Item
                                    </TableCell>
                                    <TableCell align="center" sx={{ width: "7%" }}>
                                        Batch
                                    </TableCell>
                                    <TableCell align="right" sx={{ width: "6.5%" }}>
                                        Tonnage
                                    </TableCell>
                                    <TableCell align="right" sx={{ width: "7.5%" }}>
                                        Qty (KG)
                                    </TableCell>
                                    <TableCell sx={{ width: "10%" }}>
                                        Pur .order no
                                    </TableCell>
                                    <TableCell align="center" sx={{ width: "10%" }}>
                                        Inward Jou no
                                    </TableCell>
                                    <TableCell sx={{ width: "10.5%" }}>
                                        Pur Inv no
                                    </TableCell>
                                    <TableCell sx={{ width: "6.5%" }}>
                                        Payment invoice
                                    </TableCell>
                                    <TableCell align="center" sx={{ width: "7.5%" }}>
                                        status
                                    </TableCell>
                                    <TableCell align="center" sx={{ width: "4.5%", borderRight: "none" }}>
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
                                            py: 0.7,
                                            px: 0.8,
                                            color: "#0f172a",
                                            borderRight: "1px solid #e2e8f0",
                                            position: "sticky",
                                            top: "35px",
                                            zIndex: 4,
                                            bgcolor: "#f1f5f9",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        },
                                    }}
                                >
                                    <TableCell align="center">TOTAL</TableCell>
                                    <TableCell> </TableCell>
                                    <TableCell sx={{ color: "#1e3a8a", fontWeight: 800 }}>
                                        {filteredData.length} Records
                                    </TableCell>
                                    <TableCell align="center"> </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{
                                            color: "#15803d",
                                            fontWeight: 800,
                                            fontSize: "0.78rem",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {metrics.totalTonnageKg > 0 ? formatTonsOnly(metrics.totalTonnageKg) : "-"}
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{
                                            color: "#15803d",
                                            fontWeight: 800,
                                            fontSize: "0.78rem",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {metrics.totalTonnageKg > 0 ? formatKgOnly(metrics.totalTonnageKg) : "-"}
                                    </TableCell>
                                    <TableCell> </TableCell>
                                    <TableCell align="center"> </TableCell>
                                    <TableCell> </TableCell>
                                    <TableCell> </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            size="small"
                                            label={`${metrics.completionRate}% Done`}
                                            sx={{
                                                bgcolor: "#dcfce7",
                                                color: "#15803d",
                                                fontWeight: 800,
                                                fontSize: "0.68rem",
                                                height: 20,
                                                whiteSpace: "nowrap",
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="center" sx={{ borderRight: "none" }}> </TableCell>
                                </TableRow>
                            </TableHead>

                            {/* TABLE BODY (NO EXPANSION - FLAT ROWS) */}
                            <TableBody>
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((row, idx) => {
                                        const isCompleted = row.status === "COMPLETED";
                                        const { tons: rowTons, kg: rowKg } = extractTonsAndKg(row.tonnage, row.tonnageKg);

                                        return (
                                            <TableRow
                                                key={row.id}
                                                hover
                                                onClick={() => handleOpenDetails(row)}
                                                sx={{
                                                    cursor: "pointer",
                                                    bgcolor: idx % 2 === 1 ? "#fafbfc" : "#ffffff",
                                                    borderBottom: "1px solid #e2e8f0",
                                                    transition: "background-color 0.15s ease",
                                                    "&:hover": {
                                                        bgcolor: "#f1f5f9 !important",
                                                    },
                                                    "& td": {
                                                        py: 0.5,
                                                        px: 0.8,
                                                        verticalAlign: "middle",
                                                    },
                                                }}
                                            >
                                                {/* S.NO */}
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: "#475569",
                                                        fontSize: "0.76rem",
                                                        borderRight: "1px solid #eef2f6",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {(page - 1) * rowsPerPage + idx + 1}
                                                </TableCell>

                                                {/* STOCK GROUP */}
                                                <TableCell
                                                    sx={{
                                                        fontSize: "0.76rem",
                                                        color: "#334155",
                                                        fontWeight: 600,
                                                        borderRight: "1px solid #eef2f6",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    <Tooltip title={row.stockGroup || ""} arrow placement="top-start">
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                fontSize: "0.76rem",
                                                                fontWeight: 600,
                                                                color: "#334155",
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                display: "block",
                                                            }}
                                                        >
                                                            {row.stockGroup}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* INWARD ITEM */}
                                                <TableCell
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        py: 0.4,
                                                        px: 0.8,
                                                    }}
                                                >
                                                    <Tooltip title={`${row.inwardItem || row.inwardBatchWithItemName || "-"} (Click to view full 4-tab details)`} arrow placement="top-start">
                                                        <Typography
                                                            sx={{
                                                                fontSize: "0.76rem",
                                                                fontWeight: 700,
                                                                color: "#0f172a",
                                                                display: "-webkit-box",
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: "vertical",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                lineHeight: 1.25,
                                                                wordBreak: "break-word",
                                                                whiteSpace: "normal",
                                                            }}
                                                        >
                                                            {row.inwardItem || row.inwardBatchWithItemName || "-"}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* BATCH */}
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {row.batch && row.batch !== "-" ? (
                                                        <Tooltip
                                                            title={`Batch (${row.batchCount || 1}): ${row.allBatches && row.allBatches.length > 0 ? row.allBatches.join(", ") : row.batch}`}
                                                            arrow
                                                            placement="top"
                                                        >
                                                            <Chip
                                                                size="small"
                                                                label={row.batchCount && row.batchCount > 1 ? `${row.batchCount} Batches` : row.batch}
                                                                sx={{
                                                                    fontSize: "0.70rem",
                                                                    fontWeight: row.batchCount && row.batchCount > 1 ? 700 : 600,
                                                                    height: 20,
                                                                    bgcolor: row.batchCount && row.batchCount > 1 ? "#f1f5f9" : "#f8fafc",
                                                                    color: row.batchCount && row.batchCount > 1 ? "#0f172a" : "#334155",
                                                                    border: "1px solid",
                                                                    borderColor: row.batchCount && row.batchCount > 1 ? "#94a3b8" : "#e2e8f0",
                                                                    maxWidth: "100%",
                                                                    "& .MuiChip-label": {
                                                                        px: 0.8,
                                                                        whiteSpace: "nowrap",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                    },
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    ) : (
                                                        <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8" }}>-</Typography>
                                                    )}
                                                </TableCell>

                                                {/* TONNAGE */}
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        fontWeight: 700,
                                                        color: "#0f172a",
                                                        fontSize: "0.76rem",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    <Tooltip title={`Tonnage: ${rowTons}`} arrow placement="top-end">
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: "#0f172a",
                                                                fontSize: "0.76rem",
                                                                whiteSpace: "nowrap",
                                                                display: "inline-block",
                                                            }}
                                                        >
                                                            {rowTons}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* QTY (KG) */}
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        fontWeight: 700,
                                                        color: "#15803d",
                                                        fontSize: "0.76rem",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    <Tooltip title={`Quantity in KG: ${rowKg}`} arrow placement="top-end">
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: "#15803d",
                                                                fontSize: "0.76rem",
                                                                whiteSpace: "nowrap",
                                                                display: "inline-block",
                                                            }}
                                                        >
                                                            {rowKg}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* PUR .ORDER NO */}
                                                <TableCell
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDetails(row, 0);
                                                    }}
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        cursor: "pointer",
                                                        "&:hover": {
                                                            bgcolor: "#f0f7ff",
                                                        },
                                                    }}
                                                >
                                                    <Tooltip title={`Open Purchase Order (${row.purOrderNo || "-"})`} arrow placement="top-start">
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: "#1e3a8a",
                                                                fontSize: "0.76rem",
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                display: "block",
                                                                cursor: "pointer",
                                                                "&:hover": {
                                                                    color: "#2563eb",
                                                                },
                                                            }}
                                                        >
                                                            {row.purOrderNo || "-"}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* INWARD JOU NO */}
                                                <TableCell
                                                    align="center"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDetails(row, 1);
                                                    }}
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        cursor: "pointer",
                                                        "&:hover": {
                                                            bgcolor: "#eff6ff",
                                                        },
                                                    }}
                                                >
                                                    {row.inwardJouNo && row.inwardJouNo !== "-" ? (
                                                        <Tooltip
                                                            title={`Open Inward Tab: Inwards (${row.inwardCount || 1}): ${row.allInwardJous && row.allInwardJous.length > 0 ? row.allInwardJous.join(", ") : String(row.inwardJouNo)}`}
                                                            arrow
                                                            placement="top"
                                                        >
                                                            {row.inwardCount && row.inwardCount > 1 ? (
                                                                <Chip
                                                                    size="small"
                                                                    label={`${row.inwardCount} Inwards`}
                                                                    sx={{
                                                                        fontSize: "0.70rem",
                                                                        fontWeight: 700,
                                                                        height: 20,
                                                                        bgcolor: "#eff6ff",
                                                                        color: "#1d4ed8",
                                                                        border: "1px solid #bfdbfe",
                                                                        cursor: "pointer",
                                                                        "&:hover": {
                                                                            bgcolor: "#dbeafe",
                                                                            borderColor: "#93c5fd",
                                                                        },
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Typography
                                                                    component="span"
                                                                    sx={{
                                                                        fontWeight: 600,
                                                                        color: "#1d4ed8",
                                                                        fontSize: "0.76rem",
                                                                        whiteSpace: "nowrap",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        display: "inline-block",
                                                                        maxWidth: "100%",
                                                                        cursor: "pointer",
                                                                        "&:hover": {
                                                                            color: "#1e40af",
                                                                        },
                                                                    }}
                                                                >
                                                                    {String(row.inwardJouNo).replace(/[\r\n]+/g, ", ")}
                                                                </Typography>
                                                            )}
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Open Inward Tab" arrow placement="top">
                                                            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", cursor: "pointer" }}>-</Typography>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>

                                                {/* PUR INV NO */}
                                                <TableCell
                                                    align={row.invoiceCount && row.invoiceCount > 1 ? "center" : "left"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDetails(row, 2);
                                                    }}
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        cursor: "pointer",
                                                        "&:hover": {
                                                            bgcolor: "#f0fdf4",
                                                        },
                                                    }}
                                                >
                                                    {row.purInvNo && row.purInvNo !== "-" ? (
                                                        <Tooltip
                                                            title={`Open Purchase Invoice Tab: Invoices (${row.invoiceCount || 1}): ${row.allPurInvNos && row.allPurInvNos.length > 0 ? row.allPurInvNos.join(", ") : row.purInvNo}`}
                                                            arrow
                                                            placement="top-start"
                                                        >
                                                            {row.invoiceCount && row.invoiceCount > 1 ? (
                                                                <Chip
                                                                    size="small"
                                                                    label={`${row.invoiceCount} Invoices`}
                                                                    sx={{
                                                                        fontSize: "0.70rem",
                                                                        fontWeight: 700,
                                                                        height: 20,
                                                                        bgcolor: "#f0fdf4",
                                                                        color: "#15803d",
                                                                        border: "1px solid #bbf7d0",
                                                                        cursor: "pointer",
                                                                        "&:hover": {
                                                                            bgcolor: "#dcfce7",
                                                                            borderColor: "#86efac",
                                                                        },
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Typography
                                                                    sx={{
                                                                        fontWeight: 600,
                                                                        color: "#0369a1",
                                                                        fontSize: "0.76rem",
                                                                        whiteSpace: "nowrap",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        display: "block",
                                                                        cursor: "pointer",
                                                                        "&:hover": {
                                                                            color: "#0284c7",
                                                                        },
                                                                    }}
                                                                >
                                                                    {row.purInvNo}
                                                                </Typography>
                                                            )}
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Open Purchase Invoice Tab" arrow placement="top">
                                                            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", cursor: "pointer" }}>-</Typography>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>

                                                {/* PAYMENT INVOICE */}
                                                <TableCell
                                                    align={row.paymentCount && row.paymentCount > 1 ? "center" : "left"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDetails(row, 3);
                                                    }}
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        cursor: "pointer",
                                                        "&:hover": {
                                                            bgcolor: "#faf5ff",
                                                        },
                                                    }}
                                                >
                                                    {row.paymentNo && row.paymentNo !== "-" ? (
                                                        <Tooltip
                                                            title={`Open Payment Tab: Payments (${row.paymentCount || 1}): ${row.allPaymentNos && row.allPaymentNos.length > 0 ? row.allPaymentNos.join(", ") : row.paymentNo}`}
                                                            arrow
                                                            placement="top-start"
                                                        >
                                                            {row.paymentCount && row.paymentCount > 1 ? (
                                                                <Chip
                                                                    size="small"
                                                                    label={`${row.paymentCount} Payments`}
                                                                    sx={{
                                                                        fontSize: "0.70rem",
                                                                        fontWeight: 700,
                                                                        height: 20,
                                                                        bgcolor: "#faf5ff",
                                                                        color: "#7e22ce",
                                                                        border: "1px solid #e9d5ff",
                                                                        cursor: "pointer",
                                                                        "&:hover": {
                                                                            bgcolor: "#f3e8ff",
                                                                            borderColor: "#d8b4fe",
                                                                        },
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Typography
                                                                    sx={{
                                                                        fontWeight: 600,
                                                                        color: "#7e22ce",
                                                                        fontSize: "0.76rem",
                                                                        whiteSpace: "nowrap",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        display: "block",
                                                                        cursor: "pointer",
                                                                        "&:hover": {
                                                                            color: "#9333ea",
                                                                        },
                                                                    }}
                                                                >
                                                                    {row.paymentNo}
                                                                </Typography>
                                                            )}
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Open Payment Tab" arrow placement="top">
                                                            <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", cursor: "pointer" }}>-</Typography>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>

                                                {/* STATUS */}
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        borderRight: "1px solid #eef2f6",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    <Chip
                                                        size="small"
                                                        icon={
                                                            isCompleted ? (
                                                                <CheckCircleOutlineIcon sx={{ fontSize: 13 }} />
                                                            ) : (
                                                                <AccessTimeIcon sx={{ fontSize: 13 }} />
                                                            )
                                                        }
                                                        label={row.status}
                                                        sx={{
                                                            fontWeight: 800,
                                                            fontSize: "0.64rem",
                                                            height: 20,
                                                            bgcolor: isCompleted ? "#dcfce7" : "#fee2e2",
                                                            color: isCompleted ? "#15803d" : "#b91c1c",
                                                            border: "1px solid",
                                                            borderColor: isCompleted ? "#86efac" : "#fca5a5",
                                                            whiteSpace: "nowrap",
                                                            "& .MuiChip-icon": {
                                                                color: isCompleted ? "#16a34a" : "#dc2626",
                                                            },
                                                            "& .MuiChip-label": {
                                                                px: 0.6,
                                                                whiteSpace: "nowrap",
                                                            },
                                                        }}
                                                    />
                                                </TableCell>

                                                {/* ACTIONS */}
                                                <TableCell
                                                    align="center"
                                                    sx={{
                                                        py: 0.4,
                                                        px: 0.5,
                                                        borderRight: "none",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.5, flexWrap: "nowrap" }}>
                                                        {/* View 4-Tab Transaction Details */}
                                                        <Tooltip title="View Transaction Details (PO, Inwards, Invoices, Payments)">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenDetails(row);
                                                                }}
                                                                sx={{
                                                                    bgcolor: "#eff6ff",
                                                                    color: "#1d4ed8",
                                                                    border: "1px solid #bfdbfe",
                                                                    p: 0.4,
                                                                    "&:hover": { bgcolor: "#dbeafe" },
                                                                }}
                                                            >
                                                                <VisibilityOutlinedIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>

                                                        {/* Item & Invoice Payment */}
                                                        <Tooltip title={`Item & Invoice Payment (${row.purOrderNo || row.purInvNo}) - Open in New Tab`}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const effectiveFrom = row.orderDate && dayjs(row.orderDate).isValid() && dayjs(row.orderDate).isBefore(dayjs(fromDate))
                                                                        ? dayjs(row.orderDate).format("YYYY-MM-DD")
                                                                        : fromDate;
                                                                    const url = `/purchaseItemPayment?orderId=${encodeURIComponent(row.purOrderNo || row.purInvNo)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(toDate)}`;
                                                                    window.open(url, "_blank");
                                                                }}
                                                                sx={{
                                                                    bgcolor: "#f0f9ff",
                                                                    color: "#0369a1",
                                                                    border: "1px solid #bae6fd",
                                                                    p: 0.4,
                                                                    "&:hover": { bgcolor: "#e0f2fe" },
                                                                }}
                                                            >
                                                                <TableViewOutlinedIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>

                                                        {/* Purchase Payment */}
                                                        <Tooltip title={`Payment Details (${row.purOrderNo || row.purInvNo}) - Open in New Tab`}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const effectiveFrom = row.orderDate && dayjs(row.orderDate).isValid() && dayjs(row.orderDate).isBefore(dayjs(fromDate))
                                                                        ? dayjs(row.orderDate).format("YYYY-MM-DD")
                                                                        : fromDate;
                                                                    const url = `/purchasePayment?orderId=${encodeURIComponent(row.purOrderNo || row.purInvNo)}&fromDate=${encodeURIComponent(effectiveFrom)}&toDate=${encodeURIComponent(toDate)}`;
                                                                    window.open(url, "_blank");
                                                                }}
                                                                sx={{
                                                                    bgcolor: "#fdf4ff",
                                                                    color: "#a21caf",
                                                                    border: "1px solid #f0abfc",
                                                                    p: 0.4,
                                                                    "&:hover": { bgcolor: "#fae8ff" },
                                                                }}
                                                            >
                                                                <PaymentOutlinedIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                                <ErrorOutlineIcon sx={{ fontSize: 36, color: "#94a3b8" }} />
                                                <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>
                                                    No matching purchase delivery records found
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

                {/* 5. PINNED PAGINATION */}
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

                {/* 6. TRANSACTION DETAILS DIALOG (4 TABS) */}
                <PurchaseTransactionDetailsDialog
                    open={dialogOpen}
                    onClose={handleCloseDetails}
                    item={selectedItemForDialog}
                    allDeliveryItems={data && data.length > 0 ? data : filteredData}
                    initialTab={dialogInitialTab}
                />
            </Box>
        </Box>
    );
};

export default PurchaseDelivery;
