import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface PurchaseOrderTripItem {
    OrderId: string | number;
    Trip_Id: string | number;
    Arrival_Date: string;
    Batch_No: string | null;
    From_Location?: number;
    To_Location?: number;
    Concern?: string;
    BillNo?: string;
    BatchLocation?: string;
    Product_Id: number;
    HSN_Code?: string;
    QTY: number;
    KGS: number;
    Unit_Id?: number;
    Units?: string;
    GST_Inclusive?: number;
    IS_IGST?: number;
    Gst_Rate: number;
    Gst_P?: number;
    Cgst_P?: number;
    Sgst_P?: number;
    Igst_P?: number;
    Taxable_Value: number;
    Round_off?: number;
    Total_Value: number;
    Product_Name: string;
    TR_INV_ID: string;
    T_No?: number;
    Challan_No?: string;
    Trip_Date: string;
    Vehicle_No?: string;
    BillType?: string;
    Narration?: string;
    TripStatus?: string;
    Stock_Group?: string;
}

export interface PurchaseOrderTripItemResponse {
    success: boolean;
    data: PurchaseOrderTripItem[];
    message?: string;
    others?: any;
}

export const PurchaseOrderTripItemService = {
    getPurchaseOrderTripItemDetails: (params?: { Fromdate?: string; Todate?: string }) =>
        axios.get<{ success: boolean; data: PurchaseOrderTripItem[] }>(
            `${getBaseURL()}api/reports/externalAPI/purchaseOrderTripItemDetails`,
            { params }
        ),
};
