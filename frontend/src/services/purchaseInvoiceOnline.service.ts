import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface PurchaseInvoiceHeader {
    invoice_no?: string;
    Ref_Po_Inv_No?: string;
    Ledger_Date?: string;
    Month_No?: number;
    Invoice_Month?: string;
    Invoice_Year?: number;
    Month_Year?: string;
    Trans_Id?: number | string;
    voucher_name?: string;
    Retailer_Name?: string;
    Cancel_status?: number | string;
    [key: string]: any;
}

export interface PurchaseInvoiceLOSItem {
    POI_St_Id?: number | string;
    DeliveryId?: number | string;
    PIN_Id?: number | string;
    Po_Inv_Date?: string;
    S_No?: number;
    Godown_Id?: number | string;
    Product_Id?: number | string;
    Bill_Qty?: number | string;
    Act_Qty?: number | string;
    Bill_Alt_Qty?: number | string;
    Alt_Act_Qty?: number | string;
    Unit_Id?: number | string;
    Bill_Alt_Unit_Id?: number | string;
    Act_unit_Id?: number | string;
    Alt_Unit_Id?: number | string;
    Unit?: string;
    Product_Name?: string;
    Stock_Item?: string;
    Rate?: number | string;
    Amount?: number | string;
    [key: string]: any;
}

export interface PurchaseInvoiceAmountItem {
    PA_Id?: number | string;
    PIN_Id?: number | string;
    Expense_Id?: number | string;
    Amount_value_DR?: number | string;
    Amount_value_CR?: number | string;
    Account_name?: string;
    [key: string]: any;
}

export interface PurchaseInvoiceStaffDetail {
    Id?: number | string;
    PIN_Id?: number | string;
    Involved_Emp_Id?: number | string;
    Cost_Center_Type_Id?: number | string;
    Cost_Center_Name?: string;
    Cost_Category?: string;
    Alias_Name?: string;
    [key: string]: any;
}

export interface PurchaseInvoiceResponseData {
    invoiceData: PurchaseInvoiceHeader[];
    losData: PurchaseInvoiceLOSItem[];
    amountData: PurchaseInvoiceAmountItem[];
    staffDetails: PurchaseInvoiceStaffDetail[];
}

export const PurchaseInvoiceOnlineService = {
    getPurchaseInvoiceList: (transId: string | number) =>
        axios.get<{ success: boolean; data: PurchaseInvoiceResponseData; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/ReportingOnlinePurchaseList`,
            { params: { Trans_Id: transId } }
        ),
};

