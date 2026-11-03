import React, { createContext, useState, useContext } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";

/* ---------------- CONTEXT ---------------- */
interface ToggleContextType {
  toggleMode: "Abstract" | "Expanded";
  setToggleMode: (mode: "Abstract" | "Expanded") => void;
}

const ToggleContext = createContext<ToggleContextType>({
  toggleMode: "Abstract",
  setToggleMode: () => { },
});

export const useToggleMode = () => useContext(ToggleContext);

const AppLayoutDepthContext = createContext<number>(0);

export interface AppLayoutProps {
  children?: React.ReactNode;
  fullWidth?: boolean;
}

/* ---------------- APP LAYOUT ---------------- */
const AppLayout: React.FC<AppLayoutProps> = ({
  children,
}) => {
  const [toggleMode, setToggleMode] = useState<"Abstract" | "Expanded">(
    "Abstract"
  );
  const depth = useContext(AppLayoutDepthContext);

  // If AppLayout is nested inside another AppLayout, avoid duplicate 100vh containers or screen scrolling
  if (depth > 0) {
    return (
      <AppLayoutDepthContext.Provider value={depth + 1}>
        <ToggleContext.Provider value={{ toggleMode, setToggleMode }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "auto", // Allows scrolling when content exceeds viewport
            }}
          >
            {children ?? <Outlet />}
          </Box>
        </ToggleContext.Provider>
      </AppLayoutDepthContext.Provider>
    );
  }

  return (
    <AppLayoutDepthContext.Provider value={1}>
      <ToggleContext.Provider value={{ toggleMode, setToggleMode }}>
        {/* ROOT (NO WHOLE SCREEN SCROLL) */}
        <Box
          sx={{
            height: "100vh",
            maxHeight: "100vh",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden", // 🚫 Prevent whole screen scroll
            background: "#F1F5F9",
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "auto", // Allows scrolling when content exceeds viewport
            }}
          >
            {children ?? <Outlet />}
          </Box>
        </Box>
      </ToggleContext.Provider>
    </AppLayoutDepthContext.Provider>
  );
};

export default AppLayout;
