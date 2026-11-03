import dayjs from "dayjs";

export interface FunnelOrderItem {
  itemId: string;
  itemName: string;
  hsnCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  tripNo?: string;
  vehicleNo?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  status?: "Delivered" | "In Transit" | "Pending" | "Assigned";
}

export interface FunnelTripItem {
  tripId: string;
  tripNo: string;
  vehicleNo: string;
  driverName: string;
  driverPhone?: string;
  transporter: string;
  lrNo: string;
  dispatchDate: string;
  deliveryDate?: string;
  status: "Assigned" | "In Transit" | "Delivered" | "Pending";
  quantityBags?: number;
  tonnageMT?: number;
  invoiceNo?: string;
}

export interface FunnelInvoiceItem {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  status: "Generated" | "Dispatched" | "Pending";
  taxAmount?: number;
  tripNo?: string;
}

export interface PurchaseDeliveryFunnelItem {
  id: string;
  sNo: number;
  orderId: string;
  orderDate: string;
  retailerName: string;
  city: string;
  state: string;
  itemName?: string;
  items?: FunnelOrderItem[];
  trips: FunnelTripItem[];
  invoices: FunnelInvoiceItem[];
  balanceToSettle: number;
  totalAmount: number;
  paidAmount: number;
  batch: string;
  status: "Completed" | "Not Completed";
  statusReason?: string;
  remarks?: string;
}

export interface PurchaseDeliveryItem {
  id: string;
  sNo: number;
  stockGroup: string;
  inwardItem: string;
  batch: string;
  tonnage: string;
  tonnageKg?: number;
  inwardBatchWithItemName?: string;
  purOrderNo: string;
  inwardJouNo: string | number;
  purInvNo: string;
  paymentNo: string;
  paymentAmt?: number | string;
  status: "COMPLETED" | "NOT COMPLETED" | "PENDING";
  orderDate: string;

  // Combining and transaction details modal fields
  transId?: string;
  retailerName?: string;
  partyAddress?: string;
  brokerName?: string;
  ownerName?: string;
  loadingDate?: string;
  tradeConfirmDate?: string;
  paymentCondition?: string;
  remarks?: string;

  inwardCount?: number;
  invoiceCount?: number;
  paymentCount?: number;
  batchCount?: number;

  allBatches?: string[];
  allInwardJous?: string[];
  allPurInvNos?: string[];
  allPaymentNos?: string[];

  poItems?: any[];
  inwardDetails?: any[];
  invoiceDetails?: any[];
  paymentDetails?: any[];
  transportDetails?: any;
}

export const computeItemStatus = (
  item: Omit<PurchaseDeliveryFunnelItem, "status" | "statusReason">
): { status: "Completed" | "Not Completed"; statusReason: string } => {
  const missingStages: string[] = [];

  if (!item.trips || item.trips.length === 0) {
    missingStages.push("Trip not assigned");
  }
  if (!item.invoices || item.invoices.length === 0) {
    missingStages.push("Invoice not converted");
  }
  if (item.balanceToSettle > 0) {
    missingStages.push("Balance pending");
  }

  if (missingStages.length === 0) {
    return {
      status: "Completed",
      statusReason: "All stages completed & balance settled",
    };
  }

  return {
    status: "Not Completed",
    statusReason: missingStages.join(", "),
  };
};

/* ================= HELPER CALCULATIONS ================= */

export interface FunnelSummaryMetrics {
  totalOrders: number;
  ordersWithTrips: number;
  totalTripsAssigned: number;
  tripConversionRate: number;
  ordersWithInvoices: number;
  totalInvoicesGenerated: number;
  invoiceConversionRate: number;
  ordersSettled: number;
  settledConversionRate: number;
  completedOrders: number;
  notCompletedOrders: number;
  completionRate: number;
  totalOrderAmount: number;
  totalPaidAmount: number;
  totalBalanceToSettle: number;
}

export const getFunnelMetrics = (
  data: PurchaseDeliveryFunnelItem[]
): FunnelSummaryMetrics => {
  const totalOrders = data.length;
  if (totalOrders === 0) {
    return {
      totalOrders: 0,
      ordersWithTrips: 0,
      totalTripsAssigned: 0,
      tripConversionRate: 0,
      ordersWithInvoices: 0,
      totalInvoicesGenerated: 0,
      invoiceConversionRate: 0,
      ordersSettled: 0,
      settledConversionRate: 0,
      completedOrders: 0,
      notCompletedOrders: 0,
      completionRate: 0,
      totalOrderAmount: 0,
      totalPaidAmount: 0,
      totalBalanceToSettle: 0,
    };
  }

  let totalTripsAssigned = 0;
  let ordersWithTrips = 0;
  let totalInvoicesGenerated = 0;
  let ordersWithInvoices = 0;
  let ordersSettled = 0;
  let completedOrders = 0;
  let notCompletedOrders = 0;
  let totalOrderAmount = 0;
  let totalPaidAmount = 0;
  let totalBalanceToSettle = 0;

  data.forEach((item) => {
    totalOrderAmount += item.totalAmount;
    totalPaidAmount += item.paidAmount;
    totalBalanceToSettle += item.balanceToSettle;

    const tripsCount = item.trips?.length || 0;
    const invoiceCount = item.invoices?.length || 0;

    totalTripsAssigned += tripsCount;
    if (tripsCount > 0) ordersWithTrips++;

    totalInvoicesGenerated += invoiceCount;
    if (invoiceCount > 0) ordersWithInvoices++;

    if (item.balanceToSettle === 0 && item.totalAmount > 0) {
      ordersSettled++;
    }

    if (item.status === "Completed") {
      completedOrders++;
    } else {
      notCompletedOrders++;
    }
  });

  return {
    totalOrders,
    ordersWithTrips,
    totalTripsAssigned,
    tripConversionRate: Math.round((ordersWithTrips / totalOrders) * 100),
    ordersWithInvoices,
    totalInvoicesGenerated,
    invoiceConversionRate: Math.round((ordersWithInvoices / totalOrders) * 100),
    ordersSettled,
    settledConversionRate: Math.round((ordersSettled / totalOrders) * 100),
    completedOrders,
    notCompletedOrders,
    completionRate: Math.round((completedOrders / totalOrders) * 100),
    totalOrderAmount,
    totalPaidAmount,
    totalBalanceToSettle,
  };
};

export const getOrderItems = (row: PurchaseDeliveryFunnelItem): FunnelOrderItem[] => {
  return row.items || [];
};

import {
  fetchRawPurchaseDatasets,
  buildPurchaseDeliveryDataset,
} from "./purchaseDataIntegration.service";
import {
  PurchaseOrderPaymentService,
  PurchaseOrderPaymentItem,
} from "./OnlinePurchaseReport.service";

export const PurchaseDeliveryService = {
  getPurchaseDeliveries: async (params?: {
    Fromdate?: string;
    Todate?: string;
  }): Promise<PurchaseDeliveryItem[]> => {
    try {
      const targetToDate = params?.Todate || dayjs().format("YYYY-MM-DD");
      const [raw, paymentsRes] = await Promise.all([
        fetchRawPurchaseDatasets(params),
        PurchaseOrderPaymentService.getPurchaseOrderPayments({
          Todate: targetToDate,
          company_id: 1,
        }).catch((err) => {
          console.warn("Failed to load payments for delivery:", err);
          return { data: { data: [] } };
        }),
      ]);
      const payments = paymentsRes.data?.data || (Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
      const paymentsMap = new Map<string, PurchaseOrderPaymentItem>();
      payments.forEach((p) => {
        if (p && p.invoice_no !== undefined && p.invoice_no !== null) {
          const k = String(p.invoice_no).trim().toLowerCase();
          if (k) {
            paymentsMap.set(k, p);
            if (k.startsWith("ps/")) {
              paymentsMap.set("mia/" + k.slice(3), p);
            }
            const cleanNo = k.replace(/^[a-z]+\//, "");
            if (cleanNo && cleanNo !== k) {
              paymentsMap.set(cleanNo, p);
              const digits = cleanNo.split("/")[0].replace(/^0+/, "");
              if (digits) paymentsMap.set(digits, p);
            }
          }
        }
      });
      return buildPurchaseDeliveryDataset(raw.purchaseOrders, raw.purchaseInvoices, raw.tripItems, paymentsMap);
    } catch (err) {
      console.error("Error loading live purchase delivery data:", err);
      return [];
    }
  },
};
