import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import { Add, Delete, Folder } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { knowledgeBaseApi, KnowledgeBase } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    embeddingModel: 'text-embedding-3-small',
    chunkSize: 500,
    chunkOverlap: 100,
  });

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const response = await knowledgeBaseApi.list();
      setKbs(response.data);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
    }
  };

  const handleCreate = async () => {
    try {
      await knowledgeBaseApi.create(formData);
      setOpen(false);
      setFormData({
        name: '',
        description: '',
        embeddingModel: 'text-embedding-3-small',
        chunkSize: 500,
        chunkOverlap: 100,
      });
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this knowledge base?')) {
      try {
        await knowledgeBaseApi.delete(id);
        loadKnowledgeBases();
      } catch (error) {
        console.error('Failed to delete knowledge base:', error);
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h3" component="h1">
          RAG Knowledge Platform
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
          New Knowledge Base
        </Button>
      </Box>

      <Grid container spacing={3}>
        {kbs.map((kb) => (
          <Grid item xs={12} sm={6} md={4} key={kb.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <Folder color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="h2">
                    {kb.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {kb.description || 'No description'}
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip label={kb.embeddingModel} size="small" />
                  <Chip label={`Chunk: ${kb.chunkSize}`} size="small" variant="outlined" />
                </Box>
                {kb.documents && (
                  <Typography variant="caption" display="block" mt={1}>
                    {kb.documents.filter((d) => d.status === 'completed').length} /{' '}
                    {kb.documents.length} documents
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate(`/kb/${kb.id}`)}>
                  Open
                </Button>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(kb.id)}
                  sx={{ ml: 'auto' }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Knowledge Base</DialogTitle>
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
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Embedding Model"
            fullWidth
            select
            SelectProps={{ native: true }}
            value={formData.embeddingModel}
            onChange={(e) => setFormData({ ...formData, embeddingModel: e.target.value })}
          >
            <option value="text-embedding-3-small">text-embedding-3-small</option>
            <option value="text-embedding-3-large">text-embedding-3-large</option>
            <option value="ollama-nomic-embed-text">ollama-nomic-embed-text</option>
          </TextField>
          <TextField
            margin="dense"
            label="Chunk Size (tokens)"
            fullWidth
            type="number"
            value={formData.chunkSize}
            onChange={(e) =>
              setFormData({ ...formData, chunkSize: parseInt(e.target.value) })
            }
          />
          <TextField
            margin="dense"
            label="Chunk Overlap (tokens)"
            fullWidth
            type="number"
            value={formData.chunkOverlap}
            onChange={(e) =>
              setFormData({ ...formData, chunkOverlap: parseInt(e.target.value) })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
