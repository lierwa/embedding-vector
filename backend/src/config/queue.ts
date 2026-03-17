import { Queue, QueueOptions } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

const documentQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 1,
  },
};

const evaluationQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

export const QUEUES = {
  DOCUMENT_PARSE: 'document-parse',
  DOCUMENT_CHUNK: 'document-chunk',
  EMBEDDING: 'embedding',
  INDEX: 'index',
  EVALUATION: 'evaluation',
};

export const parseQueue = new Queue(QUEUES.DOCUMENT_PARSE, documentQueueOptions);
export const chunkQueue = new Queue(QUEUES.DOCUMENT_CHUNK, documentQueueOptions);
export const embeddingQueue = new Queue(QUEUES.EMBEDDING, documentQueueOptions);
export const indexQueue = new Queue(QUEUES.INDEX, documentQueueOptions);
export const evaluationQueue = new Queue(QUEUES.EVALUATION, evaluationQueueOptions);

export async function connectQueues() {
  console.log('✓ Queues initialized');
}
