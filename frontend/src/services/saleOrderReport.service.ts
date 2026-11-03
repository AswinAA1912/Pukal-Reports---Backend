import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface SaleOrderItem {
    invoice_no: string;
    Ledger_Date: string;
    Product_Name: string;
    Bill_Qty: number;
    Rate: number;
    Amount: number;
    Retailer_Name: string;
    Total_Invoice_value: number;
}

export interface SaleOrderResponse {
    data: SaleOrderItem[];
}

export const SaleOrderReport = {
    getSaleOrder: (params?: { Fromdate?: string; Todate?: string; }) =>
        axios.get<{ success: boolean; data: SaleOrderResponse }>(
            // `http://192.168.1.5:9001/api/reports/externalAPI/SaleOrderReport`,
            `${getBaseURL()}api/reports/externalAPI/SaleOrderReport`,
            { params }
        )
}

export const SaleOrderReportItem = {
    getSaleOrderItem: (params?: { Fromdate?: string; Todate?: string; }) =>
        axios.get<{ success: boolean; data: SaleOrderResponse }>(
            // `http://192.168.1.92:9001/api/reports/externalAPI/SaleOrderReportItem`,
            `${getBaseURL()}api/reports/externalAPI/SaleOrderReportItem`,
            { params }
        )
}

export const PendingSaleOrderReport = {
    getPendingSaleOrder: (params?: { Todate?: string; }) =>
        axios.get<{ success: boolean; data: SaleOrderResponse }>(
            // `http://192.168.1.5:9001/api/reports/externalAPI/pendingSaleOrder`,
            `${getBaseURL()}api/reports/externalAPI/pendingSaleOrder`,
            { params }
        )
}

export const PendingSaleOrderItemReport = {
    getPendingSaleOrderItem: (params?: { Todate?: string; }) =>
        axios.get<{ success: boolean; data: SaleOrderResponse }>(
            // `http://192.168.1.5:9001/api/reports/externalAPI/pendingSaleOrderItem`,
            `${getBaseURL()}api/reports/externalAPI/pendingSaleOrderItem`,
            { params }
        )
}