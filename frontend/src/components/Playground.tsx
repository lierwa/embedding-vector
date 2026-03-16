import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  Slider,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { searchApi, SearchResult } from '../services/api';

interface PlaygroundProps {
  kbId: string;
}

export default function Playground({ kbId }: PlaygroundProps) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await searchApi.search(kbId, query, topK);
      setResults(response.data.results);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" mb={3}>
        Query Playground
      </Typography>

      <Box mb={3}>
        <TextField
          fullWidth
          label="Query"
          multiline
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your query here..."
          sx={{ mb: 2 }}
        />

        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Typography variant="body2" sx={{ minWidth: 100 }}>
            Top K: {topK}
          </Typography>
          <Slider
            value={topK}
            onChange={(_, value) => setTopK(value as number)}
            min={1}
            max={20}
            marks
            valueLabelDisplay="auto"
            sx={{ maxWidth: 300 }}
          />
        </Box>

        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <Search />}
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          Search
        </Button>
      </Box>

      {results.length > 0 && (
        <Box>
          <Typography variant="h6" mb={2}>
            Results ({results.length})
          </Typography>

          {results.map((result, index) => (
            <Card key={result.chunk_id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Result #{index + 1}
                  </Typography>
                  <Chip
                    label={`Score: ${result.score.toFixed(3)}`}
                    color="primary"
                    size="small"
                  />
                </Box>

                <Typography variant="body1" paragraph>
                  {result.text}
                </Typography>

                <Box display="flex" gap={1}>
                  <Chip label={result.filename} size="small" variant="outlined" />
                  <Chip label={`Chunk #${result.chunk_index}`} size="small" variant="outlined" />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {results.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
          Enter a query and click Search to see results
        </Typography>
      )}
    </Box>
  );
}
