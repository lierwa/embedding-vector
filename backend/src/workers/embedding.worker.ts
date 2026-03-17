import { Worker, UnrecoverableError } from 'bullmq';
import { prisma } from '../config/database';
import { batchEmbed } from '../utils/openai.client';
import { indexQueue, QUEUES } from '../config/queue';
import { logger } from '../utils/logger';
import { appendDocumentLog } from '../utils/document-log';
import { documentService } from '../services/document.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

export const embeddingWorker = new Worker(
  QUEUES.EMBEDDING,
  async (job) => {
    const { documentId, knowledgeBaseId, embeddingModel } = job.data;

    try {
      logger.info(`Embedding chunks for document ${documentId}`);
      await appendDocumentLog(documentId, 'info', `Start embedding with model ${embeddingModel}`);
      const jobStart = Date.now();

      const loadChunksStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Loading chunks from Postgres');
      const chunks = await prisma.chunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' },
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Loaded ${chunks.length} chunks from Postgres in ${Date.now() - loadChunksStart}ms`
      );

      if (chunks.length === 0) {
        throw new Error('No chunks found for document');
      }

      await documentService.updateDocumentStatus(documentId, 'embedding');

      const texts = chunks.map((c: any) => c.text);
      const embeddingStart = Date.now();
      const result = await batchEmbed(texts, embeddingModel, 100, {
        onLog: (level, message) => appendDocumentLog(documentId, level, message),
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Embedded ${chunks.length} chunks in ${Date.now() - embeddingStart}ms`
      );

      const enqueueStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Queueing indexing job to Redis');
      await indexQueue.add('index', {
        documentId,
        knowledgeBaseId,
        chunks,
        vectors: result.embeddings,
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Indexing task queued in Redis in ${Date.now() - enqueueStart}ms`
      );
      await appendDocumentLog(documentId, 'info', `Embedding stage finished in ${Date.now() - jobStart}ms`);

      logger.info(`Embedded ${chunks.length} chunks for document ${documentId}`);
    } catch (error: any) {
      logger.error(`Failed to embed document ${documentId}:`, error);
      await appendDocumentLog(documentId, 'error', `Embedding failed: ${error.message}`);
      await documentService.updateDocumentStatus(documentId, 'failed', error.message);
      throw new UnrecoverableError(error.message);
    }
  },
  { connection }
);

embeddingWorker.on('completed', (job) => {
  logger.info(`Embedding job ${job.id} completed`);
});

embeddingWorker.on('failed', (job, err) => {
  logger.error(`Embedding job ${job?.id} failed:`, err);
});
