import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface PurchaseOrderItem {
    Trans_Id?: string | number | (string | number)[];
    Id?: string | number;
    OrderId?: string | number;
    invoice_no: string;
    Ledger_date?: string;
    Ledger_Date?: string;
    Product_name?: string;
    Product_Name?: string;
    Product_Id?: number;
    Bill_Qty?: number;
    Weight?: number;
    Rate?: number;
    Amount?: number;
    Retailer_Name?: string;
    Total_Invoice_Value?: number;
    [key: string]: any;
}

export interface PurchaseOrderResponse {
    data: PurchaseOrderItem[]
}

export const PurchaseOrderReport = {
    getPurchaseOrder: (params?: {Fromdate:string; Todate: string}) =>
        axios.get<{success:boolean; data: PurchaseOrderResponse}>(
            // `http://192.168.1.92:9001/api/reports/externalAPI/PurchaseOrderReport`,
              `${getBaseURL()}api/reports/externalAPI/PurchaseOrderReport`,
            {params}
        )
}

export const PurchaseOrderReportItem = {
    getPurchaseOrderItem: (params?: {Fromdate:string; Todate: string}) =>
        axios.get<{success:boolean; data: PurchaseOrderResponse}>(
            //  `http://192.168.1.92:9001/api/reports/externalAPI/PurchaseOrderReportItem`,
              `${getBaseURL()}api/reports/externalAPI/PurchaseOrderReportItem`,
            {params}
        )
}

export * from "./purchaseOrderTripItem.service";