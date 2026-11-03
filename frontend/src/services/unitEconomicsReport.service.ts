import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* =========================
   Types
========================= */

export interface UnitEconomicsReport {
  Trans_Date: string;
  Product_Id: number;
  Product_Name: string;
  Bill_Qty: number;
  Rate: number;
  Amount: number;
  Min_Rate: number;
  List_Rate: number;
  COGS: number;
  COGS_Amount: number;
  Brand?: string;
  Group_ST?: string;
  Grade_Item_Group?: string;
  POS_Group?: string;
  Item_Name_Modified?: string;
  POS_Item_Name?: string;
}

export interface AdminUnitEconomicsReport {
  invoice_no: string;
  Ledger_Date: string;
  Retailer_Name: string;
  Product_Name: string;
  Bill_Qty: number;
  Rate: number;
  Amount: number;
  Min_Rate: number;
  COGS_Rate: number;
  GP_MR: number;
  GP_COGS: number;
  TGP_MR: number;
  TGP_COGS: number;
  GP_Percentage_MR: number;
  GP_Percentage_COGS: number;
}

/* =========================
   Service
========================= */

export const UnitEconomicsReportService = {
  getReports: (params?: {
    Fromdate?: string;
    Todate?: string;
    Product_Id?: number;
  }) =>
    axios.get<{
      success: boolean; data: {
        rows: UnitEconomicsReport[];
        lastStockValueDate?: {
          Last_Stock_Value_Date: string;
        };
      };
    }>(
      `${getBaseURL()}api/reports/externalAPI/unitEconomicsReport`,
      { params }
    ),
};

export const AdminUnitEconomicsReportService = {
  getReports: (params?: {
    Fromdate?: string;
    Todate?: string;
    Product_Id?: number;
  }) =>
    axios.get<{
      success: boolean; data: {
        rows: AdminUnitEconomicsReport[];
        lastStockValueDate?: {
          Last_Stock_Value_Date: string;
        };
      };
    }>(
      `${getBaseURL()}api/reports/externalAPI/adminunitEconomics`,
      // `http://192.168.1.5:9001/api/reports/externalAPI/adminunitEconomics`,
      { params }
    ),

  syncReports: (params?: {
    Fromdate?: string;
    Todate?: string;
  }) =>
    axios.get<{
      success: boolean;
      data: any;
    }>(
      `${getBaseURL()}api/reports/externalAPI/adminunitEconomicsSync`,
      // `http://192.168.1.5:9001/api/reports/externalAPI/adminunitEconomicsSync`,
      { params }
    ),
};