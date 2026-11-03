import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ----------------  DATASET ---------------- */

export interface StockAbstractData1 {
    sales_voucher_type_id: number,
    voucher_name: string,
    Act_Sal_Qty: number,
    Act_Alt_Sal_Qty: number,
    Bill_Alt_Sal_Qty: number,
    Bill_Sal_Qty: number
}


export interface StockAbstractData2 {
    purchase_voucher_type_id: number,
    voucher_name: string,
    Act_Pur_Qty: number,
    Act_Alt_Pur_Qty: number,
    Bill_Alt_Pur_Qty: number,
    Bill_Pur_Qty: number
}

export interface StockAbstractData3 {
    stock_journal_type_id: number,
    voucher_name: string,
    IN_Qty: number,
    Out_Qty: number,
    ACt_In_Qty: number,
    ACt_Out_Qty: number,
    Group_Name: string
}

export interface StockAbstractData4 {
    godown_id: string;
    godown_name: string;
    parent_godown_name: string;
    IN_Qty: number;
    Out_Qty: number;
    ACt_In_Qty: number;
    ACt_Out_Qty: number;
    OB_Qty: number;
    ACt_OB_Qty: number;
    SOU_In_Qty?: number;
    SOU_ACt_In_Qty?: number;
    SOU_Out_Qty?: number;
    SOU_ACt_Out_Qty?: number;
    Process_IN_OUT_Qty?: number;
    Process_Act_IN_OUT_Qty?: number;
    CL_QTY: number;
    CL_ACt_QTY: number;
}

export interface StockAbstractData5 {
    Sal_Out_Qty: number;
    Sal_ACt_Out_Qty: number;
    OWSG_Out_Qty: number;
    OWSG_ACt_Out_Qty: number;
    TSG_Out_Qty: number;
    TSG_ACt_Out_Qty: number;
    Out_Qty: number;
    ACt_Out_Qty: number;
    Bal_Qty: number;
    Bal_Act_Qty: number;
}

export interface StockAbstractData6 {
    ST_In_Qty: number;
    ST_ACt_In_Qty: number;
    OWSG_In_Qty: number;
    OWSG_ACt_In_Qty: number;
    TSG_In_Qty: number;
    TSG_ACt_In_Qty: number;
    In_Qty: number;
    ACt_In_Qty: number;
    PSG_In_Qty: number;
    PSG_ACt_In_Qty: number;
    Bal_Qty: number;
    Bal_Act_Qty: number;
}
export interface StockAbstractData7 {
    OWSG_Out_Qty: number;
    OWSG_ACt_Out_Qty: number;
    TSG_Out_Qty: number;
    TSG_ACt_Out_Qty: number;
    Out_Qty: number;
    ACt_Out_Qty: number;
    SG_Out_Qty: number;
    SG_ACt_Out_Qty: number;
    Bal_Qty: number;
    Bal_Act_Qty: number;
}

export interface StockAbstractData8 {
    Pur_IN_Qty: number;
    Pur_ACt_IN_Qty: number;
    IWSG_In_Qty: number;
    INSG_ACt_In_Qty: number;
    Bal_Qty: number;
    Bal_Act_Qty: number;
}

export interface StockAbstractData9 {
    Bal_Qty: number;
    Bal_Act_Qty: number;
    Trans_Type: string;
}

/* ---------------- FINAL RESPONSE TYPE ---------------- */

export interface StockAbstractReportResponse {
    Data1: StockAbstractData1[];
    Data2: StockAbstractData2[];
    Data3: StockAbstractData3[];
    Data4: StockAbstractData4[];
    Data5: StockAbstractData5[];
    Data6: StockAbstractData6[];
    Data7: StockAbstractData7[];
    Data8: StockAbstractData8[];
    Data9: StockAbstractData9[];
}

/* ---------------- STOCK ABSTRACT REPORT SERVICE ---------------- */

export const StockAbstractReportService = {
    getStockAbstractReport: async (params?: {
        Predate?: string;
        Fromdate?: string;
        Todate?: string;
    }): Promise<StockAbstractReportResponse> => {
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
            // 'http://192.168.1.5:9001/api/reports/externalAPI/dayStockAbstract',
            `${getBaseURL()}api/reports/externalAPI/dayStockAbstract`,
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
        };
    },
    getGodownSummaryInstock: async (params?: {
        Predate?: string;
        Fromdate?: string;
        Todate?: string;
    }): Promise<StockAbstractData4[]> => {
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
            `${getBaseURL()}api/reports/externalAPI/godownSummaryInstock`,
            {
                params: finalParams,
            }
        );

        const data = res.data?.data ?? res.data;
        return mergeGodownSummaryDatasets(data);
    },
};

/**
 * Merge two datasets (OB & Data) from GodownInstockSummary
 * where 1st dataset contains OB and 2nd dataset contains In, Out, Process Qty,
 * and calculate Closing Qty (CL_QTY and CL_ACt_QTY) on frontend.
 */
export function mergeGodownSummaryDatasets(apiResponseData: any): StockAbstractData4[] {
    if (!apiResponseData) return [];

    let listA: any[] = [];
    let listB: any[] = [];

    if (Array.isArray(apiResponseData)) {
        if (apiResponseData.length === 2 && Array.isArray(apiResponseData[0]) && Array.isArray(apiResponseData[1])) {
            listA = apiResponseData[0];
            listB = apiResponseData[1];
        } else {
            // Already flat list
            return apiResponseData.map((item: any) => calculateGodownItem(item, item));
        }
    } else if (typeof apiResponseData === "object") {
        if (Array.isArray(apiResponseData.Data4)) {
            return apiResponseData.Data4.map((item: any) => calculateGodownItem(item, item));
        }

        const candidateKeys = Object.keys(apiResponseData);
        const obKey = candidateKeys.find(k => k.toLowerCase() === "ob");
        const dataKey = candidateKeys.find(k => k.toLowerCase() === "data" || k.toLowerCase() === "data1");

        if (obKey && dataKey) {
            listA = Array.isArray(apiResponseData[obKey]) ? apiResponseData[obKey] : [];
            listB = Array.isArray(apiResponseData[dataKey]) ? apiResponseData[dataKey] : [];
        } else if (candidateKeys.length >= 2) {
            listA = Array.isArray(apiResponseData[candidateKeys[0]]) ? apiResponseData[candidateKeys[0]] : [];
            listB = Array.isArray(apiResponseData[candidateKeys[1]]) ? apiResponseData[candidateKeys[1]] : [];
        } else if (candidateKeys.length === 1 && Array.isArray(apiResponseData[candidateKeys[0]])) {
            return apiResponseData[candidateKeys[0]].map((item: any) => calculateGodownItem(item, item));
        }
    }

    if (!listA.length && !listB.length) {
        return [];
    }

    // Determine which list contains OB and which contains Data (In/Out/Process)
    const isListA_OB = listA.some((item: any) => (item.OB_Qty !== undefined || item.ACt_OB_Qty !== undefined) && item.IN_Qty === undefined);
    const isListB_Data = listB.some((item: any) => item.IN_Qty !== undefined || item.Out_Qty !== undefined || item.Process_IN_OUT_Qty !== undefined || item.SOU_In_Qty !== undefined);

    let obList: any[] = [];
    let dataList: any[] = [];

    if (isListA_OB || isListB_Data) {
        obList = listA;
        dataList = listB;
    } else {
        const isListB_OB = listB.some((item: any) => (item.OB_Qty !== undefined || item.ACt_OB_Qty !== undefined) && item.IN_Qty === undefined);
        if (isListB_OB) {
            obList = listB;
            dataList = listA;
        } else {
            obList = listA;
            dataList = listB;
        }
    }

    const obById = new Map<string, any>();
    const obByName = new Map<string, any>();

    obList.forEach((item: any) => {
        const gId = String(item.godown_id ?? "").trim();
        const gName = String(item.godown_name ?? "").toLowerCase().trim();
        if (gId && gId !== "0") obById.set(gId, item);
        if (gName) obByName.set(gName, item);
    });

    const combinedMap = new Map<string, StockAbstractData4>();

    dataList.forEach((dataItem: any) => {
        const gId = String(dataItem.godown_id ?? "").trim();
        const gName = String(dataItem.godown_name ?? "").toLowerCase().trim();
        const key = gId && gId !== "0" ? `id_${gId}` : `name_${gName}`;

        const obItem = (gId && obById.get(gId)) || (gName && obByName.get(gName)) || null;
        combinedMap.set(key, calculateGodownItem(dataItem, obItem));
    });

    obList.forEach((obItem: any) => {
        const gId = String(obItem.godown_id ?? "").trim();
        const gName = String(obItem.godown_name ?? "").toLowerCase().trim();
        const key = gId && gId !== "0" ? `id_${gId}` : `name_${gName}`;

        if (!combinedMap.has(key)) {
            combinedMap.set(key, calculateGodownItem(null, obItem));
        }
    });

    const result = Array.from(combinedMap.values()).filter(g => g.godown_name);
    result.sort((a, b) => a.godown_name.localeCompare(b.godown_name));
    return result;
}

function calculateGodownItem(dataItem: any, obItem: any): StockAbstractData4 {
    const godown_id = String(dataItem?.godown_id ?? obItem?.godown_id ?? "");
    const godown_name = String(dataItem?.godown_name ?? obItem?.godown_name ?? "");
    const parent_godown_name = String(dataItem?.parent_godown_name ?? obItem?.parent_godown_name ?? "Others");

    const OB_Qty = Number(obItem?.OB_Qty ?? dataItem?.OB_Qty ?? 0);
    const ACt_OB_Qty = Number(obItem?.ACt_OB_Qty ?? dataItem?.ACt_OB_Qty ?? 0);

    const IN_Qty = Number(dataItem?.IN_Qty ?? obItem?.IN_Qty ?? 0);
    const ACt_In_Qty = Number(dataItem?.ACt_In_Qty ?? obItem?.ACt_In_Qty ?? 0);

    const Out_Qty = Number(dataItem?.Out_Qty ?? obItem?.Out_Qty ?? 0);
    const ACt_Out_Qty = Number(dataItem?.ACt_Out_Qty ?? obItem?.ACt_Out_Qty ?? 0);

    const Process_IN_OUT_Qty = Number(dataItem?.Process_IN_OUT_Qty ?? obItem?.Process_IN_OUT_Qty ?? 0);
    const Process_Act_IN_OUT_Qty = Number(dataItem?.Process_Act_IN_OUT_Qty ?? obItem?.Process_Act_IN_OUT_Qty ?? 0);

    const SOU_In_Qty = Number(dataItem?.SOU_In_Qty ?? obItem?.SOU_In_Qty ?? 0);
    const SOU_ACt_In_Qty = Number(dataItem?.SOU_ACt_In_Qty ?? obItem?.SOU_ACt_In_Qty ?? 0);
    const SOU_Out_Qty = Number(dataItem?.SOU_Out_Qty ?? obItem?.SOU_Out_Qty ?? 0);
    const SOU_ACt_Out_Qty = Number(dataItem?.SOU_ACt_Out_Qty ?? obItem?.SOU_ACt_Out_Qty ?? 0);

    // Closing calculation aligned with SP1 and SP2:
    // Bal_Qty = (OB_Qty + IN_Qty + SOU_In_Qty) - (Out_Qty + SOU_Out_Qty)
    const CL_QTY = (dataItem?.CL_QTY !== undefined && dataItem?.CL_QTY !== null)
        ? Number(dataItem.CL_QTY)
        : ((OB_Qty + IN_Qty + SOU_In_Qty) - (Out_Qty + SOU_Out_Qty));
    const CL_ACt_QTY = (dataItem?.CL_ACt_QTY !== undefined && dataItem?.CL_ACt_QTY !== null)
        ? Number(dataItem.CL_ACt_QTY)
        : ((ACt_OB_Qty + ACt_In_Qty + SOU_ACt_In_Qty) - (ACt_Out_Qty + SOU_ACt_Out_Qty));

    return {
        godown_id,
        godown_name,
        parent_godown_name,
        IN_Qty,
        Out_Qty,
        ACt_In_Qty,
        ACt_Out_Qty,
        OB_Qty,
        ACt_OB_Qty,
        Process_IN_OUT_Qty,
        Process_Act_IN_OUT_Qty,
        SOU_In_Qty,
        SOU_ACt_In_Qty,
        SOU_Out_Qty,
        SOU_ACt_Out_Qty,
        CL_QTY,
        CL_ACt_QTY
    };
}