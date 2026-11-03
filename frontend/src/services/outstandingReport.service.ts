import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";
/* ================= TYPES ================= */

export interface OutStandingReport {
  Acc_Id: string;
  Account_name: string;
  Retailer_Name: string;
  Retailer_Id: string;
  Group_Name: string;
  Group_Id: string;
  OB_Amount: string;
  Debit_Amt: number;
  Credit_Amt: number;
  Bal_Amount: number;
  CR_DR: string;
  Dr_Amount: number;
  Cr_Amount: number;

  "Ledger_Name - LOL-[1]": string;
  "Ledger_Alias - LOL-[2]": string;
  "Actual_Party_Name_with_Brokers - LOL-[3]": string;
  "Party_Name - LOL-[4]": string | null;
  "Party_Location - LOL-[5]": string;
  "Party_Nature - LOL-[6]": string;
  "Party_Group - LOL-[7]": string;
  "Ref_Brokers - LOL-[8]": string;
  "Ref_Owners - LOL-[9]": string;
  "Party_Mobile_1 - LOL-[10]": string;
  "Party_Mobile_2 - LOL-[11]": string | null;
  "Party_District - LOL-[12]": string;
  "File_No - LOL-[13]": string;
  "Date_Added - LOL-[14]": string;
  "Payment_Mode - LOL-[15]": string;
  "Party_Mailing_Name - LOL-[16]": string;
  "Party_Mailing_Address - LOL-[17]": string;
  "GST_No - LOL-[18]": string | null;
  "A1 - LOL-[19]": string | null;
  "A2 - LOL-[20]": string | null;
  "A3 - LOL-[21]": string | null;
  "A4 - LOL-[22]": string | null;
  "A5 - LOL-[23]": string | null;

  Q_Pay_Group: string;
  Q_Pay_Days: number;
  Freq_Days: number;
}

export interface OutStandingReportData {
  Data1: any[];
  Creditors: any[];
  Debtors: any[];
}

/* ================= API SERVICES ================= */

export const OutStandingReportService = {
  getCostingReport: (params?: { Fromdate?: string; Todate?: string }) =>
    axios.get<{ success: boolean; data: OutStandingReportData }>(
      // `http://192.168.1.5:9001/api/reports/externalAPI/debtorsCreditors`,
      `${getBaseURL()}api/reports/externalAPI/debtorsCreditors`,
      { params }
    ),
};

