import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { DocumentProcessLog } from '../services/api';

interface DocumentProcessLogPanelProps {
  filename: string;
  logs: DocumentProcessLog[];
  status?: string;
  isProcessing?: boolean;
  isRefreshing?: boolean;
}

export default function DocumentProcessLogPanel({
  filename,
  logs,
  status = '',
  isProcessing = false,
  isRefreshing = false,
}: DocumentProcessLogPanelProps) {
  const [copyMessage, setCopyMessage] = useState('');

  const copyText = useMemo(
    () => logs.map((log) => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`).join('\n'),
    [logs]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText || '暂无日志');
      setCopyMessage('日志已复制');
    } catch {
      setCopyMessage('复制失败，请手动复制');
    }
  };

  const progress = useMemo(() => {
    for (let index = logs.length - 1; index >= 0; index--) {
      const message = logs[index].message;
      const match = message.match(/Embedding progress:\s*(\d+)\s*\/\s*(\d+)\s*chunks/i);
      if (match) {
        const current = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (total > 0) {
          return {
            current,
            total,
            percent: Math.min(100, Math.round((current / total) * 100)),
          };
        }
      }
    }
    return null;
  }, [logs]);

  return (
    <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">处理日志</Typography>
          {isProcessing && <CircularProgress size={14} thickness={6} />}
        </Box>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<ContentCopy />}
          onClick={handleCopy}
          sx={{ minWidth: 128 }}
        >
          一键复制日志
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={1}>
        文档：{filename}
      </Typography>
      {isProcessing && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          处理中：{status}
          {isRefreshing ? ' · 日志刷新中...' : ' · 等待下一条日志...'}
        </Typography>
      )}
      {progress && (
        <Box mb={1.25}>
          <Box display="flex" justifyContent="space-between" mb={0.25}>
            <Typography variant="caption" color="text.secondary">
              Embedding 进度
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {progress.current}/{progress.total} ({progress.percent}%)
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress.percent} />
        </Box>
      )}
      {copyMessage && (
        <Typography variant="caption" color="primary" display="block" mb={1}>
          {copyMessage}
        </Typography>
      )}
      <Box
        sx={{
          borderRadius: 1,
          bgcolor: '#0e1116',
          color: '#c8d1dc',
          fontFamily: 'monospace',
          fontSize: 13,
          p: 1.5,
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        {logs.length === 0 ? (
          <Typography variant="body2">暂无日志</Typography>
        ) : (
          logs.map((log, index) => (
            <Box key={`${log.timestamp}-${index}`} display="flex" alignItems="center" gap={1} mb={0.75}>
              <Chip
                label={log.level.toUpperCase()}
                size="small"
                color={log.level === 'error' ? 'error' : 'info'}
                sx={{ height: 20, minWidth: 56 }}
              />
              <Typography variant="caption" sx={{ color: '#9fb1c9' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </Typography>
              <Typography variant="body2" sx={{ color: '#c8d1dc' }}>
                {log.message}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
}
