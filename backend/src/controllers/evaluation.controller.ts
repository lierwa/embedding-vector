import { Request, Response } from 'express';
import { evaluationService } from '../services/evaluation.service';
import { evaluationQueue } from '../config/queue';

export const createTestCase = async (req: Request, res: Response) => {
  try {
    const { query, expectedAnswer, expectedDocIds } = req.body;
    const kbId = req.params.id;

    const testCase = await evaluationService.createTestCase(kbId, query, expectedAnswer, expectedDocIds);
    res.status(201).json(testCase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTestCases = async (req: Request, res: Response) => {
  try {
    const testCases = await evaluationService.getTestCases(req.params.id);
    res.json(testCases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTestCase = async (req: Request, res: Response) => {
  try {
    await evaluationService.deleteTestCase(req.params.testCaseId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createEvaluation = async (req: Request, res: Response) => {
  try {
    const { name, topK = 5, useLLMEval = false } = req.body;
    const kbId = req.params.id;

    const evaluation = await evaluationService.createEvaluation(kbId, name, topK, useLLMEval);
    
    await evaluationQueue.add('evaluate', { evaluationId: evaluation.id });

    res.status(201).json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEvaluation = async (req: Request, res: Response) => {
  try {
    const evaluation = await evaluationService.getEvaluation(req.params.evalId);
    res.json(evaluation);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const getEvaluations = async (req: Request, res: Response) => {
  try {
    const evaluations = await evaluationService.getEvaluations(req.params.id);
    res.json(evaluations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
