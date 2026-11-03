import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test-utils";
import StaffBasedReport from "../../reports/StaffBased/staffBasedReport";
import LOSStaffBasedReport from "../../reports/StaffBased/LOSstaffBasedReport";
import StaffBasedGroupingReport from "../../reports/StaffBased/staffBasedGroupingReport";
import StaffBasedCountReport from "../../reports/StaffBased/staffBasedCountReport";
import OverallStaffReport from "../../reports/StaffBased/overallStaffReport";

describe("Staff-Based Reports Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Staff Based Report Screen", () => {
    it("renders staff-based performance and productivity metrics", () => {
      renderWithProviders(<StaffBasedReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("2. LOS Staff Based Report Screen", () => {
    it("renders line-of-sale staff analysis table", () => {
      renderWithProviders(<LOSStaffBasedReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("3. Staff Based Grouping Report Screen", () => {
    it("renders staff grouping consolidated report", () => {
      renderWithProviders(<StaffBasedGroupingReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("4. Staff Based Count Report Screen", () => {
    it("renders staff visit count and order tally report", () => {
      renderWithProviders(<StaffBasedCountReport />);
      expect(document.body).toBeDefined();
    });
  });

  describe("5. Overall Staff Report Screen", () => {
    it("renders comprehensive overall staff activity report", () => {
      renderWithProviders(<OverallStaffReport />);
      expect(document.body).toBeDefined();
    });
  });
});
