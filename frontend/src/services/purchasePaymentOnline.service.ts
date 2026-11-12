import axios from "axios";
import { getBaseURL } from "../config/portalBaseURL";

// 1. Reporting_Online_Purchase_Payment_List
export interface PurchasePaymentListItem {
    Invoice_no: string;
    Cr_Amount?: number | string;
    Dr_Amount?: number | string;
    PIN_Id?: number | string;
    Trans_Id?: number | string;
    Trans_Date?: string;
    Particulars: string; // e.g., 'PAYMENT', 'JOURNAL'
    ord?: number;
    [key: string]: any;
}

// 2. Reporting_Online_Payment_List (3 datasets)
export interface PaymentDetailsHeader {
    pay_id?: number | string;
    year_id?: number;
    payment_voucher_type_id?: number;
    payment_sno?: number;
    payment_invoice_no?: string;
    payment_date?: string;
    pay_bill_type?: string;
    is_new_ref?: number;
    credit_ledger?: number;
    credit_ledger_name?: string;
    credit_amount?: number;
    debit_ledger?: number;
    debit_ledger_name?: string;
    debit_amount?: number;
    remarks?: string;
    transaction_type?: string;
    Ledger_Date?: string;
    Month_No?: number;
    Invoice_Month?: string;
    Invoice_Year?: number;
    Month_Year?: string;
    voucher_name?: string;
    Created_By?: string;
    [key: string]: any;
}

export interface PaymentDetailsReference {
    auto_id?: string;
    payment_id?: string | number;
    payment_no?: string;
    payment_date?: string;
    bill_type?: string;
    DR_CR_Acc_Id?: number;
    pay_bill_id?: number | string;
    bill_name?: string;
    bill_ref_number?: string;
    JournalBillType?: string;
    bill_amount?: number;
    Debit_Amo?: number;
    Credit_Amo?: number;
    created_on?: string;
    Account_name?: string;
    [key: string]: any;
}

export interface PaymentDetailsStaff {
    id?: number | string;
    payment_id?: number | string;
    Involved_Emp_Id?: number | string;
    Cost_Center_Type_Id?: number | string;
    Cost_Center_Name?: string;
    Cost_Category?: string;
    Alias_Name?: string;
    [key: string]: any;
}

export interface PaymentDetailsResponseData {
    headerData: PaymentDetailsHeader[];
    referenceData: PaymentDetailsReference[];
    staffDetails: PaymentDetailsStaff[];
}

// 3. Reporting_Online_Journal_List (4 datasets)
export interface JournalDetailsHeader {
    JournalAutoId?: string;
    JournalId?: number | string;
    Year_Id?: number;
    VoucherType?: number;
    JournalNo?: number;
    JournalVoucherNo?: string;
    JournalDate?: string;
    BranchId?: number;
    Narration?: string;
    JournalStatus?: number;
    Ledger_Date?: string;
    Month_No?: number;
    Invoice_Month?: string;
    Invoice_Year?: number;
    Month_Year?: string;
    voucher_name?: string;
    Created_By?: string;
    [key: string]: any;
}

export interface JournalDetailsLineItem {
    LineId?: string;
    LineNum?: number;
    JournalAutoId?: string;
    JournalId?: number | string;
    JournalVoucherNo?: string;
    JournalDate?: string;
    Acc_Id?: number | string;
    AccountGet?: string;
    DrCr?: string; // 'Dr' | 'Cr'
    Amount?: number;
    Remarks?: string;
    isSundryParty?: number;
    [key: string]: any;
}

export interface JournalDetailsReferenceItem {
    autoGenId?: string;
    LineId?: string;
    LineNum?: number;
    JournalAutoId?: string;
    JournalId?: number | string;
    JournalVoucherNo?: string;
    JournalDate?: string;
    Acc_Id?: number | string;
    DrCr?: string;
    RefId?: number | string;
    RefNo?: string;
    RefType?: string;
    Amount?: number;
    BillRefNo?: string;
    Account_name?: string;
    [key: string]: any;
}

export interface JournalDetailsStaff {
    id?: number | string;
    JournalAutoId?: string;
    Involved_Emp_Id?: number | string;
    Cost_Center_Type_Id?: number | string;
    Cost_Center_Name?: string;
    Cost_Category?: string;
    Alias_Name?: string;
    [key: string]: any;
}

export interface JournalDetailsResponseData {
    headerData: JournalDetailsHeader[];
    lineData: JournalDetailsLineItem[];
    referenceData: JournalDetailsReferenceItem[];
    staffDetails: JournalDetailsStaff[];
}

export const PurchasePaymentOnlineService = {
    // 1. Get payments list by purchase Trans_Id (Pin_Id)
    getPurchasePaymentList: (transId: string | number) =>
        axios.get<{ success: boolean; data: PurchasePaymentListItem[]; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/ReportingOnlinePurchasePaymentList`,
            { params: { Trans_Id: transId } }
        ),

    // 2. Get payment details by payment Trans_Id (3 datasets)
    getPaymentDetails: (transId: string | number) =>
        axios.get<{ success: boolean; data: PaymentDetailsResponseData; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/ReportingOnlinePaymentList`,
            { params: { Trans_Id: transId } }
        ),

    // 3. Get journal details by journal Trans_Id (4 datasets)
    getJournalDetails: (transId: string | number) =>
        axios.get<{ success: boolean; data: JournalDetailsResponseData; message?: string }>(
            `${getBaseURL()}api/reports/externalAPI/ReportingOnlineJournalList`,
            { params: { Trans_Id: transId } }
        ),
};

