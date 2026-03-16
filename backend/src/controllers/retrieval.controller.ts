import { Request, Response } from 'express';
import { retrievalService } from '../services/retrieval.service';

export const search = async (req: Request, res: Response) => {
  try {
    const { query, topK = 5 } = req.body;
    const kbId = req.params.id;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await retrievalService.search(kbId, query, topK);
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
