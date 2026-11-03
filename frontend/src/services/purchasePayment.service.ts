import dayjs from "dayjs";
import {
  fetchRawPurchaseDatasets,
  buildPurchasePaymentDataset,
  formatKgQuantity,
  formatKgQuantityCompact,
} from "./purchaseDataIntegration.service";
import {
  PurchaseOrderPaymentService,
  PurchaseOrderPaymentItem,
} from "./OnlinePurchaseReport.service";

export interface PurchaseOrderItemDetail {
  itemId: string;
  itemName: string;
  stockGroup: string;
  orderedTons: number;
  arrivedTons: number;
  pendingTons: number;
  deliveryPercentage: number;
  ratePerTon: number;
  itemAmount: number;
  arrivalStatus: "PENDING" | "PARTIALLY_ARRIVED" | "FULLY_ARRIVED" | "COMPLETED";
  inwardBatch?: string;
  lastArrivalDate?: string;
}

export interface PurchasePaymentItem {
  id: string;
  sNo: number;
  purOrderNo: string;
  transId?: string;
  transIds?: string[];
  supplierName: string;
  orderDate: string;
  dueDate: string;
  orderedTons: number;
  arrivedTons: number;
  pendingTons: number;
  deliveryPercentage: number;
  deliveryStatus: "COMPLETED" | "PARTIAL" | "PENDING";
  totalPayment: number;
  paidPayment: number;
  pendingPayment: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" | "OVERDUE";
  paymentNo: string;
  purInvNo: string;
  inwardJouNo: string | number;
  deliveryLocation: string;
  notes?: string;
  items: PurchaseOrderItemDetail[];
}

// Pure live API data - no dummy data
export const PURCHASE_PAYMENT_DATA: PurchasePaymentItem[] = [];

export { formatKgQuantity, formatKgQuantityCompact };

export const PurchasePaymentService = {
  getPurchasePayments: async (params?: {
    Fromdate?: string;
    Todate?: string;
  }): Promise<PurchasePaymentItem[]> => {
    try {
      const targetToDate = params?.Todate || dayjs().format("YYYY-MM-DD");
      const [raw, paymentsRes] = await Promise.all([
        fetchRawPurchaseDatasets(params),
        PurchaseOrderPaymentService.getPurchaseOrderPayments({
          Todate: targetToDate,
          company_id: 1,
        }).catch((err) => {
          console.warn("Failed to load payments for purchase payment:", err);
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
      return buildPurchasePaymentDataset(raw.purchaseOrders, raw.purchaseInvoices, raw.tripItems, paymentsMap);
    } catch (err) {
      console.error("Error loading live purchase payment data:", err);
      return [];
    }
  },
};
