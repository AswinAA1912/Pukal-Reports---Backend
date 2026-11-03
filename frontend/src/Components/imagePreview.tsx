import React, { useState, type ReactNode } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  IconButton, 
  Tooltip 
} from '@mui/material';
import { Close } from '@mui/icons-material';

interface ImagePreviewDialogProps {
  /** The URL of the image to preview */
  url: string;
  /** Child elements that will trigger the dialog when clicked */
  children: ReactNode;
  /** Optional className for the trigger element */
  triggerClassName?: string;
  /** Optional custom title for the dialog */
  dialogTitle?: string;
}

const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = (props) => {
  const [open, setOpen] = useState<boolean>(false);
  const { 
    url, 
    children, 
    dialogTitle = 'Image Preview',
    triggerClassName 
  } = props;

  const handleOpen = (): void => {
    setOpen(true);
  };

  const handleClose = (): void => {
    setOpen(false);
  };

  return (
    <span>
      <Tooltip title="Click to open">
        <span 
          onClick={handleOpen} 
          className={triggerClassName}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleOpen();
            }
          }}
        >
          {children}
        </span>
      </Tooltip>

      <Dialog 
        open={open} 
        onClose={handleClose} 
        fullWidth 
        maxWidth="lg"
        aria-labelledby="image-preview-dialog-title"
      >
        <DialogTitle 
          className="bg-dark text-white d-flex justify-content-between"
          id="image-preview-dialog-title"
        >
          <span>{dialogTitle}</span>
          <IconButton 
            onClick={handleClose} 
            aria-label="close"
            sx={{ color: 'white' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent className="bg-dark pb-4 d-flex align-items-center justify-content-center">
          <img 
            src={url} 
            alt="Preview" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '70vh',
              objectFit: 'contain'
            }} 
            loading="lazy"
          />
        </DialogContent>
      </Dialog>
    </span>
  );
};

export default ImagePreviewDialog;