import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  IconButton,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

export interface SelectUserCardProps {
  name: string;
  company: string;
  selected?: boolean;
  onSelect: () => void;
}

const SelectUserCard: React.FC<SelectUserCardProps> = ({
  name,
  company,
  selected = false,
  onSelect,
}) => {
  return (
    <Card
      sx={{
        borderRadius: "12px",
        boxShadow: "none",
        border: "1px solid #eee",
        position: "relative",
        textAlign: "center",
        padding: "16px",
      }}
    >
      {/* TOP RIGHT ICON */}
      <IconButton
        onClick={onSelect}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
        }}
      >
        {selected ? (
          <CheckCircleIcon sx={{ color: "#d2a56d" }} />
        ) : (
          <RadioButtonUncheckedIcon sx={{ color: "#999" }} />
        )}
      </IconButton>

      <CardContent sx={{ padding: 0 }}>
        {/* AVATAR */}
        <Box
          sx={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            backgroundColor: "#d9d9d9",
            margin: "0 auto 12px",
          }}
        />

        {/* NAME */}
        <Typography fontWeight={600}>{name}</Typography>

        {/* COMPANY */}
        <Typography fontSize="13px" color="text.secondary">
          {company}
        </Typography>

        {/* BUTTON */}
        <Button
          size="small"
          onClick={onSelect}
          sx={{
            marginTop: "10px",
            backgroundColor: "#d2a56d",
            color: "#fff",
            textTransform: "none",
            borderRadius: "12px",
            paddingX: "16px",
            fontSize: "12px",
            "&:hover": {
              backgroundColor: "#c09055",
            },
          }}
        >
          Select
        </Button>
      </CardContent>
    </Card>
  );
};

export default SelectUserCard;
