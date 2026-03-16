import { prisma } from '../config/database';
import { parseQueue } from '../config/queue';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

export class DocumentService {
  async uploadDocument(kbId: string, filename: string, filepath: string, filetype: string) {
    const doc = await prisma.document.create({
      data: {
        knowledgeBaseId: kbId,
        filename,
        filepath,
        filetype,
        status: 'pending',
      },
    });

    await parseQueue.add('parse', { documentId: doc.id });

    return doc;
  }

  async getDocuments(kbId: string) {
    return prisma.document.findMany({
      where: { knowledgeBaseId: kbId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getDocument(id: string) {
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: true,
      },
    });

    if (!doc) {
      throw new Error('Document not found');
    }

    return doc;
  }

  async deleteDocument(id: string) {
    const doc = await prisma.document.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new Error('Document not found');
    }

    if (fs.existsSync(doc.filepath)) {
      fs.unlinkSync(doc.filepath);
    }

    await prisma.document.delete({
      where: { id },
    });
  }

  async updateDocumentStatus(
    id: string,
    status: string,
    errorMessage?: string,
    processedAt?: Date
  ) {
    return prisma.document.update({
      where: { id },
      data: {
        status,
        errorMessage,
        processedAt,
      },
    });
  }
}

export const documentService = new DocumentService();
