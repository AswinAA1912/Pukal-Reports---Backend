import React, { useEffect } from "react";
import { Box, Typography, Button } from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import { useNavigate } from "react-router-dom";

const RetailerLocations: React.FC = () => {
  const targetUrl = "https://pukalfoods-geography.vercel.app/";
  const navigate = useNavigate();

  useEffect(() => {

    const newWindow = window.open(targetUrl, "_blank");

    if (newWindow) {
      const timer = setTimeout(() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/dashboard");
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)",
        color: "#fff",
        textAlign: "center",
        px: 3,
        fontFamily: "Outfit, Roboto, sans-serif",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          mb: 4,
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
        }}
      >
        <MapIcon sx={{ fontSize: 40, color: "#60A5FA" }} />
      </Box>

      <Typography
        variant="h4"
        fontWeight={700}
        sx={{
          mb: 2,
          letterSpacing: 0.5,
          background: "linear-gradient(to right, #60A5FA, #93C5FD)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Retailer Locations
      </Typography>

      <Typography variant="body1" sx={{ color: "rgba(255, 255, 255, 0.7)", mb: 4, maxWidth: 450 }}>
        Opening Retailer Locations in a new tab. If it did not open, please click the button below.
      </Typography>

      <Button
        variant="contained"
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          // If they click manually, go back to where they came from
          setTimeout(() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/dashboard");
            }
          }, 500);
        }}
        sx={{
          py: 1.5,
          px: 4,
          borderRadius: 3,
          backgroundColor: "#3B82F6",
          fontWeight: 600,
          textTransform: "none",
          boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.5)",
          "&:hover": {
            backgroundColor: "#2563EB",
            boxShadow: "0 6px 20px 0 rgba(37, 99, 235, 0.5)",
          },
        }}
      >
        Open Map in New Tab
      </Button>
    </Box>
  );
};

export default RetailerLocations;
