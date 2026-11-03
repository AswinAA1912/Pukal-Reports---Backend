import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Provider } from "react-redux";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "../redux/store";
import { AuthProvider } from "../auth/authContext";
import { ContextDataProvider } from "../Components/context/contextProvider";

const theme = createTheme({
  palette: {
    primary: { main: "#2f6b94" },
    secondary: { main: "#6b7280" },
    background: { default: "#f5f5f5", paper: "#fff" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "'Inter', 'Poppins', 'Sansation', sans-serif",
  },
});

interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {
  initialEntries?: MemoryRouterProps["initialEntries"];
  queryClient?: QueryClient;
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    initialEntries = ["/"],
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  document.body.innerHTML = "";

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <AuthProvider>
                <ContextDataProvider>
                  {children}
                </ContextDataProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </Provider>
      </MemoryRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

export * from "@testing-library/react";
