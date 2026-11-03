import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

export interface SalesDeliveryItem {
  ReportDate?: string;
  Metric: string;
  SalesOrder: string;
  SalesInvoice: string;
  Printed: string;
  Taken: string;
  Check: string;
  Dispatch: string;
  Delivery: string;
  ShedSheet: string;
}

export interface GodownItem {
  Godown_Id: string;
  Godown_Name: string;
  Godown_Tally_Id: string;
  Alter_Id: string;
  Created_By: number;
  Created_Time: string;
  Alter_By: number;
  Alter_Time: string;
  Godown_Address: string | null;
  Gst_No: string | null;
  Phone_No: string | null;
  Godown_Group_Id: string;
}

export const SalesDeliveryReportService = {
  getGodowns: () =>
    axios.get<{ success: boolean; data: GodownItem[] }>(
      `${getBaseURL()}api/masters/godown`
    ),
  getSalesDeliveryCumulative: (params?: { Fromdate?: string; Todate?: string; Godown_Id?: string | number }) =>
    axios.get<{ success: boolean; data: SalesDeliveryItem[] }>(
      `${getBaseURL()}api/reports/externalAPI/salesDeliveryCummulative`,
      { params }
    ),
  getSalesDeliveryDaywise: (params?: { Fromdate?: string; Todate?: string; Godown_Id?: string | number }) =>
    axios.get<{ success: boolean; data: SalesDeliveryItem[] }>(
      `${getBaseURL()}api/reports/externalAPI/salesDeliveryDaywise`,
      { params }
    ),
};
