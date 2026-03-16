import { Worker } from 'bullmq';
import { evaluationService } from '../services/evaluation.service';
import { QUEUES } from '../config/queue';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379'),
};

export const evaluationWorker = new Worker(
  QUEUES.EVALUATION,
  async (job) => {
    const { evaluationId } = job.data;

    try {
      logger.info(`Running evaluation ${evaluationId}`);
      await evaluationService.runEvaluation(evaluationId);
      logger.info(`Evaluation ${evaluationId} completed`);
    } catch (error: any) {
      logger.error(`Failed to run evaluation ${evaluationId}:`, error);
      throw error;
    }
  },
  { connection }
);

evaluationWorker.on('completed', (job) => {
  logger.info(`Evaluation job ${job.id} completed`);
});

evaluationWorker.on('failed', (job, err) => {
  logger.error(`Evaluation job ${job?.id} failed:`, err);
});
