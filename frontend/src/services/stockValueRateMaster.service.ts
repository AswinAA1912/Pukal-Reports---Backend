import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ================= TYPES ================= */

export interface PosRate {
  Id: number;
  Rate_Date: string;
  Pos_Brand_Id: string;
  Item_Id: string;
  Min_Rate: number;
  Rate: number;
  Max_Rate: number;
  POS_Brand_Name: string;
  Product_Name: string;
  Short_Name: string;
  Is_Active_Decative: number;
}

export interface StockValue {
  Trans_Date: string;
  Product_Id: string;
  CL_Rate: number;
}

export interface StockValueMerged {
  Product_Name: string;
  Item_Id: string;
  Rate: number;
  CL_Rate: number;
}

/* ================= API SERVICES ================= */

export const stockValueReportService = {
  // POS RATE API
  getPosRates: (params?: { FromDate?: string }) =>
    axios.get<{
      success: boolean; data: { posRateMaster: PosRate[]; };
    }>(
      `${getBaseURL()}api/masters/posRateMaster`,
      { params }
    ),

  // STOCK VALUE API
  getStockValues: (params?: { FromDate?: string }) =>
    axios.get<{ success: boolean; data: StockValue[] }>(
      //  ` http://192.168.1.92:9001/api/reports/externalAPI/stockValue`,
      `${getBaseURL()}api/reports/externalAPI/stockValue`,
      { params }
    ),
};

