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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { testCaseApi, TestCase } from '../services/api';

interface TestCaseManagerProps {
  kbId: string;
}

export default function TestCaseManager({ kbId }: TestCaseManagerProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    query: '',
    expectedAnswer: '',
  });

  useEffect(() => {
    loadTestCases();
  }, [kbId]);

  const loadTestCases = async () => {
    try {
      const response = await testCaseApi.list(kbId);
      setTestCases(response.data);
    } catch (error) {
      console.error('Failed to load test cases:', error);
    }
  };

  const handleCreate = async () => {
    try {
      await testCaseApi.create(kbId, formData);
      setOpen(false);
      setFormData({ query: '', expectedAnswer: '' });
      loadTestCases();
    } catch (error) {
      console.error('Failed to create test case:', error);
    }
  };

  const handleDelete = async (testCaseId: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      await testCaseApi.delete(testCaseId);
      loadTestCases();
    } catch (error) {
      console.error('Failed to delete test case:', error);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Test Cases</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
          Add Test Case
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Query</TableCell>
              <TableCell>Expected Answer</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {testCases.map((tc) => (
              <TableRow key={tc.id}>
                <TableCell>{tc.query}</TableCell>
                <TableCell>{tc.expectedAnswer || '-'}</TableCell>
                <TableCell>{new Date(tc.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleDelete(tc.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {testCases.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No test cases yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Test Case</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Query"
            fullWidth
            multiline
            rows={3}
            value={formData.query}
            onChange={(e) => setFormData({ ...formData, query: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Expected Answer (optional)"
            fullWidth
            multiline
            rows={3}
            value={formData.expectedAnswer}
            onChange={(e) => setFormData({ ...formData, expectedAnswer: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
