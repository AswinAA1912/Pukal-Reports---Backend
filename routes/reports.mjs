import express from 'express';
import stockAndPurchase from '../controller/Reports/stockAndPurchase.mjs';
import storageStockReport from '../controller/Reports/storageStockReport.mjs';
import expences from '../controller/Masters/expences.mjs';
import {
    onlineSalesReport, onlineSalesReportItem, unitEconomicsReport, onlineSalesReportLOL, onlineSalesReportItemLOL, SalesGraphCard, onlinePurchaseReport,
    onlinePurchaseReportItem, PurchaseGraphCard, SaleOrderReport, SaleOrderReportItem, PurchaseOrderReport, PurchaseOrderItemReport,
    StockValueGraph, StockValueReport, StaffBasedReport, costcenterList, StaffBasedReportLOS,
    OnlinePaymentReport, costingReport, DebtorsCreditors, StaffBasedCount, DayAbstractReport, DayStockAbstractReport,
    CashBoxReport, PendingSaleOrderReport, PendingSaleOrderReportItem
} from '../controller/Reports/externalAPI.mjs';
import {
    MenuSettings, executeSP, saveReportSettings, getReportList, getReportEditData, updateReportSettings, getReportsByParent, executeReportByTemplate, deleteReport
} from '../controller/Reports/reportsettings.mjs';

const ReportRouter = express.Router();

// stock & sales reports
ReportRouter.get('/salesReport/ledger', stockAndPurchase.salesReport);
ReportRouter.get('/salesReport/products', stockAndPurchase.porductBasedSalesResult);
ReportRouter.get('/salesReport/ledger/itemDetails', stockAndPurchase.salesItemDetails);

// storage stock mobile reports
ReportRouter.get('/storageStock/itemWiseMobile', storageStockReport.getStorageStockItemWiseMobile);
ReportRouter.get('/storageStock/godownWiseMobile', storageStockReport.getStorageStockGodownWiseMobile);

// expenses reports
ReportRouter.get('/itemexpenseReport', expences.itemsTransactionExpandable);
ReportRouter.get('/godownexpenseReport', expences.godownTransactionExpandable);

// external APIs
ReportRouter.get('/externalAPI/onlineSalesReport', onlineSalesReport);
ReportRouter.get('/externalAPI/onlineSalesReportItem', onlineSalesReportItem);
ReportRouter.get('/externalAPI/unitEconomicsReport', unitEconomicsReport);
ReportRouter.get('/externalAPI/onlineSalesReportLOL', onlineSalesReportLOL);
ReportRouter.get('/externalAPI/onlineSalesReportItemLOL', onlineSalesReportItemLOL);
ReportRouter.get('/externalAPI/SalesGraph', SalesGraphCard);
ReportRouter.get('/externalAPI/onlinePurchaseReport', onlinePurchaseReport);
ReportRouter.get('/externalAPI/onlinePurchaseReportItem', onlinePurchaseReportItem);
ReportRouter.get('/externalAPI/PurchaseGraph', PurchaseGraphCard);
ReportRouter.get('/externalAPI/SaleOrderReport', SaleOrderReport);
ReportRouter.get('/externalAPI/SaleOrderReportItem', SaleOrderReportItem);
ReportRouter.get('/externalAPI/PurchaseOrderReport', PurchaseOrderReport);
ReportRouter.get('/externalAPI/PurchaseOrderReportItem', PurchaseOrderItemReport);
ReportRouter.get('/externalAPI/StockValueGraph', StockValueGraph);
ReportRouter.get('/externalAPI/expenses', OnlinePaymentReport);
ReportRouter.get('/externalAPI/costing', costingReport);
ReportRouter.get('/externalAPI/stockValue', StockValueReport);
ReportRouter.get('/externalAPI/staffbased', StaffBasedReport);
ReportRouter.get('/externalAPI/debtorsCreditors', DebtorsCreditors);
ReportRouter.get('/externalAPI/staffBasedCount', StaffBasedCount);
ReportRouter.get('/externalAPI/costCenter', costcenterList);
ReportRouter.get('/externalAPI/staffbased', StaffBasedReportLOS);
ReportRouter.get('/externalAPI/dayAbstract', DayAbstractReport);
ReportRouter.get('/externalAPI/dayStockAbstract', DayStockAbstractReport);
ReportRouter.get('/externalAPI/cashbox', CashBoxReport);
ReportRouter.get('/externalAPI/pendingSaleOrder', PendingSaleOrderReport);
ReportRouter.get('/externalAPI/pendingSaleOrderItem', PendingSaleOrderReportItem);

// settings reports
ReportRouter.get('/settings/MenuSettings', MenuSettings);
ReportRouter.post('/settings/executeSP', executeSP);
ReportRouter.post('/settings/saveReport', saveReportSettings);
ReportRouter.get('/settings/reportList', getReportList);
ReportRouter.get('/settings/editreport', getReportEditData);
ReportRouter.put('/settings/updatereport', updateReportSettings);
ReportRouter.get('/settings/byParent', getReportsByParent);
ReportRouter.get('/settings/getreport', executeReportByTemplate);
ReportRouter.delete('/settings/deleteReport/:reportId', deleteReport);

// storage stock value reports
ReportRouter.get('/storageStock/stockvalueitem', storageStockReport.getStorageStockValueItemWise);
ReportRouter.get('/storageStock/stockvaluegodown', storageStockReport.getStorageStockValueGodownWise);

export default ReportRouter;