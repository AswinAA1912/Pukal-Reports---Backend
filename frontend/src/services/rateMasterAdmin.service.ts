import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface RateMasterAdminData1 {
  Product_Id: string;
  Rate: number;
  Min_Rate: number;
  Max_Rate: number;
  COGS: number;
  GP_Percentage_COGS: number;
  Product_Name: string;
  Brand: string;
  Group_ST: string;
  Grade_Item_Group: string;
  POS_Group: string;
  Item_Name_Modified: string;
  POS_Item_Name: string;
}

export interface RateMasterAdminData2 {
  Product_Id: string;
}

export interface RateMasterAdminResponse {
  Data1: RateMasterAdminData1[];
  Data2: RateMasterAdminData2[];
}

export const RateMasterAdminService = {
  getReport: (params?: { Todate?: string }) =>
    axios.get<{ success: boolean; data: RateMasterAdminResponse }>(
      `${getBaseURL()}api/reports/externalAPI/rateMasterAdmin`,
      { params }
    ),
};
