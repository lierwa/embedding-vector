import { useState, useEffect } from 'react';
import {
  Alert,
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
import { CloudUpload, Delete, Refresh, ReceiptLong } from '@mui/icons-material';
import { documentApi, Document, DocumentProcessLog } from '../services/api';
import DocumentUploadDialog from './DocumentUploadDialog';
import DocumentProcessLogPanel from './DocumentProcessLogPanel';

interface DocumentManagerProps {
  kbId: string;
}

export default function DocumentManager({ kbId }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedDocName, setSelectedDocName] = useState<string>('');
  const [logs, setLogs] = useState<DocumentProcessLog[]>([]);
  const [logError, setLogError] = useState('');
  const [logsRefreshing, setLogsRefreshing] = useState(false);

  useEffect(() => {
    loadDocuments();
    const interval = setInterval(loadDocuments, 3000);
    return () => clearInterval(interval);
  }, [kbId]);

  useEffect(() => {
    if (!selectedDocId) {
      return;
    }

    loadDocumentLogs(selectedDocId);
    const interval = setInterval(() => {
      loadDocumentLogs(selectedDocId);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedDocId]);

  const loadDocuments = async () => {
    try {
      const response = await documentApi.list(kbId);
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setLogError('');
    try {
      const response = await documentApi.upload(kbId, file);
      await loadDocuments();
      setSelectedDocId(response.data.id);
      setSelectedDocName(response.data.filename);
      await loadDocumentLogs(response.data.id);
    } catch (error: any) {
      console.error('Failed to upload document:', error);
      const message = error?.response?.data?.error || 'Failed to upload document';
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const loadDocumentLogs = async (docId: string) => {
    setLogsRefreshing(true);
    try {
      const response = await documentApi.logs(docId);
      setLogs(response.data);
      setLogError('');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to load process logs';
      setLogError(message);
    } finally {
      setLogsRefreshing(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentApi.delete(docId);
      await loadDocuments();
      if (selectedDocId === docId) {
        setSelectedDocId('');
        setSelectedDocName('');
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'parsing':
      case 'chunking':
      case 'embedding':
      case 'indexing':
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const selectedDoc = documents.find((doc) => doc.id === selectedDocId);
  const selectedDocStatus = selectedDoc?.status || '';
  const selectedDocIsProcessing =
    Boolean(selectedDoc) && selectedDocStatus !== 'completed' && selectedDocStatus !== 'failed';

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
            startIcon={<CloudUpload />}
            disabled={uploading}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Document
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
                  <IconButton
                    size="small"
                    color={selectedDocId === doc.id ? 'primary' : 'default'}
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setSelectedDocName(doc.filename);
                      loadDocumentLogs(doc.id);
                    }}
                  >
                    <ReceiptLong fontSize="small" />
                  </IconButton>
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

      {selectedDocId && logError && (
        <Alert sx={{ mt: 2 }} severity="error">
          {logError}
        </Alert>
      )}

      {selectedDocId && (
        <DocumentProcessLogPanel
          filename={selectedDocName}
          logs={logs}
          status={selectedDocStatus}
          isProcessing={selectedDocIsProcessing}
          isRefreshing={logsRefreshing}
        />
      )}

      <DocumentUploadDialog
        open={uploadDialogOpen}
        uploading={uploading}
        onClose={() => setUploadDialogOpen(false)}
        onUpload={handleUpload}
      />
    </Box>
  );
}
