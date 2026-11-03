import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ---------------- ITEM SUMMARY DATASET ---------------- */

export interface ItemSummary {
    pay_id: string;
    year_id: number;
    payment_voucher_type_id: number;
    payment_sno: number;
    payment_invoice_no: string;
    payment_date: string;

    pay_bill_type: string;
    is_new_ref: number;

    credit_ledger: number;
    credit_ledger_name: string;
    credit_amount: number;

    debit_ledger: number;
    debit_ledger_name: string;
    debit_amount: number;

    remarks: string;

    transaction_type: string;

    Product_Id: number;
    Product_Name: string;
    Stock_Item: string;
    Brand: string;
    Group_ST: string;
    Bag: string;
    Stock_Group: string;

    S_Sub_Group_1: string;
    Grade_Item_Group: string;
    Item_Name_Modified: string;

    POS_Group: string;
    POS_Item_Name: string;

    Ledger_Date: string;

    Month_No: number;
    Invoice_Month: string;
    Invoice_Year: number;
    Month_Year: string;

    voucher_name: string;
    Created_By: string;

    [key: string]: any;
}

/* ---------------- ACCOUNT GROUP DATASET ---------------- */

export interface AccountGroup {
    Acc_Id: string;
    Account_name: string;
    Group_Name: string;
    Group_Id: string;
}

/* ---------------- EXISTING SUMMARY DATASET ---------------- */

export interface OnlinePaymentSummary {
    pay_id: string;
    year_id: number;
    payment_voucher_type_id: number;
    payment_sno: number;
    payment_invoice_no: string;
    payment_date: string;

    pay_bill_type: string;

    credit_ledger: number;
    credit_ledger_name: string;
    credit_amount: number;

    debit_ledger: number;
    debit_ledger_name: string;
    debit_amount: number;

    remarks: string;
    transaction_type: string;

    Month_No: number;
    Invoice_Month: string;
    Invoice_Year: number;
    Month_Year: string;

    voucher_name: string;
    Created_By: string;

    [key: string]: any;
}

/* ---------------- EXPENSE DATASET ---------------- */

export interface ExpenseAccount {
    Acc_Id: string;
    Account_name: string;
    Group_Name: string;
    Group_Id: string;
}

/* ---------------- FINAL RESPONSE TYPE ---------------- */

export interface OnlinePaymentReportResponse {
    Summary: OnlinePaymentSummary[];

    IndirectExpense: ExpenseAccount[];
    DirectExpense: ExpenseAccount[];
    OpeningBalance?: number;
    ClosingBalance?: number;
}

/* ---------------- COSTING REPORT RESPONSE ---------------- */

export interface CostingReportResponse {
    ItemSummary: ItemSummary[];
    Accountgroup: AccountGroup[];
}

/* ---------------- ONLINE PAYMENT REPORT SERVICE ---------------- */

export const onlinePaymentReportService = {
    getOnlinePaymentReport: async (params?: {
        Fromdate?: string;
        Todate?: string;
    }): Promise<OnlinePaymentReportResponse> => {
        const res = await axios.get<{
            success: boolean;
            data: any;
        }>(
            `${getBaseURL()}api/reports/externalAPI/expenses`,
            { params }
        );

        const data = res.data.data || {};

        return {
            Summary: data.Summary || [],

            IndirectExpense:
                data.IndirectExpense ||
                data["Indirect Expense"] ||
                data["Indirect Expense "] ||
                [],

            DirectExpense:
                data.DirectExpense ||
                data["Direct Expense"] ||
                [],

            OpeningBalance:
                data.OpeningBalance ??
                data.openingBalance ??
                data.Opening ??
                data.opening ??
                0,

            ClosingBalance:
                data.ClosingBalance ??
                data.closingBalance ??
                data.Closing ??
                data.closing ??
                0,
        };
    },
};

/* ---------------- COSTING REPORT SERVICE ---------------- */

export const CostingReportService = {
    getCostingReport: async (params?: {
        Fromdate?: string;
        Todate?: string;
    }): Promise<CostingReportResponse> => {
        const res = await axios.get<{
            success: boolean;
            data: any;
        }>(
            `${getBaseURL()}api/reports/externalAPI/costing`,
            // `http://192.168.1.5:9001/api/reports/externalAPI/costing`,
            { params }
        );

        const data = res.data.data || {};

        return {
            ItemSummary:
                data.ItemSummary ||
                data["ItemSummary"] ||
                [],

            Accountgroup:
                data.Accountgroup ||
                data["Accountgroup"] ||
                [],
        };
    },
};