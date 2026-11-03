import React from "react";
import {
  Box,
  CircularProgress,
  Typography,
  Paper,
} from "@mui/material";
import { styled } from "@mui/material/styles";

interface MaincardProps {
  children: React.ReactNode;
  loading: boolean;
}

/* ---------------- MAIN COMPONENT ---------------- */
const Maincard: React.FC<MaincardProps> = ({ children, loading }) => {
  return (
    <CardContainer elevation={2}>
      {loading ? (
        <LoadingOverlay>
          <CircularProgress size={48} />
          <Typography variant="body1" sx={{ mt: 2, color: "text.secondary" }}>
            Loading...
          </Typography>
        </LoadingOverlay>
      ) : (
        <CardContentStyled>
          {children}
        </CardContentStyled>
      )}
    </CardContainer>
  );
};

export default Maincard;

/* ---------------- STYLES ---------------- */

/**
 * IMPORTANT:
 * - MainCard must NEVER scroll
 * - It only provides height
 */
const CardContainer = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  borderRadius: theme.shape.borderRadius * 2,
  overflow: "hidden",
  backgroundColor: "#e5d8c5",
}));

const LoadingOverlay = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
}));

const CardContentStyled = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflow: "hidden",   // ✅ FIXED
  padding: theme.spacing(3),
  backgroundColor: "#c5dce5",
}));
