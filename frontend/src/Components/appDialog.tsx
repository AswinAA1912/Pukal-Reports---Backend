import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  onSubmit?: () => void;
  submitText?: string;
  closeText?: string;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  fullWidth?: boolean;
  isSubmit?: boolean;
}

const AppDialog: React.FC<AppDialogProps> = ({
  open,
  title,
  onClose,
  onSubmit,
  submitText = "Submit",
  closeText = "Cancel",
  children,
  maxWidth = "sm",
  fullWidth = true,
  isSubmit = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      PaperProps={{
        sx: {
          borderRadius: "10px",
          overflow: "hidden", // Ensures header corners are rounded
        },
      }}
    >
      {/* 🔹 HEADER */}
      {title && (
        <DialogTitle
          sx={{
            backgroundColor: "#d2a56d",
            color: "#fff",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px", // Increased padding for better spacing
            minHeight: "48px",
          }}
        >
          {title}
          <IconButton
            onClick={onClose}
            sx={{ 
              color: "#fff", 
              padding: "4px",
              marginRight: "-8px", // Adjust close button position
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
      )}

      {/* 🔹 BODY - Adjusted spacing */}
      <DialogContent
        sx={{
          // 🔥 REDUCED GAP FROM HEADER TO FIRST INPUT
          paddingTop: "16px",   // Reduced from 20px to 16px
          paddingBottom: "8px",
          paddingX: "20px",
          // Remove default padding adjustments
          "&.MuiDialogContent-root": {
            paddingTop: "16px",
          }
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            // 🔥 ADJUSTED INPUT GAP - Reduced from 12px to 8px
            gap: "8px",  // Space between input fields
            "& .MuiFormControl-root": {
              margin: 0,
            },
            // Ensure labels are properly positioned
            "& .MuiInputLabel-root": {
              backgroundColor: "#fff",
              padding: "0 4px",
            },
            // Style for text fields
            "& .MuiTextField-root": {
              marginTop: 0,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "#f9f9f9",
              }
            },
          }}
        >
          {children}
        </Box>
      </DialogContent>

      {/* 🔹 FOOTER */}
      <DialogActions
        sx={{
          padding: "12px 20px",
          borderTop: "1px solid #e0e0e0",
          backgroundColor: "#f9f9f9",
        }}
      >
        <Button
          onClick={onClose}
          sx={{ 
            textTransform: "none", 
            color: "#555",
            fontWeight: 500,
          }}
        >
          {closeText}
        </Button>

        {onSubmit && (
          <Button
            variant="contained"
            onClick={onSubmit}
            type={isSubmit ? "submit" : "button"}
            sx={{
              backgroundColor: "#d2a56d",
              "&:hover": {
                backgroundColor: "#c09055",
              },
              textTransform: "none",
              fontWeight: 600,
              padding: "6px 20px",
              borderRadius: "4px",
            }}
          >
            {submitText}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AppDialog;