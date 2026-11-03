import React from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  IconButton,
  styled,
} from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";

interface TodayPlanCardProps {
  title: string;
  children: React.ReactNode;
  height?: string | number; // Custom height prop
  open: boolean;
  onToggle: () => void;
}

const TodayPlanCard: React.FC<TodayPlanCardProps> = ({
  title,
  children,
  height = "560px", // Default height when open
  open,
  onToggle,
}) => {
  return (
    <CardWrapper open={open}>
      <CardContainer open={open} height={height} elevation={2}>
        {/* HEADER */}
        <CardHeader>
          {open && (
            <Typography fontWeight={600} color="white">
              {title}
            </Typography>
          )}

          <IconButton
            size="small"
            onClick={onToggle}
            sx={{ 
              color: "white",
              marginLeft: open ? 0 : "auto"
            }}
          >
            {open ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        </CardHeader>

        {/* CONTENT */}
        {open && (
          <CardContentStyled>
            {children}
          </CardContentStyled>
        )}
      </CardContainer>
    </CardWrapper>
  );
};

export default TodayPlanCard;

/* ===================== STYLED COMPONENTS ===================== */

interface WrapperProps {
  open: boolean;
}

const CardWrapper = styled(Box, {
  shouldForwardProp: (prop) => prop !== "open",
})<WrapperProps>(({ open }) => ({
  position: "relative",
  width: open ? 320 : 0,
  transition: "width 0.35s ease",
  overflow: "hidden",
}));

interface CardContainerProps {
  open: boolean;
  height: string | number;
}

const CardContainer = styled(Card, {
  shouldForwardProp: (prop) =>
    prop !== "open" && prop !== "height",
})<CardContainerProps>(({ theme, open, height }) => ({
  width: 320,
  height: open ? height : "48px",
  display: "flex",
  flexDirection: "column",
  borderRadius: `${Number(theme.shape.borderRadius) * 2}px`,
  background: "linear-gradient(#d2a86d, #f4ede4)",
  transition: "all 0.35s ease",
  overflow: "hidden",
}));

const CardHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#d2a86d",
  borderBottom: `1px solid rgba(255,255,255,0.25)`,
  flexShrink: 0,
  minHeight: 48,
  boxSizing: "border-box",
}));

const CardContentStyled = styled(CardContent)(({ theme }) => ({
  flex: 1,
  overflowY: "auto",
  padding: theme.spacing(3),
  backgroundColor: "#e5d8c5",
  boxSizing: "border-box",
  "&:last-child": {
    paddingBottom: theme.spacing(3),
  },
}));