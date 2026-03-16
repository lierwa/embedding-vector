import { Worker } from 'bullmq';
import { TextChunker } from '../utils/chunker';
import { prisma } from '../config/database';
import { embeddingQueue, QUEUES } from '../config/queue';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

export const chunkWorker = new Worker(
  QUEUES.DOCUMENT_CHUNK,
  async (job) => {
    const { documentId, text } = job.data;

    try {
      logger.info(`Chunking document ${documentId}`);

      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { knowledgeBase: true },
      });

      if (!doc) {
        throw new Error('Document not found');
      }

      const chunker = new TextChunker();
      const chunks = chunker.chunk(text, doc.knowledgeBase.chunkSize, doc.knowledgeBase.chunkOverlap);

      const chunkRecords = [];
      for (let i = 0; i < chunks.length; i++) {
        const tokenCount = chunker.countTokens(chunks[i]);
        chunkRecords.push({
          documentId,
          knowledgeBaseId: doc.knowledgeBaseId,
          text: chunks[i],
          tokenCount,
          chunkIndex: i,
        });
      }

      await prisma.chunk.createMany({
        data: chunkRecords,
      });

      chunker.free();

      await embeddingQueue.add('embed', {
        documentId,
        knowledgeBaseId: doc.knowledgeBaseId,
        embeddingModel: doc.knowledgeBase.embeddingModel,
      });

      logger.info(`Document ${documentId} chunked into ${chunks.length} chunks`);
    } catch (error: any) {
      logger.error(`Failed to chunk document ${documentId}:`, error);
      throw error;
    }
  },
  { connection }
);

chunkWorker.on('completed', (job) => {
  logger.info(`Chunk job ${job.id} completed`);
});

chunkWorker.on('failed', (job, err) => {
  logger.error(`Chunk job ${job?.id} failed:`, err);
});
