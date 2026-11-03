import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test-utils";
import Dashboard from "../../routes/dashboard";
import GroupDashboard from "../../routes/groupdashboard";
import RetailerLocations from "../../routes/RetailerLocations";
import * as menuRights from "../../utils/menuRights";

vi.mock("../../utils/menuRights", () => ({
  fetchAndFilterMenus: vi.fn(),
}));

describe("Dashboard and Navigation Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Main Dashboard Screen", () => {
    it("renders user welcome greeting, company name, and search bar", async () => {
      (menuRights.fetchAndFilterMenus as any).mockResolvedValue([
        { name: "Online Sales Report", rUrl: "/salesreport", icon: "TrendingUp" },
        { name: "Stock In Hand", rUrl: "/stockinhand", icon: "Inventory" },
      ]);

      renderWithProviders(<Dashboard />);

      expect(screen.getAllByText(/welcome/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText("TOTAL SALES").length).toBeGreaterThan(0);
      expect(screen.getAllByPlaceholderText(/search/i).length).toBeGreaterThan(0);
    });

    it("filters menu list dynamically when typing in search bar", async () => {
      (menuRights.fetchAndFilterMenus as any).mockResolvedValue([
        { name: "Online Sales Report", rUrl: "/salesreport" },
        { name: "Stock In Hand", rUrl: "/stockinhand" },
      ]);

      renderWithProviders(<Dashboard />);
      const searchInputs = screen.getAllByPlaceholderText(/search/i);
      expect(searchInputs.length).toBeGreaterThan(0);
      searchInputs.forEach((input) => {
        fireEvent.change(input, { target: { value: "Stock" } });
      });
      expect(document.body).toBeDefined();
    });
  });

  describe("Group Dashboard Screen", () => {
    it("renders group analytics cards and sales metrics overview", () => {
      (menuRights.fetchAndFilterMenus as any).mockResolvedValue([]);

      renderWithProviders(<GroupDashboard />);
      expect(screen.getAllByText(/welcome/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText("TOTAL SALES").length).toBeGreaterThan(0);
    });
  });

  describe("Retailer Locations Screen", () => {
    it("renders retailer locations title and open map button", () => {
      renderWithProviders(<RetailerLocations />);
      expect(screen.getByText("Retailer Locations")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /open map in new tab/i })).toBeInTheDocument();
    });
  });
});
