import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { RequireAuth } from "../auth/requireAuth";
import AppLayout from "../Layout/appLayout";
import Login from "../auth/login";
import GlobalLoader from "../Components/loadingScreen";
import Dashboard from "./dashboard";
import SalesInvoiceReportPage from "../reports/Sales/salesinvoicereport";
import OnlineSalesReportPage from "../reports/Sales/OnlineSalesReport";
import UnitEconomicsReportPage from "../reports/Sales/unitEconomicsReport";
import UnitEconomicsAdmin from "../reports/Sales/unitEconomicsAdmin";
import StockInHandReport from "../reports/Stock/stockinhandReport";
import ItemWiseTransaction from "../reports/Stock/ItemTransactionList";
import GodownItemWiseTransaction from "../reports/Stock/GodownItemTransactionList";
import OnlineSalesReportLOL from "../reports/Sales/onlineSalesReportLOL";
import SalesReport from "../reports/Sales/SalesAnalyticsReport";
import LedgerWiseItemDetails from "../reports/Stock/LedgerWiseItemDetails";
import SalesAnalyticsReportPage from "../reports/GraphicalAnalyticsReport";
import OnlinePurchaseReportPage from "../reports/Purchase/onlinePurchaseReport";
import SalesOrderReport from "../reports/Sales/SaleOrderReport";
import PurchaseOrder from "../reports/Purchase/PurchaseOrderReport";
import ReportSettings from "../settings/ReportSettings";
import ReportList from "../settings/ReportList";
import StockValueReport from "../reports/Stock/stockValueReport";
import StockValueRateMasterReport from "../reports/Stock/StockValueRateMaster";
import RateMasterAdminReport from "../reports/Stock/RateMasterAdmin";
import StaffBasedReport from "../reports/StaffBased/staffBasedReport";
import LOSStaffBasedReport from "../reports/StaffBased/LOSstaffBasedReport";
import ExpensesReport from "../reports/Expenses/ExpensesReport";
import CostingReport from "../reports/Expenses/CostingReport";
import OutstandingReport from "../reports/Expenses/outstandingReport";
import AccountingOutstandingReport from "../reports/Expenses/AccountingOutstandingReport";
import PendingOutstandingReport from "../reports/Expenses/PendingOutstandingReport";
import TransactionDetailsReport from "../reports/Expenses/TransactionDetailsReport";
import StaffBasedGroupingReport from "../reports/StaffBased/staffBasedGroupingReport";
import StaffBasedCountReport from "../reports/StaffBased/staffBasedCountReport";
import DayAbstractReport from "../reports/Abstract/DayAbstractReport";
import StockAbstractReport from "../reports/Abstract/StockAbstractReport";
import CashBoxReport from "../reports/Abstract/CashBoxReport";
import BankAbstractReport from "../reports/Abstract/BankAbstractReport";
import ChequeTransactionReport from "../reports/Abstract/ChequeTransactionReport";
import PendingSaleOrder from "../reports/Sales/PendingSaleOrderReport";
import InStockReport from "../reports/Stock/InStockReport";
import SalesDeliveryReport from "../reports/Sales/salesDeliveryReport";
import PurchaseReport from "../reports/Purchase/PurchaseReport";
import RetailerLocations from "./RetailerLocations";
import RecievablePayableReport from "../reports/Expenses/recievablePayableReport";
import OverallStaffReport from "../reports/StaffBased/overallStaffReport";
import SalesStockGodown from "../reports/Stock/SalesStockGodown";
import UserRights from "../settings/UserRights";
import OverallItemwise from "../reports/Stock/OverallItemwise";
import PurchaseDelivery from "../reports/Purchase/PurchaseDelivery";
import PurchasePaymentReport from "../reports/Purchase/PurchasePaymentReport";
import PurchaseItemPaymentReport from "../reports/Purchase/PurchaseItemPaymentReport";

interface AppRoutingProps {
  setActiveCategory: (category: string) => void;
  globalLoading: boolean;
  loadingOn: () => void;
  loadingOff: () => void;
  activeCategory: string;
}

/* ---------------- URL Sync Handler ---------------- */
const URLSyncHandler: React.FC<{ setActiveCategory: (cat: string) => void }> = ({
  setActiveCategory,
}) => {
  const location = useLocation();

  useEffect(() => {
    const routeToCategory: Record<string, string> = {
      "/dashboard": "Dashboard",
      // "/salesinvoice": "Sales Invoice Report",
      "/salesreport": "Online Sales Report",
      "/uniteconomics": "Unit Economics Report",
      "/recievablePayable": "Receivable & Payable Report",
      "/purchasedelivery": "Purchase Delivery Funnel Report",
      "/purchaseDelivery": "Purchase Delivery Funnel Report",
      "/purchasepayment": "Purchase Payment Report",
      "/purchasePayment": "Purchase Payment Report",
      "/purchaseitempayment": "Purchase Item & Invoice Payment Report",
      "/purchaseItemPayment": "Purchase Item & Invoice Payment Report",
      "/purchaseinvoicepayment": "Purchase Item & Invoice Payment Report",
      "/purchaseInvoicePayment": "Purchase Item & Invoice Payment Report",
      "/groupwiseItem": "Group Wise Item",
      "/": "Login",
    };

    const matched = Object.keys(routeToCategory).find((key) =>
      location.pathname.startsWith(key)
    );

    if (matched) setActiveCategory(routeToCategory[matched]);
  }, [location.pathname, setActiveCategory]);

  return null;
};

/* ---------------- App Routing ---------------- */
const AppRouting: React.FC<AppRoutingProps> = ({
  setActiveCategory,
  globalLoading,
}) => {
  const { token, isInitializing, user } = useAuth();

  if (isInitializing) return <GlobalLoader loading />;

  return (
    <>
      {globalLoading && <GlobalLoader loading />}
      <URLSyncHandler setActiveCategory={setActiveCategory} />

      <Routes>
        {/* PUBLIC */}
        <Route
          path="/login"
          element={token ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        {/* DASHBOARD */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <Dashboard />
              </AppLayout>
            </RequireAuth>
          }
        />

        {/* SALES INVOICE */}
        <Route
          path="/salesinvoice"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <SalesInvoiceReportPage />
              </AppLayout>
            </RequireAuth>
          }
        />

        {/* ONLINE SALES REPORT */}
        <Route
          path="/salesreport"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <OnlineSalesReportPage />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/uniteconomics"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <UnitEconomicsReportPage />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/stockinhand"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <StockInHandReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/stockinhand/item-transaction"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <ItemWiseTransaction />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/stockinhand/godown-item-transaction"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <GodownItemWiseTransaction />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/salesreportLOL"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <OnlineSalesReportLOL />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/salesreportlr"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <SalesReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/reports/ledger-item"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <LedgerWiseItemDetails />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/graphanalysis"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <SalesAnalyticsReportPage />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/purchasereport"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <OnlinePurchaseReportPage />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/saleorder"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <SalesOrderReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/pendingsaleorder"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <PendingSaleOrder />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/purchaseorder"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <PurchaseOrder />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/templateList"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <ReportList />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <ReportSettings />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/stockValue"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <StockValueReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/rateMaster"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <StockValueRateMasterReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/rateMasterAdmin"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <RateMasterAdminReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/staffBasedLOS"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <LOSStaffBasedReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/staffBased"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <StaffBasedReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/expense"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <ExpensesReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/costing"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <CostingReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/outStanding"
          element={
            <RequireAuth>
              <AppLayout>
                <OutstandingReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/accountingOutstanding"
          element={
            <RequireAuth>
              <AppLayout>
                <AccountingOutstandingReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/recievablePayable"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <RecievablePayableReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/transaction-details/:accId"
          element={
            <RequireAuth>
              <AppLayout>
                <TransactionDetailsReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/pending-outstanding/:accId"
          element={
            <RequireAuth>
              <AppLayout>
                <PendingOutstandingReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/staffBasedGrouping"
          element={
            <RequireAuth>
              <AppLayout
                fullWidth
              >
                <StaffBasedGroupingReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/staffBasedCount"
          element={
            <RequireAuth>
              <AppLayout>
                <StaffBasedCountReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/overallStaffReport"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <OverallStaffReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/salesStockGodown"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <SalesStockGodown />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/dayAbstract"
          element={
            <RequireAuth>
              <AppLayout>
                <DayAbstractReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/stockAbstract"
          element={
            <RequireAuth>
              <AppLayout>
                <StockAbstractReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/cashbox"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <CashBoxReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/bankAbstract"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <BankAbstractReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/salesDelivery"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <SalesDeliveryReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/purchaseDetailed"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchaseReport />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/purchasedetailed"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchaseReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/purchaseDelivery"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchaseDelivery />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/purchasedelivery"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchaseDelivery />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/purchasePayment"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchasePaymentReport />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/purchasepayment"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchasePaymentReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/purchaseItemPayment"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchaseItemPaymentReport />
              </AppLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/purchaseitempayment"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <PurchaseItemPaymentReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/chequeTransaction"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <ChequeTransactionReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/instock"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <InStockReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/uniteconomicsAdmin"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <UnitEconomicsAdmin />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/retailer-locations"
          element={
            <RequireAuth>
              <RetailerLocations />
            </RequireAuth>
          }
        />

        <Route
          path="/overallItemwise"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <OverallItemwise />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/accountOutstanding"
          element={
            <RequireAuth>
              <AppLayout fullWidth>
                <AccountingOutstandingReport />
              </AppLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/userRights"
          element={
            <RequireAuth>
              {(() => {
                const isDevOrAdmin = user && (String(user.UserTypeId) === "0" || String(user.UserTypeId) === "1");
                return isDevOrAdmin ? (
                  <AppLayout fullWidth>
                    <UserRights />
                  </AppLayout>
                ) : (
                  <Navigate to="/dashboard" replace />
                );
              })()}
            </RequireAuth>
          }
        />

        {/* FALLBACK */}
        <Route
          path="*"
          element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </>
  );
};

export default AppRouting;
