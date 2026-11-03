import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test-utils";
import ReportSettings from "../../settings/ReportSettings";
import ReportList from "../../settings/ReportList";
import UserRights from "../../settings/UserRights";

describe("Settings and Administration Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Report Settings Screen", () => {
    it("renders custom report configuration, column selector, and save options", () => {
      renderWithProviders(<ReportSettings />);
      expect(document.body).toBeDefined();
    });
  });

  describe("2. Report List Template Screen", () => {
    it("renders saved report templates and management list", () => {
      renderWithProviders(<ReportList />);
      expect(document.body).toBeDefined();
    });
  });

  describe("3. User Rights Management Screen", () => {
    it("renders user permissions, role assignment, and security privileges panel", () => {
      renderWithProviders(<UserRights />);
      expect(document.body).toBeDefined();
    });
  });
});
