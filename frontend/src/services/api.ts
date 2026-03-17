import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  createdAt: string;
  updatedAt: string;
  documents?: Document[];
  stats?: {
    documentCount: number;
    completedDocuments: number;
    testCaseCount: number;
    evaluationCount: number;
  };
}

export interface Document {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  filetype: string;
  filepath: string;
  status: string;
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
}

export interface DocumentProcessLog {
  timestamp: string;
  level: 'info' | 'error';
  message: string;
}

export interface SearchResult {
  score: number;
  chunk_id: string;
  text: string;
  document_id: string;
  filename: string;
  chunk_index: number;
}

export interface TestCase {
  id: string;
  knowledgeBaseId: string;
  query: string;
  expectedAnswer?: string;
  expectedDocIds: string[];
  createdAt: string;
}

export interface Evaluation {
  id: string;
  knowledgeBaseId: string;
  name: string;
  status: string;
  topK: number;
  useLLMEval: boolean;
  createdAt: string;
  completedAt?: string;
  metrics?: EvaluationMetrics;
}

export interface EvaluationMetrics {
  totalQueries: number;
  avgRecall: number;
  avgRetrievalScore: number;
  avgLLMScore?: number;
}

export const knowledgeBaseApi = {
  list: () => api.get<KnowledgeBase[]>('/kb'),
  get: (id: string) => api.get<KnowledgeBase>(`/kb/${id}`),
  create: (data: Partial<KnowledgeBase>) => api.post<KnowledgeBase>('/kb', data),
  update: (id: string, data: Partial<KnowledgeBase>) => api.put<KnowledgeBase>(`/kb/${id}`, data),
  delete: (id: string) => api.delete(`/kb/${id}`),
};

export const documentApi = {
  list: (kbId: string) => api.get<Document[]>(`/kb/${kbId}/documents`),
  get: (docId: string) => api.get<Document>(`/documents/${docId}`),
  upload: (kbId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Document>(`/kb/${kbId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (docId: string) => api.delete(`/documents/${docId}`),
  logs: (docId: string, limit: number = 200) =>
    api.get<DocumentProcessLog[]>(`/documents/${docId}/logs`, { params: { limit } }),
};

export const searchApi = {
  search: (kbId: string, query: string, topK: number = 5) =>
    api.post<{ results: SearchResult[] }>(`/kb/${kbId}/search`, { query, topK }),
};

export const testCaseApi = {
  list: (kbId: string) => api.get<TestCase[]>(`/kb/${kbId}/test-cases`),
  create: (kbId: string, data: Partial<TestCase>) =>
    api.post<TestCase>(`/kb/${kbId}/test-cases`, data),
  delete: (testCaseId: string) => api.delete(`/test-cases/${testCaseId}`),
};

export const evaluationApi = {
  list: (kbId: string) => api.get<Evaluation[]>(`/kb/${kbId}/evaluations`),
  get: (evalId: string) => api.get<Evaluation>(`/evaluations/${evalId}`),
  create: (kbId: string, data: { name: string; topK?: number; useLLMEval?: boolean }) =>
    api.post<Evaluation>(`/kb/${kbId}/evaluations`, data),
};
