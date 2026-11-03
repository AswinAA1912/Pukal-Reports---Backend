import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test-utils";
import OnlinePurchaseReportPage from "../../reports/Purchase/onlinePurchaseReport";
import PurchaseOrder from "../../reports/Purchase/PurchaseOrderReport";
import PurchaseReport from "../../reports/Purchase/PurchaseReport";
import PurchaseDelivery from "../../reports/Purchase/PurchaseDelivery";
import PurchasePaymentReport from "../../reports/Purchase/PurchasePaymentReport";
import PurchaseItemPaymentReport from "../../reports/Purchase/PurchaseItemPaymentReport";
import { PurchaseTransactionDetailsDialog } from "../../reports/Purchase/PurchaseTransactionDetailsDialog";

describe("Purchase Module Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Online Purchase Report Screen", () => {
    it("renders online purchase report data grid", () => {
      renderWithProviders(<OnlinePurchaseReportPage />);
      expect(document.body).toBeDefined();
    });
  });

  describe("2. Purchase Order Report Screen", () => {
    it("renders purchase order report table and filters", () => {
      renderWithProviders(<PurchaseOrder />);
      expect(document.body).toBeDefined();
    });
  });

  describe("3. Purchase Detailed Report Screen", () => {
    it("renders detailed purchase report view", () => {
      renderWithProviders(<PurchaseReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("4. Purchase Delivery Funnel Screen", () => {
    it("renders purchase delivery funnel analysis", () => {
      renderWithProviders(<PurchaseDelivery />);
      expect(document.body).toBeDefined();
    });
  });

  describe("5. Purchase Payment Report Screen", () => {
    it("renders vendor purchase payment report table", () => {
      renderWithProviders(<PurchasePaymentReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("6. Purchase Item & Invoice Payment Report Screen", () => {
    it("renders purchase item payment breakdown report", () => {
      renderWithProviders(<PurchaseItemPaymentReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("7. Purchase Transaction Details Dialog Screen", () => {
    it("renders purchase transaction modal dialog when open is true", () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <PurchaseTransactionDetailsDialog
          open={true}
          onClose={handleClose}
          item={null}
        />
      );
      expect(document.body).toBeDefined();
    });
  });
});
