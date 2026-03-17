import { Request, Response } from 'express';
import { documentService } from '../services/document.service';
import * as fs from 'fs';
import * as path from 'path';
import { UploadedFile } from 'express-fileupload';
import { appendDocumentLog, readDocumentLogs } from '../utils/document-log';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const SUPPORTED_FILE_TYPES = ['pdf', 'docx', 'doc', 'html', 'htm', 'json', 'txt', 'md', 'markdown'];

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file as UploadedFile;
    const kbId = req.params.id;

    const ext = path.extname(file.name).slice(1).toLowerCase();
    if (!SUPPORTED_FILE_TYPES.includes(ext)) {
      return res.status(400).json({
        error: `Unsupported file type: .${ext}`,
        supportedFileTypes: SUPPORTED_FILE_TYPES,
      });
    }
    const uploadDir = path.join(STORAGE_PATH, 'documents', kbId);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}_${file.name}`;
    const filepath = path.join(uploadDir, filename);

    await file.mv(filepath);

    const doc = await documentService.uploadDocument(kbId, file.name, filepath, ext);
    await appendDocumentLog(doc.id, 'info', `Uploaded file ${file.name}`);

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

export const getDocumentLogs = async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '200', 10);
    const logs = await readDocumentLogs(req.params.docId, Number.isNaN(limit) ? 200 : limit);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
