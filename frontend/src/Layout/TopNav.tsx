import React from "react";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";

// ✅ Add props interface
interface TopNavProps {
  navColor?: string; // background color for AppBar
}

const TopNav: React.FC<TopNavProps> = ({ navColor }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();           // clear auth (token, user, etc.)
    navigate("/login"); // redirect to login
  };

  return (
    <StyledAppBar position="static" elevation={2} navColor={navColor}>
      <Toolbar>
        {/* LEFT SIDE: Pukal Reports */}
        <Typography
          variant="h6"
          onClick={() => navigate("/")}
          sx={{
            cursor: "pointer",
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          Pukal Reports
        </Typography>

        {/* SPACER */}
        <Box sx={{ flexGrow: 1 }} />

        {/* RIGHT SIDE: Logout */}
        <LogoutButton
          variant="outlined"
          size="small"
          onClick={handleLogout}
        >
          Logout
        </LogoutButton>
      </Toolbar>
    </StyledAppBar>
  );
};

export default TopNav;

/* ================= STYLED COMPONENTS ================= */

// Pass navColor to styled AppBar
const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "navColor", // avoid passing to DOM
})<{ navColor?: string }>(({ navColor }) => ({
  background: navColor || "#0369a1", // default dark blue if not passed
  color: "#fff",
}));

const LogoutButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  borderRadius: 20,
  padding: theme.spacing(0.5, 2),
  color: "#fff",
  borderColor: "rgba(255,255,255,0.6)",
  "&:hover": {
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
}));
