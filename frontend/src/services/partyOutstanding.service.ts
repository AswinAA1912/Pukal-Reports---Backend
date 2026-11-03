import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ================= TYPES ================= */

export interface PartyOutstanding {
    Acc_Id: string;
    Account_name: string;
    Retailer_Name: string;
    Retailer_Id: string;
    Group_Name: string;
    Group_Id: string;
    OB_Amount: string;
    Debit_Amt: number;
    Credit_Amt: number;
    Bal_Amount: number;
    CR_DR: string;
    Dr_Amount: number;
    Cr_Amount: number;
}

export interface PendingOutstanding {
    voucherId: string;
    voucherNumber: string;
    eventDate: string;
    Acc_Id: string;
    totalValue: number;
    dataSource: string;
    actualSource: string;
    againstAmount: number;
    journalAdjustment: number;
    accountSide: string;
    BillRefNo: string;
    BalanceAmount: number;
}

/* ================= TRANSACTION TYPES ================= */

export interface AccountTransaction {
    invoice_no: string;
    Ledger_Date: string;
    Ledger_Desc: string;
    Particulars: string;
    Credit_Amt: number;
    Debit_Amt: number;
    Acc_Id: string[];
    Month_No: number;
    Invoice_Month: string;
    Invoice_Year: number;
    Month_Year: string;
    Trans_Id: string;
    ord: number;
    Account_name: string;
    Narration: string;
    Line_Naration: string;
}

/* ================= SERVICE ================= */

export const PartyOutstandingService = {

    /* ================= PARTY OUTSTANDING ================= */

    getPartyOutstanding: (params: {
        Group_Id: string | number;
        Fromdate?: string;
        Todate?: string;
    }) =>
        axios.get<{
            success: boolean;
            data: PartyOutstanding[];
        }>(
            `${getBaseURL()}api/journal/partyOutstanding`,
            {
                params,
            }
        ),

    /* ================= PENDING OUTSTANDING ================= */

    getPendingOutstanding: (
        accId: string,
        fromDate?: string,
        toDate?: string
    ) =>
        axios.get(
            `${getBaseURL()}api/journal/accountPendingReference`,
            {
                params: {
                    Acc_Id: accId,
                    Fromdate: fromDate,
                    Todate: toDate,
                },
            }
        ),

    /* ================= ACCOUNT TRANSACTIONS ================= */

    getAccountTransactions: (
        accId: string,
        fromDate?: string,
        toDate?: string
    ) =>
        axios.get<{
            success: boolean;
            data: AccountTransaction[];
        }>(
            `${getBaseURL()}api/payment/transactions`,
            {
                params: {
                    Acc_Id: accId,
                    fromDate,
                    toDate,
                },
            }
        ),
};