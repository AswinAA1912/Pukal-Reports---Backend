import "./index.css";
import App from "./App";
import { store } from "./redux";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";

// Global axios request interceptor to attach "Db" and "Authorization" headers
axios.interceptors.request.use(
  (config) => {
    if (!config.headers["Db"]) {
      const companyId = localStorage.getItem("COMPANY_ID");
      if (companyId) {
        config.headers["Db"] = companyId;
      } else {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            if (user && user.companyId) {
              config.headers["Db"] = String(user.companyId);
            }
          } catch (e) {
            console.error("Error parsing user from localStorage in axios interceptor", e);
          }
        }
      }
    }

    // Auto-append company_id to query parameters so copied/pasted URLs preserve company context
    const currentCompanyId = localStorage.getItem("COMPANY_ID") || (() => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          return user && user.companyId ? String(user.companyId) : null;
        } catch (e) {}
      }
      return null;
    })();

    if (currentCompanyId) {
      if (!config.params) {
        config.params = {};
      }
      if (
        config.params.company_id === undefined &&
        config.params.companyId === undefined &&
        config.params.Company_Id === undefined
      ) {
        config.params.company_id = currentCompanyId;
      }
    }

    if (!config.headers["Authorization"]) {
      const storedAuth = localStorage.getItem("AUTH_ID");
      if (storedAuth) {
        config.headers["Authorization"] = storedAuth;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Provider>
  </BrowserRouter>
);