import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  LinearProgress,
} from '@mui/material';
import { CloudUpload, Delete, Refresh } from '@mui/icons-material';
import { documentApi, Document } from '../services/api';

interface DocumentManagerProps {
  kbId: string;
}

export default function DocumentManager({ kbId }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
    const interval = setInterval(loadDocuments, 3000);
    return () => clearInterval(interval);
  }, [kbId]);

  const loadDocuments = async () => {
    try {
      const response = await documentApi.list(kbId);
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await documentApi.upload(kbId, file);
      loadDocuments();
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentApi.delete(docId);
      loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Documents</Typography>
        <Box display="flex" gap={2}>
          <IconButton onClick={loadDocuments}>
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUpload />}
            disabled={uploading}
          >
            Upload Document
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        </Box>
      </Box>

      {uploading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.filename}</TableCell>
                <TableCell>
                  <Chip label={doc.filetype.toUpperCase()} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip label={doc.status} size="small" color={getStatusColor(doc.status)} />
                </TableCell>
                <TableCell>
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleDelete(doc.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {documents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No documents uploaded yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
