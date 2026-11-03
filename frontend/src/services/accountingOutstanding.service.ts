import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ================= TYPES ================= */

export interface AccountingOutstandingItem {
    Acc_Id: string;
    Account_name: string;
    Group_Id: string;
    OB_Amount: string;
    Debit_Amt: number;
    Credit_Amt: number;
    Bal_Amount: number;
    CR_DR: string;
    Dr_Amount: number;
    Cr_Amount: number;
    Retailer_Name?: string;
    Group_Name?: string;
    [key: string]: any;
}

export interface AccountingGroupItem {
    Group_Id: string | number;
    Group_Name: string;
    Alias_name?: string;
    Parent_AC_id?: string | number;
    ERP_Id?: number;
    [key: string]: any;
}

/* ================= SERVICE ================= */

export const AccountingOutstandingService = {
    getAccountingOutstanding: (params: {
        Fromdate?: string;
        Todate?: string;
        Group_Id?: string | number;
    }) =>
        axios.get<{
            success: boolean;
            data: AccountingOutstandingItem[];
        }>(`${getBaseURL()}api/reports/externalAPI/accountingOutstanding`, {
            params,
        }),

    getAccountingGroups: () =>
        axios.get<{
            success: boolean;
            data: AccountingGroupItem[];
        }>(`${getBaseURL()}api/masters/accountingGroup`),
};

