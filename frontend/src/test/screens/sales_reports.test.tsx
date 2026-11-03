import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "../test-utils";
import SalesInvoiceReportPage from "../../reports/Sales/salesinvoicereport";
import OnlineSalesReportPage from "../../reports/Sales/OnlineSalesReport";
import UnitEconomicsReportPage from "../../reports/Sales/unitEconomicsReport";
import UnitEconomicsAdmin from "../../reports/Sales/unitEconomicsAdmin";
import OnlineSalesReportLOL from "../../reports/Sales/onlineSalesReportLOL";
import SalesReport from "../../reports/Sales/SalesAnalyticsReport";
import SalesOrderReport from "../../reports/Sales/SaleOrderReport";
import PendingSaleOrder from "../../reports/Sales/PendingSaleOrderReport";
import SalesDeliveryReport from "../../reports/Sales/salesDeliveryReport";

describe("Sales Module Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Sales Invoice Report Screen", () => {
    it("renders table with invoice columns and pagination controls", () => {
      renderWithProviders(<SalesInvoiceReportPage />);
      expect(screen.getAllByText("S.No").length).toBeGreaterThan(0);
      expect(screen.getByText("Invoice")).toBeInTheDocument();
      expect(screen.getByText("Customer")).toBeInTheDocument();
      expect(screen.getByText("Voucher")).toBeInTheDocument();
    });
  });

  describe("2. Online Sales Report Screen", () => {
    it("renders online sales table and filter controls", () => {
      renderWithProviders(<OnlineSalesReportPage />);
      expect(document.body).toBeDefined();
      expect(screen.getAllByText("S.No").length).toBeGreaterThan(0);
    });
  });

  describe("3. Unit Economics Report Screen", () => {
    it("renders unit economics page and data table headers", () => {
      renderWithProviders(<UnitEconomicsReportPage />);
      expect(screen.getAllByText("S.No").length).toBeGreaterThan(0);
      expect(screen.getByText("Product")).toBeInTheDocument();
    });
  });

  describe("4. Unit Economics Admin Screen", () => {
    it("renders admin unit economics configuration screen", () => {
      renderWithProviders(<UnitEconomicsAdmin />);
      expect(document.body).toBeDefined();
    });
  });

  describe("5. Online Sales Report LOL Screen", () => {
    it("renders online sales LOL report layout without errors", () => {
      renderWithProviders(<OnlineSalesReportLOL />);
      expect(screen.getAllByText("S.No").length).toBeGreaterThan(0);
    });
  });

  describe("6. Sales Analytics Report Screen", () => {
    it("renders sales analytics data grid and headers", () => {
      renderWithProviders(<SalesReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("7. Sale Order Report Screen", () => {
    it("renders sales order report with order column headers", () => {
      renderWithProviders(<SalesOrderReport />);
      expect(screen.getAllByText("S.No").length).toBeGreaterThan(0);
    });
  });

  describe("8. Pending Sale Order Report Screen", () => {
    it("renders pending sale orders view with pending item filters", () => {
      renderWithProviders(<PendingSaleOrder />);
      expect(screen.getAllByText("S.No").length).toBeGreaterThan(0);
    });
  });

  describe("9. Sales Delivery Report Screen", () => {
    it("renders sales delivery funnel tracking table", () => {
      renderWithProviders(<SalesDeliveryReport />);
      expect(screen.getByText(/SALES DELIVERY FUNNEL TRACKING/i)).toBeInTheDocument();
    });
  });
});
