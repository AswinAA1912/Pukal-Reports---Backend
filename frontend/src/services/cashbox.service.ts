import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface CashBoxOB {
    OB_Amount: number | string;
}

export interface CashBoxTransaction {
    invoice_no: string;
    Ledger_Date: string;
    Month_No: number;
    Invoice_Month: string;
    Invoice_Year: number;
    Month_Year: string;
    Credit_Ac_Id: string;
    Debit_Ac_Id: string;
    Cr_Amount: number;
    Dr_Amount: number;
    Trans_Id: string;
    voucher_name: string;
    Particulars: string;
    Narration: string;
    Created_Time: string;
    Line_Naration: string;
    ord: number;
}

export interface CashBoxMasterAccount {
    Acc_Id: string;
    Account_name: string;
    Group_Name: string;
    Group_Id: string;
    Retailer_Name?: string;
    Retailer_Id?: string;
}

export interface CashBoxJnl {
    invoice_no: string;
    Debit_Names: string;
    Credit_Names: string;
}

export interface CashBoxRecPay {
    invoice_no: string;
    bill_name: string;
    Amount: number;
    INV_Date?: string;
}

export interface CashBoxCls {
    Group_Name: string;
    CL_Amount: number | string;
    Acc_Id?: string;
    Group_Id?: string;
}

export interface CashBoxReportResponse {
    OB: CashBoxOB[];
    Data1: CashBoxTransaction[];
    Cash: CashBoxMasterAccount[];
    Bank: CashBoxMasterAccount[];
    LedgerGrp: CashBoxMasterAccount[];
    DEX: CashBoxMasterAccount[];
    IDEX: CashBoxMasterAccount[];
    RecPay?: CashBoxRecPay[];
    Jnl?: CashBoxJnl[];
    Cls?: CashBoxCls[];
}

export const cashboxService = {
    getCashBoxReport: async (params?: {
        Fromdate?: string;
        Todate?: string;
    }): Promise<CashBoxReportResponse> => {
        const res = await axios.get<{
            success: boolean;
            data: CashBoxReportResponse;
        }>(
            // `http://192.168.1.5:9001/api/reports/externalAPI/cashbox`,
            `${getBaseURL()}api/reports/externalAPI/cashbox`,
            { params }
        );
        return res.data.data;
    },
    getCashBoxDetailedReport: async (params?: {
        Fromdate?: string;
        Todate?: string;
    }): Promise<{ OB: any[]; Data: any[]; Group: any[] }> => {
        const res = await axios.get<{
            success: boolean;
            data: { OB: any[]; Data: any[]; Group: any[] };
        }>(
            `${getBaseURL()}api/reports/externalAPI/cashListDetailed`,
            { params }
        );
        return res.data.data;
    }
};

