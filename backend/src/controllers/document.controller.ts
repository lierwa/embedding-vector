import { Request, Response } from 'express';
import { documentService } from '../services/document.service';
import * as fs from 'fs';
import * as path from 'path';
import { UploadedFile } from 'express-fileupload';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file as UploadedFile;
    const kbId = req.params.id;

    const ext = path.extname(file.name).slice(1);
    const uploadDir = path.join(STORAGE_PATH, 'documents', kbId);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);

    await file.mv(filepath);

    const doc = await documentService.uploadDocument(kbId, file.name, filepath, ext);

    res.status(201).json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const docs = await documentService.getDocuments(req.params.id);
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDocument = async (req: Request, res: Response) => {
  try {
    const doc = await documentService.getDocument(req.params.docId);
    res.json(doc);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    await documentService.deleteDocument(req.params.docId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
