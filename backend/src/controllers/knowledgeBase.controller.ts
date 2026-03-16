import { Request, Response } from 'express';
import { knowledgeBaseService } from '../services/knowledgeBase.service';

export const createKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const kb = await knowledgeBaseService.createKnowledgeBase(req.body);
    res.status(201).json(kb);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const kb = await knowledgeBaseService.getKnowledgeBase(req.params.id);
    res.json(kb);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const listKnowledgeBases = async (req: Request, res: Response) => {
  try {
    const kbs = await knowledgeBaseService.listKnowledgeBases();
    res.json(kbs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const kb = await knowledgeBaseService.updateKnowledgeBase(req.params.id, req.body);
    res.json(kb);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteKnowledgeBase = async (req: Request, res: Response) => {
  try {
    await knowledgeBaseService.deleteKnowledgeBase(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
