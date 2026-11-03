export interface TripDetail {
  tripId: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  transporter: string;
  lrNo: string;
  dispatchDate: string;
  deliveryDate?: string;
  status: "Delivered" | "In Transit" | "Unloaded" | "Dispatched" | "Pending";
  destinationGodown: string;
  loadingPoint: string;
}

export type DeliveryStatus =
  | "Arrived Today"
  | "Arrived Earlier"
  | "Not Delivered"
  | "In Transit"
  | "Pending Delivery";

export type PaymentStatus = "Paid" | "Partial" | "Unpaid";

export interface OrderItemDetail {
  id: string;
  itemNo: number;
  itemName: string;
  qty: string;
  tonnage: number;
  rate: number;
  itemValue: number;
  arrivalDate: string;
  status: DeliveryStatus;
  tripDetail?: TripDetail;
}

export interface WholeOrderDetails {
  orderId: string;
  purOrderNo?: string;
  orderDate: string;
  retailerName: string;
  city: string;
  state: string;
  totalOrderTonnage: number;
  totalOrderValue: number;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  balanceAmount: number;
  items: OrderItemDetail[];
}

export type PurchaseReportFilterType =
  | "today_arrival"
  | "pending_orders"
  | "pending_payments"
  | "completed";

export interface TodayArrivalItem {
  id: string;
  sNo: number;
  date: string;
  orderId: string;
  purOrderNo?: string;
  itemName: string;
  retailerName: string;
  city: string;
  state: string;
  qty?: string;
  tonnage: number;
  itemValue: number;
  statusTag?: string;
  order: WholeOrderDetails;
}

// Backward compatibility alias
export type PurchasePartySummary = TodayArrivalItem;
export type PurchaseReportItem = TodayArrivalItem;



/* ================= HELPER METHODS ================= */

export const getPurchaseDataByFilter = (
  _filterType: PurchaseReportFilterType
): TodayArrivalItem[] => {
  return [];
};

export const getPurchaseFilterCounts = () => ({
  today_arrival: 0,
  pending_orders: 0,
  pending_payments: 0,
  completed: 0,
});

import {
  fetchRawPurchaseDatasets,
  buildPurchaseReportDataset,
} from "./purchaseDataIntegration.service";

export const PurchaseReportService = {
  getPurchaseReportData: async (params?: {
    fromDate?: string;
    toDate?: string;
    partyName?: string;
    filterType?: PurchaseReportFilterType;
  }): Promise<{ success: boolean; data: TodayArrivalItem[] }> => {
    let baseData: TodayArrivalItem[] = [];
    try {
      const raw = await fetchRawPurchaseDatasets({
        Fromdate: params?.fromDate,
        Todate: params?.toDate,
      });
      baseData = buildPurchaseReportDataset(
        raw.purchaseOrders,
        raw.purchaseInvoices,
        params?.filterType || "today_arrival",
        raw.tripItems
      );
    } catch (err) {
      console.error("Error loading live purchase report data:", err);
      baseData = [];
    }

    let filtered = [...baseData];

    if (params?.partyName) {
      const term = params.partyName.toLowerCase();
      filtered = filtered.filter(
        (row) =>
          row.retailerName.toLowerCase().includes(term) ||
          row.itemName.toLowerCase().includes(term) ||
          row.orderId.toLowerCase().includes(term) ||
          row.city.toLowerCase().includes(term)
      );
    }

    return {
      success: true,
      data: filtered,
    };
  },
};
