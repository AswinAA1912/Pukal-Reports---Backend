import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    IconButton,
    Button,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
    Paper,
    Chip,
    Tooltip,
    Grid,
    CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonIcon from "@mui/icons-material/Person";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";
import { PurchaseDeliveryItem } from "../../services/purchaseDelivery.service";
import { OnlinePurchaseReportItemByOrderIdService } from "../../services/OnlinePurchaseReport.service";
import {
    formatKgQuantity,
    extractTonsAndKg,
    deriveStockGroup,
} from "../../services/purchaseDataIntegration.service";

interface PurchaseTransactionDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    item: PurchaseDeliveryItem | null;
    allDeliveryItems?: PurchaseDeliveryItem[];
    initialTab?: number;
}

const formatCurrency = (val: number | string | undefined): string => {
    if (val === undefined || val === null || val === "" || val === "-") return "₹ 0.00";
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "")) || 0;
    return "₹ " + num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

/**
 * Format any date value strictly to DD/MM/YYYY (e.g. 01/10/2026),
 * completely stripping any time component such as 00:00:00, 00.00.00, or T00:00:00.
 */
export const formatDisplayDate = (val?: any, fallbackToToday = true): string => {
    if (val === undefined || val === null || val === "" || val === "-" || val === "Invalid Date") {
        return fallbackToToday ? dayjs().format("DD/MM/YYYY") : "-";
    }

    const str = String(val).trim();
    if (!str || str === "-" || str.toLowerCase() === "invalid date" || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") {
        return fallbackToToday ? dayjs().format("DD/MM/YYYY") : "-";
    }

    // 1. Match YYYY[-/.]MM[-/.]DD (e.g. 2026-10-01 00:00:00, 2026-10-01 00.00.00, 2026-10-01T00:00:00.000Z)
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, "0");
        const day = ymdMatch[3].padStart(2, "0");
        return `${day}/${month}/${year}`;
    }

    // 2. Match DD[-/.]MM[-/.]YYYY or MM[-/.]DD[-/.]YYYY (e.g. 01/10/2026 00:00:00, 01/10/2026 00.00.00, 01/10/2026)
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
        const first = parseInt(dmyMatch[1], 10);
        const second = parseInt(dmyMatch[2], 10);
        const year = dmyMatch[3];
        let day = first;
        let month = second;
        // If MM/DD/YYYY format (where second > 12 and first <= 12)
        if (first <= 12 && second > 12) {
            day = second;
            month = first;
        }
        return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    }

    // 3. Fallback to dayjs parsing
    const parsed = dayjs(val);
    if (parsed.isValid()) {
        return parsed.format("DD/MM/YYYY");
    }

    return fallbackToToday ? dayjs().format("DD/MM/YYYY") : "-";
};

export const PurchaseTransactionDetailsDialog: React.FC<PurchaseTransactionDetailsDialogProps> = ({
    open,
    onClose,
    item,
    allDeliveryItems = [],
    initialTab = 0,
}) => {
    const [activeTab, setActiveTab] = useState<number>(initialTab);
    const [extraOrderDetails, setExtraOrderDetails] = useState<any[] | null>(null);
    const [loadingExtra, setLoadingExtra] = useState<boolean>(false);

    // Normalize PO number by removing all symbols, underscores, and spaces
    const normalizePo = (po?: string | number): string =>
        String(po || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

    // Find all sibling rows from the delivery report sharing the same Purchase Order Number or TransId
    const siblingRows = useMemo(() => {
        if (!item) return [];
        const targetPoNorm = normalizePo(item.purOrderNo);
        const targetTransId = item.transId ? String(item.transId).trim() : "";
        const pool = allDeliveryItems && allDeliveryItems.length > 0 ? allDeliveryItems : [];
        if (!pool.length) return [];

        const hasValidPo = targetPoNorm && targetPoNorm !== "pounknown" && targetPoNorm !== "pogeneral";
        const hasValidTransId = targetTransId && targetTransId !== "-" && targetTransId !== "0";

        if (!hasValidPo && !hasValidTransId) return [];

        return pool.filter((d) => {
            const dPoNorm = normalizePo(d.purOrderNo);
            const dTransId = d.transId ? String(d.transId).trim() : "";
            const poMatches = Boolean(hasValidPo && dPoNorm && dPoNorm === targetPoNorm);
            const transMatches = Boolean(hasValidTransId && dTransId && dTransId === targetTransId);
            return poMatches || transMatches;
        });
    }, [item, allDeliveryItems]);

    // Selected record states for Inward & Purchase Invoice detailed popups
    const [selectedInwardRow, setSelectedInwardRow] = useState<any | null>(null);
    const [selectedInvoiceRow, setSelectedInvoiceRow] = useState<any | null>(null);

    // Reset tab and active selected rows when dialog opens or item changes or initialTab changes
    useEffect(() => {
        if (open) {
            setActiveTab(initialTab ?? 0);
            setSelectedInwardRow(null);
            setSelectedInvoiceRow(null);
        }
    }, [open, item, initialTab]);

    // Fetch live backend line items for this specific PO if available
    useEffect(() => {
        let isMounted = true;
        if (open && item?.purOrderNo) {
            const idsToFetch = new Set<number>();
            const addIdCandidate = (val: any) => {
                if (val === undefined || val === null || val === "" || val === "-") return;
                const directNum = Number(val);
                if (!isNaN(directNum) && directNum > 0) {
                    idsToFetch.add(directNum);
                    return;
                }
                const match = String(val).match(/\d+$/);
                if (match && match[0]) {
                    const parsed = Number(match[0]);
                    if (!isNaN(parsed) && parsed > 0) idsToFetch.add(parsed);
                }
            };

            addIdCandidate(item.transId);
            addIdCandidate(item.purOrderNo);
            (siblingRows || []).forEach((sib) => {
                addIdCandidate(sib.transId);
                addIdCandidate(sib.purOrderNo);
            });

            if (idsToFetch.size > 0) {
                setLoadingExtra(true);
                Promise.allSettled(
                    Array.from(idsToFetch).map((id) =>
                        OnlinePurchaseReportItemByOrderIdService.getReportsitemByOrderId({
                            Po_Id: id,
                            company_id: 1,
                        })
                    )
                )
                    .then((results) => {
                        if (!isMounted) return;
                        const allExtra: any[] = [];
                        results.forEach((res) => {
                            if (res.status === "fulfilled" && res.value?.data?.data && Array.isArray(res.value.data.data)) {
                                allExtra.push(...res.value.data.data);
                            }
                        });
                        setExtraOrderDetails(allExtra.length > 0 ? allExtra : null);
                    })
                    .catch((err) => {
                        console.warn("Could not fetch extra order details by PO ID:", err);
                        if (isMounted) setExtraOrderDetails(null);
                    })
                    .finally(() => {
                        if (isMounted) setLoadingExtra(false);
                    });
            } else {
                setExtraOrderDetails(null);
            }
        } else {
            setExtraOrderDetails(null);
        }

        return () => {
            isMounted = false;
        };
    }, [open, item, siblingRows]);

    if (!item) return null;

    // Derived fields from item & extraOrderDetails
    const extraFirst = extraOrderDetails && extraOrderDetails.length > 0 ? extraOrderDetails[0] : null;

    const retailerName =
        extraFirst?.Retailer_Name ||
        item.retailerName ||
        (item as any).supplierName ||
        "Party Name As Recorded";

    const partyAddress =
        extraFirst?.Reatailer_Address ||
        extraFirst?.Party_Address ||
        item.partyAddress ||
        (extraFirst?.Reatailer_City ? `${extraFirst.Reatailer_City}, Tamil Nadu` : "-");

    const loadingDate = formatDisplayDate(
        item.loadingDate ||
        extraFirst?.Loading_Date ||
        extraFirst?.Ledger_Date ||
        item.orderDate
    );
    const tradeConfirmDate = formatDisplayDate(
        item.tradeConfirmDate ||
        extraFirst?.TradeConfirmDate ||
        extraFirst?.Ledger_Date ||
        item.orderDate
    );
    const ownerName = item.ownerName || extraFirst?.Created_By || "ADMIN";
    const brokerName = item.brokerName || extraFirst?.Brokerage || "-";
    const paymentCondition = item.paymentCondition || "30 Days";
    const remarks = item.remarks || extraFirst?.Narration || "-";

    // All PO items to display in Tab 0 (Order Preview)
    // Merges all sources (siblingRows, item.poItems, extraOrderDetails) so all distinct products are always shown
    const displayPoItems = (() => {
        const itemMap = new Map<string, any>();

        const getNormKey = (name: string): string =>
            String(name || "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        // 1. Populate from siblingRows (guarantees every product in this PO from the delivery table is present)
        siblingRows.forEach((sib) => {
            const rawName = sib.inwardItem || sib.inwardBatchWithItemName || "Item";
            const k = getNormKey(rawName);
            if (!k) return;
            if (!itemMap.has(k)) {
                itemMap.set(k, {
                    itemName: rawName,
                    orderedQty: sib.tonnageKg || 0,
                    tonnage: sib.tonnage || (sib.tonnageKg ? formatKgQuantity(sib.tonnageKg) : "-"),
                    rate: (sib as any).rate || "As recorded",
                    amount: sib.paymentAmt || "As recorded",
                    unit: (sib as any).unit || "Bags",
                    discount: (sib as any).discount || "-",
                    qualityCondition: "Standard",
                });
            }
        });

        // 2. Merge pre-formatted poItems from item or sibling rows
        const candidatePoItems: any[] = [];
        if (item.poItems && item.poItems.length > 0) candidatePoItems.push(...item.poItems);
        siblingRows.forEach((sib) => {
            if (sib.poItems && sib.poItems.length > 0) candidatePoItems.push(...sib.poItems);
        });

        candidatePoItems.forEach((it) => {
            const rawName = it.itemName || it.item_name || "Item";
            const k = getNormKey(rawName);
            if (!k) return;
            if (!itemMap.has(k)) {
                itemMap.set(k, {
                    itemName: rawName,
                    orderedQty: it.orderedQty || it.orderedTons || 0,
                    tonnage: it.tonnage || (it.orderedQty ? formatKgQuantity(it.orderedQty) : "-"),
                    rate: it.rate || "As recorded",
                    amount: it.amount || "As recorded",
                    unit: it.unit || "Bags",
                    discount: it.discount || "-",
                    qualityCondition: it.qualityCondition || "Standard",
                });
            } else {
                const ex = itemMap.get(k);
                if (it.rate && it.rate !== "As recorded" && ex.rate === "As recorded") ex.rate = it.rate;
                if (it.amount && it.amount !== "As recorded" && (ex.amount === "As recorded" || !ex.amount)) ex.amount = it.amount;
                if (it.qualityCondition && it.qualityCondition !== "Standard") ex.qualityCondition = it.qualityCondition;
            }
        });

        // 3. Merge backend live line items from extraOrderDetails (enriching rates, amounts, quantities)
        (extraOrderDetails || []).forEach((extra: any) => {
            const rawName = extra.Product_Name || extra.Stock_Item || extra.POS_Item_Name || "Item";
            const k = getNormKey(rawName);
            if (!k) return;

            const extraQty = extra.Bill_Qty || 0;
            const extraRate = extra.Rate || "As recorded";
            const extraAmt = extra.Amount || 0;
            const extraUnit = extra.Bag || "Bags";
            const extraDiscount = extra.Discount || "-";
            const extraQuality = extra.Grade_Item_Group || "Standard";

            if (itemMap.has(k)) {
                const ex = itemMap.get(k);
                if (extraRate && extraRate !== "As recorded") ex.rate = extraRate;
                if (extraAmt) ex.amount = extraAmt;
                if (extraQty) {
                    ex.orderedQty = extraQty;
                    ex.tonnage = formatKgQuantity(extraQty);
                }
                if (extraQuality && extraQuality !== "Standard") ex.qualityCondition = extraQuality;
                if (extraDiscount && extraDiscount !== "-") ex.discount = extraDiscount;
                if (extraUnit && extraUnit !== "Bags") ex.unit = extraUnit;
            } else {
                itemMap.set(k, {
                    itemName: rawName,
                    orderedQty: extraQty,
                    tonnage: extraQty ? formatKgQuantity(extraQty) : "-",
                    rate: extraRate,
                    amount: extraAmt,
                    unit: extraUnit,
                    discount: extraDiscount,
                    qualityCondition: extraQuality,
                });
            }
        });

        // If items were gathered, return them indexed sequentially
        if (itemMap.size > 0) {
            return Array.from(itemMap.values()).map((row, idx) => ({
                ...row,
                sNo: idx + 1,
            }));
        }

        // Fallback to single clicked row item
        return [
            {
                sNo: 1,
                itemName: item.inwardItem,
                orderedQty: item.tonnageKg || 0,
                tonnage: item.tonnage || "-",
                rate: "As recorded",
                amount: "As recorded",
                unit: "Bags",
                discount: "-",
                qualityCondition: "Standard",
            },
        ];
    })();

    // Inward Delivery records to display in Tab 1 (Inward - 20 columns matching photo)
    const displayInwards = (() => {
        let baseRows: any[] = [];
        if (item.inwardDetails && item.inwardDetails.length > 0) {
            baseRows = item.inwardDetails;
        } else if (siblingRows.length > 1) {
            baseRows = siblingRows;
        } else {
            const inwardJouList = item.allInwardJous && item.allInwardJous.length > 0
                ? item.allInwardJous
                : [String(item.inwardJouNo || "-")];
            const batches = item.allBatches && item.allBatches.length > 0 ? item.allBatches : [item.batch || "-"];
            baseRows = inwardJouList.map((jou, idx) => ({
                billNo: jou !== "-" ? jou : `MIA/${String(idx + 1).padStart(6, "0")}/26-27`,
                batch: batches[idx] || batches[0] || "-",
            }));
        }

        return baseRows.map((inw: any, idx: number) => {
            const rowTonnageKg = inw.tonnageKg || (inw.quantity && typeof inw.quantity === "number" ? inw.quantity : (item.tonnageKg || 0));
            const stockItem = inw.itemName || inw.stockItem || item.inwardItem || "-";
            const stockGroup = inw.stockGroup || inw.stock_group || inw.group || (inw as any).Stock_Group || item.stockGroup || (stockItem !== "-" ? deriveStockGroup(stockItem) : "-") || "-";
            return {
                sNo: idx + 1,
                entryDate: formatDisplayDate(inw.arrivalDate || inw.entryDate || inw.date || inw.orderDate || item.orderDate || loadingDate),
                vehicleNo: inw.vehicleNo || inw.inwardVehicle || inw.transportDetails?.vehicleNo || item.transportDetails?.vehicleNo || (item as any).vehicleNo || "-",
                vouType: inw.voucherType || inw.billType || "ON_M_OUTWARDS",
                vouNo: (inw.billNo && inw.billNo !== "-") ? String(inw.billNo) : ((inw.inwardJouNo && inw.inwardJouNo !== "-") ? String(inw.inwardJouNo) : (item.inwardJouNo || `MIA/${String(idx + 1).padStart(6, "0")}/26-27`)),
                retailerName: inw.retailerName || retailerName || (item as any).retailerName || "-",
                narr: inw.narration || inw.narr || inw.remarks || item.remarks || extraFirst?.Narration || "-",
                stockItem,
                stockGroup,
                qty: inw.quantity ? `${inw.quantity} ${inw.unit || "Bags"}` : (rowTonnageKg ? formatKgQuantity(rowTonnageKg) : "-"),
                batch: inw.batch || inw.batchNo || item.batch || "-",
                rate: inw.rate !== undefined && inw.rate !== "As recorded" ? (typeof inw.rate === "number" ? formatCurrency(inw.rate) : inw.rate) : (inw.billedRate || "As recorded"),
                amount: inw.amount !== undefined && inw.amount !== "As recorded" ? formatCurrency(inw.amount) : (inw.paymentAmt ? formatCurrency(inw.paymentAmt) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "As recorded")),
                fromGodown: inw.fromLocation || inw.fromGodown || inw.location || "Smt Mill",
                toGodown: inw.toGodown || inw.batchLocation || "Main Location",
                startTime: inw.startTime || "-",
                endTime: inw.endTime || "-",
                startKms: inw.startKms || "-",
                endKms: inw.endKms || "-",
                staffInvolved: inw.staffInvolved || inw.staff || inw.driver || ownerName || "-",
                balPurOrderTonnage: inw.balPurOrderTonnage || inw.balTonnage || "-",
                rowTonnageKg,
            };
        });
    })();

    // Purchase Invoice records to display in Tab 2 (Pur invoice - 25 columns matching photo)
    const displayInvoices = (() => {
        let baseRows: any[] = [];
        if (item.invoiceDetails && item.invoiceDetails.length > 0) {
            baseRows = item.invoiceDetails;
        } else if (siblingRows.length > 1) {
            baseRows = siblingRows;
        } else {
            const invoiceList = item.allPurInvNos && item.allPurInvNos.length > 0
                ? item.allPurInvNos
                : [item.purInvNo || "-"];
            const batches = item.allBatches && item.allBatches.length > 0 ? item.allBatches : [item.batch || "-"];
            baseRows = invoiceList.map((invNo, idx) => ({
                refNumber: invNo !== "-" ? invNo : `INV-${item.purOrderNo}-${idx + 1}`,
                batch: batches[idx] || batches[0] || "-",
            }));
        }

        return baseRows.map((inv: any, idx: number) => {
            const rowTonnageKg = inv.tonnageKg || inv.billQty || inv.aclQty || item.tonnageKg || 0;
            const stockItemName = inv.itemName || inv.stockItemName || item.inwardItem || "-";
            const stockGroup = inv.stockGroup || inv.stock_group || inv.group || (inv as any).Stock_Group || item.stockGroup || (stockItemName !== "-" ? deriveStockGroup(stockItemName) : "-") || "-";
            return {
                sNo: idx + 1,
                entryDate: formatDisplayDate(inv.entryDate || inv.date || inv.billDate || inv.orderDate || item.orderDate || loadingDate),
                billDate: formatDisplayDate(inv.billDate || inv.date || inv.entryDate || inv.orderDate || item.orderDate || loadingDate),
                vouType: inv.voucherType || inv.vouType || "Purchase Invoice",
                vouNo: (inv.vouNo && inv.vouNo !== "-") ? String(inv.vouNo) : (inv.refNumber || inv.purInvNo || item.purInvNo || `INV-${item.purOrderNo}-${idx + 1}`),
                refNo: inv.refNumber || inv.refNo || inv.purInvNo || item.purInvNo || `INV-${item.purOrderNo}-${idx + 1}`,
                partyName: inv.vendor || inv.partyName || retailerName || (item as any).retailerName || "-",
                narr: inv.narration || inv.narr || inv.remarks || item.remarks || extraFirst?.Narration || "-",
                stockItemName,
                stockGroup,
                actQty: inv.aclQty ? (typeof inv.aclQty === "number" ? formatKgQuantity(inv.aclQty) : inv.aclQty) : (rowTonnageKg ? formatKgQuantity(rowTonnageKg) : "-"),
                billQty: inv.billQty ? (typeof inv.billQty === "number" ? formatKgQuantity(inv.billQty) : inv.billQty) : (rowTonnageKg ? formatKgQuantity(rowTonnageKg) : "-"),
                rate: inv.rate !== undefined && inv.rate !== "As recorded" ? (typeof inv.rate === "number" ? formatCurrency(inv.rate) : inv.rate) : "As recorded",
                amount: inv.amount !== undefined && inv.amount !== "As recorded" ? formatCurrency(inv.amount) : (inv.paymentAmt ? formatCurrency(inv.paymentAmt) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "As recorded")),
                godown: inv.godown || inv.batchLocation || "Main Godown",
                batch: inv.batch || inv.batchNo || item.batch || "-",
                expenses: inv.expenses !== undefined && inv.expenses !== "-" ? formatCurrency(inv.expenses) : "-",
                cgst: inv.cgst !== undefined && inv.cgst !== "-" ? formatCurrency(inv.cgst) : "-",
                sgst: inv.sgst !== undefined && inv.sgst !== "-" ? formatCurrency(inv.sgst) : "-",
                igst: inv.igst !== undefined && inv.igst !== "-" ? formatCurrency(inv.igst) : "-",
                roundOff: inv.roundOff !== undefined && inv.roundOff !== "-" ? formatCurrency(inv.roundOff) : "-",
                totalAmount: inv.totalAmount !== undefined && inv.totalAmount !== "-" ? formatCurrency(inv.totalAmount) : (inv.amount && inv.amount !== "As recorded" ? formatCurrency(inv.amount) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "-")),
                staffInvolved: inv.staffInvolved || inv.staff || ownerName || "-",
                discount: inv.discount !== undefined ? String(inv.discount) : "0",
                paymentDays: String(inv.days || inv.Days || inv.paymentDays || inv.payment_days || inv.dueDays || inv.due_days || inv.creditDays || inv.credit_days || (item.paymentCondition ? String(item.paymentCondition).replace(/[^0-9]/g, "") : "") || "3").replace(/days?/i, "").trim() || "3",
                balInwardTonnage: inv.balInwardTonnage || inv.balTonnage || "-",
                rowTonnageKg,
            };
        });
    })();

    // Payment records to display in Tab 3 (Payment - 9 columns matching photo)
    const displayPayments = (() => {
        let baseRows: any[] = [];
        if (item.paymentDetails && item.paymentDetails.length > 0) {
            baseRows = item.paymentDetails;
        } else {
            const paymentList = item.allPaymentNos && item.allPaymentNos.length > 0
                ? item.allPaymentNos
                : [item.paymentNo || (item.paymentAmt ? "Payment As Recorded" : "-")];
            baseRows = paymentList.map((pNo) => ({
                voucher: pNo && pNo !== "-" ? pNo : "ON_Payment SM - Exp",
            }));
        }

        return baseRows.map((p: any, idx: number) => ({
            sNo: idx + 1,
            entryDate: formatDisplayDate(p.date || p.entryDate || p.paymentDate || p.orderDate || item.orderDate || loadingDate),
            vouType: p.voucherType || p.vouType || p.billType || "ON_Payment SM - Exp",
            vouNo: p.vouNo || p.voucher || p.paymentNo || item.paymentNo || "ON_Payment SM - Exp",
            purPartyName: p.debitAccount || p.purPartyName || retailerName || (item as any).retailerName || "-",
            totalInvoiceAmount: p.creditAmt ? formatCurrency(p.creditAmt) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "-"),
            paidAmt: p.debitAmt ? formatCurrency(p.debitAmt) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "-"),
            balanceInvAmt: p.balAmt !== undefined ? formatCurrency(p.balAmt) : "₹ 0.00",
            staffInvolved: p.staffInvolved || p.staff || p.approvedBy || ownerName || "ADMIN",
            debitAmt: p.debitAmt,
            creditAmt: p.creditAmt,
            narration: p.narration || p.narr || p.remarks || remarks || "-",
        }));
    })();

    // Staff Involved generator functions for each stage
    const effectiveBroker = brokerName !== "-" ? brokerName : ((item as any)?.broker || "DIRECT");

    const getInwardStaffList = (inw: any) => [
        { category: "DIRECT", role: "Broker", name: effectiveBroker },
        { category: "TRANSPORT", role: "Transport / Vehicle", name: `${inw?.vehicleNo || "Direct"} (${inw?.driver || (item as any)?.driver || "Driver Assigned"})` },
        { category: "OWNERS", role: "Owners / Approver", name: ownerName || "ADMIN" },
        { category: "DETAILS", role: "Godown Supervisor", name: `${inw?.toGodown || "Main Godown"} Supervisor` },
        { category: "ATTENDANT", role: "Inward Attendant", name: inw?.staffInvolved || "Yard Attendant" },
    ];

    const getInvoiceStaffList = (inv: any) => [
        { category: "DIRECT", role: "Broker", name: effectiveBroker },
        { category: "DETAILS", role: "Billing Staff", name: inv?.staffInvolved || "Accounts Team" },
        { category: "OWNERS", role: "Owners / Signatory", name: ownerName || "ADMIN" },
        { category: "ATTENDANT", role: "Vendor Representative", name: inv?.partyName || retailerName || "Vendor" },
        { category: "TRANSPORT", role: "Payment Terms", name: `${inv?.paymentDays || "0"} Days Credit` },
    ];

    // Top Summary Banner Calculations: Ordered, Received, Wants to Receive & Stage Statuses
    const totalOrderedKg = (() => {
        const fromItems = displayPoItems.reduce((acc: number, it: any) => acc + (it.orderedQty || 0), 0);
        if (fromItems > 0) return fromItems;
        return item.tonnageKg || 0;
    })();

    const totalReceivedKg = (() => {
        const fromInwards = displayInwards.reduce((acc: number, inw: any) => acc + (inw.rowTonnageKg || 0), 0);
        if (fromInwards > 0) return fromInwards;
        return 0;
    })();

    const totalPendingKg = Math.max(0, totalOrderedKg - totalReceivedKg);

    // Verification: Order is only completed if Received matches or exceeds Ordered Qty (within 1kg tolerance)
    const isOrderFulfilled = totalOrderedKg > 0 && totalReceivedKg >= (totalOrderedKg - 1);
    const isPartiallyReceived = totalReceivedKg > 0 && !isOrderFulfilled;

    const orderedDisplay = totalOrderedKg > 0 ? formatKgQuantity(totalOrderedKg) : (item.tonnage || "-");
    const receivedDisplay = totalReceivedKg > 0 ? formatKgQuantity(totalReceivedKg) : "0 KG";
    const pendingDisplay = totalPendingKg > 0
        ? formatKgQuantity(totalPendingKg)
        : (isOrderFulfilled ? "0 KG (Fulfilled)" : "-");

    // Dynamic Overall Status: Only completed when Ordered & Received quantities actually match!
    const overallStatus = (() => {
        if (isOrderFulfilled) {
            return {
                label: "Order Completed",
                color: "#15803d",
                bgcolor: "#dcfce7",
                borderColor: "#86efac",
                icon: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />,
            };
        }
        if (isPartiallyReceived) {
            return {
                label: "Partially Received",
                color: "#c2410c",
                bgcolor: "#ffedd5",
                borderColor: "#fed7aa",
                icon: <AccessTimeIcon sx={{ fontSize: 14 }} />,
            };
        }
        return {
            label: "Pending Inward",
            color: "#0369a1",
            bgcolor: "#e0f2fe",
            borderColor: "#bae6fd",
            icon: <AccessTimeIcon sx={{ fontSize: 14 }} />,
        };
    })();

    // Stage statuses up to Payment
    const stageStatuses = {
        po: { label: "PO Placed", status: "COMPLETED", color: "#1e3a8a", bg: "#eff6ff" },
        inward: {
            label: isOrderFulfilled
                ? "Fully Received"
                : (isPartiallyReceived ? "Partially Received" : "Pending Inward"),
            status: isOrderFulfilled ? "COMPLETED" : "IN_PROGRESS",
            color: isOrderFulfilled ? "#15803d" : (isPartiallyReceived ? "#c2410c" : "#0284c7"),
            bg: isOrderFulfilled ? "#dcfce7" : (isPartiallyReceived ? "#ffedd5" : "#e0f2fe"),
        },
        invoice: {
            label: displayInvoices.length > 0 && displayInvoices[0].vouNo !== "-"
                ? `${displayInvoices.length} ${displayInvoices.length === 1 ? "Invoice" : "Invoices"} Linked`
                : "Pending Invoice",
            status: displayInvoices.length > 0 ? "COMPLETED" : "IN_PROGRESS",
            color: "#6d28d9",
            bg: "#f5f3ff",
        },
        payment: {
            label: isOrderFulfilled && (item.status === "COMPLETED" || (displayPayments.length > 0 && displayPayments[0].balanceInvAmt === "₹ 0.00"))
                ? "Payment Completed"
                : (displayPayments.length > 0 && displayPayments[0].paidAmt && displayPayments[0].paidAmt !== "₹ 0.00"
                    ? "Partial Payment"
                    : "Payment Pending"),
            status: isOrderFulfilled && (item.status === "COMPLETED" || (displayPayments.length > 0 && displayPayments[0].balanceInvAmt === "₹ 0.00")) ? "COMPLETED" : "PENDING",
            color: isOrderFulfilled && (item.status === "COMPLETED" || (displayPayments.length > 0 && displayPayments[0].balanceInvAmt === "₹ 0.00")) ? "#15803d" : "#b91c1c",
            bg: isOrderFulfilled && (item.status === "COMPLETED" || (displayPayments.length > 0 && displayPayments[0].balanceInvAmt === "₹ 0.00")) ? "#dcfce7" : "#fee2e2",
        },
    };

    // Helper: Render "Staff Involved" Companion Table (Clean 2-Column Read-Only)
    const renderStaffInvolvedCard = (
        title: string,
        staffList: { category: string; role: string; name: string }[]
    ) => (
        <Paper
            elevation={0}
            sx={{
                border: "1px solid #e2e8f0",
                borderRadius: 1.5,
                overflow: "hidden",
                bgcolor: "#ffffff",
                width: "100%",
            }}
        >
            <Box
                sx={{
                    px: 1.5,
                    py: 0.8,
                    bgcolor: "#f1f5f9",
                    borderBottom: "1px solid #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.8,
                }}
            >
                <PersonIcon sx={{ fontSize: 16, color: "#1e3a8a" }} />
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#1e3a8a" }}>
                    {title || "Staff Involved"}
                </Typography>
            </Box>

            <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                        <TableCell sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#1e3a8a", width: "40%", py: 0.7, px: 1, borderBottom: "1px solid #e2e8f0" }}>
                            Category
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#1e3a8a", width: "60%", py: 0.7, px: 1, borderBottom: "1px solid #e2e8f0" }}>
                            Staff Name
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {staffList.map((st, sIdx) => (
                        <TableRow
                            key={sIdx}
                            sx={{
                                bgcolor: "#ffffff",
                                "&:hover": { bgcolor: "#f8fafc" },
                            }}
                        >
                            {/* Category badge */}
                            <TableCell sx={{ py: 0.6, px: 1, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" }}>
                                <Typography
                                    component="span"
                                    sx={{
                                        fontSize: "0.68rem",
                                        fontWeight: 800,
                                        color: "#1e3a8a",
                                        bgcolor: "#eff6ff",
                                        px: 0.8,
                                        py: 0.25,
                                        borderRadius: 1,
                                        border: "1px solid #bfdbfe",
                                        display: "inline-block",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {st.category}
                                </Typography>
                            </TableCell>

                            {/* Staff Name & Role */}
                            <TableCell sx={{ py: 0.6, px: 1, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" }}>
                                <Typography sx={{ fontSize: "0.73rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }}>
                                    {st.role}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: "0.68rem",
                                        color: "#475569",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                    title={st.name}
                                >
                                    {st.name}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Paper>
    );

    // Handle PDF download of Order Preview matching Picture 2
    const handleDownloadOrderPreview = () => {
        try {
            const doc = new jsPDF("portrait", "mm", "a4");

            // Header Banner
            doc.setFillColor(30, 58, 138);
            doc.rect(0, 0, 210, 18, "F");
            doc.setFontSize(13);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text("PUKAL REPORTS | ORDER PREVIEW", 14, 12);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Generated on: ${dayjs().format("DD/MM/YYYY HH:mm")}`, 155, 12);

            // Subtitle & Order Number
            doc.setFontSize(11);
            doc.setTextColor(30, 58, 138);
            doc.setFont("helvetica", "bold");
            doc.text(`Purchase Order: ${item.purOrderNo}`, 14, 26);

            // Order Details & Party Details Box
            autoTable(doc, {
                startY: 30,
                head: [["ORDER DETAILS", "PARTY DETAILS"]],
                body: [
                    [
                        `Loading Date: ${loadingDate}\nTrade Confirm Date: ${tradeConfirmDate}\nOwner Name: ${ownerName}\nBroker Name: ${brokerName}`,
                        `Party Name: ${retailerName}\nParty Address: ${partyAddress}\nPayment Condition: ${paymentCondition}\nRemarks: ${remarks}`,
                    ],
                ],
                theme: "grid",
                styles: { fontSize: 8.5, cellPadding: 3, textColor: [15, 23, 42] },
                headStyles: { fillColor: [241, 245, 249], textColor: [30, 58, 138], fontStyle: "bold" },
            });

            const finalY1 = (doc as any).lastAutoTable.finalY + 6;

            // ORDER ITEMS Table
            doc.setFontSize(9.5);
            doc.setTextColor(30, 58, 138);
            doc.setFont("helvetica", "bold");
            doc.text("ORDER ITEMS", 14, finalY1);

            const itemsBody = displayPoItems.map((it: any, idx: number) => {
                const { tons, kg } = extractTonsAndKg(it.tonnage, it.orderedQty);
                return [
                    idx + 1,
                    it.itemName || it.item_name || "-",
                    tons,
                    kg,
                    it.rate || "As recorded",
                    it.discount || "-",
                    it.qualityCondition || "Standard",
                ];
            });

            autoTable(doc, {
                startY: finalY1 + 2,
                head: [["SNo", "Item Name", "Tonnage", "Qty (KG)", "Rate (Deliver/Spot)", "Discount", "Quality Condition"]],
                body: itemsBody,
                theme: "grid",
                styles: { fontSize: 8, cellPadding: 2.5 },
                headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
            });

            doc.save(`OrderPreview_${item.purOrderNo}_${dayjs().format("YYYYMMDD")}.pdf`);
        } catch (err) {
            console.error("Failed to download Order Preview PDF:", err);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2.5,
                    bgcolor: "#ffffff",
                    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.16)",
                    maxWidth: "97vw",
                    width: "97vw",
                    maxHeight: "94vh",
                    display: "flex",
                    flexDirection: "column",
                },
            }}
        >
            {/* 1. TOP DIALOG HEADER MATCHING PICTURE 1 */}
            <DialogTitle
                sx={{
                    px: 3,
                    py: 1.8,
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    bgcolor: "#ffffff",
                }}
            >
                <Box>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 800,
                            color: "#1e3a8a",
                            fontSize: "1.15rem",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Transaction Details
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.85rem",
                            color: "#334155",
                            fontWeight: 700,
                            mt: 0.3,
                        }}
                    >
                        Purchase Order: <span style={{ color: "#1e3a8a", fontWeight: 800 }}>{item.purOrderNo}</span>
                        {item.inwardItem && (
                            <Typography component="span" sx={{ color: "#64748b", fontWeight: 600, ml: 1, fontSize: "0.80rem" }}>
                                (Product: {item.inwardItem})
                            </Typography>
                        )}
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {loadingExtra && (
                        <CircularProgress size={18} sx={{ color: "#1e3a8a" }} />
                    )}
                    <IconButton
                        size="small"
                        onClick={onClose}
                        sx={{
                            color: "#64748b",
                            "&:hover": { bgcolor: "#fee2e2", color: "#b91c1c" },
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>
            </DialogTitle>

            {/* TOP SUMMARY BANNER: ORDERED, RECEIVED, WANTS TO RECEIVE & STAGE STATUS UP TO PAYMENT */}
            <Box
                sx={{
                    px: 3,
                    py: 1.2,
                    bgcolor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                }}
            >
                {/* Top Row: Ordered, Received, Wants to Receive & Overall Status Badge */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1.5,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                        {/* 1. Ordered */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.8,
                                bgcolor: "#ffffff",
                                px: 1.2,
                                py: 0.5,
                                borderRadius: 1.5,
                                border: "1px solid #e2e8f0",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            }}
                        >
                            <ShoppingCartOutlinedIcon sx={{ fontSize: 16, color: "#1e3a8a" }} />
                            <Box>
                                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                                    Ordered
                                </Typography>
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2, mt: 0.2 }}>
                                    {orderedDisplay}
                                </Typography>
                            </Box>
                        </Box>

                        {/* 2. Received */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.8,
                                bgcolor: "#ffffff",
                                px: 1.2,
                                py: 0.5,
                                borderRadius: 1.5,
                                border: "1px solid #bbf7d0",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            }}
                        >
                            <LocalShippingOutlinedIcon sx={{ fontSize: 16, color: "#15803d" }} />
                            <Box>
                                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                                    Received
                                </Typography>
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#15803d", lineHeight: 1.2, mt: 0.2 }}>
                                    {receivedDisplay}
                                </Typography>
                            </Box>
                        </Box>

                        {/* 3. Wants to Receive */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.8,
                                bgcolor: "#ffffff",
                                px: 1.2,
                                py: 0.5,
                                borderRadius: 1.5,
                                border: "1px solid",
                                borderColor: totalPendingKg > 0 ? "#fed7aa" : "#e2e8f0",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            }}
                        >
                            <AccessTimeIcon sx={{ fontSize: 16, color: totalPendingKg > 0 ? "#c2410c" : "#64748b" }} />
                            <Box>
                                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, color: totalPendingKg > 0 ? "#c2410c" : "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1 }}>
                                    Wants to Receive
                                </Typography>
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: totalPendingKg > 0 ? "#c2410c" : "#475569", lineHeight: 1.2, mt: 0.2 }}>
                                    {pendingDisplay}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    {/* Overall Status Badge */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b" }}>
                            Overall Status:
                        </Typography>
                        <Chip
                            size="small"
                            icon={overallStatus.icon}
                            label={overallStatus.label}
                            sx={{
                                fontWeight: 800,
                                fontSize: "0.74rem",
                                bgcolor: overallStatus.bgcolor,
                                color: overallStatus.color,
                                border: "1px solid",
                                borderColor: overallStatus.borderColor,
                            }}
                        />
                    </Box>
                </Box>

            </Box>

            {/* 2. 4 TABS NAVIGATION MATCHING PICTURE 1 */}
            <Box
                sx={{
                    px: 3,
                    pt: 1.5,
                    pb: 1.2,
                    bgcolor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2,
                    flexWrap: "wrap",
                }}
            >
                {[
                    { id: 0, label: "Purchase Order", icon: <ShoppingCartOutlinedIcon sx={{ fontSize: 16 }} />, count: displayPoItems.length },
                    { id: 1, label: "Inward Details", icon: <LocalShippingOutlinedIcon sx={{ fontSize: 16 }} />, count: displayInwards.length },
                    { id: 2, label: "Purchase Invoice", icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />, count: displayInvoices.length },
                    { id: 3, label: "Payment Details", icon: <PaymentOutlinedIcon sx={{ fontSize: 16 }} />, count: displayPayments.length },
                ].map((t) => {
                    const isActive = activeTab === t.id;
                    return (
                        <Button
                            key={t.id}
                            id={`dialog-tab-${t.id}`}
                            data-testid={`dialog-tab-${t.id}`}
                            onClick={() => setActiveTab(t.id)}
                            startIcon={t.icon}
                            sx={{
                                textTransform: "none",
                                fontSize: "0.82rem",
                                fontWeight: 700,
                                px: 2,
                                py: 0.7,
                                borderRadius: 1.8,
                                bgcolor: isActive ? "#1e3a8a" : "#ffffff",
                                color: isActive ? "#ffffff" : "#475569",
                                border: "1px solid",
                                borderColor: isActive ? "#1e3a8a" : "#cbd5e1",
                                boxShadow: isActive ? "0 2px 6px rgba(30, 58, 138, 0.25)" : "none",
                                "&:hover": {
                                    bgcolor: isActive ? "#162e6e" : "#f1f5f9",
                                    borderColor: isActive ? "#162e6e" : "#94a3b8",
                                },
                            }}
                        >
                            {t.label}
                            {t.count !== undefined && t.count > 0 && (
                                <Chip
                                    size="small"
                                    label={t.count}
                                    sx={{
                                        ml: 0.8,
                                        height: 18,
                                        fontSize: "0.66rem",
                                        fontWeight: 800,
                                        bgcolor: isActive ? "rgba(255, 255, 255, 0.22)" : "#e2e8f0",
                                        color: isActive ? "#ffffff" : "#334155",
                                    }}
                                />
                            )}
                        </Button>
                    );
                })}
            </Box>

            {/* 3. TAB CONTENTS */}
            <DialogContent
                sx={{
                    p: { xs: 1.5, md: 2 },
                    bgcolor: "#ffffff",
                    overflowY: "auto",
                    overflowX: "hidden",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* ============================================================== */}
                {/* TAB 0: PURCHASE ORDER DETAILS / ORDER PREVIEW */}
                {/* ============================================================== */}
                {activeTab === 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {/* Top bar with Order Preview Title & Download Button */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Box>
                                <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                    Order Preview
                                </Typography>
                                <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                    Purchase Order Items — one PO can contain multiple item rows ({displayPoItems.length} {displayPoItems.length === 1 ? "Item" : "Items"})
                                </Typography>
                            </Box>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                                onClick={handleDownloadOrderPreview}
                                sx={{
                                    textTransform: "none",
                                    fontWeight: 700,
                                    fontSize: "0.75rem",
                                    py: 0.3,
                                    px: 1.5,
                                    color: "#0284c7",
                                    borderColor: "#38bdf8",
                                    bgcolor: "#f0f9ff",
                                    "&:hover": { bgcolor: "#e0f2fe", borderColor: "#0284c7" },
                                }}
                            >
                                DOWNLOAD
                            </Button>
                        </Box>

                        {/* Top 2-Column Section: ORDER DETAILS & PARTY DETAILS */}
                        <Paper
                            elevation={0}
                            sx={{
                                border: "1px solid #e2e8f0",
                                borderRadius: 1.5,
                                overflow: "hidden",
                            }}
                        >
                            <Grid container>
                                {/* Left Column: ORDER DETAILS */}
                                <Grid
                                    item
                                    xs={12}
                                    md={6}
                                    sx={{
                                        p: 1.2,
                                        borderRight: { xs: "none", md: "1px solid #e2e8f0" },
                                        borderBottom: { xs: "1px solid #e2e8f0", md: "none" },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: "0.72rem",
                                            fontWeight: 800,
                                            color: "#2563eb",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                            mb: 0.8,
                                        }}
                                    >
                                        ORDER DETAILS
                                    </Typography>
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2, borderBottom: "1px dashed #f1f5f9" }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Loading Date</Typography>
                                            <Typography sx={{ fontSize: "0.76rem", color: "#0f172a", fontWeight: 700 }}>{formatDisplayDate(loadingDate)}</Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2, borderBottom: "1px dashed #f1f5f9" }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Trade Confirm Date</Typography>
                                            <Typography sx={{ fontSize: "0.76rem", color: "#0f172a", fontWeight: 700 }}>{formatDisplayDate(tradeConfirmDate)}</Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2, borderBottom: "1px dashed #f1f5f9" }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Owner Name</Typography>
                                            <Typography sx={{ fontSize: "0.76rem", color: "#0f172a", fontWeight: 700 }}>{ownerName}</Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2 }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Broker Name</Typography>
                                            <Typography sx={{ fontSize: "0.76rem", color: "#0f172a", fontWeight: 700 }}>{brokerName}</Typography>
                                        </Box>
                                    </Box>
                                </Grid>

                                {/* Right Column: PARTY DETAILS */}
                                <Grid item xs={12} md={6} sx={{ p: 1.2 }}>
                                    <Typography
                                        sx={{
                                            fontSize: "0.72rem",
                                            fontWeight: 800,
                                            color: "#2563eb",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                            mb: 0.8,
                                        }}
                                    >
                                        PARTY DETAILS
                                    </Typography>
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2, borderBottom: "1px dashed #f1f5f9" }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Party Name:</Typography>
                                            <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 800, textAlign: "right" }}>{retailerName}</Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2, borderBottom: "1px dashed #f1f5f9" }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Party Address:</Typography>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#334155", fontWeight: 600, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partyAddress}</Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2, borderBottom: "1px dashed #f1f5f9" }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Payment Condition:</Typography>
                                            <Typography sx={{ fontSize: "0.76rem", color: "#0f172a", fontWeight: 700 }}>{paymentCondition}</Typography>
                                        </Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.2 }}>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Remarks:</Typography>
                                            <Typography sx={{ fontSize: "0.75rem", color: "#475569", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{remarks}</Typography>
                                        </Box>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* ORDER ITEMS Table */}
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                            <Typography
                                sx={{
                                    fontSize: "0.74rem",
                                    fontWeight: 800,
                                    color: "#2563eb",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    mb: 0.6,
                                }}
                            >
                                ORDER ITEMS
                            </Typography>
                            <TableContainer
                                component={Paper}
                                elevation={0}
                                sx={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 1.5,
                                    overflowX: "hidden",
                                    overflowY: "hidden",
                                    width: "100%",
                                }}
                            >
                                <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                                            <TableCell sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "5%", py: 0.6 }}>SNo</TableCell>
                                            <TableCell sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "31%", py: 0.6 }}>Item Name</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "9%", py: 0.6 }}>Tonnage</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "11%", py: 0.6 }}>Qty (KG)</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "13%", py: 0.6 }}>Rate Deliver/Spot</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "13%", py: 0.6 }}>Amount</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "6%", py: 0.6 }}>Discount</TableCell>
                                            <TableCell sx={{ fontWeight: 800, fontSize: "0.74rem", color: "#1e3a8a", width: "12%", py: 0.6 }}>Quality Condition</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayPoItems.map((poIt: any, idx: number) => {
                                            const isSelected = Boolean(
                                                item.inwardItem &&
                                                poIt.itemName &&
                                                (poIt.itemName.toLowerCase().includes(item.inwardItem.toLowerCase()) ||
                                                    item.inwardItem.toLowerCase().includes(poIt.itemName.toLowerCase()))
                                            );
                                            const { tons: poTons, kg: poKg } = extractTonsAndKg(poIt.tonnage, poIt.orderedQty);

                                            return (
                                                <TableRow
                                                    key={idx}
                                                    sx={{
                                                        bgcolor: isSelected ? "#eff6ff" : (idx % 2 === 1 ? "#fafbfc" : "#ffffff"),
                                                        "&:hover": { bgcolor: "#f1f5f9" },
                                                    }}
                                                >
                                                    <TableCell sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#475569", py: 0.4, whiteSpace: "nowrap" }}>
                                                        {idx + 1}
                                                    </TableCell>
                                                    <TableCell sx={{ py: 0.4 }}>
                                                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                                                            <Typography
                                                                sx={{
                                                                    fontSize: "0.76rem",
                                                                    fontWeight: isSelected ? 800 : 700,
                                                                    color: isSelected ? "#1e3a8a" : "#0f172a",
                                                                    display: "-webkit-box",
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: "vertical",
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    lineHeight: 1.25,
                                                                    wordBreak: "break-word",
                                                                    whiteSpace: "normal",
                                                                    flex: 1,
                                                                }}
                                                                title={poIt.itemName || "-"}
                                                            >
                                                                {poIt.itemName || "-"}
                                                            </Typography>
                                                            {isSelected && (
                                                                <Chip
                                                                    size="small"
                                                                    label="Selected"
                                                                    sx={{
                                                                        flexShrink: 0,
                                                                        height: 18,
                                                                        fontSize: "0.62rem",
                                                                        bgcolor: "#dbeafe",
                                                                        color: "#1e40af",
                                                                        fontWeight: 800,
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", py: 0.4, whiteSpace: "nowrap" }}>
                                                        {poTons}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#15803d", py: 0.4, whiteSpace: "nowrap" }}>
                                                        {poKg}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "0.76rem", fontWeight: 600, color: "#334155", py: 0.4, whiteSpace: "nowrap" }}>
                                                        {poIt.rate !== undefined && poIt.rate !== "As recorded" ? (typeof poIt.rate === "number" ? `₹ ${poIt.rate}` : poIt.rate) : "As recorded"}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#15803d", py: 0.4, whiteSpace: "nowrap" }}>
                                                        {poIt.amount !== undefined && poIt.amount !== "As recorded" ? formatCurrency(poIt.amount) : "As recorded"}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontSize: "0.74rem", color: "#64748b", py: 0.4, whiteSpace: "nowrap" }}>
                                                        {poIt.discount || "-"}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: "0.74rem", color: "#475569", py: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {poIt.qualityCondition || "Standard"}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Box>
                )}

                {/* ============================================================== */}
                {/* TAB 1: INWARD DETAILS (INITIAL TABLE OF ALL ROWS)            */}
                {/* ============================================================== */}
                {activeTab === 1 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                            <Box>
                                <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                    Inward Details
                                </Typography>
                                <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                    PO: <strong>{item.purOrderNo}</strong> • Retailer: <strong>{retailerName}</strong> • Click any row to view full details with staff involved
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                                <Chip
                                    size="small"
                                    label={`${displayInwards.length} ${displayInwards.length === 1 ? "Inward Record" : "Inward Records"}`}
                                    sx={{ bgcolor: "#e0f2fe", color: "#0369a1", fontWeight: 800, fontSize: "0.72rem" }}
                                />

                                <Chip
                                    size="small"
                                    icon={isOrderFulfilled ? <CheckCircleOutlineIcon sx={{ fontSize: 13 }} /> : <AccessTimeIcon sx={{ fontSize: 13 }} />}
                                    label={isOrderFulfilled ? "Status: Fully Received" : (isPartiallyReceived ? "Status: Partially Received" : "Status: Pending Inward")}
                                    sx={{
                                        bgcolor: isOrderFulfilled ? "#dcfce7" : (isPartiallyReceived ? "#ffedd5" : "#e0f2fe"),
                                        color: isOrderFulfilled ? "#15803d" : (isPartiallyReceived ? "#c2410c" : "#0369a1"),
                                        border: "1px solid",
                                        borderColor: isOrderFulfilled ? "#86efac" : (isPartiallyReceived ? "#fed7aa" : "#bae6fd"),
                                        fontWeight: 800,
                                        fontSize: "0.72rem",
                                    }}
                                />
                            </Box>
                        </Box>

                        {/* Initial Inward Table: S.NO, Date, Retailer Name, Stock Item with Stock Group, Qty, Rate, Amt and From and To godown */}
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            sx={{
                                border: "1px solid #e2e8f0",
                                borderRadius: 1.5,
                                overflow: "hidden",
                                width: "100%",
                            }}
                        >
                            <Table
                                size="small"
                                sx={{
                                    width: "100%",
                                    tableLayout: "fixed",
                                    "& .MuiTableCell-root": {
                                        py: 0.8,
                                        px: 1.2,
                                        fontSize: "0.75rem",
                                        borderBottom: "1px solid #f1f5f9",
                                        verticalAlign: "middle",
                                    },
                                    "& .MuiTableCell-head": {
                                        py: 0.9,
                                        px: 1.2,
                                        fontSize: "0.74rem",
                                        fontWeight: 800,
                                        color: "#1e3a8a",
                                        bgcolor: "#f1f5f9",
                                        borderBottom: "1px solid #cbd5e1",
                                    },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell align="center" sx={{ width: "5%" }}>S.NO</TableCell>
                                        <TableCell align="left" sx={{ width: "10%" }}>Date</TableCell>
                                        <TableCell align="left" sx={{ width: "18%" }}>Retailer Name</TableCell>
                                        <TableCell align="left" sx={{ width: "23%" }}>Stock Item with Stock Group</TableCell>
                                        <TableCell align="right" sx={{ width: "10%" }}>Qty</TableCell>
                                        <TableCell align="right" sx={{ width: "10%" }}>Rate</TableCell>
                                        <TableCell align="right" sx={{ width: "10%" }}>Amt</TableCell>
                                        <TableCell align="left" sx={{ width: "14%" }}>From and To godown</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {displayInwards.length > 0 ? (
                                        displayInwards.map((inw: any, idx: number) => (
                                            <TableRow
                                                key={idx}
                                                onClick={() => setSelectedInwardRow(inw)}
                                                sx={{
                                                    bgcolor: idx % 2 === 1 ? "#fafbfc" : "#ffffff",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s ease",
                                                    "&:hover": {
                                                        bgcolor: "#eff6ff",
                                                    },
                                                }}
                                                title="Click to view full inward details and staff involved"
                                            >
                                                {/* 1. S.NO */}
                                                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                    {idx + 1}
                                                </TableCell>

                                                {/* 2. Date */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#0284c7" }}>
                                                        {inw.entryDate}
                                                    </Typography>
                                                </TableCell>

                                                {/* 3. Retailer Name */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a" }}>
                                                        {inw.retailerName}
                                                    </Typography>
                                                </TableCell>

                                                {/* 4. Stock Item with Stock Group */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }}>
                                                        {inw.stockItem}
                                                    </Typography>
                                                    <Box sx={{ mt: 0.3, display: "flex", alignItems: "center", gap: 0.5 }}>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Group:</Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#1e3a8a", fontWeight: 700 }}>
                                                            {inw.stockGroup}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>

                                                {/* 5. Qty */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#15803d" }}>
                                                        {inw.qty}
                                                    </Typography>
                                                </TableCell>

                                                {/* 6. Rate */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                                                        {inw.rate}
                                                    </Typography>
                                                </TableCell>

                                                {/* 7. Amt */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a" }}>
                                                        {inw.amount}
                                                    </Typography>
                                                </TableCell>

                                                {/* 8. From and To godown */}
                                                <TableCell align="left">
                                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                                                            <Typography sx={{ fontSize: "0.64rem", color: "#64748b", width: 32, flexShrink: 0 }}>From:</Typography>
                                                            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e3a8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={inw.fromGodown}>
                                                                {inw.fromGodown}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                                                            <Typography sx={{ fontSize: "0.64rem", color: "#059669", fontWeight: 800, width: 32, flexShrink: 0 }}>To ➔</Typography>
                                                            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#059669", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={inw.toGodown}>
                                                                {inw.toGodown}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 3, color: "#64748b" }}>
                                                No inward records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* ============================================================== */}
                {/* TAB 2: PURCHASE INVOICE (INITIAL TABLE OF ALL ROWS)           */}
                {/* ============================================================== */}
                {activeTab === 2 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                            <Box>
                                <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                    Purchase Invoice
                                </Typography>
                                <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                    PO: <strong>{item.purOrderNo}</strong> • Vendor: <strong>{retailerName}</strong> • Click any row to view full details with staff involved
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                                <Chip
                                    size="small"
                                    label={`${displayInvoices.length} ${displayInvoices.length === 1 ? "Invoice Linked" : "Invoices Linked"}`}
                                    sx={{ bgcolor: "#e0f2fe", color: "#0369a1", fontWeight: 800, fontSize: "0.72rem" }}
                                />
                            </Box>
                        </Box>

                        {/* Initial Purchase Invoice Table:
                            S.NO, Date (only Entry Date), Inv No, Party, Days, Stock item with Group, Bill Qty, Act Qty, Rate, Disc, Total Amt */}
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            sx={{
                                border: "1px solid #e2e8f0",
                                borderRadius: 1.5,
                                overflow: "hidden",
                                width: "100%",
                            }}
                        >
                            <Table
                                size="small"
                                sx={{
                                    width: "100%",
                                    tableLayout: "fixed",
                                    "& .MuiTableCell-root": {
                                        py: 0.8,
                                        px: 1,
                                        fontSize: "0.75rem",
                                        borderBottom: "1px solid #f1f5f9",
                                        verticalAlign: "middle",
                                    },
                                    "& .MuiTableCell-head": {
                                        py: 0.9,
                                        px: 1,
                                        fontSize: "0.74rem",
                                        fontWeight: 800,
                                        color: "#1e3a8a",
                                        bgcolor: "#f1f5f9",
                                        borderBottom: "1px solid #cbd5e1",
                                    },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell align="center" sx={{ width: "4%" }}>S.NO</TableCell>
                                        <TableCell align="left" sx={{ width: "9%" }}>Date</TableCell>
                                        <TableCell align="left" sx={{ width: "11%" }}>Inv No</TableCell>
                                        <TableCell align="left" sx={{ width: "15%" }}>Party</TableCell>
                                        <TableCell align="center" sx={{ width: "5%" }}>Days</TableCell>
                                        <TableCell align="left" sx={{ width: "19%" }}>Stock item with Group</TableCell>
                                        <TableCell align="right" sx={{ width: "9%" }}>Bill Qty</TableCell>
                                        <TableCell align="right" sx={{ width: "9%" }}>Act Qty</TableCell>
                                        <TableCell align="right" sx={{ width: "7%" }}>Rate</TableCell>
                                        <TableCell align="center" sx={{ width: "4%" }}>Disc</TableCell>
                                        <TableCell align="right" sx={{ width: "8%" }}>Total Amt</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {displayInvoices.length > 0 ? (
                                        displayInvoices.map((inv: any, idx: number) => (
                                            <TableRow
                                                key={idx}
                                                onClick={() => setSelectedInvoiceRow(inv)}
                                                sx={{
                                                    bgcolor: idx % 2 === 1 ? "#fafbfc" : "#ffffff",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s ease",
                                                    "&:hover": {
                                                        bgcolor: "#eff6ff",
                                                    },
                                                }}
                                                title="Click to view full invoice details and staff involved"
                                            >
                                                {/* 1. S.NO */}
                                                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                    {idx + 1}
                                                </TableCell>

                                                {/* 2. Date (only Entry Date) */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#0284c7" }}>
                                                        {inv.entryDate}
                                                    </Typography>
                                                </TableCell>

                                                {/* 3. Inv No */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a" }} title={String(inv.vouNo)}>
                                                        {inv.vouNo}
                                                    </Typography>
                                                </TableCell>

                                                {/* 4. Party */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#0f172a" }} title={inv.partyName}>
                                                        {inv.partyName}
                                                    </Typography>
                                                </TableCell>

                                                {/* 5. Days */}
                                                <TableCell align="center">
                                                    <Tooltip title={`Credit Terms: ${inv.paymentDays || "0"} Days`} arrow>
                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155" }}>
                                                            {inv.paymentDays || "-"}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>

                                                {/* 6. Stock item with Group */}
                                                <TableCell align="left">
                                                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }}>
                                                        {inv.stockItemName}
                                                    </Typography>
                                                    <Box sx={{ mt: 0.3, display: "flex", alignItems: "center", gap: 0.5 }}>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Group:</Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#1e3a8a", fontWeight: 700 }}>
                                                            {inv.stockGroup}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>

                                                {/* 7. Bill Qty */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a" }}>
                                                        {inv.billQty}
                                                    </Typography>
                                                </TableCell>

                                                {/* 8. Act Qty */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#15803d" }}>
                                                        {inv.actQty}
                                                    </Typography>
                                                </TableCell>

                                                {/* 9. Rate */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#334155" }}>
                                                        {inv.rate}
                                                    </Typography>
                                                </TableCell>

                                                {/* 10. Disc */}
                                                <TableCell align="center">
                                                    <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                                        {inv.discount || "0"}
                                                    </Typography>
                                                </TableCell>

                                                {/* 11. Total Amt */}
                                                <TableCell align="right">
                                                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 900, color: "#15803d" }}>
                                                        {inv.totalAmount}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={11} align="center" sx={{ py: 3, color: "#64748b" }}>
                                                No invoice records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {/* ============================================================== */}
                {/* TAB 3: PAYMENT (SINGLE RECORD VIEW WITH < > STEPPER & STAFF)   */}
                {/* ============================================================== */}
                {activeTab === 3 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                            <Box>
                                <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                    Payment Details
                                </Typography>
                                <Typography sx={{ fontSize: "0.74rem", color: "#64748b" }}>
                                    PO: <strong>{item.purOrderNo}</strong> • Party: <strong>{retailerName}</strong>
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                                <Chip
                                    size="small"
                                    label={`${displayPayments.length} ${displayPayments.length === 1 ? "Payment Record" : "Payment Records"}`}
                                    sx={{ bgcolor: "#e0f2fe", color: "#0369a1", fontWeight: 800, fontSize: "0.72rem" }}
                                />

                                <Chip
                                    size="small"
                                    icon={stageStatuses.payment.status === "COMPLETED" ? <CheckCircleOutlineIcon sx={{ fontSize: 13 }} /> : <AccessTimeIcon sx={{ fontSize: 13 }} />}
                                    label={stageStatuses.payment.label}
                                    sx={{
                                        bgcolor: stageStatuses.payment.bg,
                                        color: stageStatuses.payment.color,
                                        border: "1px solid",
                                        borderColor: stageStatuses.payment.status === "COMPLETED" ? "#86efac" : "#fca5a5",
                                        fontWeight: 800,
                                        fontSize: "0.72rem",
                                    }}
                                />
                            </Box>
                        </Box>

                        {/* Payment Details Table (All Records as Rows) */}
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            sx={{
                                border: "1px solid #e2e8f0",
                                borderRadius: 1.5,
                                overflow: "hidden",
                                width: "100%",
                            }}
                        >
                            <Table
                                size="small"
                                sx={{
                                    width: "100%",
                                    tableLayout: "fixed",
                                    "& .MuiTableCell-root": {
                                        py: 0.6,
                                        px: 1,
                                        fontSize: "0.73rem",
                                        borderBottom: "1px solid #f1f5f9",
                                        verticalAlign: "top",
                                    },
                                    "& .MuiTableCell-head": {
                                        py: 0.8,
                                        px: 1,
                                        fontSize: "0.73rem",
                                        fontWeight: 800,
                                        color: "#1e3a8a",
                                        bgcolor: "#f1f5f9",
                                        borderBottom: "1px solid #cbd5e1",
                                    },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell align="center" sx={{ width: "4%" }}>S.no</TableCell>
                                        <TableCell align="left" sx={{ width: "12%" }}>Entry Date</TableCell>
                                        <TableCell align="left" sx={{ width: "18%" }}>Voucher No & Type</TableCell>
                                        <TableCell align="left" sx={{ width: "22%" }}>Pur Party name</TableCell>
                                        <TableCell align="right" sx={{ width: "15%" }}>Total Invoice Amount</TableCell>
                                        <TableCell align="right" sx={{ width: "15%" }}>Paid Amt</TableCell>
                                        <TableCell align="right" sx={{ width: "14%" }}>Balance & Staff</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {displayPayments.length > 0 ? (
                                        displayPayments.map((p, pIdx) => (
                                            <React.Fragment key={pIdx}>
                                                <TableRow sx={{ bgcolor: "#ffffff", "&:hover": { bgcolor: "#f8fafc" } }}>
                                                    {/* 1. S.no */}
                                                    <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                        {pIdx + 1}
                                                    </TableCell>

                                                    {/* 2. Entry Date */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0284c7" }}>
                                                            {p.entryDate}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 3. Vou No & Vou Type */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a", lineHeight: 1.2 }} title={String(p.vouNo)}>
                                                            {p.vouNo}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b", mt: 0.2 }}>
                                                            {p.vouType}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 4. Pur Party name */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a" }}>
                                                            {p.purPartyName}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 5. Total Invoice Amount */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a" }}>
                                                            {p.totalInvoiceAmount}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 6. Paid Amt */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 900, color: "#15803d" }}>
                                                            {p.paidAmt}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* 7. Balance inv Amt & Staff Involved */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: p.balanceInvAmt === "₹ 0.00" ? "#15803d" : "#b91c1c" }}>
                                                            {p.balanceInvAmt}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b", mt: 0.2 }}>
                                                            Staff: <strong style={{ color: "#0f172a" }}>{p.staffInvolved}</strong>
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>

                                                {/* NARRATION SUB-ROW (* below the row) */}
                                                <TableRow sx={{ bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                                                    <TableCell colSpan={7} sx={{ py: 0.35, px: 2, borderTop: "none" }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                                            <Typography sx={{ color: "#2563eb", fontWeight: 900, fontSize: "0.85rem", lineHeight: 1 }}>*</Typography>
                                                            <Typography sx={{ fontSize: "0.72rem", color: "#475569", fontStyle: "italic" }}>
                                                                <strong style={{ fontStyle: "normal", color: "#1e3a8a" }}>Narration:</strong> {p.narration || remarks}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center" sx={{ py: 2, color: "#64748b" }}>
                                                No payment records found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </DialogContent>

            {/* ============================================================== */}
            {/* POPUP MODAL: INWARD DETAILED VIEW WITH STAFF INVOLVED         */}
            {/* ============================================================== */}
            <Dialog
                open={Boolean(selectedInwardRow)}
                onClose={() => setSelectedInwardRow(null)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2.5,
                        boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
                        bgcolor: "#ffffff",
                        overflow: "hidden",
                        maxHeight: "90vh",
                        display: "flex",
                        flexDirection: "column",
                    },
                }}
            >
                {selectedInwardRow && (
                    <React.Fragment>
                        <DialogTitle
                            sx={{
                                px: 3,
                                py: 1.8,
                                bgcolor: "#f8fafc",
                                borderBottom: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                                <Box
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 2,
                                        bgcolor: "#eff6ff",
                                        border: "1px solid #bfdbfe",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#1e3a8a",
                                    }}
                                >
                                    <LocalShippingOutlinedIcon sx={{ fontSize: 22 }} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                        Inward Delivery Details
                                    </Typography>
                                    <Typography sx={{ fontSize: "0.74rem", color: "#64748b", mt: 0.2 }}>
                                        Voucher No: <strong style={{ color: "#1e3a8a" }}>{selectedInwardRow.vouNo}</strong> • Date: <strong>{selectedInwardRow.entryDate}</strong> • Retailer: <strong>{selectedInwardRow.retailerName}</strong>
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {displayInwards.length > 1 && (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, bgcolor: "#ffffff", p: 0.4, borderRadius: 1.5, border: "1px solid #cbd5e1" }}>
                                        <IconButton
                                            size="small"
                                            disabled={displayInwards.findIndex(r => r.sNo === selectedInwardRow.sNo) <= 0}
                                            onClick={() => {
                                                const curIdx = displayInwards.findIndex(r => r.sNo === selectedInwardRow.sNo);
                                                if (curIdx > 0) setSelectedInwardRow(displayInwards[curIdx - 1]);
                                            }}
                                            sx={{ p: 0.3 }}
                                            title="Previous Inward Record"
                                        >
                                            <ChevronLeftIcon fontSize="small" />
                                        </IconButton>
                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1e3a8a", px: 0.8 }}>
                                            Inward {displayInwards.findIndex(r => r.sNo === selectedInwardRow.sNo) + 1} of {displayInwards.length}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            disabled={displayInwards.findIndex(r => r.sNo === selectedInwardRow.sNo) >= displayInwards.length - 1}
                                            onClick={() => {
                                                const curIdx = displayInwards.findIndex(r => r.sNo === selectedInwardRow.sNo);
                                                if (curIdx < displayInwards.length - 1) setSelectedInwardRow(displayInwards[curIdx + 1]);
                                            }}
                                            sx={{ p: 0.3 }}
                                            title="Next Inward Record"
                                        >
                                            <ChevronRightIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => setSelectedInwardRow(null)}
                                    sx={{
                                        color: "#64748b",
                                        "&:hover": { bgcolor: "#fee2e2", color: "#b91c1c" },
                                    }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </DialogTitle>

                        <DialogContent sx={{ p: 2.5, bgcolor: "#ffffff", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                            {/* Side-by-side: Main Inward Detailed View (Left) + Staff Involved Companion Table (Right) */}
                            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", width: "100%", flexDirection: { xs: "column", md: "row" } }}>
                                {/* Left: Detailed Views */}
                                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                    {/* 1. Main 8-column Full Inward Table with Narration */}
                                    <TableContainer
                                        component={Paper}
                                        elevation={0}
                                        sx={{
                                            border: "1px solid #e2e8f0",
                                            borderRadius: 1.5,
                                            overflow: "hidden",
                                            width: "100%",
                                        }}
                                    >
                                        <Table
                                            size="small"
                                            sx={{
                                                width: "100%",
                                                tableLayout: "fixed",
                                                "& .MuiTableCell-root": {
                                                    py: 0.7,
                                                    px: 1,
                                                    fontSize: "0.74rem",
                                                    borderBottom: "1px solid #f1f5f9",
                                                    verticalAlign: "top",
                                                },
                                                "& .MuiTableCell-head": {
                                                    py: 0.8,
                                                    px: 1,
                                                    fontSize: "0.73rem",
                                                    fontWeight: 800,
                                                    color: "#1e3a8a",
                                                    bgcolor: "#f1f5f9",
                                                    borderBottom: "1px solid #cbd5e1",
                                                },
                                            }}
                                        >
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell align="center" sx={{ width: "4%" }}>S.no</TableCell>
                                                    <TableCell align="left" sx={{ width: "13%" }}>Date & Voucher</TableCell>
                                                    <TableCell align="left" sx={{ width: "17%" }}>Retailer & Vehicle</TableCell>
                                                    <TableCell align="left" sx={{ width: "18%" }}>Stock Item & Batch</TableCell>
                                                    <TableCell align="right" sx={{ width: "14%" }}>Qty, Rate & Amount</TableCell>
                                                    <TableCell align="left" sx={{ width: "14%" }}>Godown (From ➔ To)</TableCell>
                                                    <TableCell align="center" sx={{ width: "10%" }}>Trip (Time & Kms)</TableCell>
                                                    <TableCell align="right" sx={{ width: "10%" }}>Staff & Bal PO</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                <TableRow sx={{ bgcolor: "#ffffff" }}>
                                                    {/* S.no */}
                                                    <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                        {selectedInwardRow.sNo}
                                                    </TableCell>

                                                    {/* Date & Voucher */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#0284c7", lineHeight: 1.2 }}>
                                                            {selectedInwardRow.entryDate}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.70rem", fontWeight: 700, color: "#1e3a8a", mt: 0.3 }} title={String(selectedInwardRow.vouNo)}>
                                                            {selectedInwardRow.vouNo}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.65rem", color: "#64748b" }}>
                                                            {selectedInwardRow.vouType}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* Retailer & Vehicle */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.25 }} title={selectedInwardRow.retailerName}>
                                                            {selectedInwardRow.retailerName}
                                                        </Typography>
                                                        <Box sx={{ mt: 0.4 }}>
                                                            <Typography
                                                                component="span"
                                                                sx={{
                                                                    fontSize: "0.68rem",
                                                                    fontWeight: 700,
                                                                    color: "#1e3a8a",
                                                                    bgcolor: "#eff6ff",
                                                                    px: 0.6,
                                                                    py: 0.15,
                                                                    borderRadius: 1,
                                                                    border: "1px solid #bfdbfe",
                                                                    display: "inline-block",
                                                                }}
                                                            >
                                                                🚛 {selectedInwardRow.vehicleNo}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>

                                                    {/* Stock Item & Batch */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }} title={selectedInwardRow.stockItem}>
                                                            {selectedInwardRow.stockItem}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.67rem", color: "#64748b", mt: 0.2 }}>
                                                            Group: <strong>{selectedInwardRow.stockGroup}</strong>
                                                        </Typography>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.3 }}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b" }}>Batch:</Typography>
                                                            {selectedInwardRow.batch !== "-" ? (
                                                                <Chip size="small" label={selectedInwardRow.batch} sx={{ height: 16, fontSize: "0.64rem", fontWeight: 700, bgcolor: "#f1f5f9" }} />
                                                            ) : (
                                                                <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8" }}>-</Typography>
                                                            )}
                                                        </Box>
                                                    </TableCell>

                                                    {/* Qty, Rate & Amount */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#15803d", lineHeight: 1.2 }}>
                                                            {selectedInwardRow.qty}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", mt: 0.2 }}>
                                                            {selectedInwardRow.amount}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.66rem", color: "#475569" }}>
                                                            Rate: {selectedInwardRow.rate}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* Godown (From Godown ➔ To Godown) */}
                                                    <TableCell align="left">
                                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                                                                <Typography sx={{ fontSize: "0.64rem", color: "#64748b", width: 32, flexShrink: 0 }}>From:</Typography>
                                                                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e3a8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedInwardRow.fromGodown}>
                                                                    {selectedInwardRow.fromGodown}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                                                                <Typography sx={{ fontSize: "0.64rem", color: "#059669", fontWeight: 800, width: 32, flexShrink: 0 }}>To ➔</Typography>
                                                                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#059669", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedInwardRow.toGodown}>
                                                                    {selectedInwardRow.toGodown}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>

                                                    {/* Trip Stats */}
                                                    <TableCell align="center">
                                                        <Typography sx={{ fontSize: "0.68rem", color: selectedInwardRow.startTime === "-" && selectedInwardRow.endTime === "-" ? "#94a3b8" : "#334155" }}>
                                                            ⏱ {selectedInwardRow.startTime !== "-" || selectedInwardRow.endTime !== "-" ? `${selectedInwardRow.startTime} - ${selectedInwardRow.endTime}` : "-"}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: selectedInwardRow.startKms === "-" && selectedInwardRow.endKms === "-" ? "#94a3b8" : "#334155", mt: 0.2 }}>
                                                            📍 {selectedInwardRow.startKms !== "-" || selectedInwardRow.endKms !== "-" ? `${selectedInwardRow.startKms} - ${selectedInwardRow.endKms} km` : "-"}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* Staff & Bal PO */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#0f172a" }}>
                                                            {selectedInwardRow.staffInvolved}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b", mt: 0.2 }}>
                                                            Bal PO: <strong style={{ color: "#0f172a" }}>{selectedInwardRow.balPurOrderTonnage}</strong>
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>

                                                {/* NARRATION SUB-ROW (* below the row) */}
                                                <TableRow sx={{ bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                                                    <TableCell colSpan={8} sx={{ py: 0.4, px: 2, borderTop: "none" }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                                            <Typography sx={{ color: "#2563eb", fontWeight: 900, fontSize: "0.85rem", lineHeight: 1 }}>*</Typography>
                                                            <Typography sx={{ fontSize: "0.73rem", color: "#475569", fontStyle: "italic" }}>
                                                                <strong style={{ fontStyle: "normal", color: "#1e3a8a" }}>Narration:</strong> {selectedInwardRow.narr || "-"}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    {/* 2. Structured Key-Value Details Cards Grid */}
                                    <Paper elevation={0} sx={{ p: 1.5, border: "1px solid #e2e8f0", borderRadius: 1.5, bgcolor: "#f8fafc" }}>
                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.04em", mb: 1 }}>
                                            Detailed Attributes
                                        </Typography>
                                        <Grid container spacing={1.5}>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Entry Date</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.entryDate}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Voucher No & Type</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{selectedInwardRow.vouNo} ({selectedInwardRow.vouType})</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Retailer Name</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.retailerName}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Vehicle Number</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.vehicleNo}</Typography>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Stock Item</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.stockItem}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Stock Group</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{selectedInwardRow.stockGroup}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Batch Number</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.batch}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Arrived Quantity</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 800 }}>{selectedInwardRow.qty}</Typography>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Rate</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.rate}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Total Amount</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 800 }}>{selectedInwardRow.amount}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>From Location</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{selectedInwardRow.fromGodown}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>To Location (Godown)</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#059669", fontWeight: 700 }}>{selectedInwardRow.toGodown}</Typography>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Trip Time (Start - End)</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.startTime} - {selectedInwardRow.endTime}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Trip Distance (Start - End Kms)</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.startKms} - {selectedInwardRow.endKms} km</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Bal PO Tonnage</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#c2410c", fontWeight: 700 }}>{selectedInwardRow.balPurOrderTonnage}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Staff Involved</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInwardRow.staffInvolved}</Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Box>

                                {/* Right: Staff Involved Table Companion Card */}
                                <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
                                    {renderStaffInvolvedCard("Staff Involved", getInwardStaffList(selectedInwardRow))}
                                </Box>
                            </Box>
                        </DialogContent>
                    </React.Fragment>
                )}
            </Dialog>

            {/* ============================================================== */}
            {/* POPUP MODAL: PURCHASE INVOICE DETAILED VIEW WITH STAFF         */}
            {/* ============================================================== */}
            <Dialog
                open={Boolean(selectedInvoiceRow)}
                onClose={() => setSelectedInvoiceRow(null)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2.5,
                        boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
                        bgcolor: "#ffffff",
                        overflow: "hidden",
                        maxHeight: "90vh",
                        display: "flex",
                        flexDirection: "column",
                    },
                }}
            >
                {selectedInvoiceRow && (
                    <React.Fragment>
                        <DialogTitle
                            sx={{
                                px: 3,
                                py: 1.8,
                                bgcolor: "#f8fafc",
                                borderBottom: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                                <Box
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 2,
                                        bgcolor: "#f5f3ff",
                                        border: "1px solid #ddd6fe",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#6d28d9",
                                    }}
                                >
                                    <ReceiptLongOutlinedIcon sx={{ fontSize: 22 }} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                        Purchase Invoice Details
                                    </Typography>
                                    <Typography sx={{ fontSize: "0.74rem", color: "#64748b", mt: 0.2 }}>
                                        Invoice No: <strong style={{ color: "#1e3a8a" }}>{selectedInvoiceRow.vouNo}</strong> • Entry Date: <strong>{selectedInvoiceRow.entryDate}</strong> • Party: <strong>{selectedInvoiceRow.partyName}</strong>
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {displayInvoices.length > 1 && (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, bgcolor: "#ffffff", p: 0.4, borderRadius: 1.5, border: "1px solid #cbd5e1" }}>
                                        <IconButton
                                            size="small"
                                            disabled={displayInvoices.findIndex(r => r.sNo === selectedInvoiceRow.sNo) <= 0}
                                            onClick={() => {
                                                const curIdx = displayInvoices.findIndex(r => r.sNo === selectedInvoiceRow.sNo);
                                                if (curIdx > 0) setSelectedInvoiceRow(displayInvoices[curIdx - 1]);
                                            }}
                                            sx={{ p: 0.3 }}
                                            title="Previous Invoice Record"
                                        >
                                            <ChevronLeftIcon fontSize="small" />
                                        </IconButton>
                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1e3a8a", px: 0.8 }}>
                                            Invoice {displayInvoices.findIndex(r => r.sNo === selectedInvoiceRow.sNo) + 1} of {displayInvoices.length}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            disabled={displayInvoices.findIndex(r => r.sNo === selectedInvoiceRow.sNo) >= displayInvoices.length - 1}
                                            onClick={() => {
                                                const curIdx = displayInvoices.findIndex(r => r.sNo === selectedInvoiceRow.sNo);
                                                if (curIdx < displayInvoices.length - 1) setSelectedInvoiceRow(displayInvoices[curIdx + 1]);
                                            }}
                                            sx={{ p: 0.3 }}
                                            title="Next Invoice Record"
                                        >
                                            <ChevronRightIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => setSelectedInvoiceRow(null)}
                                    sx={{
                                        color: "#64748b",
                                        "&:hover": { bgcolor: "#fee2e2", color: "#b91c1c" },
                                    }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </DialogTitle>

                        <DialogContent sx={{ p: 2.5, bgcolor: "#ffffff", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                            {/* Side-by-side: Main Invoice Detailed View (Left) + Staff Involved Companion Table (Right) */}
                            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", width: "100%", flexDirection: { xs: "column", md: "row" } }}>
                                {/* Left: Detailed Views */}
                                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                    {/* 1. Main 8-column Full Invoice Table with Narration */}
                                    <TableContainer
                                        component={Paper}
                                        elevation={0}
                                        sx={{
                                            border: "1px solid #e2e8f0",
                                            borderRadius: 1.5,
                                            overflow: "hidden",
                                            width: "100%",
                                        }}
                                    >
                                        <Table
                                            size="small"
                                            sx={{
                                                width: "100%",
                                                tableLayout: "fixed",
                                                "& .MuiTableCell-root": {
                                                    py: 0.7,
                                                    px: 1,
                                                    fontSize: "0.74rem",
                                                    borderBottom: "1px solid #f1f5f9",
                                                    verticalAlign: "top",
                                                },
                                                "& .MuiTableCell-head": {
                                                    py: 0.8,
                                                    px: 1,
                                                    fontSize: "0.73rem",
                                                    fontWeight: 800,
                                                    color: "#1e3a8a",
                                                    bgcolor: "#f1f5f9",
                                                    borderBottom: "1px solid #cbd5e1",
                                                },
                                            }}
                                        >
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell align="center" sx={{ width: "4%" }}>S.no</TableCell>
                                                    <TableCell align="left" sx={{ width: "11%" }}>Dates (Bill & Entry)</TableCell>
                                                    <TableCell align="left" sx={{ width: "14%" }}>Voucher & Ref No</TableCell>
                                                    <TableCell align="left" sx={{ width: "16%" }}>Party & Terms</TableCell>
                                                    <TableCell align="left" sx={{ width: "18%" }}>Stock Item & Godown</TableCell>
                                                    <TableCell align="right" sx={{ width: "11%" }}>Quantities (Bill / Act)</TableCell>
                                                    <TableCell align="right" sx={{ width: "10%" }}>Rate & Disc</TableCell>
                                                    <TableCell align="right" sx={{ width: "16%" }}>Total Amount & Taxes</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                <TableRow sx={{ bgcolor: "#ffffff" }}>
                                                    {/* S.no */}
                                                    <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                        {selectedInvoiceRow.sNo}
                                                    </TableCell>

                                                    {/* Dates (Bill Date & Entry Date) */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0284c7", lineHeight: 1.2 }}>
                                                            Bill: {selectedInvoiceRow.billDate}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", mt: 0.2 }}>
                                                            Entry: {selectedInvoiceRow.entryDate}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* Voucher (Vou No, Ref No, Vou Type) */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a", lineHeight: 1.2 }} title={String(selectedInvoiceRow.vouNo)}>
                                                            {selectedInvoiceRow.vouNo}
                                                        </Typography>
                                                        {selectedInvoiceRow.refNo && selectedInvoiceRow.refNo !== selectedInvoiceRow.vouNo && (
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#475569", mt: 0.2 }} title={selectedInvoiceRow.refNo}>
                                                                    Ref: {selectedInvoiceRow.refNo}
                                                            </Typography>
                                                        )}
                                                        <Typography sx={{ fontSize: "0.64rem", color: "#64748b" }}>
                                                            {selectedInvoiceRow.vouType}
                                                        </Typography>
                                                    </TableCell>

                                                    {/* Party Name, Staff Involved, Payment Days */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.25 }} title={selectedInvoiceRow.partyName}>
                                                            {selectedInvoiceRow.partyName}
                                                        </Typography>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 0.3, flexWrap: "wrap" }}>
                                                            <Typography sx={{ fontSize: "0.66rem", color: "#475569" }}>
                                                                Staff: <strong style={{ color: "#0f172a" }}>{selectedInvoiceRow.staffInvolved}</strong>
                                                            </Typography>
                                                            <Typography sx={{ fontSize: "0.66rem", color: "#475569" }}>
                                                                Days: <strong style={{ color: "#0f172a" }}>{selectedInvoiceRow.paymentDays}</strong>
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>

                                                    {/* Stock Item Name, Godown & Batch */}
                                                    <TableCell align="left">
                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }} title={selectedInvoiceRow.stockItemName}>
                                                            {selectedInvoiceRow.stockItemName}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.67rem", color: "#64748b", mt: 0.2 }}>
                                                            Group: <strong>{selectedInvoiceRow.stockGroup}</strong>
                                                        </Typography>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.3, flexWrap: "wrap" }}>
                                                            <Typography sx={{ fontSize: "0.66rem", color: "#1e3a8a", fontWeight: 600 }}>
                                                                🏢 {selectedInvoiceRow.godown}
                                                            </Typography>
                                                            {selectedInvoiceRow.batch !== "-" && (
                                                                <Chip size="small" label={`Batch: ${selectedInvoiceRow.batch}`} sx={{ height: 16, fontSize: "0.62rem", fontWeight: 700, bgcolor: "#f1f5f9" }} />
                                                            )}
                                                        </Box>
                                                    </TableCell>

                                                    {/* Quantities (Bill Qty, Act Qty, Bal Inward Tonnage) */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                                                            {selectedInvoiceRow.billQty}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#475569", mt: 0.2 }}>
                                                            Act: {selectedInvoiceRow.actQty}
                                                        </Typography>
                                                        {selectedInvoiceRow.balInwardTonnage !== "-" && (
                                                            <Typography sx={{ fontSize: "0.64rem", color: "#b45309", fontWeight: 700 }}>
                                                                Bal Inw: {selectedInvoiceRow.balInwardTonnage}
                                                            </Typography>
                                                        )}
                                                    </TableCell>

                                                    {/* Rate, Amount & Discount */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0f172a" }}>
                                                            {selectedInvoiceRow.rate}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700, mt: 0.2 }}>
                                                            Amt: {selectedInvoiceRow.amount}
                                                        </Typography>
                                                        {selectedInvoiceRow.discount !== "0" && selectedInvoiceRow.discount !== "-" && (
                                                            <Typography sx={{ fontSize: "0.64rem", color: "#64748b" }}>
                                                                Disc: {selectedInvoiceRow.discount}
                                                            </Typography>
                                                        )}
                                                    </TableCell>

                                                    {/* Total Amount & Taxes/Expenses */}
                                                    <TableCell align="right">
                                                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 900, color: "#15803d", lineHeight: 1.2 }}>
                                                            {selectedInvoiceRow.totalAmount}
                                                        </Typography>
                                                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.4, mt: 0.3, flexWrap: "wrap" }}>
                                                            <Typography sx={{ fontSize: "0.62rem", color: "#64748b" }}>
                                                                CGST: {selectedInvoiceRow.cgst} | SGST: {selectedInvoiceRow.sgst} | IGST: {selectedInvoiceRow.igst}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.4, flexWrap: "wrap" }}>
                                                            <Typography sx={{ fontSize: "0.62rem", color: "#64748b" }}>
                                                                Exp: {selectedInvoiceRow.expenses} | Rnd: {selectedInvoiceRow.roundOff}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>

                                                {/* NARRATION SUB-ROW (* below the row) */}
                                                <TableRow sx={{ bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                                                    <TableCell colSpan={8} sx={{ py: 0.4, px: 2, borderTop: "none" }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                                            <Typography sx={{ color: "#2563eb", fontWeight: 900, fontSize: "0.85rem", lineHeight: 1 }}>*</Typography>
                                                            <Typography sx={{ fontSize: "0.73rem", color: "#475569", fontStyle: "italic" }}>
                                                                <strong style={{ fontStyle: "normal", color: "#1e3a8a" }}>Narration:</strong> {selectedInvoiceRow.narr || "-"}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    {/* 2. Structured Key-Value Details Cards Grid */}
                                    <Paper elevation={0} sx={{ p: 1.5, border: "1px solid #e2e8f0", borderRadius: 1.5, bgcolor: "#f8fafc" }}>
                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.04em", mb: 1 }}>
                                            Detailed Attributes
                                        </Typography>
                                        <Grid container spacing={1.5}>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Entry Date</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.entryDate}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Bill Date</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700 }}>{selectedInvoiceRow.billDate}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Invoice (Voucher) No</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{selectedInvoiceRow.vouNo}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Reference No</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.refNo}</Typography>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Party / Vendor</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.partyName}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Stock Item</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.stockItemName}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Stock Group</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{selectedInvoiceRow.stockGroup}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Godown & Batch</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.godown} ({selectedInvoiceRow.batch})</Typography>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Billed Quantity</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.billQty}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Actual Quantity</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 700 }}>{selectedInvoiceRow.actQty}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Rate</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.rate}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Discount</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.discount}</Typography>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Total Invoice Amount</Typography>
                                                <Typography sx={{ fontSize: "0.82rem", color: "#15803d", fontWeight: 900 }}>{selectedInvoiceRow.totalAmount}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Taxes (CGST / SGST / IGST)</Typography>
                                                <Typography sx={{ fontSize: "0.75rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.cgst} / {selectedInvoiceRow.sgst} / {selectedInvoiceRow.igst}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Expenses & Round Off</Typography>
                                                <Typography sx={{ fontSize: "0.75rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.expenses} / {selectedInvoiceRow.roundOff}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Credit Terms (Days)</Typography>
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{selectedInvoiceRow.paymentDays} Days</Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Box>

                                {/* Right: Staff Involved Table Companion Card */}
                                <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
                                    {renderStaffInvolvedCard("Staff Involved", getInvoiceStaffList(selectedInvoiceRow))}
                                </Box>
                            </Box>
                        </DialogContent>
                    </React.Fragment>
                )}
            </Dialog>

        </Dialog>
    );
};

export default PurchaseTransactionDetailsDialog;
