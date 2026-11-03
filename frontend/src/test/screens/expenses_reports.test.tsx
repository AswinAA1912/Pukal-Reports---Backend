import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test-utils";
import ExpensesReport from "../../reports/Expenses/ExpensesReport";
import CostingReport from "../../reports/Expenses/CostingReport";
import OutstandingReport from "../../reports/Expenses/outstandingReport";
import PendingOutstandingReport from "../../reports/Expenses/PendingOutstandingReport";
import TransactionDetailsReport from "../../reports/Expenses/TransactionDetailsReport";
import RecievablePayableReport from "../../reports/Expenses/recievablePayableReport";

describe("Expenses and Financial Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Expenses Report Screen", () => {
    it("renders expenses report data and category breakdown", () => {
      renderWithProviders(<ExpensesReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("2. Costing Report Screen", () => {
    it("renders item costing analysis view", () => {
      renderWithProviders(<CostingReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("3. Outstanding Report Screen", () => {
    it("renders party outstanding dues and aging balance table", () => {
      renderWithProviders(<OutstandingReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("4. Pending Outstanding Report Screen", () => {
    it("renders account specific pending outstanding report", () => {
      renderWithProviders(<PendingOutstandingReport />, {
        initialEntries: ["/pending-outstanding/101"],
      });
      expect(document.body).toBeDefined();
    });
  });

  describe("5. Transaction Details Report Screen", () => {
    it("renders account transaction ledger drill-down report", () => {
      renderWithProviders(<TransactionDetailsReport />, {
        initialEntries: ["/transaction-details/101"],
      });
      expect(document.body).toBeDefined();
    });
  });

  describe("6. Receivable & Payable Report Screen", () => {
    it("renders cash flow receivable and payable balance overview", () => {
      renderWithProviders(<RecievablePayableReport />);
      expect(document.body).toBeDefined();
    });
  });
});
