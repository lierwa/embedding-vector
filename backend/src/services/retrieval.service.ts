import { qdrantClient, getCollectionName } from '../config/qdrant';
import { embedSingle } from '../utils/openai.client';
import { prisma } from '../config/database';

export interface SearchResult {
  score: number;
  chunk_id: string;
  text: string;
  document_id: string;
  filename: string;
  chunk_index: number;
}

export class RetrievalService {
  async search(kbId: string, query: string, topK: number = 5): Promise<SearchResult[]> {
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
    });

    if (!kb) {
      throw new Error('Knowledge base not found');
    }

    const queryVector = await embedSingle(query, kb.embeddingModel);

    const collectionName = getCollectionName(kbId);
    const searchResults = await qdrantClient.search(collectionName, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
    });

    const results: SearchResult[] = [];

    for (const result of searchResults) {
      const payload = result.payload as any;
      const document = await prisma.document.findUnique({
        where: { id: payload.document_id },
        select: { filename: true },
      });

      results.push({
        score: result.score,
        chunk_id: payload.chunk_id,
        text: payload.text,
        document_id: payload.document_id,
        filename: document?.filename || 'unknown',
        chunk_index: payload.chunk_index,
      });
    }

    return results;
  }
}

export const retrievalService = new RetrievalService();
