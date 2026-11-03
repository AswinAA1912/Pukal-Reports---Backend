import React, { useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { ContextDataProvider } from "./Components/context/contextProvider";
import { AuthProvider } from "./auth/authContext";
import AppRouting from "./routes/appRouting";
import LoadingScreen from "./Components/loadingScreen";

/* MUI Theme */
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
  components: {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflow: "auto",
        },
      },
    },
  },
});

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Dashboard");

  const loadingOn = () => setLoading(true);
  const loadingOff = () => setLoading(false);

  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <ContextDataProvider>
          <ToastContainer position="top-right" autoClose={3000} />

          <LoadingScreen
            loading={loading}
            message="Loading, please wait..."
            tone="light"
            logo={<strong>ERP</strong>}
          />

          {/* 🚫 NO BrowserRouter here */}
          <AppRouting
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            globalLoading={loading}
            loadingOn={loadingOn}
            loadingOff={loadingOff}
          />
        </ContextDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
