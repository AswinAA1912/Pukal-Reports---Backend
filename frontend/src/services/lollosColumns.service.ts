import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface LolLosColumn {
  Id: string;
  ColumnName: string;
  company_Id: string;
  status: number;
  Alias_Name: string | null;
  Position: number;
}

export const lollosColumnsService = {
  getLolColumns: () =>
    axios.get<{ success: boolean; data: LolLosColumn[] }>(
      `${getBaseURL()}api/masters/lol`
    ),
  getLosColumns: () =>
    axios.get<{ success: boolean; data: LolLosColumn[] }>(
      `${getBaseURL()}api/masters/los`
    ),
};
