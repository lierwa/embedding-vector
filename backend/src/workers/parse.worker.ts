import { Worker, UnrecoverableError } from 'bullmq';
import { parseDocument } from '../utils/parsers';
import { documentService } from '../services/document.service';
import { chunkQueue, QUEUES } from '../config/queue';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { appendDocumentLog } from '../utils/document-log';

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
      await appendDocumentLog(documentId, 'info', 'Start parsing document');
      const jobStart = Date.now();

      const loadDocStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Loading document metadata from Postgres');
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Loaded document metadata from Postgres in ${Date.now() - loadDocStart}ms`
      );

      if (!doc) {
        throw new Error('Document not found');
      }

      await documentService.updateDocumentStatus(documentId, 'parsing');

      const parseStart = Date.now();
      const text = await parseDocument(doc.filepath, doc.filetype);
      await appendDocumentLog(
        documentId,
        'info',
        `Document parsing completed in ${Date.now() - parseStart}ms`
      );

      const enqueueStart = Date.now();
      await appendDocumentLog(documentId, 'info', 'Queueing chunking job to Redis');
      await chunkQueue.add('chunk', {
        documentId,
        text,
      });
      await appendDocumentLog(
        documentId,
        'info',
        `Chunking task queued in Redis in ${Date.now() - enqueueStart}ms`
      );
      await appendDocumentLog(documentId, 'info', `Parse stage finished in ${Date.now() - jobStart}ms`);

      logger.info(`Document ${documentId} parsed successfully`);
    } catch (error: any) {
      logger.error(`Failed to parse document ${documentId}:`, error);
      await appendDocumentLog(documentId, 'error', `Parse failed: ${error.message}`);
      await documentService.updateDocumentStatus(documentId, 'failed', error.message);
      throw new UnrecoverableError(error.message);
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
