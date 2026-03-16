import { Worker } from 'bullmq';
import { parseDocument } from '../utils/parsers';
import { documentService } from '../services/document.service';
import { chunkQueue, QUEUES } from '../config/queue';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

export const parseWorker = new Worker(
  QUEUES.DOCUMENT_PARSE,
  async (job) => {
    const { documentId } = job.data;

    try {
      logger.info(`Parsing document ${documentId}`);

      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!doc) {
        throw new Error('Document not found');
      }

      await documentService.updateDocumentStatus(documentId, 'processing');

      const text = await parseDocument(doc.filepath, doc.filetype);

      await chunkQueue.add('chunk', {
        documentId,
        text,
      });

      logger.info(`Document ${documentId} parsed successfully`);
    } catch (error: any) {
      logger.error(`Failed to parse document ${documentId}:`, error);
      await documentService.updateDocumentStatus(documentId, 'failed', error.message);
      throw error;
    }
  },
  { connection }
);

parseWorker.on('completed', (job) => {
  logger.info(`Parse job ${job.id} completed`);
});

parseWorker.on('failed', (job, err) => {
  logger.error(`Parse job ${job?.id} failed:`, err);
});
