import { Worker, UnrecoverableError } from 'bullmq';
import { qdrantClient, getCollectionName } from '../config/qdrant';
import { documentService } from '../services/document.service';
import { QUEUES } from '../config/queue';
import { logger } from '../utils/logger';
import { appendDocumentLog } from '../utils/document-log';

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
      await appendDocumentLog(documentId, 'info', `Start indexing ${chunks.length} chunks`);
      const jobStart = Date.now();

      await documentService.updateDocumentStatus(documentId, 'indexing');

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

      const upsertStart = Date.now();
      await appendDocumentLog(documentId, 'info', `Writing ${points.length} vectors to Qdrant`);
      await qdrantClient.upsert(collectionName, {
        points,
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Qdrant upsert completed in ${Date.now() - upsertStart}ms`
      );

      const updateStatusStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Updating completion status in Postgres');
      await documentService.updateDocumentStatus(documentId, 'completed', undefined, new Date());
      await appendDocumentLog(
        documentId,
        'info',
        `Completion status updated in Postgres in ${Date.now() - updateStatusStart}ms`
      );
      await appendDocumentLog(documentId, 'info', 'Document processing completed');
      await appendDocumentLog(documentId, 'info', `Index stage finished in ${Date.now() - jobStart}ms`);

      logger.info(`Successfully indexed document ${documentId}`);
    } catch (error: any) {
      logger.error(`Failed to index document ${documentId}:`, error);
      await appendDocumentLog(documentId, 'error', `Indexing failed: ${error.message}`);
      await documentService.updateDocumentStatus(documentId, 'failed', error.message);
      throw new UnrecoverableError(error.message);
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
