import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test-utils";
import Login from "../../auth/login";
import PageNotFound from "../../Components/404page";

describe("Auth and System Screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Login Screen", () => {
    it("renders login screen with welcome title, username input, and Next button", () => {
      localStorage.removeItem("AUTH_ID");
      localStorage.removeItem("user");

      renderWithProviders(<Login />);
      expect(screen.getByText("Pukal Reports")).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("allows user to type into the username input field", () => {
      localStorage.removeItem("AUTH_ID");
      localStorage.removeItem("user");

      renderWithProviders(<Login />);
      const usernameInput = screen.getByLabelText(/username/i);
      fireEvent.change(usernameInput, { target: { value: "testuser" } });
      expect((usernameInput as HTMLInputElement).value).toBe("testuser");
    });
  });

  describe("404 Page Not Found Screen", () => {
    it("renders 404 error page elements and Go to Home button", () => {
      renderWithProviders(<PageNotFound pageLoading={false} />);
      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText(/page not found/i)).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /go to home/i }).length).toBeGreaterThan(0);
    });

    it("triggers goHome navigation when button is clicked", () => {
      const setActiveCategory = vi.fn();
      renderWithProviders(
        <PageNotFound pageLoading={false} setActiveCategory={setActiveCategory} />
      );

      const homeBtns = screen.getAllByRole("button", { name: /go to home/i });
      fireEvent.click(homeBtns[0]);
      expect(setActiveCategory).toHaveBeenCalledWith("all");
    });
  });
});
