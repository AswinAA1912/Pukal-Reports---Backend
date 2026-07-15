import sql from 'mssql';
import { servError, sentData } from '../../res.mjs';
import { isEqualNumber, ISOString, isValidNumber, stringCompare } from '../../helper_functions.mjs';

const ReceiptReport = () => {

    const getChequeTransaction = async (req, res) => {
        try {
            const Fromdate = req.query?.Fromdate ? ISOString(req.query?.Fromdate) : ISOString();
            const Todate = req.query?.Todate ? ISOString(req.query?.Todate) : ISOString();
            const debitAccount = req.query?.debitAccount || null

            const request = new sql.Request()
                .input('Fromdate', Fromdate)
                .input('Todate', Todate)
                .input('debitAccount', debitAccount)
                .query(`
                -- ********************************* account filter  *********************************
                    DECLARE @accountFilter TABLE (accId INT);
                    WITH GroupHierarchy AS (
                        SELECT Group_Id, Parent_AC_id
                        FROM tbl_Accounting_Group
                        WHERE Group_Id = 11 OR Group_Id = 22
                        UNION ALL
                        SELECT g.Group_Id, g.Parent_AC_id
                        FROM tbl_Accounting_Group g
                        JOIN GroupHierarchy gh ON g.Parent_AC_id = gh.Group_Id
                    )
                    INSERT INTO @accountFilter (accId)
                    SELECT Acc_Id
                    FROM tbl_Account_Master
                    WHERE 
                        Group_Id IN (SELECT Group_Id FROM GroupHierarchy)
                        ${isValidNumber(debitAccount) ? ` AND Acc_Id = @debitAccount ` : ''};
                -- *********************************  RECEIPT FILTERS *********************************
                    DECLARE @receiptFilter TABLE (receipt_id BIGINT PRIMARY KEY, receipt_number NVARCHAR(20));
                    INSERT INTO @receiptFilter (receipt_id, receipt_number)
                    SELECT DISTINCT rgi.receipt_id, rgi.receipt_invoice_no
                    FROM tbl_Receipt_General_Info AS rgi
                    JOIN @accountFilter AS debAcc ON debAcc.accId = rgi.debit_ledger
                    WHERE 
                    	rgi.receipt_date BETWEEN @Fromdate AND @Todate 
                    	AND rgi.status <> 0;
                -- ********************************* getting receipts *********************************
                    SELECT
                    	rgi.receipt_id,
                    	rgi.receipt_invoice_no,
                    	rgi.receipt_date,
                    	rgi.receipt_voucher_type_id,
                    	rgi.debit_ledger,
                    	rgi.credit_ledger,
                    	rgi.check_no,
                    	rgi.check_date,
                    	rgi.bank_date,
                    	rgi.debit_amount,
                    	rgi.credit_amount,
                    	vm.Voucher_Type AS voucherTypeGet,
                    	debAcc.Account_name AS debitAccountGet,
                    	creAcc.Account_name AS creditAccountGet
                    FROM tbl_Receipt_General_Info AS rgi
                    LEFT JOIN tbl_Voucher_Type AS vm ON vm.Vocher_Type_Id = rgi.receipt_voucher_type_id
                    LEFT JOIN tbl_Account_Master AS debAcc ON debAcc.Acc_Id = rgi.debit_ledger
                    LEFT JOIN tbl_Account_Master AS creAcc ON creAcc.Acc_Id = rgi.credit_ledger
                    JOIN @receiptFilter AS rfltr ON rfltr.receipt_id = rgi.receipt_id
                    ORDER BY rgi.receipt_date;
                -- ********************************* receipt references *********************************
                    SELECT 
                    	rbi.receipt_id,
                    	sdgi.Do_Date AS billDate,
                    	sdgi.Do_Inv_No AS invoiceVoucherNumber,
                    	sdgi.Total_Invoice_value AS invoiceValue,
                    	rbi.Credit_Amo AS paidAmount
                    FROM tbl_Receipt_Bill_Info AS rbi
                    JOIN tbl_Receipt_General_Info AS rgi ON rgi.receipt_id = rbi.receipt_id
                    JOIN tbl_Sales_Delivery_Gen_Info AS sdgi ON sdgi.Do_Id = rbi.bill_id AND sdgi.Do_Inv_No = rbi.bill_name
                    JOIN @receiptFilter AS rfil ON rfil.receipt_id = rbi.receipt_id AND rfil.receipt_number = rbi.receipt_no
                -- ********************************* contra references *********************************
                    SELECT
                    	cgi.ContraId,
                    	cgi.ContraVoucherNo AS contraVoucherNumber,
                    	cgi.ContraDate AS contraDate,
                    	cbi.bill_id AS refrenceId,
                    	cbi.bill_no AS refrenceVoucherNumber,
                    	cgi.Amount AS contraAmount,
                    	cgi.CreditAccount AS creditAmount,
                    	debtAcc.Account_name AS debitAccountGet,
                    	creAcc.Account_name AS creditAccountGet,
                    	cgi.Chequeno AS chequeNumber,
                    	cgi.ChequeDate AS chequeDate,
                    	cgi.BankDate AS bankDate,
                    	cgi.Narration AS narration
                    FROM tbl_Contra_Bill_Info AS cbi
                    JOIN tbl_Contra_General_Info AS cgi ON cgi.ContraId = cbi.contra_id
                    JOIN @receiptFilter AS rf ON rf.receipt_id = cbi.bill_id AND rf.receipt_number = cbi.bill_no
                    JOIN tbl_Account_Master AS debtAcc ON debtAcc.Acc_Id = cgi.DebitAccount
                    JOIN tbl_Account_Master AS creAcc ON creAcc.Acc_Id = cgi.CreditAccount
                    WHERE cgi.ContraStatus <> 0;`
                );

            const result = await request;

            const [receipt, billInfo, contra] = result.recordsets;

            const output = receipt.map((row) => {
                const billRef = billInfo.filter(bill => isEqualNumber(bill.receipt_id, row.receipt_id));
                const contraRef = contra.filter(c => (
                    isEqualNumber(c.refrenceId, row.receipt_id)
                    && stringCompare(c.refrenceVoucherNumber, row.receipt_invoice_no)
                ));

                return {
                    ...row,
                    billRef,
                    contraRef
                }
            });

            sentData(res, output);

        } catch (e) {
            servError(e, res);
        }
    }

    const getChequeAccounts = async (req, res) => {
        try {
            const request = new sql.Request()
                .query(`
                    WITH GroupHierarchy AS (
                        SELECT Group_Id, Parent_AC_id
                        FROM tbl_Accounting_Group
                        WHERE Group_Id = 11 OR Group_Id = 22
                        UNION ALL
                        SELECT g.Group_Id, g.Parent_AC_id
                        FROM tbl_Accounting_Group g
                        JOIN GroupHierarchy gh ON g.Parent_AC_id = gh.Group_Id
                    )
                    SELECT Acc_Id AS value, Account_name AS label
                    FROM tbl_Account_Master
                    WHERE Group_Id IN (SELECT Group_Id FROM GroupHierarchy)
                    ORDER BY Account_name;
                `);

            const result = await request;
            sentData(res, result.recordset || []);
        } catch (e) {
            servError(e, res);
        }
    }

    const getChequeCreditAccounts = async (req, res) => {
        try {
            const request = new sql.Request()
                .query(`
                    SELECT DISTINCT am.Acc_Id AS value, am.Account_name AS label
                    FROM tbl_Receipt_General_Info AS rgi
                    JOIN tbl_Account_Master AS am ON am.Acc_Id = rgi.credit_ledger
                    ORDER BY am.Account_name;
                `);

            const result = await request;
            sentData(res, result.recordset || []);
        } catch (e) {
            servError(e, res);
        }
    }

    const getChequeVoucherTypes = async (req, res) => {
        try {
            const request = new sql.Request()
                .query(`
                    SELECT DISTINCT vt.Vocher_Type_Id AS value, vt.Voucher_Type AS label
                    FROM tbl_Receipt_General_Info AS rgi
                    JOIN tbl_Voucher_Type AS vt ON vt.Vocher_Type_Id = rgi.receipt_voucher_type_id
                    ORDER BY vt.Voucher_Type;
                `);

            const result = await request;
            sentData(res, result.recordset || []);
        } catch (e) {
            servError(e, res);
        }
    }

    return {
        getChequeTransaction,
        getChequeAccounts,
        getChequeCreditAccounts,
        getChequeVoucherTypes
    }
}

export default ReceiptReport();