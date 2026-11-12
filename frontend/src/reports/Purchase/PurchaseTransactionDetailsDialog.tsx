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
    TripArrivalService,
    TripArrivalDetail,
    TripArrivalStaffDetail,
} from "../../services/tripArrival.service";
import {
    PurchaseInvoiceOnlineService,
    PurchaseInvoiceResponseData,
} from "../../services/purchaseInvoiceOnline.service";
import {
    PurchasePaymentOnlineService,
    PurchasePaymentListItem,
    PaymentDetailsResponseData,
    JournalDetailsResponseData,
} from "../../services/purchasePaymentOnline.service";
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
    const [selectedPaymentRow, setSelectedPaymentRow] = useState<any | null>(null);

    // Trip Arrival Details & Staff Details Map (keyed by tripId) from Reporting_Online_Trip_Arrival_List
    const [tripArrivalMap, setTripArrivalMap] = useState<Record<string, { details: TripArrivalDetail[]; staffDetails: TripArrivalStaffDetail[] }>>({});
    const [loadingTripArrival, setLoadingTripArrival] = useState<boolean>(false);

    // Purchase Invoice Online Details Map (keyed by transId / PIN_Id) from Reporting_Online_Purchase_List
    const [purchaseInvoiceMap, setPurchaseInvoiceMap] = useState<Record<string, PurchaseInvoiceResponseData>>({});
    const [loadingPurchaseInvoice, setLoadingPurchaseInvoice] = useState<boolean>(false);

    // Purchase Payment List Map (keyed by purchase Trans_Id / PIN_Id) from Reporting_Online_Purchase_Payment_List
    const [purchasePaymentMap, setPurchasePaymentMap] = useState<Record<string, PurchasePaymentListItem[]>>({});
    const [loadingPurchasePayment, setLoadingPurchasePayment] = useState<boolean>(false);

    // Payment Detailed View Map (keyed by payment Trans_Id) from Reporting_Online_Payment_List
    const [paymentDetailsMap, setPaymentDetailsMap] = useState<Record<string, PaymentDetailsResponseData>>({});

    // Journal Detailed View Map (keyed by journal Trans_Id) from Reporting_Online_Journal_List
    const [journalDetailsMap, setJournalDetailsMap] = useState<Record<string, JournalDetailsResponseData>>({});
    const [loadingPaymentOrJournal, setLoadingPaymentOrJournal] = useState<boolean>(false);

    // Helper to resolve Trip_Id from any inward row or current item
    const resolveInwardTripId = (inw?: any): string | number | null => {
        if (!inw && !item) return null;
        const candidates = [
            inw?.tripId,
            inw?.Trip_Id,
            inw?.TripId,
            inw?.trip_id,
            (item as any)?.tripId,
            (item as any)?.Trip_Id,
            inw?.vouNo,
            inw?.billNo,
            (item as any)?.inwardJouNo,
        ];
        for (const c of candidates) {
            if (c === undefined || c === null || c === "" || c === "-") continue;
            const strVal = String(c).trim();
            if (/^\d+$/.test(strVal) && Number(strVal) > 0) {
                return strVal;
            }
            const match = strVal.match(/\d+$/);
            if (match && match[0] && Number(match[0]) > 0) {
                return match[0];
            }
        }
        return null;
    };

    // Helper to resolve Trans_Id / PIN_Id from any invoice row or current item
    const resolveInvoiceTransId = (inv?: any): string | null => {
        if (!inv && !item) return null;
        const candidates = [
            inv?.transId,
            inv?.Trans_Id,
            inv?.PIN_Id,
            inv?.pinId,
            inv?.POI_St_Id,
            (item as any)?.transId,
            (item as any)?.Trans_Id,
            (item as any)?.PIN_Id,
            inv?.vouNo,
            inv?.refNumber,
            inv?.refNo,
            (item as any)?.purInvNo,
        ];
        for (const c of candidates) {
            if (c === undefined || c === null || c === "" || c === "-") continue;
            const strVal = String(c).trim();
            if (/^\d+$/.test(strVal) && Number(strVal) > 0) {
                return strVal;
            }
            const match = strVal.match(/\d+$/);
            if (match && match[0] && Number(match[0]) > 0) {
                return match[0];
            }
        }
        return null;
    };

    // Reset tab and active selected rows when dialog opens or item changes or initialTab changes
    useEffect(() => {
        if (open) {
            setActiveTab(initialTab ?? 0);
            setSelectedInwardRow(null);
            setSelectedInvoiceRow(null);
            setSelectedPaymentRow(null);
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

    // Fetch live Trip Arrival List (details & staffDetails) from Reporting_Online_Trip_Arrival_List
    useEffect(() => {
        let isMounted = true;
        if (!open || !item) return;

        const tripIdsToFetch = new Set<string>();

        const inspectCandidate = (val: any) => {
            if (val === undefined || val === null || val === "" || val === "-") return;
            const strVal = String(val).trim();
            if (/^\d+$/.test(strVal) && Number(strVal) > 0) {
                tripIdsToFetch.add(strVal);
                return;
            }
            const match = strVal.match(/\d+$/);
            if (match && match[0] && Number(match[0]) > 0) {
                tripIdsToFetch.add(match[0]);
            }
        };

        inspectCandidate(item.tripId);
        inspectCandidate((item as any).Trip_Id);
        inspectCandidate(item.inwardJouNo);
        (item.allTripIds || []).forEach(inspectCandidate);
        (item.allInwardJous || []).forEach(inspectCandidate);
        (item.inwardDetails || []).forEach((inw: any) => {
            inspectCandidate(inw.tripId);
            inspectCandidate(inw.Trip_Id);
            inspectCandidate(inw.billNo);
            inspectCandidate(inw.vouNo);
        });
        (siblingRows || []).forEach((sib: any) => {
            inspectCandidate(sib.tripId);
            inspectCandidate(sib.Trip_Id);
            inspectCandidate(sib.inwardJouNo);
            (sib.allTripIds || []).forEach(inspectCandidate);
            (sib.allInwardJous || []).forEach(inspectCandidate);
        });

        const unCachedIds = Array.from(tripIdsToFetch).filter((tId) => !tripArrivalMap[tId]);
        if (unCachedIds.length === 0) return;

        setLoadingTripArrival(true);
        Promise.allSettled(
            unCachedIds.map((tId) =>
                TripArrivalService.getTripArrivalList(tId).then((res) => ({
                    tripId: tId,
                    data: res.data?.data,
                }))
            )
        )
            .then((results) => {
                if (!isMounted) return;
                const newArrivalMap: Record<string, { details: TripArrivalDetail[]; staffDetails: TripArrivalStaffDetail[] }> = {};
                results.forEach((r) => {
                    if (r.status === "fulfilled" && r.value.data) {
                        const fetched = r.value.data;
                        newArrivalMap[r.value.tripId] = {
                            details: Array.isArray(fetched.details) ? fetched.details : [],
                            staffDetails: Array.isArray(fetched.staffDetails) ? fetched.staffDetails : [],
                        };
                    }
                });
                if (Object.keys(newArrivalMap).length > 0) {
                    setTripArrivalMap((prev) => ({ ...prev, ...newArrivalMap }));
                }
            })
            .catch((err) => {
                console.warn("Could not fetch Trip Arrival List:", err);
            })
            .finally(() => {
                if (isMounted) setLoadingTripArrival(false);
            });

        return () => {
            isMounted = false;
        };
    }, [open, item, siblingRows, tripArrivalMap]);

    // Fetch live Purchase Invoice Data (Dataset 1-4) from Reporting_Online_Purchase_List
    useEffect(() => {
        let isMounted = true;
        if (!open || !item) return;

        const transIdsToFetch = new Set<string>();

        const inspectCandidate = (val: any) => {
            if (val === undefined || val === null || val === "" || val === "-") return;
            const strVal = String(val).trim();
            if (/^\d+$/.test(strVal) && Number(strVal) > 0) {
                transIdsToFetch.add(strVal);
                return;
            }
            const match = strVal.match(/\d+$/);
            if (match && match[0] && Number(match[0]) > 0) {
                transIdsToFetch.add(match[0]);
            }
        };

        inspectCandidate(item.transId);
        inspectCandidate((item as any).Trans_Id);
        inspectCandidate((item as any).PIN_Id);
        inspectCandidate(item.purInvNo);
        ((item as any).allTransIds || []).forEach(inspectCandidate);
        (item.allPurInvNos || []).forEach(inspectCandidate);
        (item.invoiceDetails || []).forEach((inv: any) => {
            inspectCandidate(inv.transId);
            inspectCandidate(inv.Trans_Id);
            inspectCandidate(inv.PIN_Id);
            inspectCandidate(inv.vouNo);
            inspectCandidate(inv.refNumber);
        });
        (siblingRows || []).forEach((sib: any) => {
            inspectCandidate(sib.transId);
            inspectCandidate(sib.Trans_Id);
            inspectCandidate(sib.PIN_Id);
            inspectCandidate(sib.purInvNo);
            (sib.allTransIds || []).forEach(inspectCandidate);
            (sib.allPurInvNos || []).forEach(inspectCandidate);
        });

        const unCachedIds = Array.from(transIdsToFetch).filter((tId) => !purchaseInvoiceMap[tId]);
        if (unCachedIds.length === 0) return;

        setLoadingPurchaseInvoice(true);
        Promise.allSettled(
            unCachedIds.map((tId) =>
                PurchaseInvoiceOnlineService.getPurchaseInvoiceList(tId).then((res) => ({
                    transId: tId,
                    data: res.data?.data,
                }))
            )
        )
            .then((results) => {
                if (!isMounted) return;
                const newInvoiceMap: Record<string, PurchaseInvoiceResponseData> = {};
                results.forEach((r) => {
                    if (r.status === "fulfilled" && r.value.data) {
                        const fetched = r.value.data;
                        newInvoiceMap[r.value.transId] = {
                            invoiceData: Array.isArray(fetched.invoiceData) ? fetched.invoiceData : [],
                            losData: Array.isArray(fetched.losData) ? fetched.losData : [],
                            amountData: Array.isArray(fetched.amountData) ? fetched.amountData : [],
                            staffDetails: Array.isArray(fetched.staffDetails) ? fetched.staffDetails : [],
                        };
                    }
                });
                if (Object.keys(newInvoiceMap).length > 0) {
                    setPurchaseInvoiceMap((prev) => ({ ...prev, ...newInvoiceMap }));
                }
            })
            .catch((err) => {
                console.warn("Could not fetch Purchase Invoice List:", err);
            })
            .finally(() => {
                if (isMounted) setLoadingPurchaseInvoice(false);
            });

        return () => {
            isMounted = false;
        };
    }, [open, item, siblingRows, purchaseInvoiceMap]);

    // Fetch live Purchase Payment List (from Reporting_Online_Purchase_Payment_List)
    useEffect(() => {
        let isMounted = true;
        if (!open || !item) return;

        const pinIdsToFetch = new Set<string>();

        const inspectCandidate = (val: any) => {
            if (val === undefined || val === null || val === "" || val === "-") return;
            const strVal = String(val).trim();
            if (/^\d+$/.test(strVal) && Number(strVal) > 0) {
                pinIdsToFetch.add(strVal);
                return;
            }
            const match = strVal.match(/\d+$/);
            if (match && match[0] && Number(match[0]) > 0) {
                pinIdsToFetch.add(match[0]);
            }
        };

        inspectCandidate(item.transId);
        inspectCandidate((item as any).Trans_Id);
        inspectCandidate((item as any).PIN_Id);
        inspectCandidate(item.purInvNo);
        ((item as any).allTransIds || []).forEach(inspectCandidate);
        (item.allPurInvNos || []).forEach(inspectCandidate);
        (item.invoiceDetails || []).forEach((inv: any) => {
            inspectCandidate(inv.transId);
            inspectCandidate(inv.Trans_Id);
            inspectCandidate(inv.PIN_Id);
            inspectCandidate(inv.vouNo);
            inspectCandidate(inv.refNumber);
        });
        (siblingRows || []).forEach((sib: any) => {
            inspectCandidate(sib.transId);
            inspectCandidate(sib.Trans_Id);
            inspectCandidate(sib.PIN_Id);
            inspectCandidate(sib.purInvNo);
            (sib.allTransIds || []).forEach(inspectCandidate);
            (sib.allPurInvNos || []).forEach(inspectCandidate);
        });

        const unCachedIds = Array.from(pinIdsToFetch).filter((id) => !purchasePaymentMap[id]);
        if (unCachedIds.length === 0) return;

        setLoadingPurchasePayment(true);
        Promise.allSettled(
            unCachedIds.map((pinId) =>
                PurchasePaymentOnlineService.getPurchasePaymentList(pinId).then((res) => ({
                    pinId,
                    data: res.data?.data,
                }))
            )
        )
            .then((results) => {
                if (!isMounted) return;
                const newMap: Record<string, PurchasePaymentListItem[]> = {};
                results.forEach((r) => {
                    if (r.status === "fulfilled" && r.value.data) {
                        newMap[r.value.pinId] = Array.isArray(r.value.data) ? r.value.data : [];
                    }
                });
                if (Object.keys(newMap).length > 0) {
                    setPurchasePaymentMap((prev) => ({ ...prev, ...newMap }));
                }
            })
            .catch((err) => {
                console.warn("Could not fetch Purchase Payment List:", err);
            })
            .finally(() => {
                if (isMounted) setLoadingPurchasePayment(false);
            });

        return () => {
            isMounted = false;
        };
    }, [open, item, siblingRows, purchasePaymentMap]);

    // Fetch live Payment Details or Journal Details when a Payment row is selected
    useEffect(() => {
        let isMounted = true;
        if (!selectedPaymentRow) return;

        const payTransId = selectedPaymentRow.Trans_Id || selectedPaymentRow.transId || selectedPaymentRow.pay_id || selectedPaymentRow.id;
        if (!payTransId) return;

        const strTransId = String(payTransId).trim();
        const isJournal = String(selectedPaymentRow.Particulars || selectedPaymentRow.vouType || "").toUpperCase().includes("JOURNAL");

        if (isJournal) {
            if (journalDetailsMap[strTransId]) return;
            setLoadingPaymentOrJournal(true);
            PurchasePaymentOnlineService.getJournalDetails(strTransId)
                .then((res) => {
                    if (!isMounted || !res.data?.data) return;
                    setJournalDetailsMap((prev) => ({
                        ...prev,
                        [strTransId]: {
                            headerData: Array.isArray(res.data.data.headerData) ? res.data.data.headerData : [],
                            lineData: Array.isArray(res.data.data.lineData) ? res.data.data.lineData : [],
                            referenceData: Array.isArray(res.data.data.referenceData) ? res.data.data.referenceData : [],
                            staffDetails: Array.isArray(res.data.data.staffDetails) ? res.data.data.staffDetails : [],
                        },
                    }));
                })
                .catch((err) => console.warn("Failed to fetch journal details:", err))
                .finally(() => {
                    if (isMounted) setLoadingPaymentOrJournal(false);
                });
        } else {
            if (paymentDetailsMap[strTransId]) return;
            setLoadingPaymentOrJournal(true);
            PurchasePaymentOnlineService.getPaymentDetails(strTransId)
                .then((res) => {
                    if (!isMounted || !res.data?.data) return;
                    setPaymentDetailsMap((prev) => ({
                        ...prev,
                        [strTransId]: {
                            headerData: Array.isArray(res.data.data.headerData) ? res.data.data.headerData : [],
                            referenceData: Array.isArray(res.data.data.referenceData) ? res.data.data.referenceData : [],
                            staffDetails: Array.isArray(res.data.data.staffDetails) ? res.data.data.staffDetails : [],
                        },
                    }));
                })
                .catch((err) => console.warn("Failed to fetch payment details:", err))
                .finally(() => {
                    if (isMounted) setLoadingPaymentOrJournal(false);
                });
        }

        return () => {
            isMounted = false;
        };
    }, [selectedPaymentRow, paymentDetailsMap, journalDetailsMap]);

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

            // Resolve Trip_Id and check if Reporting_Online_Trip_Arrival_List returned arrival details
            const rowTripId = resolveInwardTripId(inw);
            const liveArrival = rowTripId ? tripArrivalMap[rowTripId] : null;
            const liveFirstDetail = liveArrival?.details && liveArrival.details.length > 0 ? liveArrival.details[0] : null;

            // Use live details if available from dataset 1
            const effectiveDate = liveFirstDetail?.Stock_Journal_date
                ? formatDisplayDate(liveFirstDetail.Stock_Journal_date)
                : formatDisplayDate(inw.arrivalDate || inw.entryDate || inw.date || inw.orderDate || item.orderDate || loadingDate);
            const effectiveVouNo = liveFirstDetail?.Journal_no
                ? String(liveFirstDetail.Journal_no)
                : ((inw.billNo && inw.billNo !== "-") ? String(inw.billNo) : ((inw.inwardJouNo && inw.inwardJouNo !== "-") ? String(inw.inwardJouNo) : (item.inwardJouNo || `MIA/${String(idx + 1).padStart(6, "0")}/26-27`)));
            const effectiveVouType = liveFirstDetail?.Stock_Journal_Voucher_type || liveFirstDetail?.Bill_type || inw.voucherType || inw.billType || "ON_M_OUTWARDS";
            const effectiveNarr = liveFirstDetail?.Narration || inw.narration || inw.narr || inw.remarks || item.remarks || extraFirst?.Narration || "-";

            return {
                sNo: idx + 1,
                tripId: rowTripId || inw.tripId || inw.Trip_Id,
                Trip_Id: rowTripId || inw.tripId || inw.Trip_Id,
                entryDate: effectiveDate,
                vehicleNo: inw.vehicleNo || inw.inwardVehicle || inw.transportDetails?.vehicleNo || item.transportDetails?.vehicleNo || (item as any).vehicleNo || "-",
                vouType: effectiveVouType,
                vouNo: effectiveVouNo,
                retailerName: inw.retailerName || retailerName || (item as any).retailerName || "-",
                narr: effectiveNarr,
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
            const rowTransId = resolveInvoiceTransId(inv);
            const liveInv = rowTransId ? purchaseInvoiceMap[rowTransId] : null;
            const liveHeader = liveInv?.invoiceData && liveInv.invoiceData.length > 0 ? liveInv.invoiceData[0] : null;
            const liveLos = liveInv?.losData && liveInv.losData.length > 0 ? liveInv.losData : [];
            const liveFirstLos = liveLos.length > 0 ? liveLos[0] : null;
            const liveAmounts = liveInv?.amountData && liveInv.amountData.length > 0 ? liveInv.amountData : [];

            // Sum up taxes and line item amounts from live data if present
            let liveTotalLosAmt = 0;
            let liveTotalBillQty = 0;
            let liveTotalActQty = 0;
            liveLos.forEach((l) => {
                const bQ = Number(l.Bill_Qty);
                if (!isNaN(bQ)) liveTotalBillQty += bQ;
                const aQ = Number(l.Act_Qty);
                if (!isNaN(aQ)) liveTotalActQty += aQ;
                const amt = Number(l.Amount);
                if (!isNaN(amt)) liveTotalLosAmt += amt;
            });

            let liveCgst = 0;
            let liveSgst = 0;
            let liveIgst = 0;
            let liveRoundOff = 0;
            let liveExpenses = 0;

            liveAmounts.forEach((a) => {
                const acc = String(a.Account_name || "").toUpperCase();
                const dr = Number(a.Amount_value_DR) || 0;
                const cr = Number(a.Amount_value_CR) || 0;
                const val = dr > 0 ? dr : (cr > 0 ? -cr : 0);

                if (acc.includes("CGST")) {
                    liveCgst += dr > 0 ? dr : cr;
                } else if (acc.includes("SGST")) {
                    liveSgst += dr > 0 ? dr : cr;
                } else if (acc.includes("IGST")) {
                    liveIgst += dr > 0 ? dr : cr;
                } else if (acc.includes("ROUND")) {
                    liveRoundOff += val;
                } else {
                    liveExpenses += val;
                }
            });

            const liveGrossTotal = liveTotalLosAmt > 0
                ? (liveTotalLosAmt + liveCgst + liveSgst + liveIgst + liveExpenses + liveRoundOff)
                : 0;

            const rowTonnageKg = liveTotalActQty > 0
                ? liveTotalActQty
                : (inv.tonnageKg || inv.billQty || inv.aclQty || item.tonnageKg || 0);

            const stockItemName = liveFirstLos?.Product_Name || liveFirstLos?.Stock_Item || inv.itemName || inv.stockItemName || item.inwardItem || "-";
            const stockGroup = inv.stockGroup || inv.stock_group || inv.group || (inv as any).Stock_Group || item.stockGroup || (stockItemName !== "-" ? deriveStockGroup(stockItemName) : "-") || "-";

            const effectiveEntryDate = liveHeader?.Ledger_Date
                ? formatDisplayDate(liveHeader.Ledger_Date)
                : formatDisplayDate(inv.entryDate || inv.date || inv.billDate || inv.orderDate || item.orderDate || loadingDate);

            const effectiveBillDate = liveFirstLos?.Po_Inv_Date
                ? formatDisplayDate(liveFirstLos.Po_Inv_Date)
                : (liveHeader?.Ledger_Date ? formatDisplayDate(liveHeader.Ledger_Date) : formatDisplayDate(inv.billDate || inv.date || inv.entryDate || inv.orderDate || item.orderDate || loadingDate));

            const effectiveVouNo = liveHeader?.invoice_no
                ? String(liveHeader.invoice_no)
                : ((inv.vouNo && inv.vouNo !== "-") ? String(inv.vouNo) : (inv.refNumber || inv.purInvNo || item.purInvNo || `INV-${item.purOrderNo}-${idx + 1}`));

            const effectiveRefNo = liveHeader?.Ref_Po_Inv_No
                ? String(liveHeader.Ref_Po_Inv_No)
                : (inv.refNumber || inv.refNo || inv.purInvNo || item.purInvNo || `INV-${item.purOrderNo}-${idx + 1}`);

            const effectivePartyName = liveHeader?.Retailer_Name || inv.vendor || inv.partyName || retailerName || (item as any).retailerName || "-";
            const effectiveVouType = liveHeader?.voucher_name || inv.voucherType || inv.vouType || "Purchase Invoice";

            return {
                sNo: idx + 1,
                transId: rowTransId,
                Trans_Id: rowTransId,
                entryDate: effectiveEntryDate,
                billDate: effectiveBillDate,
                vouType: effectiveVouType,
                vouNo: effectiveVouNo,
                refNo: effectiveRefNo,
                partyName: effectivePartyName,
                narr: inv.narration || inv.narr || inv.remarks || item.remarks || extraFirst?.Narration || "-",
                stockItemName,
                stockGroup,
                actQty: liveTotalActQty > 0
                    ? `${liveTotalActQty} ${liveFirstLos?.Unit || "kg"}`
                    : (inv.aclQty ? (typeof inv.aclQty === "number" ? formatKgQuantity(inv.aclQty) : inv.aclQty) : (rowTonnageKg ? formatKgQuantity(rowTonnageKg) : "-")),
                billQty: liveTotalBillQty > 0
                    ? `${liveTotalBillQty} ${liveFirstLos?.Unit || "kg"}`
                    : (inv.billQty ? (typeof inv.billQty === "number" ? formatKgQuantity(inv.billQty) : inv.billQty) : (rowTonnageKg ? formatKgQuantity(rowTonnageKg) : "-")),
                rate: liveFirstLos?.Rate !== undefined && liveFirstLos.Rate !== null
                    ? (typeof liveFirstLos.Rate === "number" ? formatCurrency(liveFirstLos.Rate) : `₹ ${liveFirstLos.Rate}`)
                    : (inv.rate !== undefined && inv.rate !== "As recorded" ? (typeof inv.rate === "number" ? formatCurrency(inv.rate) : inv.rate) : "As recorded"),
                amount: liveTotalLosAmt > 0
                    ? formatCurrency(liveTotalLosAmt)
                    : (inv.amount !== undefined && inv.amount !== "As recorded" ? formatCurrency(inv.amount) : (inv.paymentAmt ? formatCurrency(inv.paymentAmt) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "As recorded"))),
                godown: liveFirstLos?.Godown_Id ? `Godown ${liveFirstLos.Godown_Id}` : (inv.godown || inv.batchLocation || "Main Godown"),
                batch: inv.batch || inv.batchNo || item.batch || "-",
                expenses: liveExpenses !== 0 ? formatCurrency(liveExpenses) : (inv.expenses !== undefined && inv.expenses !== "-" ? formatCurrency(inv.expenses) : "-"),
                cgst: liveCgst > 0 ? formatCurrency(liveCgst) : (inv.cgst !== undefined && inv.cgst !== "-" ? formatCurrency(inv.cgst) : "-"),
                sgst: liveSgst > 0 ? formatCurrency(liveSgst) : (inv.sgst !== undefined && inv.sgst !== "-" ? formatCurrency(inv.sgst) : "-"),
                igst: liveIgst > 0 ? formatCurrency(liveIgst) : (inv.igst !== undefined && inv.igst !== "-" ? formatCurrency(inv.igst) : "-"),
                roundOff: liveRoundOff !== 0 ? formatCurrency(liveRoundOff) : (inv.roundOff !== undefined && inv.roundOff !== "-" ? formatCurrency(inv.roundOff) : "-"),
                totalAmount: liveGrossTotal > 0
                    ? formatCurrency(liveGrossTotal)
                    : (inv.totalAmount !== undefined && inv.totalAmount !== "-" ? formatCurrency(inv.totalAmount) : (inv.amount && inv.amount !== "As recorded" ? formatCurrency(inv.amount) : (item.paymentAmt ? formatCurrency(item.paymentAmt) : "-"))),
                staffInvolved: inv.staffInvolved || inv.staff || ownerName || "-",
                discount: inv.discount !== undefined ? String(inv.discount) : "0",
                paymentDays: String(inv.days || inv.Days || inv.paymentDays || inv.payment_days || inv.dueDays || inv.due_days || inv.creditDays || inv.credit_days || (item.paymentCondition ? String(item.paymentCondition).replace(/[^0-9]/g, "") : "") || "3").replace(/days?/i, "").trim() || "3",
                balInwardTonnage: inv.balInwardTonnage || inv.balTonnage || "-",
                rowTonnageKg,
                liveLos,
                liveAmounts,
                liveHeader,
            };
        });
    })();

    // Payment records to display in Tab 3 (Payment - 9 columns matching photo)
    const displayPayments = (() => {
        const rowTransId = resolveInvoiceTransId(item);
        const livePaymentList = rowTransId ? purchasePaymentMap[rowTransId] : undefined;

        if (livePaymentList && livePaymentList.length > 0) {
            return livePaymentList.map((p, idx) => {
                const isJournal = String(p.Particulars || "").toUpperCase().includes("JOURNAL");
                const dr = Number(p.Dr_Amount) || 0;
                const cr = Number(p.Cr_Amount) || 0;
                const effectiveAmt = dr > 0 ? dr : (cr > 0 ? cr : 0);

                return {
                    sNo: idx + 1,
                    Trans_Id: p.Trans_Id,
                    PIN_Id: p.PIN_Id,
                    entryDate: formatDisplayDate(p.Trans_Date || item.orderDate || loadingDate),
                    vouType: isJournal ? "ON_Journal SM" : "ON_Payment SM",
                    vouNo: p.Invoice_no,
                    purPartyName: retailerName || (item as any).retailerName || "-",
                    totalInvoiceAmount: formatCurrency(effectiveAmt),
                    paidAmt: formatCurrency(effectiveAmt),
                    balanceInvAmt: "₹ 0.00",
                    staffInvolved: ownerName || "ADMIN",
                    debitAmt: dr,
                    creditAmt: cr,
                    narration: `${p.Particulars || "PAYMENT"} against invoice ${p.Invoice_no}`,
                    Particulars: p.Particulars || (isJournal ? "JOURNAL" : "PAYMENT"),
                };
            });
        }

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
            Trans_Id: p.Trans_Id || p.transId || rowTransId,
            PIN_Id: p.PIN_Id || p.pinId,
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
            Particulars: p.Particulars || "PAYMENT",
        }));
    })();

    // Staff Involved generator functions for each stage
    const effectiveBroker = brokerName !== "-" ? brokerName : ((item as any)?.broker || "DIRECT");

    const getInwardStaffList = (inw: any) => {
        const rowTripId = resolveInwardTripId(inw);
        const liveArrival = rowTripId ? tripArrivalMap[rowTripId] : null;

        if (liveArrival?.staffDetails && liveArrival.staffDetails.length > 0) {
            return liveArrival.staffDetails.map((s) => ({
                category: String(s.Cost_Category || "STAFF").toUpperCase(),
                role: String(s.Alias_Name || s.Cost_Category || "Staff"),
                name: String(s.Cost_Center_Name || "-"),
            }));
        }

        return [
            { category: "DIRECT", role: "Broker", name: effectiveBroker },
            { category: "TRANSPORT", role: "Transport / Vehicle", name: `${inw?.vehicleNo || "Direct"} (${inw?.driver || (item as any)?.driver || "Driver Assigned"})` },
            { category: "OWNERS", role: "Owners / Approver", name: ownerName || "ADMIN" },
            { category: "DETAILS", role: "Godown Supervisor", name: `${inw?.toGodown || "Main Godown"} Supervisor` },
            { category: "ATTENDANT", role: "Inward Attendant", name: inw?.staffInvolved || "Yard Attendant" },
        ];
    };

    const getInvoiceStaffList = (inv: any) => {
        const rowTransId = resolveInvoiceTransId(inv);
        const liveInv = rowTransId ? purchaseInvoiceMap[rowTransId] : null;

        if (liveInv?.staffDetails && liveInv.staffDetails.length > 0) {
            return liveInv.staffDetails.map((s) => ({
                category: String(s.Cost_Category || "STAFF").toUpperCase(),
                role: String(s.Alias_Name || s.Cost_Category || "Staff"),
                name: String(s.Cost_Center_Name || "-"),
            }));
        }

        return [
            { category: "DIRECT", role: "Broker", name: effectiveBroker },
            { category: "DETAILS", role: "Billing Staff", name: inv?.staffInvolved || "Accounts Team" },
            { category: "OWNERS", role: "Owners / Signatory", name: ownerName || "ADMIN" },
            { category: "ATTENDANT", role: "Vendor Representative", name: inv?.partyName || retailerName || "Vendor" },
            { category: "TRANSPORT", role: "Payment Terms", name: `${inv?.paymentDays || "0"} Days Credit` },
        ];
    };

    const getPaymentStaffList = (p: any) => {
        const payTransId = String(p?.Trans_Id || p?.transId || p?.pay_id || "").trim();
        const isJournal = String(p?.Particulars || p?.vouType || "").toUpperCase().includes("JOURNAL");

        if (isJournal) {
            const jLive = payTransId ? journalDetailsMap[payTransId] : null;
            if (jLive?.staffDetails && jLive.staffDetails.length > 0) {
                return jLive.staffDetails.map((s) => ({
                    category: String(s.Cost_Category || "STAFF").toUpperCase(),
                    role: String(s.Alias_Name || s.Cost_Category || "Staff"),
                    name: String(s.Cost_Center_Name || "-"),
                }));
            }
        } else {
            const pLive = payTransId ? paymentDetailsMap[payTransId] : null;
            if (pLive?.staffDetails && pLive.staffDetails.length > 0) {
                return pLive.staffDetails.map((s) => ({
                    category: String(s.Cost_Category || "STAFF").toUpperCase(),
                    role: String(s.Alias_Name || s.Cost_Category || "Staff"),
                    name: String(s.Cost_Center_Name || "-"),
                }));
            }
        }

        return [
            { category: "DIRECT", role: "Broker", name: effectiveBroker },
            { category: "DETAILS", role: "Accounts Cashier", name: p?.staffInvolved || "Accounts Team" },
            { category: "OWNERS", role: "Authorized Approver", name: ownerName || "ADMIN" },
            { category: "ATTENDANT", role: "Payee / Party", name: p?.purPartyName || retailerName || "Payee" },
            { category: "FINANCE", role: "Mode", name: p?.transaction_type || "Bank Transfer" },
        ];
    };

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
                                    label={`${displayPayments.length} ${displayPayments.length === 1 ? "Payment Record" : "Payment Records"}${loadingPurchasePayment ? " (Loading...)" : ""}`}
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
                                                <TableRow
                                                    sx={{
                                                        bgcolor: "#ffffff",
                                                        cursor: "pointer",
                                                        "&:hover": { bgcolor: "#f5f3ff" },
                                                    }}
                                                    onClick={() => setSelectedPaymentRow(p)}
                                                    title="Click to view detailed payment / journal transaction"
                                                >
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
                                                <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>
                                                    {(() => {
                                                        const rowTripId = resolveInwardTripId(selectedInwardRow);
                                                        const liveArrival = rowTripId ? tripArrivalMap[rowTripId] : null;
                                                        if (liveArrival?.staffDetails && liveArrival.staffDetails.length > 0) {
                                                            return liveArrival.staffDetails.map(s => s.Cost_Center_Name).filter(Boolean).join(", ");
                                                        }
                                                        return selectedInwardRow.staffInvolved;
                                                    })()}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                </Box>

                                {/* Right: Staff Involved Table Companion Card */}
                                <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
                                    {renderStaffInvolvedCard(
                                        `Staff Involved${loadingTripArrival ? " (Loading...)" : ""}`,
                                        getInwardStaffList(selectedInwardRow)
                                    )}
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
                                                {(() => {
                                                    const rowTransId = resolveInvoiceTransId(selectedInvoiceRow);
                                                    const liveInv = rowTransId ? purchaseInvoiceMap[rowTransId] : null;
                                                    const liveLos = liveInv?.losData && liveInv.losData.length > 0 ? liveInv.losData : (selectedInvoiceRow.liveLos && selectedInvoiceRow.liveLos.length > 0 ? selectedInvoiceRow.liveLos : null);

                                                    if (liveLos && liveLos.length > 0) {
                                                        return liveLos.map((itemRow: any, lIdx: number) => {
                                                            const itemStockName = itemRow.Product_Name || itemRow.Stock_Item || selectedInvoiceRow.stockItemName || "-";
                                                            const itemStockGroup = selectedInvoiceRow.stockGroup !== "-" ? selectedInvoiceRow.stockGroup : deriveStockGroup(itemStockName);
                                                            const itemBillQty = itemRow.Bill_Qty ? `${itemRow.Bill_Qty} ${itemRow.Unit || "kg"}` : selectedInvoiceRow.billQty;
                                                            const itemActQty = itemRow.Act_Qty ? `${itemRow.Act_Qty} ${itemRow.Unit || "kg"}` : selectedInvoiceRow.actQty;
                                                            const itemRate = itemRow.Rate !== undefined && itemRow.Rate !== null ? (typeof itemRow.Rate === "number" ? formatCurrency(itemRow.Rate) : `₹ ${itemRow.Rate}`) : selectedInvoiceRow.rate;
                                                            const itemAmt = itemRow.Amount !== undefined && itemRow.Amount !== null ? (typeof itemRow.Amount === "number" ? formatCurrency(itemRow.Amount) : `₹ ${itemRow.Amount}`) : selectedInvoiceRow.amount;
                                                            const itemGodown = itemRow.Godown_Id ? `Godown ${itemRow.Godown_Id}` : selectedInvoiceRow.godown;

                                                            return (
                                                                <TableRow key={lIdx} sx={{ bgcolor: lIdx % 2 === 1 ? "#fafbfc" : "#ffffff" }}>
                                                                    {/* S.no */}
                                                                    <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                                        {itemRow.S_No || (lIdx + 1)}
                                                                    </TableCell>

                                                                    {/* Dates (Bill Date & Entry Date) */}
                                                                    <TableCell align="left">
                                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#0284c7", lineHeight: 1.2 }}>
                                                                            Bill: {itemRow.Po_Inv_Date ? formatDisplayDate(itemRow.Po_Inv_Date) : selectedInvoiceRow.billDate}
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
                                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25 }} title={itemStockName}>
                                                                            {itemStockName}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: "0.67rem", color: "#64748b", mt: 0.2 }}>
                                                                            Group: <strong>{itemStockGroup}</strong>
                                                                        </Typography>
                                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.3, flexWrap: "wrap" }}>
                                                                            <Typography sx={{ fontSize: "0.66rem", color: "#1e3a8a", fontWeight: 600 }}>
                                                                                🏢 {itemGodown}
                                                                            </Typography>
                                                                            {selectedInvoiceRow.batch !== "-" && (
                                                                                <Chip size="small" label={`Batch: ${selectedInvoiceRow.batch}`} sx={{ height: 16, fontSize: "0.62rem", fontWeight: 700, bgcolor: "#f1f5f9" }} />
                                                                            )}
                                                                        </Box>
                                                                    </TableCell>

                                                                    {/* Quantities (Bill Qty, Act Qty, Bal Inward Tonnage) */}
                                                                    <TableCell align="right">
                                                                        <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                                                                            {itemBillQty}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: "0.68rem", color: "#475569", mt: 0.2 }}>
                                                                            Act: {itemActQty}
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
                                                                            {itemRate}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700, mt: 0.2 }}>
                                                                            Amt: {itemAmt}
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
                                                                            {lIdx === 0 ? selectedInvoiceRow.totalAmount : itemAmt}
                                                                        </Typography>
                                                                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.4, mt: 0.3, flexWrap: "wrap" }}>
                                                                            <Typography sx={{ fontSize: "0.62rem", color: "#64748b" }}>
                                                                                CGST: {selectedInvoiceRow.cgst} | SGST: {selectedInvoiceRow.sgst}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.4, flexWrap: "wrap" }}>
                                                                            <Typography sx={{ fontSize: "0.62rem", color: "#64748b" }}>
                                                                                Exp: {selectedInvoiceRow.expenses} | Rnd: {selectedInvoiceRow.roundOff}
                                                                            </Typography>
                                                                        </Box>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        });
                                                    }

                                                    return (
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
                                                    );
                                                })()}

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
                                    {renderStaffInvolvedCard(
                                        `Staff Involved${loadingPurchaseInvoice ? " (Loading...)" : ""}`,
                                        getInvoiceStaffList(selectedInvoiceRow)
                                    )}
                                </Box>
                            </Box>
                        </DialogContent>
                    </React.Fragment>
                )}
            </Dialog>

            {/* ============================================================== */}
            {/* POPUP MODAL: PAYMENT / JOURNAL DETAILED VIEW WITH COMPANION   */}
            {/* ============================================================== */}
            <Dialog
                open={Boolean(selectedPaymentRow)}
                onClose={() => setSelectedPaymentRow(null)}
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
                {selectedPaymentRow && (() => {
                    const payTransId = String(selectedPaymentRow.Trans_Id || selectedPaymentRow.transId || selectedPaymentRow.pay_id || "").trim();
                    const isJournal = String(selectedPaymentRow.Particulars || selectedPaymentRow.vouType || "").toUpperCase().includes("JOURNAL");

                    const jLive = isJournal && payTransId ? journalDetailsMap[payTransId] : null;
                    const pLive = !isJournal && payTransId ? paymentDetailsMap[payTransId] : null;

                    const jHead = jLive?.headerData?.[0];
                    const pHead = pLive?.headerData?.[0];

                    const modalTitle = isJournal ? "Journal Voucher Details" : "Payment Voucher Details";
                    const voucherNo = jHead?.JournalVoucherNo || pHead?.payment_invoice_no || selectedPaymentRow.vouNo || "-";
                    const entryDate = jHead?.JournalDate ? formatDisplayDate(jHead.JournalDate) : (pHead?.payment_date ? formatDisplayDate(pHead.payment_date) : selectedPaymentRow.entryDate);
                    const party = pHead?.debit_ledger_name || selectedPaymentRow.purPartyName || retailerName || "-";
                    const voucherType = jHead?.voucher_name || pHead?.voucher_name || selectedPaymentRow.vouType || (isJournal ? "ON_Journal SM" : "ON_Payment SM");
                    const narration = jHead?.Narration || pHead?.remarks || selectedPaymentRow.narration || "-";

                    return (
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
                                            bgcolor: isJournal ? "#fdf2f8" : "#faf5ff",
                                            border: `1px solid ${isJournal ? "#fbcfe8" : "#e9d5ff"}`,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: isJournal ? "#db2777" : "#7e22ce",
                                        }}
                                    >
                                        <PaymentOutlinedIcon sx={{ fontSize: 22 }} />
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#1e3a8a", lineHeight: 1.2 }}>
                                            {modalTitle}
                                        </Typography>
                                        <Typography sx={{ fontSize: "0.74rem", color: "#64748b", mt: 0.2 }}>
                                            Voucher No: <strong style={{ color: "#1e3a8a" }}>{voucherNo}</strong> • Date: <strong>{entryDate}</strong> • Party: <strong>{party}</strong>
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    {displayPayments.length > 1 && (
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, bgcolor: "#ffffff", p: 0.4, borderRadius: 1.5, border: "1px solid #cbd5e1" }}>
                                            <IconButton
                                                size="small"
                                                disabled={displayPayments.findIndex(r => r.sNo === selectedPaymentRow.sNo) <= 0}
                                                onClick={() => {
                                                    const curIdx = displayPayments.findIndex(r => r.sNo === selectedPaymentRow.sNo);
                                                    if (curIdx > 0) setSelectedPaymentRow(displayPayments[curIdx - 1]);
                                                }}
                                                sx={{ p: 0.3 }}
                                                title="Previous Payment Record"
                                            >
                                                <ChevronLeftIcon fontSize="small" />
                                            </IconButton>
                                            <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1e3a8a", px: 0.8 }}>
                                                {displayPayments.findIndex(r => r.sNo === selectedPaymentRow.sNo) + 1} of {displayPayments.length}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                disabled={displayPayments.findIndex(r => r.sNo === selectedPaymentRow.sNo) >= displayPayments.length - 1}
                                                onClick={() => {
                                                    const curIdx = displayPayments.findIndex(r => r.sNo === selectedPaymentRow.sNo);
                                                    if (curIdx < displayPayments.length - 1) setSelectedPaymentRow(displayPayments[curIdx + 1]);
                                                }}
                                                sx={{ p: 0.3 }}
                                                title="Next Payment Record"
                                            >
                                                <ChevronRightIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={() => setSelectedPaymentRow(null)}
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
                                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", width: "100%", flexDirection: { xs: "column", md: "row" } }}>
                                    {/* Left: Detailed Views */}
                                    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                        {/* Main Multi-Column Table */}
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
                                                        <TableCell align="center" sx={{ width: "5%" }}>S.no</TableCell>
                                                        <TableCell align="left" sx={{ width: "14%" }}>Voucher & Date</TableCell>
                                                        <TableCell align="left" sx={{ width: "24%" }}>{isJournal ? "Account Particulars" : "Credit / Debit Ledgers"}</TableCell>
                                                        <TableCell align="center" sx={{ width: "8%" }}>Type</TableCell>
                                                        <TableCell align="right" sx={{ width: "16%" }}>Amount</TableCell>
                                                        <TableCell align="left" sx={{ width: "33%" }}>Reference Details</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {isJournal && jLive?.lineData && jLive.lineData.length > 0 ? (
                                                        jLive.lineData.map((lItem, lIdx) => {
                                                            const refMatch = jLive.referenceData?.find(r => r.LineId === lItem.LineId) || jLive.referenceData?.[0];
                                                            return (
                                                                <TableRow key={lIdx} sx={{ bgcolor: lIdx % 2 === 1 ? "#fafbfc" : "#ffffff" }}>
                                                                    <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                                        {lItem.LineNum || (lIdx + 1)}
                                                                    </TableCell>
                                                                    <TableCell align="left">
                                                                        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a", lineHeight: 1.2 }}>
                                                                            {voucherNo}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: "0.68rem", color: "#64748b", mt: 0.2 }}>
                                                                            {entryDate}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="left">
                                                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#0f172a" }}>
                                                                            {lItem.AccountGet || "-"}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b" }}>
                                                                            Acc ID: {lItem.Acc_Id}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="center">
                                                                        <Chip
                                                                            size="small"
                                                                            label={lItem.DrCr || "Dr"}
                                                                            sx={{
                                                                                height: 18,
                                                                                fontSize: "0.66rem",
                                                                                fontWeight: 800,
                                                                                bgcolor: lItem.DrCr === "Cr" ? "#fef3c7" : "#eff6ff",
                                                                                color: lItem.DrCr === "Cr" ? "#b45309" : "#1d4ed8",
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell align="right">
                                                                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: lItem.DrCr === "Dr" ? "#15803d" : "#0f172a" }}>
                                                                            {formatCurrency(lItem.Amount || 0)}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="left">
                                                                        {refMatch ? (
                                                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                                                                                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e3a8a" }}>
                                                                                    Ref: {refMatch.RefNo || "-"} ({refMatch.RefType || "PURCHASE"})
                                                                                </Typography>
                                                                                <Typography sx={{ fontSize: "0.66rem", color: "#64748b" }}>
                                                                                    Bill Ref: {refMatch.BillRefNo || "-"} • Amt: {formatCurrency(refMatch.Amount || 0)}
                                                                                </Typography>
                                                                            </Box>
                                                                        ) : (
                                                                            <Typography sx={{ fontSize: "0.70rem", color: "#94a3b8" }}>-</Typography>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })
                                                    ) : !isJournal && pLive?.referenceData && pLive.referenceData.length > 0 ? (
                                                        pLive.referenceData.map((refItem, rIdx) => (
                                                            <TableRow key={rIdx} sx={{ bgcolor: rIdx % 2 === 1 ? "#fafbfc" : "#ffffff" }}>
                                                                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>
                                                                    {rIdx + 1}
                                                                </TableCell>
                                                                <TableCell align="left">
                                                                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a", lineHeight: 1.2 }}>
                                                                        {voucherNo}
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", mt: 0.2 }}>
                                                                        {entryDate}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="left">
                                                                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#0f172a" }}>
                                                                        {refItem.Account_name || party}
                                                                    </Typography>
                                                                    {pHead?.credit_ledger_name && (
                                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b" }}>
                                                                            Credit: {pHead.credit_ledger_name}
                                                                        </Typography>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell align="center">
                                                                    <Chip
                                                                        size="small"
                                                                        label="PAYMENT"
                                                                        sx={{
                                                                            height: 18,
                                                                            fontSize: "0.66rem",
                                                                            fontWeight: 800,
                                                                            bgcolor: "#faf5ff",
                                                                            color: "#7e22ce",
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#15803d" }}>
                                                                        {formatCurrency(refItem.Debit_Amo || pHead?.debit_amount || selectedPaymentRow.paidAmt || 0)}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="left">
                                                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2 }}>
                                                                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e3a8a" }}>
                                                                            Bill: {refItem.bill_name || "-"} (Ref: {refItem.bill_ref_number || "-"})
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: "0.66rem", color: "#64748b" }}>
                                                                            Type: {refItem.JournalBillType || "PURCHASE PAYMENT"} • Total: {formatCurrency(refItem.bill_amount || 0)}
                                                                        </Typography>
                                                                    </Box>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow sx={{ bgcolor: "#ffffff" }}>
                                                            <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>1</TableCell>
                                                            <TableCell align="left">
                                                                <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e3a8a" }}>{voucherNo}</Typography>
                                                                <Typography sx={{ fontSize: "0.68rem", color: "#64748b" }}>{entryDate}</Typography>
                                                            </TableCell>
                                                            <TableCell align="left">
                                                                <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#0f172a" }}>{party}</Typography>
                                                                <Typography sx={{ fontSize: "0.66rem", color: "#64748b" }}>{voucherType}</Typography>
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Chip size="small" label={isJournal ? "JOURNAL" : "PAYMENT"} sx={{ height: 18, fontSize: "0.66rem", fontWeight: 800, bgcolor: "#eff6ff", color: "#1d4ed8" }} />
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: "#15803d" }}>{selectedPaymentRow.paidAmt}</Typography>
                                                            </TableCell>
                                                            <TableCell align="left">
                                                                <Typography sx={{ fontSize: "0.72rem", color: "#475569" }}>Settlement against Purchase</Typography>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}

                                                    {/* NARRATION SUB-ROW */}
                                                    <TableRow sx={{ bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
                                                        <TableCell colSpan={6} sx={{ py: 0.4, px: 2, borderTop: "none" }}>
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                                                                <Typography sx={{ color: "#2563eb", fontWeight: 900, fontSize: "0.85rem", lineHeight: 1 }}>*</Typography>
                                                                <Typography sx={{ fontSize: "0.73rem", color: "#475569", fontStyle: "italic" }}>
                                                                    <strong style={{ fontStyle: "normal", color: "#1e3a8a" }}>Narration:</strong> {narration}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </TableContainer>

                                        {/* Structured Key-Value Details Cards Grid */}
                                        <Paper elevation={0} sx={{ p: 1.5, border: "1px solid #e2e8f0", borderRadius: 1.5, bgcolor: "#f8fafc" }}>
                                            <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.04em", mb: 1 }}>
                                                {isJournal ? "Journal Attributes" : "Payment Attributes"}
                                            </Typography>
                                            <Grid container spacing={1.5}>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Voucher No</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{voucherNo}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Voucher Date</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#0284c7", fontWeight: 700 }}>{entryDate}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Voucher Type</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{voucherType}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Particulars</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#7e22ce", fontWeight: 700 }}>{selectedPaymentRow.Particulars || (isJournal ? "JOURNAL" : "PAYMENT")}</Typography>
                                                </Grid>

                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Debit Party / Account</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{party}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Credit Ledger / Account</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{pHead?.credit_ledger_name || (isJournal ? "Multiple Creditors (See lines)" : "-")}</Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Transaction Amount</Typography>
                                                    <Typography sx={{ fontSize: "0.82rem", color: "#15803d", fontWeight: 900 }}>
                                                        {selectedPaymentRow.paidAmt}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Created By</Typography>
                                                    <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{jHead?.Created_By || pHead?.Created_By || "ADMIN"}</Typography>
                                                </Grid>

                                                {/* If Journal, show extra Reference dataset information */}
                                                {isJournal && jLive?.referenceData && jLive.referenceData.length > 0 && (
                                                    <React.Fragment>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Reference Purchase No</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{jLive.referenceData[0]?.RefNo || "-"}</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Bill Reference No</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{jLive.referenceData[0]?.BillRefNo || "-"}</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Reference Type</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{jLive.referenceData[0]?.RefType || "PURCHASE"}</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Reference Amount</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#15803d", fontWeight: 800 }}>{formatCurrency(jLive.referenceData[0]?.Amount || 0)}</Typography>
                                                        </Grid>
                                                    </React.Fragment>
                                                )}

                                                {/* If Payment, show reference bill info */}
                                                {!isJournal && pLive?.referenceData && pLive.referenceData.length > 0 && (
                                                    <React.Fragment>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Against Bill Name</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#1e3a8a", fontWeight: 700 }}>{pLive.referenceData[0]?.bill_name || "-"}</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Bill Ref No</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{pLive.referenceData[0]?.bill_ref_number || "-"}</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Total Bill Amount</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{formatCurrency(pLive.referenceData[0]?.bill_amount || 0)}</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={6} md={3}>
                                                            <Typography sx={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Payment Mode</Typography>
                                                            <Typography sx={{ fontSize: "0.78rem", color: "#0f172a", fontWeight: 700 }}>{pHead?.transaction_type || "e-Fund Transfer"}</Typography>
                                                        </Grid>
                                                    </React.Fragment>
                                                )}
                                            </Grid>
                                        </Paper>
                                    </Box>

                                    {/* Right: Staff Involved Table Companion Card */}
                                    <Box sx={{ width: { xs: "100%", md: 320 }, flexShrink: 0 }}>
                                        {renderStaffInvolvedCard(
                                            `Staff Involved${loadingPaymentOrJournal ? " (Loading...)" : ""}`,
                                            getPaymentStaffList(selectedPaymentRow)
                                        )}
                                    </Box>
                                </Box>
                            </DialogContent>
                        </React.Fragment>
                    );
                })()}
            </Dialog>

        </Dialog>
    );
};

export default PurchaseTransactionDetailsDialog;
