import { Worker } from 'bullmq';
import { qdrantClient, getCollectionName } from '../config/qdrant';
import { documentService } from '../services/document.service';
import { QUEUES } from '../config/queue';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

export const indexWorker = new Worker(
  QUEUES.INDEX,
  async (job) => {
    const { documentId, knowledgeBaseId, chunks, vectors } = job.data;

    try {
      logger.info(`Indexing ${chunks.length} chunks for document ${documentId}`);

      const collectionName = getCollectionName(knowledgeBaseId);

      const points = chunks.map((chunk: any, index: number) => ({
        id: chunk.id,
        vector: vectors[index],
        payload: {
          chunk_id: chunk.id,
          document_id: chunk.documentId,
          kb_id: chunk.knowledgeBaseId,
          text: chunk.text,
          token_count: chunk.tokenCount,
          chunk_index: chunk.chunkIndex,
        },
      }));

      await qdrantClient.upsert(collectionName, {
        points,
      });

      await documentService.updateDocumentStatus(documentId, 'completed', undefined, new Date());

      logger.info(`Successfully indexed document ${documentId}`);
    } catch (error: any) {
      logger.error(`Failed to index document ${documentId}:`, error);
      await documentService.updateDocumentStatus(documentId, 'failed', error.message);
      throw error;
    }
  },
  { connection }
);

indexWorker.on('completed', (job) => {
  logger.info(`Index job ${job.id} completed`);
});

indexWorker.on('failed', (job, err) => {
  logger.error(`Index job ${job?.id} failed:`, err);
});
