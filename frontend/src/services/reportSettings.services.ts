import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ================= TYPES ================= */


export interface Settings {
    Report_Name: string;
    Abstract_SP: string;
    Expanded_SP: string;
}

export interface ExecuteSPPayload {
    spName: string;
    params: Record<string, any>;
}

export interface ColumnPayload {
    key: string;
    label: string;
    order: number;
    groupBy: number;
    enabled: boolean;
}

export interface SaveReportPayload {
    reportName: string;
    parentReport: string;
    abstractSP: string;
    expandedSP: string;
    abstractColumns: ColumnPayload[];
    expandedColumns: ColumnPayload[];
    createdBy: number;
}

type UpdateReportPayload = {
    reportId: number;
    typeId: number;
    reportName?: string;

    columns?: any[];

    abstractColumns?: any[];
    expandedColumns?: any[];
};

export interface SaveReportByTypePayload {
    reportName: string;
    parentReport: string;
    type: "Abstract" | "Expanded";
    spName: string;
    columns: ColumnPayload[];
}

/* ================= SERVICE ================= */

export const SettingsService = {
    // 🔹 1. Get Menu + SP Mapping
    getMenuSP: () =>
        axios.get<{ success: boolean; data: Settings[] }>(
            // `http://192.168.1.92:9001/api/reports/settings/MenuSettings`
            `${getBaseURL()}api/reports/settings/MenuSettings`
        ),

    // 🔹 2. Execute Stored Procedure (Dynamic Columns)
    executeSP: (payload: ExecuteSPPayload) =>
        axios.post<{ success: boolean; data: any[] }>(
            // `http://192.168.1.92:9001/api/reports/settings/executeSP`,
            `${getBaseURL()}api/reports/settings/executeSP`,
            payload
        ),

    // 🔹 3. Save Report Settings
    saveReport: (payload: SaveReportPayload) =>
        axios.post<{ success: boolean; message: string }>(
            // `http://192.168.1.92:9001/api/reports/settings/saveReport`,
            `${getBaseURL()}api/reports/settings/saveReport`,
            payload
        ),
    saveReportSettings: (payload: any) =>
        axios.post<{ success: boolean; message: string }>(
            // `http://192.168.1.92:9001/api/reports/settings/saveReport`,
            `${getBaseURL()}api/reports/settings/saveReport`,
            payload
        ),

    // 🔹 4. get Reports
    getReportList: () =>
        // axios.get(`http://192.168.1.92:9001/api/reports/settings/reportList`),
        axios.get(`${getBaseURL()}api/reports/settings/reportList`),

    /* 🔹 5. Get Edit Data (IMPORTANT) */
    getReportEditData: (params: {
        reportId: number;
        typeId: number;
    }) =>
        // axios.get(`http://192.168.1.92:9001/api/reports/settings/editreport`, {
        //     params
        // }),
        axios.get(`${getBaseURL()}api/reports/settings/editreport`, {
            params
        }),

    /* 🔹 6. Update Report (EDIT SAVE) */
    updateReport: (payload: UpdateReportPayload) =>
        // axios.put(`http://192.168.1.92:9001/api/reports/settings/updatereport`, payload),
        axios.put(`${getBaseURL()}api/reports/settings/updatereport`, payload),

    getReportsByParent(parentReport: string) {
        // return axios.get(`http://192.168.1.92:9001/api/reports/settings/byParent`, {
        //     params: { parentReport }
        // });
        return axios.get(`${getBaseURL()}api/reports/settings/byParent`, {
            params: { parentReport }
        });
    },

    executeReport(reportId: number, typeId: number) {
        // return axios.get(`http://192.168.1.92:9001/api/reports/settings/getreport`, {
        //     params: { reportId, typeId }
        // });
        return axios.get(`${getBaseURL()}api/reports/settings/getreport`, {
            params: { reportId, typeId }
        });
    },
    /* 🔹 7. Delete Report  */
    deleteReport(reportId: number) {
        //  return axios.delete(`http://192.168.1.92:9001/api/reports/settings/deleteReport/${reportId}`);
        return axios.delete(`${getBaseURL()}api/reports/settings/deleteReport/${reportId}`);
    },


};