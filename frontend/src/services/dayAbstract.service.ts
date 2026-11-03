import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ----------------  DATASET ---------------- */

export interface DayAbstractData1 {
    Trans_Type: string;
    Trans_Amount: number;
}


export interface DayAbstractData2 {
    Trans_Type: string;
    Trans_Amount: number;
    Trans_Count: number;
}

export interface DayAbstractData3 {
    ledger_name: string;
    group_name: string;
    Master_Name: string;
    Trans_Type: string;
    Credit_Amount: number;
    Debit_Amount: number;
}

export interface DayAbstractData4 {
    Trans_Type: string;
    Trans_Amount: number;
    Trans_Count: number;
}

export interface DayAbstractData5 {
    Dr_Amount: number;
    Cr_Amount: number;
    OB_Amount: number;
    OPB_Amount: number;
    Credit_Amt: number;
    Debit_Amt: number;
    Bal_Amount: number;
}

export interface DayAbstractData6 {
    Dr_Amount: number;
    Cr_Amount: number;
    OB_Amount: number;
    OPB_Amount: number;
    Credit_Amt: number;
    Debit_Amt: number;
    Bal_Amount: number;
}
export interface DayAbstractData7 {
    Trans_Type: string;
    Credit_Amount: number;
    Debit_Amount: number;
    Credit_Amount_1: number;
    Debit_Amount_1: number;
}

export interface DayAbstractData8 {
    Trans_Type: string;
    Credit_Amount: number;
    Debit_Amount: number;
    Credit_Amount_1: number;
    Debit_Amount_1: number;
}

export interface DayAbstractData9 {
    Recivables: number;
    Payables: number;
    Balance: number;
}

export interface DayAbstractData10 {
    Recivables: number;
    Payables: number;
    Balance: number;
}

/* ---------------- FINAL RESPONSE TYPE ---------------- */

export interface DayAbstractReportResponse {
    Data1: DayAbstractData1[];
    Data2: DayAbstractData2[];
    Data3: DayAbstractData3[];
    Data4: DayAbstractData4[];
    Data5: DayAbstractData5[];
    Data6: DayAbstractData6[];
    Data7: DayAbstractData7[];
    Data8: DayAbstractData8[];
    Data9: DayAbstractData9[];
    Data10: DayAbstractData10[];
}

/* ---------------- DAY ABSTRACT REPORT SERVICE ---------------- */

export const DayAbstractReportService = {
    getDayAbstractReport: async (params?: {
        Predate?: string;
        Fromdate?: string;
        Todate?: string;
    }): Promise<DayAbstractReportResponse> => {
        const finalParams = { ...params };
        if (!finalParams.Predate && finalParams.Fromdate) {
            const d = new Date(finalParams.Fromdate);
            d.setDate(d.getDate() - 1);
            finalParams.Predate = d.toISOString().split("T")[0];
        }
        const res = await axios.get<{
            success: boolean;
            data: any;
        }>(
            // 'http://192.168.1.5:9001/api/reports/externalAPI/dayAbstract',
            `${getBaseURL()}api/reports/externalAPI/dayAbstract`,
            {
                params: finalParams,
            }
        );

        const data = res.data.data || {};

        return {
            Data1:
                data.Data1 ||
                data["Data1"] ||
                [],

            Data2:
                data.Data2 ||
                data["Data2"] ||
                [],

            Data3:
                data.Data3 ||
                data["Data3"] ||
                [],

            Data4:
                data.Data4 ||
                data["Data4"] ||
                [],

            Data5:
                data.Data5 ||
                data["Data5"] ||
                [],

            Data6:
                data.Data6 ||
                data["Data6"] ||
                [],

            Data7:
                data.Data7 ||
                data["Data7"] ||
                [],

            Data8:
                data.Data8 ||
                data["Data8"] ||
                [],

            Data9:
                data.Data9 ||
                data["Data9"] ||
                [],

            Data10:
                data.Data10 ||
                data["Data10"] ||
                [],
        };
    },
};