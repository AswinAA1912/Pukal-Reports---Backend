import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";
import { CashBoxReportResponse } from "./cashbox.service";

export interface ChequeAccountOption {
    value: number | string;
    label: string;
}

export const bankboxService = {
    getBankBoxReport: async (params?: {
        Fromdate?: string;
        Todate?: string;
    }): Promise<CashBoxReportResponse> => {
        const res = await axios.get<{
            success: boolean;
            data: CashBoxReportResponse;
        }>(
            `${getBaseURL()}api/reports/externalAPI/Bankbox`,
            { params }
        );
        return res.data.data;
    },

    getBankBoxDetailedReport: async (params?: {
        Fromdate?: string;
        Todate?: string;
    }): Promise<{ OB: any[]; Data: any[]; Group: any[] }> => {
        const res = await axios.get<{
            success: boolean;
            data: { OB: any[]; Data: any[]; Group: any[] };
        }>(
            `${getBaseURL()}api/reports/externalAPI/bankListDetailed`,
            { params }
        );
        return res.data.data;
    },

    getChequeAccounts: async (): Promise<ChequeAccountOption[]> => {
        const res = await axios.get<{
            success: boolean;
            data: ChequeAccountOption[];
        }>(
            `${getBaseURL()}api/reports/receipt/chequeAccounts`
        );
        return res.data.data;
    },

    getChequeCreditAccounts: async (): Promise<ChequeAccountOption[]> => {
        const res = await axios.get<{
            success: boolean;
            data: ChequeAccountOption[];
        }>(
            `${getBaseURL()}api/reports/receipt/chequeCreditAccounts`
        );
        return res.data.data;
    },

    getChequeVoucherTypes: async (): Promise<ChequeAccountOption[]> => {
        const res = await axios.get<{
            success: boolean;
            data: ChequeAccountOption[];
        }>(
            `${getBaseURL()}api/reports/receipt/chequeVoucherTypes`
        );
        return res.data.data;
    },

    getChequeTransactions: async (params: {
        Fromdate: string;
        Todate: string;
        debitAccount: string | number;
    }): Promise<any[]> => {
        const res = await axios.get<{
            success: boolean;
            data: any[];
        }>(
            `${getBaseURL()}api/reports/receipt/chequeTransaction`,
            { params }
        );
        return res.data.data;
    }
};
