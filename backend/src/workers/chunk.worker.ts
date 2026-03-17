import { Worker, UnrecoverableError } from 'bullmq';
import { TextChunker } from '../utils/chunker';
import { prisma } from '../config/database';
import { embeddingQueue, QUEUES } from '../config/queue';
import { logger } from '../utils/logger';
import { appendDocumentLog } from '../utils/document-log';
import { documentService } from '../services/document.service';

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
      await appendDocumentLog(documentId, 'info', 'Start chunking document');
      const jobStart = Date.now();

      const loadDocStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Loading chunk config from Postgres');
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { knowledgeBase: true },
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Loaded chunk config from Postgres in ${Date.now() - loadDocStart}ms`
      );

      if (!doc) {
        throw new Error('Document not found');
      }

      await documentService.updateDocumentStatus(documentId, 'chunking');

      const chunkStart = Date.now();
      const chunker = new TextChunker();
      const chunks = chunker.chunk(text, doc.knowledgeBase.chunkSize, doc.knowledgeBase.chunkOverlap);
      await appendDocumentLog(
        documentId,
        'info',
        `Chunking completed in ${Date.now() - chunkStart}ms`
      );

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

      const saveChunksStart = Date.now();
      await appendDocumentLog(documentId, 'info', `Writing ${chunkRecords.length} chunks to Postgres`);
      await prisma.chunk.createMany({
        data: chunkRecords,
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Chunked into ${chunks.length} chunks, Postgres write took ${Date.now() - saveChunksStart}ms`
      );

      chunker.free();

      const enqueueStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Queueing embedding job to Redis');
      await embeddingQueue.add('embed', {
        documentId,
        knowledgeBaseId: doc.knowledgeBaseId,
        embeddingModel: doc.knowledgeBase.embeddingModel,
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Embedding task queued in Redis in ${Date.now() - enqueueStart}ms`
      );
      await appendDocumentLog(documentId, 'info', `Chunk stage finished in ${Date.now() - jobStart}ms`);

      logger.info(`Document ${documentId} chunked into ${chunks.length} chunks`);
    } catch (error: any) {
      logger.error(`Failed to chunk document ${documentId}:`, error);
      await appendDocumentLog(documentId, 'error', `Chunking failed: ${error.message}`);
      await documentService.updateDocumentStatus(documentId, 'failed', error.message);
      throw new UnrecoverableError(error.message);
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
