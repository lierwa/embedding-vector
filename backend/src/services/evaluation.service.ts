import { prisma } from '../config/database';
import { retrievalService } from './retrieval.service';
import { evaluateWithLLM } from '../utils/openai.client';
import { logger } from '../utils/logger';

export class EvaluationService {
  async createTestCase(kbId: string, query: string, expectedAnswer?: string, expectedDocIds?: string[]) {
    return prisma.testCase.create({
      data: {
        knowledgeBaseId: kbId,
        query,
        expectedAnswer,
        expectedDocIds: expectedDocIds || [],
      },
    });
  }

  async getTestCases(kbId: string) {
    return prisma.testCase.findMany({
      where: { knowledgeBaseId: kbId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTestCase(id: string) {
    await prisma.testCase.delete({
      where: { id },
    });
  }

  async createEvaluation(kbId: string, name: string, topK: number, useLLMEval: boolean) {
    return prisma.evaluation.create({
      data: {
        knowledgeBaseId: kbId,
        name,
        topK,
        useLLMEval,
        status: 'pending',
      },
    });
  }

  async runEvaluation(evaluationId: string) {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { knowledgeBase: { include: { testCases: true } } },
    });

    if (!evaluation) {
      throw new Error('Evaluation not found');
    }

    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: 'running' },
    });

    const testCases = evaluation.knowledgeBase.testCases;

    let totalRecall = 0;
    let totalRetrievalScore = 0;
    let totalLLMScore = 0;
    let llmScoreCount = 0;

    for (const testCase of testCases) {
      try {
        const results = await retrievalService.search(
          evaluation.knowledgeBaseId,
          testCase.query,
          evaluation.topK
        );

        const retrievedDocIds = results.map((r) => r.document_id);
        const retrievedTexts = results.map((r) => r.text);
        const scores = results.map((r) => r.score);

        const recall = this.calculateRecall(retrievedDocIds, testCase.expectedDocIds);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        let llmScore: number | null = null;
        let llmFeedback: string | null = null;

        if (evaluation.useLLMEval && retrievedTexts.length > 0) {
          try {
            const llmResult = await evaluateWithLLM(testCase.query, retrievedTexts);
            llmScore = llmResult.score;
            llmFeedback = llmResult.feedback;
            totalLLMScore += llmScore;
            llmScoreCount++;
          } catch (error) {
            logger.error('LLM evaluation failed:', error);
          }
        }

        await prisma.evaluationResult.create({
          data: {
            evaluationId,
            testCaseId: testCase.id,
            query: testCase.query,
            retrievedChunks: results,
            retrievalScore: avgScore,
            recallScore: recall,
            llmScore,
            llmFeedback,
          },
        });

        totalRecall += recall;
        totalRetrievalScore += avgScore;
      } catch (error) {
        logger.error(`Failed to evaluate test case ${testCase.id}:`, error);
      }
    }

    const avgRecall = testCases.length > 0 ? totalRecall / testCases.length : 0;
    const avgRetrievalScore = testCases.length > 0 ? totalRetrievalScore / testCases.length : 0;
    const avgLLMScore = llmScoreCount > 0 ? totalLLMScore / llmScoreCount : null;

    await prisma.evaluationMetrics.create({
      data: {
        evaluationId,
        totalQueries: testCases.length,
        avgRecall,
        avgRetrievalScore,
        avgLLMScore,
      },
    });

    await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return evaluation;
  }

  async getEvaluation(id: string) {
    return prisma.evaluation.findUnique({
      where: { id },
      include: {
        results: true,
        metrics: true,
      },
    });
  }

  async getEvaluations(kbId: string) {
    return prisma.evaluation.findMany({
      where: { knowledgeBaseId: kbId },
      include: { metrics: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private calculateRecall(retrieved: string[], expected: string[]): number {
    if (expected.length === 0) return 1;

    const intersection = retrieved.filter((id) => expected.includes(id));
    return intersection.length / expected.length;
  }
}

export const evaluationService = new EvaluationService();
