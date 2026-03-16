import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Grid,
} from '@mui/material';
import { Add, Assessment } from '@mui/icons-material';
import { evaluationApi, Evaluation } from '../services/api';

interface EvaluationListProps {
  kbId: string;
}

export default function EvaluationList({ kbId }: EvaluationListProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    topK: 5,
    useLLMEval: false,
  });

  useEffect(() => {
    loadEvaluations();
    const interval = setInterval(loadEvaluations, 5000);
    return () => clearInterval(interval);
  }, [kbId]);

  const loadEvaluations = async () => {
    try {
      const response = await evaluationApi.list(kbId);
      setEvaluations(response.data);
    } catch (error) {
      console.error('Failed to load evaluations:', error);
    }
  };

  const handleCreate = async () => {
    try {
      await evaluationApi.create(kbId, formData);
      setOpen(false);
      setFormData({ name: '', topK: 5, useLLMEval: false });
      loadEvaluations();
    } catch (error) {
      console.error('Failed to create evaluation:', error);
      alert('Failed to create evaluation');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
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
        <Typography variant="h5">Evaluations</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
          New Evaluation
        </Button>
      </Box>

      <Grid container spacing={2}>
        {evaluations.map((evaluation) => (
          <Grid item xs={12} md={6} key={evaluation.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">{evaluation.name}</Typography>
                  <Chip label={evaluation.status} size="small" color={getStatusColor(evaluation.status)} />
                </Box>

                <Box display="flex" gap={1} mb={2}>
                  <Chip label={`Top K: ${evaluation.topK}`} size="small" variant="outlined" />
                  {evaluation.useLLMEval && (
                    <Chip label="LLM Eval" size="small" color="primary" />
                  )}
                </Box>

                {evaluation.metrics && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      <Assessment fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                      Results
                    </Typography>
                    <Typography variant="body2">
                      Total Queries: {evaluation.metrics.totalQueries}
                    </Typography>
                    <Typography variant="body2">
                      Avg Recall: {(evaluation.metrics.avgRecall * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2">
                      Avg Score: {evaluation.metrics.avgRetrievalScore.toFixed(3)}
                    </Typography>
                    {evaluation.metrics.avgLLMScore !== null && evaluation.metrics.avgLLMScore !== undefined && (
                      <Typography variant="body2">
                        Avg LLM Score: {evaluation.metrics.avgLLMScore.toFixed(1)}/10
                      </Typography>
                    )}
                  </Box>
                )}

                <Typography variant="caption" display="block" mt={1} color="text.secondary">
                  Created: {new Date(evaluation.createdAt).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {evaluations.length === 0 && (
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" align="center">
              No evaluations yet
            </Typography>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Evaluation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Top K"
            fullWidth
            type="number"
            value={formData.topK}
            onChange={(e) => setFormData({ ...formData, topK: parseInt(e.target.value) })}
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.useLLMEval}
                onChange={(e) => setFormData({ ...formData, useLLMEval: e.target.checked })}
              />
            }
            label="Use LLM Evaluation (slower, costs OpenAI credits)"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">
            Start Evaluation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
