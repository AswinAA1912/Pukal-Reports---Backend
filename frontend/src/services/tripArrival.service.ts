import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface TripArrivalDetail {
    ST_Inv_Id?: number | string;
    Trip_Id?: number | string;
    Branch_Id?: number;
    Journal_no?: string;
    Stock_Journal_date?: string;
    Month_No?: number;
    Invoice_Month?: string;
    Invoice_Year?: number;
    Month_Year?: string;
    Bill_type?: string;
    Stock_Journal_Voucher_type?: string;
    Invoice_no?: string;
    Narration?: string;
    [key: string]: any;
}

export interface TripArrivalStaffDetail {
    Trip_Id?: number | string;
    Cost_Center_Type_Id?: number | string;
    Cost_Center_Name?: string;
    Cost_Category?: string;
    Alias_Name?: string;
    [key: string]: any;
}

export interface TripArrivalResponseData {
    details: TripArrivalDetail[];
    staffDetails: TripArrivalStaffDetail[];
}

export const TripArrivalService = {
    getTripArrivalList: (tripId: string | number) =>
        axios.get<{ success: boolean; data: TripArrivalResponseData; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/ReportingOnlineTripArrivalList`,
            { params: { Trip_Id: tripId } }
        ),
};