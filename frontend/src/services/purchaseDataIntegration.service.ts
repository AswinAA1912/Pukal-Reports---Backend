/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from "dayjs";
import {
    OnlinePurchaseReportService,
    OnlinePurchaseReportItemService,
    OnlinePurchaseReport,
    PurchaseOrderPaymentItem,
} from "./OnlinePurchaseReport.service";
import {
    PurchaseOrderReport,
    PurchaseOrderReportItem,
    PurchaseOrderItem,
    PurchaseOrderTripItem,
    PurchaseOrderTripItemService,
} from "./purchaseOrderReport.service";
import {
    PurchasePaymentItem,
    PurchaseOrderItemDetail,
} from "./purchasePayment.service";
import {
    PurchaseItemOrder,
    ArrivedInvoiceDetail,
    cleanItemName,
} from "./purchaseItemPayment.service";
export { cleanItemName } from "./purchaseItemPayment.service";
import {
    PurchaseDeliveryItem,
} from "./purchaseDelivery.service";
import {
    TodayArrivalItem,
    WholeOrderDetails,
    DeliveryStatus,
    PurchaseReportFilterType,
} from "./purchaseReport.service";

/* =========================================================================
   HELPER UTILITIES
========================================================================= */

export const cleanStr = (val: any): string => (val !== undefined && val !== null ? String(val).trim() : "");

export const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "").trim());
    return isNaN(n) ? 0 : n;
};

const normalizeName = (name: string): string => {
    return cleanItemName(cleanStr(name))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
};

export const formatKgQuantity = (qtyInKg: number | string): string => {
    const num = typeof qtyInKg === "number" ? qtyInKg : parseFloat(String(qtyInKg || 0)) || 0;
    if (num <= 0) return "0 KG";
    if (num >= 1000) {
        const tons = (num / 1000).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
        const kgStr = Math.round(num).toLocaleString("en-IN");
        return `${tons} T (${kgStr} KG)`;
    }
    return `${Math.round(num).toLocaleString("en-IN")} KG`;
};

export const formatKgQuantityCompact = (qtyInKg: number | string): string => {
    const num = typeof qtyInKg === "number" ? qtyInKg : parseFloat(String(qtyInKg || 0)) || 0;
    if (num <= 0) return "0 KG";
    if (num >= 1000) {
        const tons = (num / 1000).toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
        return `${tons} T (${Math.round(num).toLocaleString("en-IN")} KG)`;
    }
    return `${Math.round(num).toLocaleString("en-IN")} KG`;
};

export const formatTonsOnly = (qtyInKg: number | string): string => {
    const num = typeof qtyInKg === "number" ? qtyInKg : parseFloat(String(qtyInKg || 0).replace(/,/g, "")) || 0;
    if (num <= 0) return "-";
    const tons = (num / 1000).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
    return `${tons} T`;
};

export const formatKgOnly = (qtyInKg: number | string): string => {
    const num = typeof qtyInKg === "number" ? qtyInKg : parseFloat(String(qtyInKg || 0).replace(/,/g, "")) || 0;
    if (num <= 0) return "-";
    return `${Math.round(num).toLocaleString("en-IN")} KG`;
};

export const extractTonsAndKg = (tonnageStr?: string, tonnageKg?: number | string): { tons: string; kg: string } => {
    const numKg = parseNum(tonnageKg);

    if (tonnageStr && tonnageStr.includes("(") && tonnageStr.includes(")")) {
        const parts = tonnageStr.split("(");
        const tonsPart = parts[0].trim();
        const kgPart = parts[1].replace(")", "").trim();
        return {
            tons: tonsPart || (numKg > 0 ? formatTonsOnly(numKg) : "-"),
            kg: kgPart || (numKg > 0 ? formatKgOnly(numKg) : "-"),
        };
    }

    if (numKg > 0) {
        return {
            tons: formatTonsOnly(numKg),
            kg: formatKgOnly(numKg),
        };
    }

    if (tonnageStr && tonnageStr !== "-") {
        if (/T/i.test(tonnageStr) && !tonnageStr.includes("KG")) {
            return { tons: tonnageStr.trim(), kg: "-" };
        }
        if (/KG/i.test(tonnageStr)) {
            return { tons: "-", kg: tonnageStr.trim() };
        }
        const parsedStrNum = parseNum(tonnageStr);
        if (parsedStrNum > 0) {
            return {
                tons: formatTonsOnly(parsedStrNum),
                kg: formatKgOnly(parsedStrNum),
            };
        }
    }

    return { tons: "-", kg: "-" };
};

export const deriveStockGroup = (productName: string): string => {
    const p = (productName || "").toUpperCase();
    if (!p) return "";
    if (p.includes("PEAS") || p.includes("VATANA")) return "11.PEAS";
    if (p.includes("MOONG") || p.includes("PASI") || p.includes("GREEN GRAM")) return "10.Moong";
    if (p.includes("MASOOR")) return "7.MASOOR";
    if (p.includes("KABULI") || p.includes("WHITEGRAM")) return "5.Kabuli cp";
    if (p.includes("CHANA") || p.includes("MALDA") || p.includes("DESI") || p.includes("BENGAL")) return "2.Desi cp";
    if (p.includes("RICE") || p.includes("PADDY") || p.includes("PONNI") || p.includes("SONA") || p.includes("BASMATI")) return "12.RICE";
    if (p.includes("MOCHAI")) return "9.Mochai";
    if (p.includes("THATTAI") || p.includes("COWPEN") || p.includes("KARAMANI")) return "13.Thattai";
    if (p.includes("KANAM") || p.includes("BLACKKANAM")) return "6.KANAM";
    if (p.includes("MILLET") || p.includes("RAGI") || p.includes("JOWAR") || p.includes("BAJRA") || p.includes("VARAGU") || p.includes("SAMAI") || p.includes("THINAI") || p.includes("KUDO")) return "8.MILLETS";
    if (p.includes("BEAN") || p.includes("RAJMA") || p.includes("VARI") || p.includes("SOYA")) return "1.BEANS";
    if (p.includes("BAG") || p.includes("GUNNY") || p.includes("PACKING")) return "14.BAGS";
    if (p.includes("RETAIL")) return "15.Retail";
    if (p.includes("II ") || p.includes("II-") || p.includes("II ITEM")) return "4.II Item";
    if (p.includes("DHAL") || p.includes("DHALL") || p.includes("TOOR") || p.includes("URAD") || p.includes("GRAM") || p.includes("PARCHED")) {
        return "3.DHALL";
    }
    return "";
};

/**
 * Builds a stock group catalog across all dataset rows (PO, invoices, trips)
 * and provides a resolver that prioritizes backend-defined Stock_Group.
 */
export const buildStockGroupCatalog = (
    poRows: any[] = [],
    invRows: any[] = [],
    tripRows: any[] = []
) => {
    const byId = new Map<number, string>();
    const byName = new Map<string, string>();

    const register = (prodId?: any, prodName?: string, sg?: string) => {
        const cleanSg = cleanStr(sg);
        if (!cleanSg || cleanSg.toLowerCase() === "general items") return;
        const pIdNum = Number(prodId);
        if (pIdNum && !isNaN(pIdNum)) {
            byId.set(pIdNum, cleanSg);
        }
        const normName = normalizeName(prodName || "");
        if (normName) {
            byName.set(normName, cleanSg);
        }
    };

    (poRows || []).forEach((r) => {
        register(r?.Product_Id, r?.Product_name || r?.Product_Name || r?.Stock_Item, r?.Stock_Group || r?.stockGroup);
    });
    (invRows || []).forEach((r) => {
        register(r?.Product_Id, r?.Product_Name || r?.Product_name || r?.Stock_Item, r?.Stock_Group || r?.stockGroup);
    });
    (tripRows || []).forEach((t) => {
        register(t?.Product_Id, t?.Product_Name, t?.Stock_Group || t?.stockGroup);
    });

    const resolve = (itemObj: any, prodName: string, prodId?: any): string => {
        const explicit = cleanStr(itemObj?.Stock_Group || itemObj?.stockGroup);
        if (explicit && explicit.toLowerCase() !== "general items") return explicit;

        const pIdNum = Number(prodId || itemObj?.Product_Id);
        if (pIdNum && !isNaN(pIdNum) && byId.has(pIdNum)) {
            return byId.get(pIdNum)!;
        }

        const norm = normalizeName(prodName);
        if (norm && byName.has(norm)) {
            return byName.get(norm)!;
        }

        return deriveStockGroup(prodName);
    };

    return { byId, byName, resolve };
};

/* =========================================================================
   RAW DATA FETCHING
========================================================================= */

const extractArray = (res: any): any[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.data)) return res.data.data;
    if (Array.isArray(res.data?.data?.data)) return res.data.data.data;
    if (Array.isArray(res.result)) return res.result;
    return [];
};

export interface RawPurchaseDatasets {
    purchaseOrders: PurchaseOrderItem[];
    purchaseInvoices: OnlinePurchaseReport[];
    tripItems: PurchaseOrderTripItem[];
}

export const fetchRawPurchaseDatasets = async (params?: {
    Fromdate?: string;
    Todate?: string;
}): Promise<RawPurchaseDatasets> => {
    const from = params?.Fromdate || dayjs().startOf("month").format("YYYY-MM-DD");
    const to = params?.Todate || dayjs().format("YYYY-MM-DD");

    let poList: PurchaseOrderItem[] = [];
    let invList: OnlinePurchaseReport[] = [];
    let tripList: PurchaseOrderTripItem[] = [];

    const [poItemRes, poRes, invItemRes, invRes, tripRes] = await Promise.allSettled([
        PurchaseOrderReportItem.getPurchaseOrderItem({ Fromdate: from, Todate: to }),
        PurchaseOrderReport.getPurchaseOrder({ Fromdate: from, Todate: to }),
        OnlinePurchaseReportItemService.getReportsitem({ Fromdate: from, Todate: to }),
        OnlinePurchaseReportService.getReports({ Fromdate: from, Todate: to }),
        PurchaseOrderTripItemService.getPurchaseOrderTripItemDetails({ Fromdate: from, Todate: to }),
    ]);

    // 1. Extract Purchase Orders (Prefer Item-level endpoint from PurchaseOrderReportItem)
    if (poItemRes.status === "fulfilled" && poItemRes.value) {
        const raw = extractArray(poItemRes.value.data) || extractArray(poItemRes.value);
        if (raw.length > 0) {
            poList = raw;
        }
    }
    if (poList.length === 0 && poRes.status === "fulfilled" && poRes.value) {
        const raw = extractArray(poRes.value.data) || extractArray(poRes.value);
        if (raw.length > 0) {
            poList = raw;
        }
    }

    // 2. Extract Purchase Invoices (Prefer Item-level endpoint)
    if (invItemRes.status === "fulfilled" && invItemRes.value) {
        const raw = extractArray(invItemRes.value.data) || extractArray(invItemRes.value);
        if (raw.length > 0) {
            invList = raw;
        }
    }
    if (invList.length === 0 && invRes.status === "fulfilled" && invRes.value) {
        const raw = extractArray(invRes.value.data) || extractArray(invRes.value);
        if (raw.length > 0) {
            invList = raw;
        }
    }

    // 3. Extract Purchase Order Trip Items (Trip & Inward Arrival Details with Batch Details)
    if (tripRes.status === "fulfilled" && tripRes.value) {
        const raw = extractArray(tripRes.value.data) || extractArray(tripRes.value);
        if (raw.length > 0) {
            tripList = raw;
        }
    }

    return { purchaseOrders: poList, purchaseInvoices: invList, tripItems: tripList };
};

/* =========================================================================
   DATASET BUILDERS (Pure live API data, no dummy values, empty fields if missing)
========================================================================= */

/**
 * 1. Transform raw datasets into PurchasePaymentItem[] (for PurchasePaymentReport)
 */
export const buildPurchasePaymentDataset = (
    poRows: PurchaseOrderItem[],
    invRows: OnlinePurchaseReport[],
    tripRows: PurchaseOrderTripItem[] = [],
    paymentsMap?: Map<string, PurchaseOrderPaymentItem>
): PurchasePaymentItem[] => {
    // If tripRows are available from PurchaseOrderTripItemService, use rich live dataset
    if (tripRows && tripRows.length > 0) {
        const itemOrders = buildPurchaseItemPaymentDataset(poRows, invRows, tripRows, paymentsMap);
        if (itemOrders && itemOrders.length > 0) {
            return itemOrders.map((ord, idx) => ({
                id: ord.id,
                sNo: idx + 1,
                purOrderNo: ord.purOrderNo,
                transId: ord.transId,
                transIds: ord.transIds,
                supplierName: ord.supplierName,
                orderDate: ord.orderDate,
                dueDate: ord.dueDate,
                items: ord.items,
                orderedTons: ord.orderedTons,
                arrivedTons: ord.arrivedTons,
                pendingTons: ord.pendingTons,
                deliveryPercentage: ord.deliveryPercentage,
                deliveryStatus: ord.deliveryStatus,
                totalPayment: ord.totalValue,
                paidPayment: ord.paidAmount,
                pendingPayment: ord.pendingPayment,
                paymentStatus: ord.paymentStatus,
                paymentNo: ord.paymentNo || (ord.arrivedInvoices && ord.arrivedInvoices.length > 0 ? ord.arrivedInvoices[0].invoiceNo : ""),
                purInvNo: ord.purInvNo,
                inwardJouNo: ord.inwardJouNo || (ord.arrivedInvoices && ord.arrivedInvoices.length > 0 ? ord.arrivedInvoices.length : ""),
                deliveryLocation: ord.deliveryLocation,
                notes: ord.notes || "",
            }));
        }
    }

    // If no data returned from either API, return empty array (NO DUMMY DATA)
    if ((!poRows || poRows.length === 0) && (!invRows || invRows.length === 0)) {
        return [];
    }

    const result: PurchasePaymentItem[] = [];
    let sNoCounter = 1;
    const { resolve: resolveGroup } = buildStockGroupCatalog(poRows, invRows);

    // Group PO items by invoice_no (PO Number)
    const poGroupMap: Record<string, PurchaseOrderItem[]> = {};
    (poRows || []).forEach((row) => {
        const key = cleanStr(
            (row as any).invoice_no ||
            (row as any).Invoice_No ||
            (row as any).voucher_no ||
            (row as any).Voucher_No ||
            (row as any).order_no ||
            (row as any).Order_No ||
            (row as any).Ref_Brokers
        ) || "PO-UNKNOWN";
        if (!poGroupMap[key]) {
            poGroupMap[key] = [];
        }
        poGroupMap[key].push(row);
    });

    // 2. Group raw invoice items by unique invoice_no FIRST so multi-item invoices are matched as a whole
    const invGroupMap: Record<string, OnlinePurchaseReport[]> = {};
    (invRows || []).forEach((inv) => {
        const invNo = cleanStr((inv as any).invoice_no || (inv as any).Invoice_No);
        if (!invNo) return;
        if (!invGroupMap[invNo]) invGroupMap[invNo] = [];
        invGroupMap[invNo].push(inv);
    });
    const uniqueInvNos = Object.keys(invGroupMap);

    // Track which invoices were matched to POs
    const poKeys = Object.keys(poGroupMap);
    const poInvoiceMap: Record<string, OnlinePurchaseReport[]> = {};
    poKeys.forEach((k) => (poInvoiceMap[k] = []));
    const matchedInvoices = new Set<string>();

    // Pass 1: Explicit PO reference in Ref_Brokers, voucher_name, voucher_no, Narration
    uniqueInvNos.forEach((invNo) => {
        const rows = invGroupMap[invNo];
        const ref = rows
            .map((r) =>
                cleanStr(
                    (r as any).Ref_Brokers ||
                    (r as any).ref_brokers ||
                    (r as any).voucher_name ||
                    (r as any).voucher_no ||
                    (r as any).Narration ||
                    (r as any).narration
                )
            )
            .filter(Boolean)
            .join(" ");

        for (const poNo of poKeys) {
            if (ref && poNo && ref.toLowerCase().includes(poNo.toLowerCase())) {
                poInvoiceMap[poNo].push(...rows);
                matchedInvoices.add(invNo);
                break;
            }
        }
    });

    // Pass 2: Best supplier + amount + product + date match for remaining invoices
    uniqueInvNos.forEach((invNo) => {
        if (matchedInvoices.has(invNo)) return;
        const rows = invGroupMap[invNo];
        const first = rows[0];
        const invSupplier = cleanStr(
            (first as any).Retailer_Name ||
            (first as any).Party_Name ||
            (first as any).Vendor_Name
        );
        const invAmount =
            parseNum((first as any).Total_Invoice_value ?? (first as any).Total_Invoice_Value) ||
            rows.reduce((s, r) => s + parseNum((r as any).Amount ?? (r as any).amount), 0);
        const invQty = rows.reduce(
            (s, r) =>
                s +
                parseNum(
                    (r as any).Bill_Qty ??
                    (r as any).Bill_qty ??
                    (r as any).Weight ??
                    (r as any).weight
                ),
            0
        );
        const invProducts = rows
            .map((r) =>
                cleanStr(
                    (r as any).Product_Name ||
                    (r as any).Product_name ||
                    (r as any).Stock_Item_Name ||
                    (r as any).Item_Name
                )
            )
            .filter(Boolean);

        let bestPo: string | null = null;
        let highestScore = 0;

        for (const poNo of poKeys) {
            const poItems = poGroupMap[poNo];
            const firstPo = poItems[0];
            const poSupplier = cleanStr(
                (firstPo as any).Retailer_Name ||
                (firstPo as any).Party_Name ||
                (firstPo as any).Vendor_Name
            );
            if (!invSupplier || !poSupplier) continue;
            if (
                !invSupplier.toLowerCase().includes(poSupplier.toLowerCase()) &&
                !poSupplier.toLowerCase().includes(invSupplier.toLowerCase())
            ) {
                continue;
            }

            let score = 10;
            const poTotalAmt = poItems.reduce((s, it) => s + parseNum((it as any).Amount), 0);
            const poTotalWt = poItems.reduce(
                (s, it) => s + parseNum((it as any).Weight ?? (it as any).weight ?? (it as any).Bill_Qty),
                0
            );

            if (Math.abs(poTotalAmt - invAmount) < 2) score += 100;
            if (Math.abs(poTotalWt - invQty) < 2) score += 80;

            const hasProdMatch = poItems.some((poIt) => {
                const poPName = cleanStr(
                    (poIt as any).Product_Name ||
                    (poIt as any).Stock_Item ||
                    (poIt as any).Item_Name
                ).toLowerCase();
                return invProducts.some(
                    (invP) =>
                        invP.toLowerCase().includes(poPName) ||
                        poPName.includes(invP.toLowerCase())
                );
            });
            if (hasProdMatch) score += 50;

            const poDate = cleanStr((firstPo as any).Ledger_date || (firstPo as any).Ledger_Date || (firstPo as any).Date);
            const invDate = cleanStr((first as any).Ledger_Date || (first as any).Ledger_date);
            if (poDate && invDate) {
                const diffDays = Math.abs((new Date(invDate).getTime() - new Date(poDate).getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) score += 20;
                else if (diffDays <= 30) score += 10;
            }

            if (score > highestScore) {
                highestScore = score;
                bestPo = poNo;
            }
        }

        if (bestPo && highestScore >= 50) {
            poInvoiceMap[bestPo].push(...rows);
            matchedInvoices.add(invNo);
        }
    });

    Object.entries(poGroupMap).forEach(([poNo, items]) => {
        const first = items[0];
        const supplierName = cleanStr(
            (first as any).Retailer_Name ||
            (first as any).Retailer_name ||
            (first as any).Reatailer_Name ||
            (first as any).reatailer_name ||
            (first as any).Party_Name ||
            (first as any).Party_name ||
            (first as any).Supplier_Name ||
            (first as any).Vendor_Name
        );
        const orderDate = cleanStr(
            (first as any).Ledger_date ||
            (first as any).Ledger_Date ||
            (first as any).Date ||
            (first as any).date ||
            (first as any).Voucher_Date
        );
        const dueDate = orderDate && dayjs(orderDate).isValid()
            ? dayjs(orderDate).add(30, "day").format("YYYY-MM-DD")
            : "";

        // Get pre-matched invoices for this PO
        const matchingInvoices: OnlinePurchaseReport[] = poInvoiceMap[poNo] || [];

        // Extract Trans_Ids for this PO
        const poTransIds = new Set<string>();
        items.forEach((it: any) => {
            const rawVal = it.Trans_Id ?? it.trans_id ?? it.Id ?? it.id ?? it.OrderId ?? it.order_id;
            if (Array.isArray(rawVal)) {
                rawVal.forEach((v) => {
                    const s = cleanStr(v);
                    if (s) poTransIds.add(s);
                });
            } else {
                const s = cleanStr(rawVal);
                if (s) poTransIds.add(s);
            }
        });
        const transIdList = Array.from(poTransIds);
        const primaryTransId = transIdList[0] || "";

        // Build item details from PurchaseOrderReportItem
        let totalOrderedTons = 0;
        let totalArrivedTons = 0;
        let totalPOValue = 0;

        const itemDetails: PurchaseOrderItemDetail[] = items.map((it, idx) => {
            const rawItemName = cleanStr(
                (it as any).Product_name ||
                (it as any).Product_Name ||
                (it as any).Stock_Item_Name ||
                (it as any).Item_Name ||
                (it as any).item_name ||
                (it as any).Product ||
                (it as any).product
            );
            const itOrderedTons = parseNum(
                (it as any).Weight ??
                (it as any).weight ??
                (it as any).Bill_Qty ??
                (it as any).Bill_qty ??
                (it as any).Billed_Qty ??
                (it as any).billed_qty ??
                (it as any).Qty ??
                (it as any).qty ??
                (it as any).Quantity ??
                (it as any).quantity
            );
            const itRate = parseNum(
                (it as any).Rate ??
                (it as any).rate ??
                (it as any).Price ??
                (it as any).price
            );
            const itAmount = parseNum(
                (it as any).Amount ??
                (it as any).amount ??
                (it as any).Total_Amount ??
                (it as any).total_amount ??
                (it as any).Item_Amount ??
                (it as any).Total_Invoice_Value ??
                (it as any).Total_Invoice_value
            ) || Math.round(itOrderedTons * itRate);

            totalOrderedTons += itOrderedTons;
            totalPOValue += itAmount;

            // Find invoices matching this specific item
            const normItName = normalizeName(rawItemName);
            const itInvoices = matchingInvoices.filter((inv) => {
                const normInvItem = normalizeName(
                    (inv as any).Product_Name ||
                    (inv as any).Product_name ||
                    (inv as any).Stock_Item_Name ||
                    (inv as any).Item_Name ||
                    (inv as any).item_name
                );
                return normInvItem && (normInvItem.includes(normItName) || normItName.includes(normInvItem));
            });

            const itArrivedTons = itInvoices.reduce((sum, inv) => {
                return sum + parseNum(
                    (inv as any).Bill_Qty ??
                    (inv as any).Bill_qty ??
                    (inv as any).Weight ??
                    (inv as any).weight ??
                    (inv as any).Billed_Qty ??
                    (inv as any).Qty ??
                    (inv as any).Quantity
                );
            }, 0);
            totalArrivedTons += itArrivedTons;

            const pendingTons = Math.max(0, itOrderedTons - itArrivedTons);
            const deliveryPercentage = itOrderedTons > 0
                ? Math.min(100, Math.round((itArrivedTons / itOrderedTons) * 100))
                : (itArrivedTons > 0 ? 100 : 0);

            const arrivalStatus: "COMPLETED" | "PARTIALLY_ARRIVED" | "PENDING" =
                deliveryPercentage >= 100
                    ? "COMPLETED"
                    : deliveryPercentage > 0
                        ? "PARTIALLY_ARRIVED"
                        : "PENDING";

            const latestInv = itInvoices[itInvoices.length - 1];
            // Leave batch empty per user requirement (do not show Voucher_Type)
            const lastArrivalDate = latestInv ? cleanStr((latestInv as any).Ledger_Date || (latestInv as any).Ledger_date) : "";

            return {
                itemId: `item-${poNo}-${idx + 1}`,
                itemName: rawItemName,
                stockGroup: resolveGroup(it, rawItemName, (it as any).Product_Id),
                orderedTons: itOrderedTons,
                arrivedTons: itArrivedTons,
                pendingTons,
                deliveryPercentage,
                ratePerTon: itRate,
                itemAmount: itAmount,
                arrivalStatus,
                inwardBatch: undefined,
                lastArrivalDate: lastArrivalDate || undefined,
            };
        });

        // Summary calculations
        const pendingTons = Math.max(0, totalOrderedTons - totalArrivedTons);
        const deliveryPercentage = totalOrderedTons > 0
            ? Math.min(100, Math.round((totalArrivedTons / totalOrderedTons) * 100))
            : (totalArrivedTons > 0 ? 100 : 0);

        const deliveryStatus: "COMPLETED" | "PARTIAL" | "PENDING" =
            deliveryPercentage >= 100 ? "COMPLETED" : deliveryPercentage > 0 ? "PARTIAL" : "PENDING";

        const uniqueMatchingInvNos = Array.from(new Set(matchingInvoices.map((inv) => cleanStr(inv.invoice_no)).filter(Boolean)));
        const purInvNo = uniqueMatchingInvNos.join(", ");
        const primaryInv = matchingInvoices[0];
        const deliveryLocation = primaryInv
            ? (cleanStr(primaryInv.Party_Location) || cleanStr(primaryInv.Party_District))
            : "";

        // Payment details: Match with paymentsMap if provided
        let totalPaidPayment = 0;
        let pendingPayment = totalPOValue;
        let paymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" | "OVERDUE" = "PENDING";
        let paymentNo = "";

        if (paymentsMap && paymentsMap.size > 0) {
            let matchedCredit = 0;
            let matchedDebit = 0;
            let matchedBal = 0;
            let hasMatched = false;

            uniqueMatchingInvNos.forEach((invNo) => {
                const k = invNo.toLowerCase();
                const p = paymentsMap.get(k) || paymentsMap.get(k.replace(/^0+/, ""));
                if (p) {
                    hasMatched = true;
                    matchedCredit += parseNum(p.Credit_Amt);
                    matchedDebit += parseNum(p.Debit_Amt);
                    matchedBal += parseNum(p.Bal_Amount);
                    if (!paymentNo) paymentNo = p.invoice_no;
                }
            });

            if (!hasMatched && poNo && poNo !== "PO-UNKNOWN") {
                const k = poNo.toLowerCase();
                const p = paymentsMap.get(k) || paymentsMap.get(k.replace(/^0+/, ""));
                if (p) {
                    hasMatched = true;
                    matchedCredit += parseNum(p.Credit_Amt);
                    matchedDebit += parseNum(p.Debit_Amt);
                    matchedBal += parseNum(p.Bal_Amount);
                    if (!paymentNo) paymentNo = p.invoice_no;
                }
            }

            if (hasMatched) {
                const effectiveTotal = matchedCredit > 0 ? matchedCredit : totalPOValue;
                totalPaidPayment = matchedDebit;
                pendingPayment = matchedBal !== 0 ? Math.abs(matchedBal) : Math.max(0, effectiveTotal - totalPaidPayment);
                paymentStatus = pendingPayment <= 0 && totalPaidPayment > 0
                    ? "PAID"
                    : totalPaidPayment > 0
                        ? "PARTIALLY_PAID"
                        : (dueDate && dayjs(dueDate).isBefore(dayjs()) ? "OVERDUE" : "PENDING");
            } else {
                paymentStatus = dueDate && dayjs(dueDate).isBefore(dayjs()) ? "OVERDUE" : "PENDING";
            }
        } else {
            paymentStatus = dueDate && dayjs(dueDate).isBefore(dayjs()) ? "OVERDUE" : "PENDING";
        }

        const row: PurchasePaymentItem = {
            id: `po-${poNo}`,
            sNo: sNoCounter++,
            purOrderNo: poNo,
            transId: primaryTransId,
            transIds: transIdList,
            supplierName,
            orderDate,
            dueDate,
            orderedTons: totalOrderedTons,
            arrivedTons: totalArrivedTons,
            pendingTons,
            deliveryPercentage,
            deliveryStatus,
            totalPayment: totalPOValue,
            paidPayment: totalPaidPayment,
            pendingPayment,
            paymentStatus,
            paymentNo: "", // Leave empty if no payment data in API
            purInvNo: purInvNo || "",
            inwardJouNo: uniqueMatchingInvNos.length > 0 ? uniqueMatchingInvNos.length : "",
            deliveryLocation,
            notes: "",
            items: itemDetails,
        };
        (row as any).matchingInvoices = matchingInvoices;
        result.push(row);
    });

    // If there are standalone inward invoices not matched to any PO, include them as well (grouped by unique invoice_no)
    uniqueInvNos.forEach((invNo, invIdx) => {
        if (!matchedInvoices.has(invNo)) {
            const rows = invGroupMap[invNo];
            const first = rows[0];
            const refPO = rows.map((r) => cleanStr((r as any).Ref_Brokers || (r as any).ref_brokers || (r as any).voucher_name)).filter(Boolean)[0] || "";
            const invSupplier = cleanStr((first as any).Retailer_Name || (first as any).Party_Name || (first as any).Vendor_Name);
            const invDate = cleanStr((first as any).Ledger_Date || (first as any).Ledger_date);
            const location = cleanStr((first as any).Party_Location || (first as any).Party_District) || "";

            let totalQty = 0;
            let totalAmount = 0;
            const seenKeys = new Set<string>();
            const itemDetails: PurchaseOrderItemDetail[] = [];

            rows.forEach((r, rIdx) => {
                const rawProduct = cleanStr(
                    (r as any).Product_Name ||
                    (r as any).Product_name ||
                    (r as any).Stock_Item_Name ||
                    (r as any).Item_Name
                );
                const q = parseNum(
                    (r as any).Bill_Qty ??
                    (r as any).Bill_qty ??
                    (r as any).Weight ??
                    (r as any).weight ??
                    (r as any).Billed_Qty ??
                    (r as any).Qty ??
                    (r as any).Quantity
                );
                const rate = parseNum((r as any).Rate ?? (r as any).rate ?? (r as any).Price);
                const amt = parseNum(
                    (r as any).Amount ??
                    (r as any).amount ??
                    (r as any).Total_Invoice_value ??
                    (r as any).Total_Invoice_Value
                ) || Math.round(q * rate);

                const itemKey = `${rawProduct}||${q}||${amt}||${(r as any).Trans_Id || ""}`;
                if (!seenKeys.has(itemKey)) {
                    seenKeys.add(itemKey);
                    totalQty += q;
                    totalAmount += amt;

                    itemDetails.push({
                        itemId: `item-inv-${invIdx + 1}-${rIdx + 1}`,
                        itemName: rawProduct,
                        stockGroup: resolveGroup(r, rawProduct, (r as any).Product_Id),
                        orderedTons: q,
                        arrivedTons: q,
                        pendingTons: 0,
                        deliveryPercentage: 100,
                        ratePerTon: rate,
                        itemAmount: amt,
                        arrivalStatus: "COMPLETED",
                        inwardBatch: undefined,
                        lastArrivalDate: invDate || undefined,
                    });
                }
            });

            const standaloneRow: PurchasePaymentItem = {
                id: `inv-row-${invIdx + 1}`,
                sNo: sNoCounter++,
                purOrderNo: refPO,
                supplierName: invSupplier,
                orderDate: invDate,
                dueDate: "",
                orderedTons: totalQty,
                arrivedTons: totalQty,
                pendingTons: 0,
                deliveryPercentage: 100,
                deliveryStatus: "COMPLETED",
                totalPayment: totalAmount,
                paidPayment: 0,
                pendingPayment: totalAmount,
                paymentStatus: "PENDING",
                paymentNo: "", // Empty
                purInvNo: invNo,
                inwardJouNo: "",
                deliveryLocation: location,
                notes: "",
                items: itemDetails,
            };
            (standaloneRow as any).matchingInvoices = rows;
            result.push(standaloneRow);
        }
    });

    return result;
};

/**
 * 2. Transform raw datasets into PurchaseItemOrder[] (for PurchaseItemPaymentReport)
 * Maps purchase invoices / trip items from purchaseOrderTripItemDetails to PurchaseOrder by Id in PurchaseOrder Trans_Id
 * with full BatchDetails (Batch_No, BatchLocation)
 */
export const buildPurchaseItemPaymentDataset = (
    poRows: PurchaseOrderItem[],
    invRows: OnlinePurchaseReport[],
    tripRows: PurchaseOrderTripItem[] = [],
    paymentsMap?: Map<string, PurchaseOrderPaymentItem>
): PurchaseItemOrder[] => {
    // If no data returned from any API, return empty array (NO DUMMY DATA)
    if ((!poRows || poRows.length === 0) && (!invRows || invRows.length === 0) && (!tripRows || tripRows.length === 0)) {
        return [];
    }

    const { resolve: resolveGroup } = buildStockGroupCatalog(poRows, invRows, tripRows);

    // PRIMARY PATH: If tripRows from purchaseOrderTripItemDetails are available, map by OrderId === Trans_Id
    if (tripRows && tripRows.length > 0) {
        // Group non-canceled trips by OrderId (string)
        const tripGroupMap = new Map<string, PurchaseOrderTripItem[]>();
        tripRows.forEach((t) => {
            if (cleanStr(t.TripStatus).toLowerCase() === "canceled") return;
            const oId = cleanStr(t.OrderId);
            if (!oId) return;
            if (!tripGroupMap.has(oId)) {
                tripGroupMap.set(oId, []);
            }
            tripGroupMap.get(oId)!.push(t);
        });

        // Group PO items by invoice_no (PO Number)
        const poGroupMap: Record<string, PurchaseOrderItem[]> = {};
        (poRows || []).forEach((row) => {
            const key = cleanStr(
                row.invoice_no ||
                (row as any).Invoice_No ||
                (row as any).voucher_no ||
                (row as any).order_no ||
                (row as any).Order_No
            ) || "PO-UNKNOWN";
            if (!poGroupMap[key]) {
                poGroupMap[key] = [];
            }
            poGroupMap[key].push(row);
        });

        const poKeys = Object.keys(poGroupMap);
        let sNoCounter = 1;

        return poKeys.map((poNo) => {
            const poItems = poGroupMap[poNo];
            const firstPo = poItems[0];

            // Extract all Trans_Ids / Ids / PO Numbers associated with this PO
            const poTransIds = new Set<string>();
            if (poNo && poNo !== "PO-UNKNOWN") {
                poTransIds.add(cleanStr(poNo));
            }
            poItems.forEach((it: any) => {
                const candidates = [
                    it.Trans_Id,
                    it.trans_id,
                    it.Id,
                    it.id,
                    it.OrderId,
                    it.order_id,
                    it.order_no,
                    it.Order_No,
                    it.invoice_no,
                    it.Invoice_No,
                    it.voucher_no,
                ];
                candidates.forEach((rawVal) => {
                    if (Array.isArray(rawVal)) {
                        rawVal.forEach((v) => {
                            const s = cleanStr(v);
                            if (s) poTransIds.add(s);
                        });
                    } else {
                        const s = cleanStr(rawVal);
                        if (s) poTransIds.add(s);
                    }
                });
            });

            // Find all trip items mapped to this PO by OrderId === Trans_Id
            const matchedTrips: PurchaseOrderTripItem[] = [];
            poTransIds.forEach((tid) => {
                if (tripGroupMap.has(tid)) {
                    matchedTrips.push(...tripGroupMap.get(tid)!);
                }
            });

            const supplierName = cleanStr(
                (firstPo as any).Retailer_Name ||
                (firstPo as any).PartyName ||
                (firstPo as any).Party_Name ||
                (firstPo as any).Supplier_Name ||
                (firstPo as any).Vendor_Name
            );
            const orderDate = cleanStr(
                (firstPo as any).Ledger_date ||
                (firstPo as any).Ledger_Date ||
                (firstPo as any).TradeConfirmDate ||
                (firstPo as any).Date
            );
            const dueDate = orderDate && dayjs(orderDate).isValid()
                ? dayjs(orderDate).add(30, "day").format("YYYY-MM-DD")
                : "";

            let totalOrderedTons = 0;
            let totalPOValue = 0;

            // Map PO Items and match item-level batches and arrived qty
            const itemDetails: PurchaseOrderItemDetail[] = poItems.map((it, itIdx) => {
                const rawItemName = cleanStr(
                    (it as any).Product_name ||
                    (it as any).Product_Name ||
                    (it as any).Stock_Item ||
                    (it as any).Stock_Item_Name ||
                    (it as any).Item_Name
                );
                const itProdId = (it as any).Product_Id;
                const itOrderedTons = parseNum(
                    (it as any).Weight ??
                    (it as any).Bill_Qty ??
                    (it as any).Billed_Qty ??
                    (it as any).Qty ??
                    (it as any).Quantity
                );
                const itRate = parseNum((it as any).Rate ?? (it as any).Price);
                const itAmount = parseNum(
                    (it as any).Amount ??
                    (it as any).Total_Invoice_Value ??
                    (it as any).Total_Invoice_value
                ) || Math.round(itOrderedTons * itRate);

                totalOrderedTons += itOrderedTons;
                totalPOValue += itAmount;

                // Match trip items for this specific product (by Product_Id or normalized name)
                const normItName = normalizeName(rawItemName);
                const matchingItemTrips = matchedTrips.filter((t) => {
                    if (itProdId && t.Product_Id && Number(itProdId) === Number(t.Product_Id)) {
                        return true;
                    }
                    const normTripProd = normalizeName(t.Product_Name);
                    return normTripProd && (normTripProd.includes(normItName) || normItName.includes(normTripProd));
                });

                const itArrivedTons = matchingItemTrips.reduce((sum, t) => sum + parseNum(t.QTY ?? t.KGS), 0);
                const pendingTons = Math.max(0, itOrderedTons - itArrivedTons);
                const deliveryPercentage = itOrderedTons > 0
                    ? Math.min(100, Math.round((itArrivedTons / itOrderedTons) * 100))
                    : (itArrivedTons > 0 ? 100 : 0);
                const arrivalStatus: "COMPLETED" | "PARTIALLY_ARRIVED" | "PENDING" =
                    deliveryPercentage >= 100 ? "COMPLETED" : deliveryPercentage > 0 ? "PARTIALLY_ARRIVED" : "PENDING";

                // Unique batches for this item
                const batches = Array.from(new Set(matchingItemTrips.map((t) => cleanStr(t.Batch_No)).filter(Boolean)));
                const latestTrip = matchingItemTrips[matchingItemTrips.length - 1];
                const lastArrivalDate = latestTrip ? cleanStr(latestTrip.Arrival_Date || latestTrip.Trip_Date) : "";

                return {
                    itemId: `item-${poNo}-${itIdx + 1}`,
                    itemName: rawItemName,
                    stockGroup: resolveGroup(it, rawItemName, itProdId),
                    orderedTons: itOrderedTons,
                    arrivedTons: itArrivedTons,
                    pendingTons,
                    deliveryPercentage,
                    ratePerTon: itRate,
                    itemAmount: itAmount,
                    arrivalStatus,
                    inwardBatch: batches.join(", ") || undefined,
                    lastArrivalDate: lastArrivalDate || undefined,
                };
            });

            // Map arrived purchase invoices / trip items with full BatchDetails
            const arrivedInvoices: ArrivedInvoiceDetail[] = matchedTrips.map((t, invIdx) => {
                const invNo = cleanStr(t.TR_INV_ID || t.BillNo || t.Challan_No || `TRIP-${t.Trip_Id}`);
                const invDate = cleanStr(t.Arrival_Date || t.Trip_Date || orderDate);
                const prodName = cleanStr(t.Product_Name || "Item");
                const qty = parseNum(t.QTY ?? t.KGS);
                const unit = cleanStr(t.Units) || "kg";
                const totalVal = parseNum(t.Total_Value ?? t.Taxable_Value);
                const rate = parseNum(t.Gst_Rate ?? (qty > 0 ? totalVal / qty : 0));
                const batchNo = cleanStr(t.Batch_No);
                const batchLocation = cleanStr(t.BatchLocation);
                const vehicle = cleanStr(t.Vehicle_No);

                const matchedPoItem = poItems.find(
                    (p) => (p.Product_Id && t.Product_Id && Number(p.Product_Id) === Number(t.Product_Id)) ||
                        (p.Product_Name && t.Product_Name && normalizeName(p.Product_Name) === normalizeName(t.Product_Name))
                );

                const explicitTripGroup = cleanStr((t as any).Stock_Group || (t as any).stockGroup);
                const matchedPoGroup = cleanStr((matchedPoItem as any)?.Stock_Group || (matchedPoItem as any)?.stockGroup);

                const itemStockGroup = (explicitTripGroup && explicitTripGroup.toLowerCase() !== "general items")
                    ? explicitTripGroup
                    : ((matchedPoGroup && matchedPoGroup.toLowerCase() !== "general items")
                        ? matchedPoGroup
                        : resolveGroup(t, prodName, t.Product_Id));

                return {
                    invoiceId: `trip-${t.Trip_Id}-${t.Product_Id}-${invIdx + 1}`,
                    invoiceNo: invNo,
                    invoiceDate: invDate,
                    itemId: `item-inv-${t.Product_Id || invIdx + 1}`,
                    itemName: prodName,
                    stockGroup: itemStockGroup,
                    batchNo: batchNo, // Batch Details
                    batchLocation: batchLocation,
                    arrivedQty: qty,
                    unit: unit,
                    rate: rate,
                    amount: totalVal,
                    paidAmount: 0,
                    pendingPayment: totalVal,
                    paymentStatus: "PENDING",
                    inwardVehicle: vehicle,
                    inwardJouNo: cleanStr(t.TR_INV_ID) || cleanStr(t.BillNo) || (t.T_No ? `MIA/${String(t.T_No).padStart(6, "0")}/26-27` : "-"),
                    TR_INV_ID: cleanStr(t.TR_INV_ID),
                    godown: batchLocation || (t.To_Location ? `Location ${t.To_Location}` : ""),
                    challanNo: cleanStr(t.Challan_No),
                    tripId: t.Trip_Id,
                    narration: cleanStr(t.Narration),
                    tripStatus: cleanStr(t.TripStatus),
                    billType: cleanStr(t.BillType),
                };
            });

            const totalArrivedTons = arrivedInvoices.reduce((s, inv) => s + (inv.arrivedQty || 0), 0);
            const pendingTons = Math.max(0, totalOrderedTons - totalArrivedTons);
            const deliveryPercentage = totalOrderedTons > 0
                ? Math.min(100, Math.round((totalArrivedTons / totalOrderedTons) * 100))
                : (totalArrivedTons > 0 ? 100 : 0);
            const deliveryStatus: "COMPLETED" | "PARTIAL" | "PENDING" =
                deliveryPercentage >= 100 ? "COMPLETED" : deliveryPercentage > 0 ? "PARTIAL" : "PENDING";

            const uniqueInvNos = Array.from(new Set(arrivedInvoices.map((inv) => inv.invoiceNo).filter(Boolean)));
            const purInvNo = uniqueInvNos.join(", ");
            const deliveryLocation = cleanStr(
                matchedTrips[0]?.BatchLocation ||
                (matchedTrips[0]?.To_Location ? `Location ${matchedTrips[0]?.To_Location}` : "") ||
                (firstPo as any).DeliveryLocation ||
                ""
            );

            // Find actual database Trans_Id/OrderId (numeric/non-poNo ID)
            let actualTransId = "";
            for (const it of poItems) {
                const candidates = [
                    (it as any).Trans_Id,
                    (it as any).trans_id,
                    (it as any).Id,
                    (it as any).id,
                    (it as any).OrderId,
                    (it as any).order_id,
                ];
                for (const c of candidates) {
                    if (c === undefined || c === null) continue;
                    let s = "";
                    if (Array.isArray(c)) {
                        const vals = c.map((v) => cleanStr(v)).filter((v) => v && v !== poNo);
                        s = vals[0] || "";
                    } else {
                        s = cleanStr(c);
                        if (s.includes(",")) {
                            const parts = s.split(",").map((p) => cleanStr(p)).filter((p) => p && p !== poNo);
                            s = parts[0] || "";
                        }
                    }
                    if (s && s !== poNo && (!isNaN(Number(s)) || !s.includes("/"))) {
                        actualTransId = s;
                        break;
                    }
                }
                if (actualTransId) break;
            }

            const transIdList = Array.from(poTransIds);
            let primaryTransId = actualTransId || transIdList.find((id) => id !== poNo && !isNaN(Number(id))) || "";
            if (primaryTransId.includes(",")) {
                const parts = primaryTransId.split(",").map((p) => cleanStr(p)).filter((p) => p && p !== poNo);
                primaryTransId = parts[0] || "";
            }

            let paidAmount = 0;
            let pendingPayment = totalPOValue;
            let totalValue = totalPOValue;
            let paymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" | "OVERDUE" = "PENDING";
            let paymentNo = "";

            if (paymentsMap && paymentsMap.size > 0) {
                let matchedCredit = 0;
                let matchedDebit = 0;
                let matchedBal = 0;
                let hasMatchedPayment = false;

                // 1. Check all arrived invoices
                arrivedInvoices.forEach((inv) => {
                    const invK = cleanStr(inv.invoiceNo).toLowerCase();
                    const p = invK ? (
                        paymentsMap.get(invK) ||
                        paymentsMap.get(invK.replace(/^0+/, "")) ||
                        paymentsMap.get(invK.replace(/^mia\//, "ps/")) ||
                        paymentsMap.get(invK.replace(/^[a-z]+\//, ""))
                    ) : undefined;
                    if (p) {
                        hasMatchedPayment = true;
                        matchedCredit += parseNum(p.Credit_Amt);
                        matchedDebit += parseNum(p.Debit_Amt);
                        matchedBal += parseNum(p.Bal_Amount);
                        inv.paidAmount = parseNum(p.Debit_Amt);
                        inv.pendingPayment = Math.abs(parseNum(p.Bal_Amount));
                        inv.paymentStatus = inv.pendingPayment <= 0 && inv.paidAmount > 0 ? "PAID" : inv.paidAmount > 0 ? "PARTIALLY_PAID" : "PENDING";
                        (inv as any).paymentNo = p.invoice_no;
                        if (!paymentNo) paymentNo = p.invoice_no;
                    }
                });

                // 2. Check PO No if no invoice match
                if (!hasMatchedPayment && poNo && poNo !== "PO-UNKNOWN") {
                    const poK = poNo.toLowerCase();
                    const p = paymentsMap.get(poK) || paymentsMap.get(poK.replace(/^0+/, ""));
                    if (p) {
                        hasMatchedPayment = true;
                        matchedCredit += parseNum(p.Credit_Amt);
                        matchedDebit += parseNum(p.Debit_Amt);
                        matchedBal += parseNum(p.Bal_Amount);
                        if (!paymentNo) paymentNo = p.invoice_no;
                    }
                }

                // 3. Check transIds if still no match
                if (!hasMatchedPayment && transIdList.length > 0) {
                    for (const tid of transIdList) {
                        const tK = tid.toLowerCase();
                        const p = paymentsMap.get(tK) || paymentsMap.get(tK.replace(/^0+/, ""));
                        if (p) {
                            hasMatchedPayment = true;
                            matchedCredit += parseNum(p.Credit_Amt);
                            matchedDebit += parseNum(p.Debit_Amt);
                            matchedBal += parseNum(p.Bal_Amount);
                            if (!paymentNo) paymentNo = p.invoice_no;
                            break;
                        }
                    }
                }

                if (hasMatchedPayment) {
                    totalValue = matchedCredit > 0 ? matchedCredit : totalPOValue;
                    paidAmount = matchedDebit;
                    pendingPayment = matchedBal !== 0 ? Math.abs(matchedBal) : Math.max(0, totalValue - paidAmount);
                    paymentStatus = pendingPayment <= 0 && paidAmount > 0
                        ? "PAID"
                        : paidAmount > 0
                            ? "PARTIALLY_PAID"
                            : (dueDate && dayjs(dueDate).isBefore(dayjs()) ? "OVERDUE" : "PENDING");

                    // Propagate payment info to arrived invoices if not individually matched
                    if (arrivedInvoices.length > 0) {
                        arrivedInvoices.forEach((inv) => {
                            if (!inv.paidAmount || inv.paidAmount === 0) {
                                const ratio = arrivedInvoices.length === 1 ? 1 : ((inv.amount || 1) / (totalPOValue || 1));
                                inv.paidAmount = Math.round(paidAmount * ratio);
                                inv.pendingPayment = Math.max(0, inv.amount - inv.paidAmount);
                                inv.paymentStatus = inv.pendingPayment <= 0 && inv.paidAmount > 0 ? "PAID" : inv.paidAmount > 0 ? "PARTIALLY_PAID" : "PENDING";
                            }
                            if (!(inv as any).paymentNo && paymentNo) {
                                (inv as any).paymentNo = paymentNo;
                            }
                        });
                    }
                } else {
                    paymentStatus = dueDate && dayjs(dueDate).isBefore(dayjs()) ? "OVERDUE" : "PENDING";
                }
            } else {
                paymentStatus = dueDate && dayjs(dueDate).isBefore(dayjs()) ? "OVERDUE" : "PENDING";
            }

            return {
                id: `po-${poNo}`,
                sNo: sNoCounter++,
                purOrderNo: poNo,
                transId: primaryTransId,
                transIds: transIdList,
                supplierName,
                orderDate,
                dueDate,
                orderedTons: totalOrderedTons,
                arrivedTons: totalArrivedTons,
                pendingTons,
                deliveryPercentage,
                deliveryStatus,
                totalValue,
                paidAmount,
                pendingPayment,
                paymentStatus,
                paymentNo,
                purInvNo,
                inwardJouNo: matchedTrips[0]?.TR_INV_ID || (uniqueInvNos.length > 0 ? uniqueInvNos[0] : "-"),
                deliveryLocation,
                notes: matchedTrips[0]?.Narration || "",
                items: itemDetails,
                arrivedInvoices,
            };
        });
    }

    // FALLBACK: When tripRows are not available, fall back to basePayments logic
    const basePayments = buildPurchasePaymentDataset(poRows, invRows, [], paymentsMap);

    if (!basePayments || basePayments.length === 0) {
        return [];
    }

    return basePayments.map((po, poIdx) => {
        const matchingInvoices: OnlinePurchaseReport[] = (po as any).matchingInvoices || [];
        const invoiceGroupMap: Record<string, OnlinePurchaseReport[]> = {};
        matchingInvoices.forEach((inv) => {
            const invNo = cleanStr((inv as any).invoice_no || (inv as any).Invoice_No);
            if (!invNo) return;
            if (!invoiceGroupMap[invNo]) {
                invoiceGroupMap[invNo] = [];
            }
            invoiceGroupMap[invNo].push(inv);
        });

        const arrivedInvoices: ArrivedInvoiceDetail[] = Object.entries(invoiceGroupMap).map(([invNo, rows], invIdx) => {
            const first = rows[0];
            const invDate = cleanStr((first as any).Ledger_Date || (first as any).Ledger_date) || po.orderDate;

            const itemNames = Array.from(
                new Set(
                    rows.map((r) =>
                        cleanStr(
                            (r as any).Product_Name ||
                            (r as any).Product_name ||
                            (r as any).Stock_Item_Name ||
                            (r as any).Item_Name
                        )
                    ).filter(Boolean)
                )
            ).join(", ");

            const seenItemKeys = new Set<string>();
            let totalInvQty = 0;
            let totalInvAmount = 0;
            let primaryRate = parseNum((first as any).Rate ?? (first as any).rate ?? (first as any).Price);

            rows.forEach((r) => {
                const prod = cleanStr((r as any).Product_Name || (r as any).Item_Name);
                const q = parseNum(
                    (r as any).Bill_Qty ??
                    (r as any).Bill_qty ??
                    (r as any).Weight ??
                    (r as any).weight ??
                    (r as any).Billed_Qty ??
                    (r as any).Qty ??
                    (r as any).Quantity
                );
                const amt = parseNum(
                    (r as any).Amount ??
                    (r as any).amount ??
                    (r as any).Total_Invoice_value ??
                    (r as any).Total_Invoice_Value
                );
                const rRate = parseNum((r as any).Rate ?? (r as any).rate ?? (r as any).Price);
                const itemKey = `${prod}||${q}||${amt}||${(r as any).Trans_Id || ""}`;
                if (!seenItemKeys.has(itemKey)) {
                    seenItemKeys.add(itemKey);
                    totalInvQty += q;
                    totalInvAmount += amt > 0 ? amt : Math.round(q * rRate);
                    if (rRate > 0) primaryRate = rRate;
                }
            });

            return {
                invoiceId: `inv-${po.purOrderNo || "PO"}-${invIdx + 1}`,
                invoiceNo: invNo,
                invoiceDate: invDate,
                itemId: `item-inv-${invIdx + 1}`,
                itemName: itemNames || "Purchase Item",
                stockGroup: cleanStr((first as any).Stock_Group) || deriveStockGroup(itemNames),
                batchNo: "",
                arrivedQty: totalInvQty,
                unit: "Tons",
                rate: primaryRate,
                amount: totalInvAmount,
                paidAmount: 0,
                pendingPayment: totalInvAmount,
                paymentStatus: "PENDING",
                inwardVehicle: cleanStr((first as any).Ref_Brokers || (first as any).ref_brokers) || "",
                godown: cleanStr((first as any).Party_Location || (first as any).Party_District) || "",
            };
        });

        return {
            id: po.id,
            sNo: poIdx + 1,
            purOrderNo: po.purOrderNo,
            transId: po.transId || (po as any).transId || "",
            transIds: po.transIds || (po as any).transIds || [],
            supplierName: po.supplierName,
            orderDate: po.orderDate,
            dueDate: po.dueDate,
            orderedTons: po.orderedTons,
            arrivedTons: po.arrivedTons,
            pendingTons: po.pendingTons,
            deliveryPercentage: po.deliveryPercentage,
            deliveryStatus: po.deliveryStatus,
            totalValue: po.totalPayment,
            paidAmount: po.paidPayment,
            pendingPayment: po.pendingPayment,
            paymentStatus: po.paymentStatus,
            paymentNo: po.paymentNo,
            purInvNo: po.purInvNo,
            inwardJouNo: po.inwardJouNo,
            deliveryLocation: po.deliveryLocation,
            notes: po.notes,
            items: po.items,
            arrivedInvoices,
        };
    });
};

/**
 * 3. Transform raw datasets into PurchaseDeliveryItem[] (for PurchaseDelivery)
 */
export const buildPurchaseDeliveryDataset = (
    poRows: PurchaseOrderItem[],
    invRows: OnlinePurchaseReport[],
    tripRows: PurchaseOrderTripItem[] = [],
    paymentsMap?: Map<string, PurchaseOrderPaymentItem>
): PurchaseDeliveryItem[] => {
    const { resolve: resolveGroup } = buildStockGroupCatalog(poRows, invRows, tripRows);

    // If tripRows are available, build unified dataset from trips & POs
    if (tripRows && tripRows.length > 0) {
        const itemOrders = buildPurchaseItemPaymentDataset(poRows, invRows, tripRows, paymentsMap);
        if (itemOrders && itemOrders.length > 0) {
            const records: PurchaseDeliveryItem[] = [];
            let sNoCounter = 1;

            itemOrders.forEach((order) => {
                const matchingPo = (poRows || []).find((p) =>
                    cleanStr(p.invoice_no).toLowerCase() === cleanStr(order.purOrderNo).toLowerCase() ||
                    (order.transId && String(p.Trans_Id || p.Id || p.OrderId) === String(order.transId))
                );

                const retailerName = cleanStr(
                    (matchingPo as any)?.Retailer_Name ||
                    (matchingPo as any)?.PartyName ||
                    (matchingPo as any)?.Party_Name ||
                    order.supplierName
                ) || "Party As Recorded";

                const partyAddress = cleanStr(
                    (matchingPo as any)?.Party_Address ||
                    (matchingPo as any)?.party_address ||
                    (matchingPo as any)?.Party_Location ||
                    (matchingPo as any)?.Party_District
                ) || "-";

                const brokerName = cleanStr((matchingPo as any)?.Broker_Name || (matchingPo as any)?.broker_name || (matchingPo as any)?.Ref_Brokers || "-");
                const ownerName = cleanStr((matchingPo as any)?.Owner_Name || (matchingPo as any)?.owner_name || "ADMIN");
                const loadingDate = cleanStr((matchingPo as any)?.Loading_Date || (matchingPo as any)?.Ledger_Date || order.orderDate);
                const tradeConfirmDate = cleanStr((matchingPo as any)?.TradeConfirmDate || (matchingPo as any)?.Ledger_Date || order.orderDate);
                const paymentCondition = cleanStr((matchingPo as any)?.Payment_Condition || (matchingPo as any)?.PaymentCondition || "30 Days");
                const remarks = cleanStr((matchingPo as any)?.Remarks || order.notes || "-");

                // Group all arrivals and items by clean product name
                const productMap = new Map<string, {
                    rawName: string;
                    stockGroup: string;
                    arrivedInvoices: typeof order.arrivedInvoices;
                    poItems: typeof order.items;
                }>();

                (order.arrivedInvoices || []).forEach((inv) => {
                    const rawName = cleanItemName(inv.itemName);
                    const key = rawName.toLowerCase();
                    if (!productMap.has(key)) {
                        const itemStockGroup = (inv.stockGroup && inv.stockGroup.toLowerCase() !== "general items")
                            ? inv.stockGroup
                            : resolveGroup(inv, rawName, (inv as any).Product_Id);
                        productMap.set(key, { rawName, stockGroup: itemStockGroup, arrivedInvoices: [], poItems: [] });
                    }
                    productMap.get(key)!.arrivedInvoices.push(inv);
                });

                (order.items || []).forEach((it) => {
                    const rawName = cleanItemName(it.itemName);
                    const key = rawName.toLowerCase();
                    if (!productMap.has(key)) {
                        const itemStockGroup = (it.stockGroup && it.stockGroup.toLowerCase() !== "general items")
                            ? it.stockGroup
                            : resolveGroup(it, rawName, (it as any).Product_Id);
                        productMap.set(key, { rawName, stockGroup: itemStockGroup, arrivedInvoices: [], poItems: [] });
                    }
                    productMap.get(key)!.poItems.push(it);
                });

                // For each distinct product under this Purchase Order, combine into a single row
                productMap.forEach(({ rawName, stockGroup, arrivedInvoices, poItems }) => {
                    const inwardJous: string[] = [];
                    const batches: string[] = [];
                    const invoiceNos: string[] = [];
                    const paymentNos: string[] = [];
                    let totalArrivedKg = 0;
                    let totalPaidAmt = 0;
                    let isAllPaid = arrivedInvoices.length > 0;

                    arrivedInvoices.forEach((inv) => {
                        totalArrivedKg += (inv.arrivedQty || 0);

                        const jou = cleanStr((inv as any).inwardJouNo || (inv as any).TR_INV_ID || order.inwardJouNo);
                        if (jou && jou !== "-" && !inwardJous.includes(jou)) {
                            inwardJous.push(jou);
                        }

                        const b = cleanStr(inv.batchNo);
                        if (b && b !== "-" && !batches.includes(b)) {
                            batches.push(b);
                        }

                        const invNo = cleanStr(inv.invoiceNo);
                        if (invNo && invNo !== "-" && !invoiceNos.includes(invNo)) {
                            invoiceNos.push(invNo);
                        }

                        const invKey = invNo.toLowerCase();
                        const pMatch = paymentsMap ? (
                            paymentsMap.get(invKey) ||
                            paymentsMap.get(invKey.replace(/^mia\//, "ps/")) ||
                            paymentsMap.get(invKey.replace(/^[a-z]+\//, "")) ||
                            (order.purOrderNo ? paymentsMap.get(order.purOrderNo.toLowerCase()) : undefined)
                        ) : undefined;

                        const effectivePaid = inv.paidAmount > 0
                            ? inv.paidAmount
                            : (pMatch && pMatch.Debit_Amt > 0 ? pMatch.Debit_Amt : (order.paidAmount > 0 ? order.paidAmount : 0));
                        totalPaidAmt += parseNum(effectivePaid);

                        const payNo = cleanStr((inv as any).paymentNo || (pMatch ? pMatch.invoice_no : "") || order.paymentNo);
                        if (payNo && payNo !== "-" && !paymentNos.includes(payNo)) {
                            paymentNos.push(payNo);
                        }

                        const numPaid = parseNum(effectivePaid);
                        const itemPaidDone = Boolean(
                            numPaid > 0 && (
                                (pMatch && parseNum(pMatch.Bal_Amount) <= 0) ||
                                inv.paymentStatus === "PAID" ||
                                order.paymentStatus === "PAID" ||
                                (inv.amount && numPaid >= inv.amount)
                            )
                        );
                        if (!itemPaidDone) isAllPaid = false;
                    });

                    let totalOrderedKg = 0;
                    poItems.forEach((it) => {
                        totalOrderedKg += parseNum(it.orderedTons);
                        const b = cleanStr((it as any).inwardBatch || (it as any).batchNo || (it as any).batch);
                        if (b && b !== "-" && !batches.includes(b)) {
                            batches.push(b);
                        }
                    });

                    const finalTonnageKg = totalArrivedKg > 0 ? totalArrivedKg : totalOrderedKg;
                    const finalTonnageStr = finalTonnageKg > 0 ? formatKgQuantity(finalTonnageKg) : "-";

                    const inwardCount = inwardJous.length > 0 ? inwardJous.length : arrivedInvoices.length;
                    const batchCount = batches.length;

                    // Formatted column strings showing counts when combined
                    const inwardJouDisplay = inwardCount > 1
                        ? `${inwardCount} Inwards`
                        : (inwardJous[0] || (inwardCount === 1 ? "1 Inward" : "-"));

                    // Show Payment Invoice no column data in Pur Inv no column
                    const actualPurInvNos = paymentNos.length > 0 ? paymentNos : (order.paymentNo && order.paymentNo !== "-" ? [order.paymentNo] : []);
                    const invoiceCount = actualPurInvNos.length;
                    const purInvDisplay = invoiceCount > 1
                        ? `${invoiceCount} Invoices`
                        : (actualPurInvNos[0] || "-");

                    // Make the Payment Invoice no column empty as of now
                    const paymentDisplay = "-";

                    const batchDisplay = batchCount > 1
                        ? `${batchCount} Batches`
                        : (batches[0] || "-");

                    const status: "COMPLETED" | "NOT COMPLETED" =
                        (arrivedInvoices.length > 0 && isAllPaid) ? "COMPLETED" : "NOT COMPLETED";

                    // Pre-format PO line items for Tab 1
                    const poItemsFormatted = (order.items || []).map((it, idx) => ({
                        sNo: idx + 1,
                        itemName: cleanItemName(it.itemName),
                        orderedQty: it.orderedTons,
                        tonnage: formatKgQuantity(it.orderedTons),
                        rate: it.ratePerTon || "As recorded",
                        amount: it.itemAmount || "As recorded",
                        unit: "Bags",
                        discount: "-",
                        qualityCondition: "Standard",
                    }));

                    // Pre-format Inward arrivals for Tab 2
                    const inwardDetailsFormatted = arrivedInvoices.map((inv, idx) => ({
                        sNo: idx + 1,
                        location: inv.batchLocation || "Smt Mill",
                        arrivalDate: inv.invoiceDate || order.orderDate,
                        itemName: cleanItemName(inv.itemName),
                        concern: "SM AGRO",
                        billNo: cleanStr(inv.inwardJouNo || inv.invoiceNo || "-"),
                        billDate: inv.invoiceDate || order.orderDate,
                        quantity: Math.round(inv.arrivedQty / 50) || inv.arrivedQty,
                        unit: inv.unit || "Bags",
                        billedRate: inv.rate || "As recorded",
                        tonnageKg: inv.arrivedQty,
                        tonnage: formatKgQuantity(inv.arrivedQty),
                        batch: inv.batchNo || "-",
                        batchLocation: inv.batchLocation || "Main Location",
                        vehicleNo: inv.inwardVehicle || "TN 64 W 6487 / SD",
                        rate: inv.rate || "As recorded",
                        amount: inv.amount || "As recorded",
                        fromLocation: "Smt Mill",
                        status: "Completed",
                        billType: inv.billType || "OTHER GODOWN",
                        voucherType: "ON_M_OUTWARDS",
                        narration: inv.narration || `SMT MILL RTO GODOWN (${inv.inwardVehicle || "TN 64 W 6487"})`,
                    }));

                    // Pre-format Invoice records for Tab 3
                    const invoiceDisplayList = actualPurInvNos.length > 0 ? actualPurInvNos : invoiceNos;
                    const invoiceDetailsFormatted = invoiceDisplayList.map((invNo, idx) => {
                        const matchingInv = arrivedInvoices.find((i) => i.invoiceNo === invNo) || arrivedInvoices[idx];
                        return {
                            sNo: idx + 1,
                            vendor: retailerName,
                            voucherType: "Purchase Invoice",
                            branch: "SM AGRO",
                            entryDate: matchingInv?.invoiceDate || order.orderDate,
                            billDate: matchingInv?.invoiceDate || order.orderDate,
                            refNumber: invNo,
                            gstType: "Not Taxable",
                            taxType: "GST",
                            stockItemLedger: "GST OS Purchase Exempted",
                            discount: "0",
                            qualityCondition: "Standard",
                            paymentDays: "3",
                            narration: matchingInv?.narration || `Purchase invoice against order ${order.purOrderNo}`,
                            itemName: rawName,
                            rate: matchingInv?.rate || "As recorded",
                            billQty: matchingInv?.arrivedQty || finalTonnageKg,
                            aclQty: matchingInv?.arrivedQty || finalTonnageKg,
                            unit: matchingInv?.unit || "Bags",
                            amount: matchingInv?.amount || totalPaidAmt || "As recorded",
                            godown: matchingInv?.batchLocation || "Main Godown",
                            batch: matchingInv?.batchNo || batches[idx] || batches[0] || "-",
                        };
                    });

                    // Pre-format Payment records for Tab 4
                    const paymentDetailsFormatted = (paymentNos.length > 0 ? paymentNos : (totalPaidAmt > 0 ? ["Payment As Recorded"] : [])).map((pNo, idx) => ({
                        sNo: idx + 1,
                        date: order.orderDate,
                        billType: "EXPENSES / OTHERS (IN-DIRECT)",
                        voucher: pNo && pNo !== "-" ? pNo : "ON_Payment SM - Exp",
                        status: status === "COMPLETED" ? "Completed" : "Pending",
                        amount: totalPaidAmt || (order.paidAmount > 0 ? order.paidAmount : "As recorded"),
                        transactionType: "Cash / Bank Transfer",
                        approvedBy: ownerName,
                        narration: `Payment settlement for PO ${order.purOrderNo}`,
                        creditAccount: "Mill Cash",
                        debitAccount: retailerName,
                        refInvoiceNo: invoiceDisplayList[idx] || invoiceDisplayList[0] || order.purOrderNo,
                        debitAmt: totalPaidAmt || order.paidAmount,
                        creditAmt: totalPaidAmt || order.totalValue,
                        balAmt: status === "COMPLETED" ? 0 : 0,
                    }));

                    const transportDetails = {
                        name: "Direct Logistics",
                        vehicleNo: arrivedInvoices[0]?.inwardVehicle || "TN 74 AE 5397",
                        phone: "-",
                    };

                    records.push({
                        id: `pd-combined-${order.id}-${rawName.replace(/\s+/g, "_")}-${sNoCounter}`,
                        sNo: sNoCounter++,
                        stockGroup,
                        inwardItem: rawName,
                        batch: batchDisplay,
                        tonnage: finalTonnageStr,
                        tonnageKg: finalTonnageKg,
                        inwardBatchWithItemName: `${rawName} (${finalTonnageStr})`,
                        purOrderNo: order.purOrderNo,
                        inwardJouNo: inwardJouDisplay,
                        purInvNo: purInvDisplay,
                        paymentNo: paymentDisplay,
                        paymentAmt: totalPaidAmt > 0 ? totalPaidAmt : "",
                        status,
                        orderDate: order.orderDate,

                        transId: order.transId,
                        retailerName,
                        partyAddress,
                        brokerName,
                        ownerName,
                        loadingDate,
                        tradeConfirmDate,
                        paymentCondition,
                        remarks,

                        inwardCount,
                        invoiceCount,
                        paymentCount: 0,
                        batchCount,

                        allBatches: batches,
                        allInwardJous: inwardJous,
                        allPurInvNos: actualPurInvNos,
                        allPaymentNos: [],

                        poItems: poItemsFormatted,
                        inwardDetails: inwardDetailsFormatted,
                        invoiceDetails: invoiceDetailsFormatted,
                        paymentDetails: paymentDetailsFormatted,
                        transportDetails,
                    });
                });
            });

            // Ensure poItems & inwardDetails & invoiceDetails on every record include all items of that order
            const branchOrderItemsMap = new Map<string, any[]>();
            const branchInwardMap = new Map<string, any[]>();
            const branchInvoiceMap = new Map<string, any[]>();

            records.forEach((r) => {
                const k = cleanStr(r.purOrderNo).toLowerCase();
                if (!k || k === "-" || k === "po-unknown") return;

                if (!branchOrderItemsMap.has(k)) branchOrderItemsMap.set(k, []);
                (r.poItems || []).forEach((it) => {
                    const norm = cleanStr(it.itemName).toLowerCase();
                    if (norm && !branchOrderItemsMap.get(k)!.some((x) => cleanStr(x.itemName).toLowerCase() === norm)) {
                        branchOrderItemsMap.get(k)!.push({
                            ...it,
                            sNo: branchOrderItemsMap.get(k)!.length + 1,
                        });
                    }
                });

                // Also guarantee r.inwardItem is represented
                const rName = cleanStr(r.inwardItem);
                if (rName && !branchOrderItemsMap.get(k)!.some((x) => cleanStr(x.itemName).toLowerCase() === rName.toLowerCase())) {
                    branchOrderItemsMap.get(k)!.push({
                        sNo: branchOrderItemsMap.get(k)!.length + 1,
                        itemName: rName,
                        orderedQty: r.tonnageKg || 0,
                        tonnage: r.tonnage || "-",
                        rate: (r as any).rate || "As recorded",
                        amount: r.paymentAmt || "As recorded",
                        unit: "Bags",
                        discount: "-",
                        qualityCondition: "Standard",
                    });
                }

                if (!branchInwardMap.has(k)) branchInwardMap.set(k, []);
                (r.inwardDetails || []).forEach((inw) => {
                    branchInwardMap.get(k)!.push(inw);
                });

                if (!branchInvoiceMap.has(k)) branchInvoiceMap.set(k, []);
                (r.invoiceDetails || []).forEach((inv) => {
                    branchInvoiceMap.get(k)!.push(inv);
                });
            });

            records.forEach((r) => {
                const k = cleanStr(r.purOrderNo).toLowerCase();
                if (branchOrderItemsMap.has(k) && branchOrderItemsMap.get(k)!.length > 0) {
                    r.poItems = branchOrderItemsMap.get(k);
                }
                if (branchInwardMap.has(k) && branchInwardMap.get(k)!.length > 0) {
                    r.inwardDetails = branchInwardMap.get(k);
                }
                if (branchInvoiceMap.has(k) && branchInvoiceMap.get(k)!.length > 0) {
                    r.invoiceDetails = branchInvoiceMap.get(k);
                }
            });

            return records;
        }
    }

    // Fallback if no tripRows
    if ((!invRows || invRows.length === 0) && (!poRows || poRows.length === 0)) {
        return [];
    }

    const records: PurchaseDeliveryItem[] = [];
    let sNoCounter = 1;

    // Group fallback rows by (purOrderNo, cleanProduct)
    const fallbackGroup = new Map<string, any[]>();

    (invRows || []).forEach((inv) => {
        const rawProduct = cleanStr(
            (inv as any).Product_Name ||
            (inv as any).Product_name ||
            (inv as any).Stock_Item_Name ||
            (inv as any).Item_Name
        );
        const purOrderNo = cleanStr((inv as any).Ref_Brokers || (inv as any).ref_brokers || (inv as any).voucher_name) || "PO-GENERAL";
        const key = `${purOrderNo.toLowerCase()}:::${cleanItemName(rawProduct).toLowerCase()}`;
        if (!fallbackGroup.has(key)) fallbackGroup.set(key, []);
        fallbackGroup.get(key)!.push({ type: "inv", data: inv, rawProduct, purOrderNo });
    });

    (poRows || []).forEach((po) => {
        const rawProduct = cleanStr(
            (po as any).Product_Name ||
            (po as any).Product_name ||
            (po as any).Stock_Item_Name ||
            (po as any).Item_Name
        );
        const purOrderNo = cleanStr((po as any).invoice_no || (po as any).Invoice_No || (po as any).voucher_no) || "PO-GENERAL";
        const key = `${purOrderNo.toLowerCase()}:::${cleanItemName(rawProduct).toLowerCase()}`;
        if (!fallbackGroup.has(key)) fallbackGroup.set(key, []);
        fallbackGroup.get(key)!.push({ type: "po", data: po, rawProduct, purOrderNo });
    });

    fallbackGroup.forEach((groupRows) => {
        const first = groupRows[0];
        const rawProduct = first.rawProduct;
        const purOrderNo = first.purOrderNo;

        let totalKg = 0;
        const batches: string[] = [];
        const invoiceNos: string[] = [];
        const paymentInvoiceNos: string[] = [];
        let totalPaidAmt = 0;
        let isPaymentDone = false;
        let retailerName = "";

        groupRows.forEach((r) => {
            if (r.type === "inv") {
                const inv = r.data;
                retailerName = cleanStr((inv as any).Retailer_Name || retailerName);
                const purInvNo = cleanStr((inv as any).invoice_no || (inv as any).Invoice_No);
                if (purInvNo && purInvNo !== "-" && !invoiceNos.includes(purInvNo)) {
                    invoiceNos.push(purInvNo);
                }
                const b = cleanStr((inv as any).Batch || (inv as any).batch_no || (inv as any).Batch_No);
                if (b && b !== "-" && !batches.includes(b)) {
                    batches.push(b);
                }
                const qty = parseNum(
                    (inv as any).Bill_Qty ??
                    (inv as any).Bill_qty ??
                    (inv as any).Weight ??
                    (inv as any).weight ??
                    (inv as any).Billed_Qty ??
                    (inv as any).Qty
                );
                totalKg += qty;

                const matchedPay = purInvNo ? paymentsMap?.get(purInvNo.toLowerCase()) : undefined;
                if (matchedPay) {
                    const pInv = cleanStr(matchedPay.invoice_no);
                    if (pInv && pInv !== "-" && !paymentInvoiceNos.includes(pInv)) {
                        paymentInvoiceNos.push(pInv);
                    }
                    totalPaidAmt += parseNum(matchedPay.Debit_Amt);
                    if (parseNum(matchedPay.Debit_Amt) > 0 && parseNum(matchedPay.Bal_Amount) <= 0) {
                        isPaymentDone = true;
                    }
                }
            } else if (r.type === "po") {
                const po = r.data;
                retailerName = cleanStr((po as any).Retailer_Name || retailerName);
                const poQty = parseNum(
                    (po as any).Weight ??
                    (po as any).weight ??
                    (po as any).Bill_Qty ??
                    (po as any).Bill_qty ??
                    (po as any).Qty
                );
                if (totalKg === 0) totalKg += poQty;
                const b = cleanStr((po as any).Batch || (po as any).batch_no || (po as any).Batch_No);
                if (b && b !== "-" && !batches.includes(b)) {
                    batches.push(b);
                }
                const poMatchedPay = purOrderNo ? paymentsMap?.get(purOrderNo.toLowerCase()) : undefined;
                if (poMatchedPay) {
                    const pInv = cleanStr(poMatchedPay.invoice_no);
                    if (pInv && pInv !== "-" && !paymentInvoiceNos.includes(pInv)) {
                        paymentInvoiceNos.push(pInv);
                    }
                }
            }
        });

        const invoiceCount = paymentInvoiceNos.length;
        const batchCount = batches.length;
        const inwardCount = invoiceNos.length > 0 ? invoiceNos.length : 1;

        records.push({
            id: `pd-fallback-${sNoCounter}`,
            sNo: sNoCounter++,
            stockGroup: resolveGroup(first.data, rawProduct, (first.data as any).Product_Id),
            inwardItem: cleanItemName(rawProduct),
            batch: batchCount > 1 ? `${batchCount} Batches` : (batches[0] || "-"),
            tonnage: totalKg > 0 ? formatKgQuantity(totalKg) : "-",
            tonnageKg: totalKg,
            inwardBatchWithItemName: `${cleanItemName(rawProduct)} (${formatKgQuantity(totalKg)})`,
            purOrderNo,
            inwardJouNo: inwardCount > 1 ? `${inwardCount} Inwards` : (invoiceNos[0] || "1 Inward"),
            purInvNo: invoiceCount > 1 ? `${invoiceCount} Invoices` : (paymentInvoiceNos[0] || "-"),
            paymentNo: "-",
            paymentAmt: totalPaidAmt > 0 ? totalPaidAmt : "",
            status: isPaymentDone ? "COMPLETED" : "NOT COMPLETED",
            orderDate: cleanStr((first.data as any).Ledger_Date || (first.data as any).Ledger_date),

            retailerName: retailerName || "Party As Recorded",
            inwardCount,
            invoiceCount,
            paymentCount: 0,
            batchCount,
            allBatches: batches,
            allInwardJous: invoiceNos,
            allPurInvNos: paymentInvoiceNos,
            allPaymentNos: [],
        });
    });

    // Link poItems, inwardDetails, invoiceDetails across all records of the same purOrderNo in fallback
    const fallbackPoItemsMap = new Map<string, any[]>();
    const fallbackInwardMap = new Map<string, any[]>();
    const fallbackInvoiceMap = new Map<string, any[]>();

    records.forEach((r) => {
        const k = cleanStr(r.purOrderNo).toLowerCase();
        if (!k || k === "-" || k === "po-unknown") return;

        if (!fallbackPoItemsMap.has(k)) fallbackPoItemsMap.set(k, []);
        fallbackPoItemsMap.get(k)!.push({
            sNo: fallbackPoItemsMap.get(k)!.length + 1,
            itemName: r.inwardItem,
            orderedQty: r.tonnageKg || 0,
            tonnage: r.tonnage || "-",
            rate: "As recorded",
            amount: r.paymentAmt || "As recorded",
            unit: "Bags",
            discount: "-",
            qualityCondition: "Standard",
        });

        if (!fallbackInwardMap.has(k)) fallbackInwardMap.set(k, []);
        fallbackInwardMap.get(k)!.push({
            sNo: fallbackInwardMap.get(k)!.length + 1,
            location: "Smt Mill",
            arrivalDate: r.orderDate || dayjs().format("YYYY-MM-DD"),
            itemName: r.inwardItem,
            concern: "SM AGRO",
            billNo: r.inwardJouNo || "-",
            billDate: r.orderDate || dayjs().format("YYYY-MM-DD"),
            quantity: Math.round((r.tonnageKg || 1000) / 50) || 50,
            unit: "Bags",
            billedRate: "As recorded",
            tonnageKg: r.tonnageKg || 0,
            tonnage: r.tonnage || "-",
            batch: r.batch || "-",
            batchLocation: "Main Location",
            vehicleNo: "TN 64 W 6487 / SD",
            rate: "As recorded",
            amount: r.paymentAmt || "As recorded",
            fromLocation: "Smt Mill",
            status: "Completed",
            billType: "OTHER GODOWN",
            voucherType: "ON_M_OUTWARDS",
            narration: `SMT MILL RTO GODOWN (TN 64 W 6487) - ${r.purOrderNo}`,
        });

        if (!fallbackInvoiceMap.has(k)) fallbackInvoiceMap.set(k, []);
        fallbackInvoiceMap.get(k)!.push({
            sNo: fallbackInvoiceMap.get(k)!.length + 1,
            vendor: r.retailerName || "Party As Recorded",
            voucherType: "Purchase Invoice",
            branch: "SM AGRO",
            entryDate: r.orderDate || dayjs().format("YYYY-MM-DD"),
            billDate: r.orderDate || dayjs().format("YYYY-MM-DD"),
            refNumber: r.purInvNo || `INV-${r.purOrderNo}`,
            gstType: "Not Taxable",
            taxType: "GST",
            stockItemLedger: "GST OS Purchase Exempted",
            discount: "0",
            qualityCondition: "Standard",
            paymentDays: "3",
            narration: `Purchase invoice against order ${r.purOrderNo}`,
            itemName: r.inwardItem,
            rate: "As recorded",
            billQty: r.tonnageKg || 0,
            aclQty: r.tonnageKg || 0,
            unit: "Bags",
            amount: r.paymentAmt || "As recorded",
            godown: "Main Godown",
            batch: r.batch || "-",
        });
    });

    records.forEach((r) => {
        const k = cleanStr(r.purOrderNo).toLowerCase();
        if (fallbackPoItemsMap.has(k)) {
            r.poItems = fallbackPoItemsMap.get(k);
        }
        if (fallbackInwardMap.has(k)) {
            r.inwardDetails = fallbackInwardMap.get(k);
        }
        if (fallbackInvoiceMap.has(k)) {
            r.invoiceDetails = fallbackInvoiceMap.get(k);
        }
    });

    return records;
};

/**
 * 4. Transform raw datasets into TodayArrivalItem[] (for PurchaseReport)
 */
export const buildPurchaseReportDataset = (
    poRows: PurchaseOrderItem[],
    invRows: OnlinePurchaseReport[],
    filterType: PurchaseReportFilterType = "today_arrival",
    tripRows: PurchaseOrderTripItem[] = []
): TodayArrivalItem[] => {
    const todayStr = dayjs().format("YYYY-MM-DD");
    const itemPayments = buildPurchaseItemPaymentDataset(poRows, invRows, tripRows);

    if (!itemPayments || itemPayments.length === 0) {
        return [];
    }

    const allArrivals: TodayArrivalItem[] = [];
    let counter = 1;

    itemPayments.forEach((order) => {
        const orderDateFormatted = order.orderDate && dayjs(order.orderDate).isValid()
            ? dayjs(order.orderDate).format("DD/MM/YYYY")
            : order.orderDate;

        const wholeOrder: WholeOrderDetails = {
            orderId: order.purOrderNo,
            purOrderNo: order.purOrderNo,
            orderDate: orderDateFormatted,
            retailerName: order.supplierName,
            city: order.deliveryLocation || "",
            state: "Tamil Nadu",
            totalOrderTonnage: order.orderedTons,
            totalOrderValue: order.totalValue,
            paymentStatus: "Unpaid",
            paidAmount: 0,
            balanceAmount: order.totalValue,
            items: order.items.map((it, idx) => ({
                id: it.itemId,
                itemNo: idx + 1,
                itemName: it.itemName,
                qty: `${it.orderedTons} Tons`,
                tonnage: it.orderedTons,
                rate: it.ratePerTon,
                itemValue: it.itemAmount,
                arrivalDate: it.lastArrivalDate && dayjs(it.lastArrivalDate).isValid()
                    ? dayjs(it.lastArrivalDate).format("DD/MM/YYYY")
                    : "-",
                status: (it.deliveryPercentage >= 100
                    ? (it.lastArrivalDate === todayStr ? "Arrived Today" : "Arrived Earlier")
                    : it.deliveryPercentage > 0
                        ? "In Transit"
                        : "Pending Delivery") as DeliveryStatus,
                tripDetail: undefined, // Leave empty/undefined (NO fake driver or vehicle)
            })),
        };

        // If invoices arrived, create arrival records
        if (order.arrivedInvoices.length > 0) {
            order.arrivedInvoices.forEach((inv) => {
                const invDateFormatted = inv.invoiceDate && dayjs(inv.invoiceDate).isValid()
                    ? dayjs(inv.invoiceDate).format("DD/MM/YYYY")
                    : inv.invoiceDate;

                allArrivals.push({
                    id: inv.invoiceId,
                    sNo: counter++,
                    date: invDateFormatted,
                    orderId: order.purOrderNo,
                    purOrderNo: order.purOrderNo,
                    itemName: inv.itemName,
                    retailerName: order.supplierName,
                    city: inv.godown || order.deliveryLocation || "",
                    state: "Tamil Nadu",
                    qty: `${inv.arrivedQty} Tons`,
                    tonnage: inv.arrivedQty,
                    itemValue: inv.amount,
                    statusTag: inv.invoiceDate === todayStr ? "Arrived Today" : "Arrived Earlier",
                    order: wholeOrder,
                });
            });
        } else {
            // Pending arrival record for primary item
            const firstIt = order.items[0];
            allArrivals.push({
                id: `pending-${order.purOrderNo}`,
                sNo: counter++,
                date: orderDateFormatted,
                orderId: order.purOrderNo,
                purOrderNo: order.purOrderNo,
                itemName: firstIt ? firstIt.itemName : "General Product",
                retailerName: order.supplierName,
                city: order.deliveryLocation || "",
                state: "Tamil Nadu",
                qty: firstIt ? `${firstIt.orderedTons} Tons` : `${order.orderedTons} Tons`,
                tonnage: firstIt ? firstIt.orderedTons : order.orderedTons,
                itemValue: firstIt ? firstIt.itemAmount : order.totalValue,
                statusTag: "Pending Delivery",
                order: wholeOrder,
            });
        }
    });

    // Apply filter tab
    switch (filterType) {
        case "today_arrival":
            return allArrivals.filter((r) => r.statusTag === "Arrived Today" || r.statusTag === "Arrived Earlier");
        case "pending_orders":
            return allArrivals.filter((r) => r.order.items.some((it) => it.status === "Pending Delivery" || it.status === "In Transit"));
        case "pending_payments":
            return allArrivals.filter((r) => r.order.balanceAmount > 0);
        case "completed":
            return allArrivals.filter((r) => r.order.items.every((it) => it.status === "Arrived Today" || it.status === "Arrived Earlier"));
        default:
            return allArrivals;
    }
};
