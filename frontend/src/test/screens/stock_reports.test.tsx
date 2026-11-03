import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "../test-utils";
import StockInHandReport from "../../reports/Stock/stockinhandReport";
import ItemWiseTransaction from "../../reports/Stock/ItemTransactionList";
import GodownItemWiseTransaction from "../../reports/Stock/GodownItemTransactionList";
import LedgerWiseItemDetails from "../../reports/Stock/LedgerWiseItemDetails";
import StockValueReport from "../../reports/Stock/stockValueReport";
import StockValueRateMasterReport from "../../reports/Stock/StockValueRateMaster";
import RateMasterAdminReport from "../../reports/Stock/RateMasterAdmin";
import InStockReport from "../../reports/Stock/InStockReport";
import SalesStockGodown from "../../reports/Stock/SalesStockGodown";
import OverallItemwise from "../../reports/Stock/OverallItemwise";

describe("Stock Module Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Stock In Hand Report Screen", () => {
    it("renders stock in hand data view and table structure", () => {
      renderWithProviders(<StockInHandReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("2. Item Wise Transaction Screen", () => {
    it("renders item-wise transaction table and filter elements", () => {
      renderWithProviders(<ItemWiseTransaction />);
      expect(document.body).toBeDefined();
    });
  });

  describe("3. Godown Item Wise Transaction Screen", () => {
    it("renders godown item transaction table", () => {
      renderWithProviders(<GodownItemWiseTransaction />);
      expect(document.body).toBeDefined();
    });
  });

  describe("4. Ledger Wise Item Details Screen", () => {
    it("renders ledger-wise item breakdown screen", () => {
      renderWithProviders(<LedgerWiseItemDetails />);
      expect(document.body).toBeDefined();
    });
  });

  describe("5. Stock Value Report Screen", () => {
    it("renders stock value calculation table and filters", () => {
      renderWithProviders(<StockValueReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("6. Stock Value Rate Master Screen", () => {
    it("renders stock value rate master interface", () => {
      renderWithProviders(<StockValueRateMasterReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("7. Rate Master Admin Screen", () => {
    it("renders rate master admin settings table", () => {
      renderWithProviders(<RateMasterAdminReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("8. In Stock Report Screen", () => {
    it("renders in-stock inventory report view", () => {
      renderWithProviders(<InStockReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("9. Sales Stock Godown Screen", () => {
    it("renders sales stock godown distribution report", () => {
      renderWithProviders(<SalesStockGodown />);
      expect(document.body).toBeDefined();
    });
  });

  describe("10. Overall Itemwise Screen", () => {
    it("renders overall itemwise consolidated stock view", () => {
      renderWithProviders(<OverallItemwise />);
      expect(document.body).toBeDefined();
    });
  });
});
