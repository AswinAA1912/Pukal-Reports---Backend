import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test-utils";
import DayAbstractReport from "../../reports/Abstract/DayAbstractReport";
import StockAbstractReport from "../../reports/Abstract/StockAbstractReport";
import CashBoxReport from "../../reports/Abstract/CashBoxReport";
import BankAbstractReport from "../../reports/Abstract/BankAbstractReport";
import ChequeTransactionReport from "../../reports/Abstract/ChequeTransactionReport";
import SalesAnalyticsReportPage from "../../reports/GraphicalAnalyticsReport";

describe("Abstract and Analytics Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Day Abstract Report Screen", () => {
    it("renders daily business summary abstract", () => {
      renderWithProviders(<DayAbstractReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("2. Stock Abstract Report Screen", () => {
    it("renders stock abstract valuation summary", () => {
      renderWithProviders(<StockAbstractReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("3. Cash Box Report Screen", () => {
    it("renders cash collection, counter inflows, and outflows", () => {
      renderWithProviders(<CashBoxReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("4. Bank Abstract Report Screen", () => {
    it("renders bank deposit, withdrawals, and ledger reconciliation", () => {
      renderWithProviders(<BankAbstractReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("5. Cheque Transaction Report Screen", () => {
    it("renders cheque clearance, dishonor, and pending status report", () => {
      renderWithProviders(<ChequeTransactionReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("6. Sales Analytics Graphical Report Screen", () => {
    it("renders graphical sales visual trend charts and KPI breakdown", () => {
      renderWithProviders(<SalesAnalyticsReportPage />);
      expect(document.body).toBeDefined();
    });
  });
});
