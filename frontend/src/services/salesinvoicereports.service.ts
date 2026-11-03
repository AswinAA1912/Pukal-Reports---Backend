import axios from "axios";
import {getBaseURL} from "../config/portalBaseURL";

/* =========================
   Types
========================= */

export interface SalesInvoiceReport {
    Do_Id: string;
    Do_Inv_No: string;
    Created_on: string;
    Retailer_Id: number;
    Retailer_Name: string;
    VoucherTypeGet: string;
    Total_Before_Tax: number;
    Total_Tax: number;
    Total_Invoice_value: number;
}

export interface Retailer {
    Retailer_Id: number;
    Retailer_Name: string;
}


/* =========================
   Service
========================= */

export const SalesInvoiceReportService = {
    getReports: (params?: {
        Fromdate?: string;
        Todate?: string;
        Retailer_Id?: number;
    }) =>
        axios.get<{ success: boolean; data: SalesInvoiceReport[] }>(
            `${getBaseURL()}api/sales/salesInvoice`,
            { params }
        ),

};
