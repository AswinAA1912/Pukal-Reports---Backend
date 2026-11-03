import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* =========================
   Types
========================= */

export interface OnlinePurchaseReport {
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

/* =========================
   Service
========================= */

export const OnlinePurchaseReportService = {
    getReports: (params?: { Fromdate?: string; Todate?: string; invoice_no?: string }) =>
        axios.get<{ success: boolean; data: OnlinePurchaseReport[] }>(
            `${getBaseURL()}api/reports/externalAPI/onlinePurchaseReport`,
            // `http://192.168.1.92:9001/api/reports/externalAPI/onlinePurchaseReport`,
            { params }
        ),
};

export const OnlinePurchaseReportItemService = {
    getReportsitem: (params?: { Fromdate?: string; Todate?: string; invoice_no?: string }) =>
        axios.get<{ success: boolean; data: OnlinePurchaseReport[] }>(
            `${getBaseURL()}api/reports/externalAPI/onlinePurchaseReportItem`,
            //  `http://192.168.1.92:9001/api/reports/externalAPI/onlinePurchaseReportItem`,
            { params }
        ),
};

export interface OnlinePurchaseReportItemByOrderIdItem {
    invoice_no: string;
    Batch?: string;
    Ledger_Date?: string;
    Month_No?: number;
    Invoice_Month?: string;
    Invoice_Year?: number;
    Month_Year?: string;
    Product_Id?: number;
    Product_Name?: string;
    Godown_Id?: number;
    Godown_Name?: string;
    Bill_Qty?: number | string;
    Rate?: number | string;
    Amount?: number | string;
    Trans_Id?: string;
    voucher_name?: string;
    Retailer_Name?: string;
    Cancel_status?: string;
    Stock_Item?: string;
    Brand?: string;
    Group_ST?: string;
    Bag?: string;
    Stock_Group?: string;
    S_Sub_Group_1?: string;
    Grade_Item_Group?: string;
    Item_Name_Modified?: string;
    Date_Added?: string;
    POS_Group?: string;
    Active?: string;
    POS_Item_Name?: string;
    Brokerage?: any;
    Coolie?: any;
    Total_Invoice_value?: number | string;
    Retailer_Id?: number;
    Contact_Person?: string;
    Reatailer_Address?: string;
    Reatailer_City?: string;
    Mobile_No?: string;
    Narration?: string;
    Created_on?: string;
    Created_By?: string;
    Ref_Po_Inv_No?: string;
    [key: string]: any;
}

export const OnlinePurchaseReportItemByOrderIdService = {
    getReportsitemByOrderId: (params: { Po_Id: string | number | any; company_id?: string | number }) => {
        let singlePoId = params?.Po_Id;
        if (Array.isArray(singlePoId)) {
            singlePoId = singlePoId[0];
        }
        if (typeof singlePoId === "string" && singlePoId.includes(",")) {
            singlePoId = singlePoId.split(",")[0].trim();
        }
        if (singlePoId !== undefined && singlePoId !== null && String(singlePoId).trim() !== "" && !isNaN(Number(singlePoId))) {
            singlePoId = Number(singlePoId);
        }
        const company_id = params?.company_id !== undefined ? params.company_id : 1;
        return axios.get<{ success: boolean; data: OnlinePurchaseReportItemByOrderIdItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/onlinePurchaseReportItemByOrderId`,
            { params: { Po_Id: singlePoId, company_id } }
        );
    },
};

export interface PurchaseOrderPaymentItem {
    invoice_no: string;
    Credit_Amt: number;
    Debit_Amt: number;
    Bal_Amount: number;
}

export const PurchaseOrderPaymentService = {
    getPurchaseOrderPayments: (params?: { Todate?: string; company_id?: string | number }) => {
        const company_id = params?.company_id !== undefined ? params.company_id : 1;
        return axios.get<{ success: boolean; data: PurchaseOrderPaymentItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/purchaseOrderPayment`,
            { params: { Todate: params?.Todate, company_id } }
        );
    },
};


