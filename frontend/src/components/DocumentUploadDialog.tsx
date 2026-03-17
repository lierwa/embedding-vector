import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

const SUPPORTED_FILE_EXTENSIONS = [
  'pdf',
  'docx',
  'doc',
  'html',
  'htm',
  'json',
  'txt',
  'md',
  'markdown',
];

interface DocumentUploadDialogProps {
  open: boolean;
  uploading: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

function getFileExtension(filename: string) {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function validateFile(file: File) {
  const ext = getFileExtension(file.name);
  if (!ext || !SUPPORTED_FILE_EXTENSIONS.includes(ext)) {
    return `不支持该文件类型：.${ext || 'unknown'}，请上传 ${SUPPORTED_FILE_EXTENSIONS.join(', ')}`;
  }
  return '';
}

export default function DocumentUploadDialog({
  open,
  uploading,
  onClose,
  onUpload,
}: DocumentUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const supportText = useMemo(
    () => SUPPORTED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(', '),
    []
  );

  const handlePick = (nextFile: File | null) => {
    if (!nextFile) return;
    const validationError = validateFile(nextFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(nextFile);
    setError('');
  };

  const handleConfirmUpload = async () => {
    if (!file) {
      setError('请先选择文件');
      return;
    }
    await onUpload(file);
    setFile(null);
    setError('');
    onClose();
  };

  const handleClose = () => {
    if (uploading) {
      return;
    }
    setFile(null);
    setError('');
    setDragging(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Document</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={1}>
          支持格式：{supportText}
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          {SUPPORTED_FILE_EXTENSIONS.map((ext) => (
            <Chip key={ext} label={`.${ext}`} size="small" variant="outlined" />
          ))}
        </Box>

        <Box
          sx={{
            border: '1px dashed',
            borderColor: dragging ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            bgcolor: dragging ? 'action.hover' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            // 拖拽上传统一走同一套校验逻辑，避免两套规则不一致
            handlePick(event.dataTransfer.files?.[0] || null);
          }}
        >
          <CloudUpload color={dragging ? 'primary' : 'inherit'} />
          <Typography mt={1}>拖拽文件到这里，或点击选择文件</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            单文件上传
          </Typography>
          {file && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
              已选择：{file.name}
            </Typography>
          )}
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => handlePick(event.target.files?.[0] || null)}
        />

        {error && (
          <Alert sx={{ mt: 2 }} severity="error">
            {error}
          </Alert>
        )}

        {uploading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleConfirmUpload} disabled={uploading || !file} variant="contained">
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}

