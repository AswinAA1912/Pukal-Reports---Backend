import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  InputBase,
  alpha,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Stack,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import logo from "../assets/logo.png";

interface HeaderProps {
  headerColor?: string;
  showSearch?: boolean;
  position?: "fixed" | "static" | "sticky" | "relative";
}

const HEADER_HEIGHT = 64;

const Header: React.FC<HeaderProps> = ({
  headerColor = "#1E3A8A",
  showSearch = false,
  position = "static",
}) => {
  const navigate = useNavigate();
  const { logout, token, user, companies, switchCompany } = useAuth();

  const [companyAnchor, setCompanyAnchor] = useState<null | HTMLElement>(null);
  const [userAnchor, setUserAnchor] = useState<null | HTMLElement>(null);

  const companyOpen = Boolean(companyAnchor);
  const userOpen = Boolean(userAnchor);

  if (!token) return null;

  const handleCompanyClick = (event: React.MouseEvent<HTMLElement>) => {
    setCompanyAnchor(event.currentTarget);
  };

  const handleCompanyClose = async (company?: any) => {
    setCompanyAnchor(null);
    if (company) {
      try {
        await switchCompany(company);
        window.location.reload();
      } catch (e) {
        // Switch failed, do not reload
      }
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserAnchor(null);
  };

  return (
    <AppBar
      position={position}
      sx={{
        background: headerColor,
        height: HEADER_HEIGHT,
        minHeight: HEADER_HEIGHT,
        flexShrink: 0,
        zIndex: (theme) => theme.zIndex.drawer + 10,
      }}
    >
      <Toolbar sx={{ height: HEADER_HEIGHT }}>
        <IconButton
          edge="start"
          color="inherit"
          sx={{ display: { xs: "flex", md: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Logo */}
        <Box
          onClick={() => navigate("/")}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <img
            src={logo}
            alt="Pukal Reports"
            style={{
              height: 40,
              objectFit: "contain",
            }}
          />
        </Box>

        {/* CENTER COMPANY SWITCH */}
        {companies && companies.length > 0 && (
          <Box
            onClick={handleCompanyClick}
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              color: "#fff",
              gap: 0.5,
            }}
          >
            <Typography fontWeight={600}>
              {user?.Company_Name || "Select Company"}
            </Typography>

          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Search */}
        {showSearch && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              backgroundColor: alpha("#fff", 0.15),
              px: 1,
              borderRadius: 1,
            }}
          >
            <SearchIcon />
            <InputBase placeholder="Search…" sx={{ ml: 1, color: "inherit" }} />
          </Box>
        )}

        {/* USER ICON */}
        <Tooltip title="Account">
          <IconButton onClick={handleUserMenuOpen} sx={{ ml: 2 }}>
            <Avatar sx={{ bgcolor: "#fff", color: "#1E3A8A", fontWeight: 600 }}>
              {user?.Name?.charAt(0) || "U"}
            </Avatar>
          </IconButton>
        </Tooltip>

        {/* USER MENU */}
        <Menu
          anchorEl={userAnchor}
          open={userOpen}
          onClose={handleUserMenuClose}
          PaperProps={{
            sx: {
              width: 220,
              p: 2,
              borderRadius: 2,
            },
          }}
        >
          {/* User Info */}
          <Box sx={{ textAlign: "center", mb: 1 }}>
            <Typography fontWeight={600}>
              {user?.Name || "User"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.Company_Name}
            </Typography>
          </Box>

          {/* Icons */}
          <Stack direction="row" justifyContent="center" spacing={3} mt={1}>

            {/* Logout */}
            <Tooltip title="Logout">
              <IconButton
                onClick={logout}
                sx={{
                  bgcolor: "#FEE2E2",
                  borderRadius: "50%",
                }}
              >
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Menu>

        {/* COMPANY MENU */}
        <Menu
          anchorEl={companyAnchor}
          open={companyOpen}
          onClose={() => handleCompanyClose()}
          PaperProps={{
            sx: { minWidth: 200 },
          }}
        >
          {companies.map((company) => {
            const isSelected = company.id === user?.companyId;
            return (
              <MenuItem
                key={company.id}
                onClick={() => handleCompanyClose(company)}
                sx={{
                  backgroundColor: isSelected
                    ? "rgba(0,0,0,0.08)"
                    : "inherit",
                  fontWeight: isSelected ? "bold" : "normal",
                }}
              >
                {company.name}
              </MenuItem>
            );
          })}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
export { HEADER_HEIGHT };