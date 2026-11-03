import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* =========================
   Types
========================= */

export interface OnlineSalesReport {
    Ledger_Date: string;
    Retailer_Name: string;
    voucher_name: string;
    Ref_Brokers: string;
    Party_Location: string;
    Party_District: string;
    invoice_no: string;
    Total_Invoice_value: string;
    Item_Count: String;
    Product_Name: string;
    Bill_Qty: string;
    Rate: string;
    Amount: string;
}

export interface SalesGroupConfig {
    filterType?: string;
    tableId?: number;
    columnName: string;
    tableName?: string;
    aliasName?: string;
    valueColumn?: string;

    FilterLevel?: number;
    Level_Id?: number;

    isGroupFilter?: boolean;
    listTypes?: string;

    displayName?: string;
    groupOrder?: number;

    options?: {
        value: string;
        label: string;
    }[];
}

/* ---------------- GROUPING API ---------------- */

export const stockGroupingService = {
    getGroupingConfig: (reportName: string) =>
        axios.get<{ success: boolean; data: SalesGroupConfig[] }>(
            `${getBaseURL()}api/sales/salesFilterDropdown`,
            { params: { reportName } }
        ),
};

/* =========================
   Service
========================= */

export const OnlineSalesReportService = {
    getReports: (params?: { Fromdate?: string; Todate?: string; invoice_no?: string }) =>
        axios.get<{ success: boolean; data: OnlineSalesReport[] }>(
            `${getBaseURL()}api/reports/externalAPI/onlineSalesReport`,
            { params }
        ),
};

export const OnlineSalesReportItemService = {
    getReportsitem: (params?: { Fromdate?: string; Todate?: string; invoice_no?: string }) =>
        axios.get<{ success: boolean; data: OnlineSalesReport[] }>(
            `${getBaseURL()}api/reports/externalAPI/onlineSalesReportItem`,
            { params }
        ),
};

export const onlineSalesReportLOLService = {
    getReportsLOL: (params?: { Fromdate?: string; Todate?: string; invoice_no?: string }) =>
        axios.get<{ success: boolean; data: OnlineSalesReport[] }>(
            `${getBaseURL()}api/reports/externalAPI/onlineSalesReportLOL`,
            { params }
        ),
};

export const onlineSalesReportItemLOLService = {
    getReportsItemLOL: (params?: {Fromdate?: string; Todate?: string; invoice_no?: string}) =>
        axios.get<{ success: boolean; data: OnlineSalesReport[]}>(
            `${getBaseURL()}api/reports/externalAPI/onlineSalesReportItemLOL`,
            { params }
        )
}
