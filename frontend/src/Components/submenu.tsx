import React from "react";
import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export interface MenuIconItemProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  path?: string;
  onClick?: () => void;
}

interface MenuIconGridProps {
  menus: MenuIconItemProps[];
  gap?: number;
  minCardWidth?: number;
  cardHeight?: number;
}

const MenuCardItem: React.FC<
  MenuIconItemProps & { cardHeight?: number }
> = ({
  title,
  subtitle = "",
  icon,
  path,
  onClick,
  cardHeight = 90,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) onClick();
    else if (path) navigate(path);
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        width: "100%",
        height: cardHeight,
        backgroundColor: "#fff",
        borderRadius: "14px",
        cursor: "pointer",
        padding: "14px 16px",
        boxShadow: "0px 6px 18px rgba(0,0,0,0.08)",
        transition: "all 0.25s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0px 12px 26px rgba(0,0,0,0.12)",
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          "& svg": {
            fontSize: "1.5rem",
            color: "#666",
          },
        }}
      >
        {icon}
      </Box>

      {/* Text */}
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: "0.95rem",
            color: "#111",
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "#8a8a8a",
              mt: 0.5,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const MenuIconGrid: React.FC<MenuIconGridProps> = ({
  menus,
  gap = 20,
  minCardWidth = 200,
  cardHeight = 90,
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
        gap,
      }}
    >
      {menus.map((menu, index) => (
        <MenuCardItem
          key={index}
          {...menu}
          cardHeight={cardHeight}
        />
      ))}
    </Box>
  );
};

export default MenuIconGrid;
