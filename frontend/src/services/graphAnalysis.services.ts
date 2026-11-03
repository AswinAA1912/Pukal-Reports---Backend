import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface DayWiseData {
  Invoice_Date: string;
  Invoice_Count: number;
  Total_Invoice_value: number;
}

export interface WeekWiseData {
  Week_No: number;
  Invoice_Count: number;
  Total_Invoice_value: number;
}

export interface DayWiseTonnage {
  Invoice_Date: string;
  Total_Tons: number;
}

export interface WeekWiseTonnage {
  Week_No: number;
  Total_Tons: number;
}


export interface DashboardGraphResponse {
  DayWise: DayWiseData[];
  WeekWiseData: WeekWiseData[];
  DayWiseTonnage: DayWiseTonnage[];
  WeekWiseTonnage:WeekWiseTonnage[];
}

export const DashBoardSalesGraph = {
  getDashboardGraph: (params?: { Fromdate?: string; Todate?: string;  Company_Id?: number; }) =>
    axios.get<{ success: boolean; data: DashboardGraphResponse }>(
      // `http://192.168.1.92:9001/api/reports/externalAPI/SalesGraph`,
      `${getBaseURL()}api/reports/externalAPI/SalesGraph`,
      { params }
    )
}

export const DashBoardPurchaseGraph = {
  getDashboardGraph: (params?: { Fromdate?: string; Todate?: string;  Company_Id?: number; }) =>
    axios.get<{ success: boolean; data: DashboardGraphResponse }>(
      // `http://192.168.1.92:9001/api/reports/externalAPI/PurchaseGraph`,
      `${getBaseURL()}api/reports/externalAPI/PurchaseGraph`,
      { params }
    )
}

export const StockValueGraph = {
  getDashboardGraph: (params?: { Fromdate?: string; Todate?: string; Company_Id?: number; }) =>
    axios.get<{ success: boolean; data: DashboardGraphResponse }>(
      //  `http://192.168.1.92:9001/api/reports/externalAPI/StockValueGraph`,
      `${getBaseURL()}api/reports/externalAPI/StockValueGraph`,
      {params}
    )
}