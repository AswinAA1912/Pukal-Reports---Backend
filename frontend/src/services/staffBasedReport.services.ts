import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

/* ================= TYPES ================= */

export interface CostCenter {
  Cost_Center_Id: number;
  Cost_Center_Name: string;
}


export interface StaffBasedReport {
  ST_Inv_Id: string;
  Branch_Id: number;
  Journal_no: string;
  Stock_Journal_date: string;
  Month_No: number;
  Invoice_Month: string;
  Invoice_Year: number;
  Month_Year: string;
  Stock_Journal_Bill_type: string;
  Stock_Journal_Voucher_type: string;
  Invoice_no: string;
  Narration: string;
  Product_Id: string;
  Product_Name: string;
  Godown_Id: number;
  Batch_No: string;
  Qty: number;
  Act_Qty: number;
  Rate: number;
  Amt: number;
  Unit: string;
  Trans_Id: string;
  Stock_Item: string;
  Brand: string;
  Group_ST: string;
  Bag: string;
  Stock_Group: string;
  S_Sub_Group_1: string;
  Grade_Item_Group: string;
  Item_Name_Modified: string;
  Date_Added: string;
  POS_Group: string;
  Active: string;
  POS_Item_Name: string;
  Brokerage: number | null;
  Coolie: number | null;
  Empty_Cost: string;
  Primary_Cost: string;
  Transporter_Name: string;
  Broker_Name: string;
  Load_Man: string;
  Others1: string;
  Others2: string;
  Others3: string;
  Checker: string;
  Delivery_Man: string;
  Others4: string;
  Others5: string;
  Others6: string;
  Driver: string;
  Godown_Name: string;
}

export interface StaffBasedCountReport {
  ST_Inv_Id: string;
  Journal_no: string;
  Stock_Journal_date: string;
  Month_No: string;
  Invoice_Month: string;
  Invoice_Year: string;
  Month_Year: string;
  Bill_type: string;
  Stock_Journal_Voucher_type: string;
  Invoice_no: string;
  Narration: string;
  Created_on: string;
  Created_By: string;
}

/* ================= API SERVICES ================= */

export const costCenterListService = {
  getStaff: () =>
    axios.get<{ success: boolean; data: CostCenter[] }>(
      //  ` http://192.168.1.5:9001/api/reports/externalAPI/costCenter`,
      `${getBaseURL()}api/reports/externalAPI/costCenter`
    ),
};

export const staffBasedReportService = {
  getStaffBasedReport: (params?: { Fromdate?: string; Todate?: string }) =>
    axios.get<{ success: boolean; data: StaffBasedReport[] }>(
      //  ` http://192.168.1.5:9001/api/reports/externalAPI/staffbased`,
      `${getBaseURL()}api/reports/externalAPI/staffbased`,
      { params }
    ),
};

export const StaffBasedCountReportService = {
  getStaffBasedCountReport: (params?: { Fromdate?: string; Todate?: string }) =>
    axios.get<{ success: boolean; data: StaffBasedCountReport[] }>(
      //  ` http://192.168.1.5:9001/api/reports/externalAPI/staffbasedCount`,
      `${getBaseURL()}api/reports/externalAPI/staffbasedCount`,
      { params }
    ),
};

export interface VoucherType {
  Value: number;
  label: string;
  Vocher_Type_Id?: number;
  Voucher_Type?: string;
  Voucher_Code?: string;
  Branch_Id?: number;
  Type?: string;
  Tally_Id?: string | null;
  Alter_Id?: string | null;
  Created_By?: any;
  Created_Time?: string | null;
  Alter_By?: any;
  Alter_Time?: string | null;
  tally_sync?: boolean;
  deleteFlag?: number;
  GodownId?: number | null;
  crLimit?: number | null;
  drLimit?: number | null;
  tallyModule?: string | null;
  Godown_Name?: string | null;
  [key: string]: any;
}

export interface GodownMaster {
  Godown_Id: string | number;
  Godown_Name: string;
  VoucherCount?: number;
  [key: string]: any;
}

export interface EmployeeReportGroup {
  Id: number;
  Group_Name: string;
  Overall_GroupId: number;
  Overall_GroupName: string;
  VoucherId: number;
  Voucher_Type_Name: string;
  Created_By?: any;
  Created_At?: string;
  Updated_By?: any;
  Updated_At?: string;
}

export interface CreateEmployeeReportGroupPayload {
  groupName: string;
  overallGroupId: number;
  voucherId: number;
  createdBy?: number;
}

export interface UpdateEmployeeReportGroupPayload {
  groupName: string;
  overallGroupId: number;
  voucherIds: number[];
  updatedBy?: number;
}

export const employeeReportGroupService = {
  getVoucherTypes: (params?: { GodownId?: number | string }) =>
    axios.get<{ success: boolean; data: VoucherType[] }>(
      `${getBaseURL()}api/masters/getVoucherTypes`,
      { params }
    ),

  getGodownsWithVoucherTypes: () =>
    axios.get<{ success: boolean; data: GodownMaster[] }>(
      `${getBaseURL()}api/masters/godownsWithVoucherTypes`
    ),

  getGodowns: () =>
    axios.get<{ success: boolean; data: GodownMaster[] }>(
      `${getBaseURL()}api/masters/godown`
    ),

  getEmployeeReportGroups: (params?: { overallGroupId?: number; groupName?: string }) =>
    axios.get<{ success: boolean; data: EmployeeReportGroup[] }>(
      `${getBaseURL()}api/reports/settings/getEmployeeReportGroups`,
      { params }
    ),

  createEmployeeReportGroup: (payload: CreateEmployeeReportGroupPayload) =>
    axios.post<{ success: boolean; message: string; data?: { Id: number } }>(
      `${getBaseURL()}api/reports/settings/createEmployeeReportGroup`,
      payload
    ),

  updateEmployeeReportGroup: (payload: UpdateEmployeeReportGroupPayload) =>
    axios.put<{ success: boolean; message: string }>(
      `${getBaseURL()}api/reports/settings/updateEmployeeReportGroup`,
      payload
    ),

  getOverallStaffCategorywise: (params?: { Fromdate?: string; Todate?: string }) =>
    axios.get<{ success: boolean; data: any[] }>(
      `${getBaseURL()}api/reports/externalAPI/overallStaffCategorywise`,
      { params }
    ),

  getGroupEmployees: (params?: { Fromdate?: string; Todate?: string; Overall_GroupName?: string; Group_Name?: string; Voucher_Type?: string }) =>
    axios.get<{ success: boolean; data: any[] }>(
      `${getBaseURL()}api/reports/externalAPI/overallStaffCategorywise/employees`,
      { params }
    ),

  getEmployeeInvoices: (params?: { Fromdate?: string; Todate?: string; Overall_GroupName?: string; Group_Name?: string; Voucher_Type?: string | number; Voucher_Type_Id?: number; VoucherId?: number; Emp_Id?: number; Emp_Id_Is_Unassigned?: number }) =>
    axios.get<{ success: boolean; data: any[] }>(
      `${getBaseURL()}api/reports/externalAPI/overallStaffCategorywise/invoices`,
      { params }
    ),

  getEmployeeInvoicesWithItems: (params?: { Fromdate?: string; Todate?: string; Overall_GroupName?: string; Group_Name?: string; Voucher_Type?: string | number; Voucher_Type_Id?: number; VoucherId?: number; Emp_Id?: number; Emp_Id_Is_Unassigned?: number }) =>
    axios.get<{ success: boolean; data: any[] }>(
      `${getBaseURL()}api/reports/externalAPI/overallStaffCategorywise/invoicewithitems`,
      { params }
    ),

  getReportingDetailedList: (params: { Ref_Id?: number | string; Trans_Id?: number | string; Trans_Type: string }) =>
    axios.get<{
      success: boolean;
      data: {
        Masters: any[];
        Items: any[];
        CostCenter: any[];
        Expenses: any[];
      };
      message: string;
      others?: any;
    }>(
      `${getBaseURL()}api/reports/externalAPI/reportingDetailedList`,
      { params }
    ),
};
