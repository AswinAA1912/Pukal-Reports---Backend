import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface stockWiseReport {
    Product_Id: string;
    stock_item_name: string;
    Trans_Date: string;
    Group_Name: string;
    OB_Act_Qty: string;
    Pur_Act_Qty: string;
    Sal_Act_Qty: string;
    Bal_Act_Qty: string;
    OB_Bal_Qty: string;
    Pur_Qty: string;
    Sal_Qty: string;
    Bal_Qty: string;
    Brand: string;
    Group_ST: string;
    Bag: string;
    Stock_Group: string;
    S_Sub_Group_1: string;
    Grade_Item_Group: string;
    Item_Name_Modified: string;
    Date_Added: string;
    POS_Group: string;
    Active: string;
    POS_Item_Name: string;
    Product_Rate: string;
    Stock_Item: string;
    Godown_Name: string;
    IN_Qty?: string | number;
    OUT_Qty?: string | number;
    IN_Act_Qty?: string | number;
    OUT_Act_Qty?: string | number;
    Act_Bal_Qty?: string | number;
    [key: string]: string | number | undefined;
}

/* ---------------- GROUP CONFIG ---------------- */

export interface StockGroupConfig {
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

export interface Level2Filter {
    Group_ST: string;
    Group_ST_Name: string;
}


/* ---------------- GROUPING API ---------------- */

export const stockGroupingService = {
    getGroupingConfig: (reportName: string) =>
        axios.get<{ success: boolean; data: StockGroupConfig[] }>(
            `${getBaseURL()}api/sales/salesFilterDropdown`,
            { params: { reportName } }
        ),
};

/* ---------------- DATA APIs ---------------- */

export const itemwisestockreportservice = {
    getItemwiseReports: (params?: { Fromdate?: string; Todate?: string }) =>
        axios.get<{ success: boolean; data: stockWiseReport[] }>(
            `${getBaseURL()}api/reports/storageStock/itemWiseMobile`,
            { params }
        ),
};

export const godownwisestockreportservice = {
    getGodownwiseReports: (params?: {
        Godown_Id: number | string;
        Fromdate?: string;
        Todate?: string;
        filter1?: string;
        filter2?: string;
        filter3?: string;
        groupFilter1?: string;
        groupFilter2?: string;
        groupFilter3?: string;
    }) =>
        axios.get<{ success: boolean; data: stockWiseReport[] }>(
            `${getBaseURL()}api/reports/storageStock/godownitemWise`,
            { params }
        ),
};

export const stockInOutProcessService = {
    getStockInOutProcess: (params: { Todate: string; Fromdate?: string }) =>
        axios.get<{ success: boolean; data: any[] }>(
            `${getBaseURL()}api/reports/externalAPI/stockinoutprocess`,
            { params }
        ),
};

/* ---------------- TRANSACTION APIs ---------------- */

export const itemTransactionService = {
    getItemTransactions: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: number;
    }) =>
        axios.get<{ success: boolean; data: stockWiseReport[] }>(
            `${getBaseURL()}api/reports/itemexpenseReport`,
            { params }
        ),
};

export const godownItemTransactionService = {
    getGodownItemTransactions: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: number;
        Godown_Id: number;
    }) =>
        axios.get<{ success: boolean; data: stockWiseReport[] }>(
            `${getBaseURL()}api/reports/godownexpenseReport`,
            { params }
        ),
    getGodownItemProcess: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: number;
        Godown_Id: number;
    }) =>
        axios.get<{ success: boolean; data: any[] }>(
            `${getBaseURL()}api/reports/godownitemprocess`,
            { params }
        ),
    getGodownItemOutExpandable: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: number;
        Godown_Id: number;
        Trip_No?: number;
    }) =>
        axios.get<{ success: boolean; data: any[] }>(
            `${getBaseURL()}api/reports/godownitemOutexpandable`,
            { params }
        ),
    getGodownItemInExpandable: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: number;
        Godown_Id: number;
        Trip_No?: number;
    }) =>
        axios.get<{ success: boolean; data: any[] }>(
            `${getBaseURL()}api/reports/godownitemInexpandable`,
            { params }
        ),
};

/* ---------------- GODOWN STOCK BADGE (BATCH) API ---------------- */

export interface GodownStockBadgeItem {
    Godown_Id: string | number;
    Product_Id: string | number;
    Batch_No: string;
    OB_Act_Qty: number | string;
    OB_Bal_Qty: number | string;
    IN_Act_Qty: number | string;
    IN_Qty: number | string;
    OUT_Act_Qty: number | string;
    OUT_Qty: number | string;
    Act_Bal_Qty: number | string;
    Bal_Qty: number | string;
    stock_item_name: string;
    Godown_Name: string;
    [key: string]: any;
}

export const godownStockBadgeService = {
    getGodownStockBadge: (params: {
        Fromdate: string;
        Todate: string;
        Godown_Id: string | number;
        Item_Id: string | number;
    }) =>
        axios.get<{ success: boolean; data: GodownStockBadgeItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/godownStockBadge`,
            { params }
        ),
};

/* ---------------- ITEMWISE STOCK BADGE (BATCH) API ---------------- */

export interface ItemwiseStockBadgeItem {
    Product_Id: string | number;
    Batch_No: string | null;
    OB_Act_Qty: number | string;
    OB_Bal_Qty: number | string;
    IN_Act_Qty: number | string;
    IN_Qty: number | string;
    OUT_Act_Qty: number | string;
    OUT_Qty: number | string;
    Act_Bal_Qty: number | string;
    Bal_Qty: number | string;
    stock_item_name: string;
    [key: string]: any;
}

export const itemwiseStockBadgeService = {
    getItemwiseStockBadge: (params: {
        Fromdate: string;
        Todate: string;
        Item_Name?: string;
        stock_item_name?: string;
        Product_Id?: string | number;
        Item_Id?: string | number;
        company_id?: string | number;
    }) =>
        axios.get<{ success: boolean; data: ItemwiseStockBadgeItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/itemwiseBadge`,
            { params }
        ),
};

/* ---------------- TRANSACTION BATCH STOCK REPORT API ---------------- */

export interface TransactionBatchStockItem {
    invoice_no: string;
    Batch: string;
    Ledger_Date: string;
    Month_No: number;
    Invoice_Month: string;
    Invoice_Year: number;
    Month_Year: string;
    Product_Id: string | number;
    Product_Name: string;
    Godown_Id: string | number;
    Godown_Name: string;
    In_Qty: number;
    Out_Qty: number;
    In_Act_Qty: number;
    Out_Act_Qty: number;
    Rate: number;
    Amount: number;
    Trans_Id: string;
    voucher_name: string;
    Particulars: string;
    Retailer_Name: string;
    ord: number;
    [key: string]: any;
}

export const transactionBatchStockService = {
    getTransactionBatchStock: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: string | number;
        Batch: string;
    }) =>
        axios.get<{ success: boolean; data: TransactionBatchStockItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/transactionBatchStockReportByProId`,
            { params }
        ),

    getTransactionBatchStockByGodown: (params: {
        fromDate: string;
        toDate: string;
        Product_Id: string | number;
        Godown_Id: string | number;
        Batch: string;
    }) =>
        axios.get<{ success: boolean; data: TransactionBatchStockItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/transactionBatchStockReportByProIdandGodownId`,
            { params }
        ),
};



