import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const LOG_DIR = path.join(STORAGE_PATH, 'logs');
const MAX_LOG_LINES = 500;

export interface DocumentProcessLog {
  timestamp: string;
  level: 'info' | 'error';
  message: string;
}

function getLogFilePath(documentId: string) {
  return path.join(LOG_DIR, `${documentId}.log`);
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export async function appendDocumentLog(
  documentId: string,
  level: 'info' | 'error',
  message: string
) {
  ensureLogDir();
  const log: DocumentProcessLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  await fs.promises.appendFile(getLogFilePath(documentId), `${JSON.stringify(log)}\n`, 'utf8');
}

export async function readDocumentLogs(documentId: string, limit: number = 200) {
  const filepath = getLogFilePath(documentId);
  if (!fs.existsSync(filepath)) {
    return [] as DocumentProcessLog[];
  }

  const content = await fs.promises.readFile(filepath, 'utf8');
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const safeLimit = Math.min(Math.max(limit, 1), MAX_LOG_LINES);
  return lines
    .slice(-safeLimit)
    .map((line) => {
      try {
        return JSON.parse(line) as DocumentProcessLog;
      } catch {
        return null;
      }
    })
    .filter((log): log is DocumentProcessLog => log !== null);
}

