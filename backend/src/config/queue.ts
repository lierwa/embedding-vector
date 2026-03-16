import { Queue, QueueOptions } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

const queueOptions: QueueOptions = {
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
  DOCUMENT_PARSE: 'document:parse',
  DOCUMENT_CHUNK: 'document:chunk',
  EMBEDDING: 'embedding',
  INDEX: 'index',
  EVALUATION: 'evaluation',
};

export const parseQueue = new Queue(QUEUES.DOCUMENT_PARSE, queueOptions);
export const chunkQueue = new Queue(QUEUES.DOCUMENT_CHUNK, queueOptions);
export const embeddingQueue = new Queue(QUEUES.EMBEDDING, queueOptions);
export const indexQueue = new Queue(QUEUES.INDEX, queueOptions);
export const evaluationQueue = new Queue(QUEUES.EVALUATION, queueOptions);

export async function connectQueues() {
  console.log('✓ Queues initialized');
}
