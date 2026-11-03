import dayjs from "dayjs";
import { PurchaseOrderItemDetail } from "./purchasePayment.service";
import {
  fetchRawPurchaseDatasets,
  buildPurchaseItemPaymentDataset,
  formatKgQuantity,
  formatKgQuantityCompact,
} from "./purchaseDataIntegration.service";
import {
  PurchaseOrderPaymentService,
  PurchaseOrderPaymentItem,
} from "./OnlinePurchaseReport.service";

export interface ArrivedInvoiceDetail {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  itemId: string;
  itemName: string;
  stockGroup: string;
  batchNo: string;
  arrivedQty: number;
  unit: string;
  rate: number;
  amount: number;
  paidAmount: number;
  pendingPayment: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING";
  inwardVehicle?: string;
  inwardJouNo?: string | number;
  godown?: string;
  batchLocation?: string;
  vehicleNo?: string;
  challanNo?: string;
  tripId?: string | number;
  narration?: string;
  tripStatus?: string;
  billType?: string;
  retailerName?: string;
  transId?: string;
}

export interface PurchaseItemOrder {
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
  totalValue: number;
  paidAmount: number;
  pendingPayment: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "PENDING" | "OVERDUE";
  paymentNo: string;
  purInvNo: string;
  inwardJouNo: string | number;
  deliveryLocation: string;
  notes?: string;
  items: PurchaseOrderItemDetail[];
  arrivedInvoices: ArrivedInvoiceDetail[];
}

export const cleanItemName = (name: string): string => {
  if (!name) return "";
  return name.replace(/^(?:[0-9]+-[0-9]+|[A-Za-z0-9]+-[A-Za-z0-9]+)\s*-\s*/, "").trim();
};

// Pure live API data - no dummy data
export const PURCHASE_ITEM_PAYMENT_DATA: PurchaseItemOrder[] = [];

export { formatKgQuantity, formatKgQuantityCompact };

export const PurchaseItemPaymentService = {
  getPurchaseItemPayments: async (params?: {
    Fromdate?: string;
    Todate?: string;
  }): Promise<PurchaseItemOrder[]> => {
    try {
      const targetToDate = params?.Todate || dayjs().format("YYYY-MM-DD");
      const [raw, paymentsRes] = await Promise.all([
        fetchRawPurchaseDatasets(params),
        PurchaseOrderPaymentService.getPurchaseOrderPayments({
          Todate: targetToDate,
          company_id: 1,
        }).catch((err) => {
          console.warn("Failed to load payments for item payment:", err);
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
      return buildPurchaseItemPaymentDataset(raw.purchaseOrders, raw.purchaseInvoices, raw.tripItems, paymentsMap);
    } catch (err) {
      console.error("Error loading live purchase item payment data:", err);
      return [];
    }
  },
};
