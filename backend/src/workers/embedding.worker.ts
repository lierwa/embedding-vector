import { Worker } from 'bullmq';
import { prisma } from '../config/database';
import { batchEmbed } from '../utils/openai.client';
import { indexQueue, QUEUES } from '../config/queue';
import { logger } from '../utils/logger';

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

      const chunks = await prisma.chunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' },
      });

      if (chunks.length === 0) {
        throw new Error('No chunks found for document');
      }

      const texts = chunks.map((c: any) => c.text);
      const result = await batchEmbed(texts, embeddingModel);

      await indexQueue.add('index', {
        documentId,
        knowledgeBaseId,
        chunks,
        vectors: result.embeddings,
      });

      logger.info(`Embedded ${chunks.length} chunks for document ${documentId}`);
    } catch (error: any) {
      logger.error(`Failed to embed document ${documentId}:`, error);
      throw error;
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
