import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from '../config/database';
import { connectQdrant } from '../config/qdrant';
import { parseWorker } from './parse.worker';
import { chunkWorker } from './chunk.worker';
import { embeddingWorker } from './embedding.worker';
import { indexWorker } from './index.worker';
import { evaluationWorker } from './evaluation.worker';
import { logger } from '../utils/logger';

async function startWorkers() {
  await connectDatabase();
  await connectQdrant();

  logger.info('All workers started');
  logger.info('- Parse worker');
  logger.info('- Chunk worker');
  logger.info('- Embedding worker');
  logger.info('- Index worker');
  logger.info('- Evaluation worker');
}

startWorkers().catch((error) => {
  logger.error('Failed to start workers:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers...');
  await parseWorker.close();
  await chunkWorker.close();
  await embeddingWorker.close();
  await indexWorker.close();
  await evaluationWorker.close();
  process.exit(0);
});
