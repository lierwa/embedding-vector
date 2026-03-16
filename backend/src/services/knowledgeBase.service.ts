import { prisma } from '../config/database';
import { createCollection, deleteCollection, getCollectionName } from '../config/qdrant';
import { getEmbeddingDimension } from '../utils/openai.client';

export interface CreateKBDto {
  name: string;
  description?: string;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class KnowledgeBaseService {
  async createKnowledgeBase(data: CreateKBDto) {
    const kb = await prisma.knowledgeBase.create({
      data: {
        name: data.name,
        description: data.description,
        embeddingModel: data.embeddingModel || 'text-embedding-3-small',
        chunkSize: data.chunkSize || 500,
        chunkOverlap: data.chunkOverlap || 100,
      },
    });

    const dimension = getEmbeddingDimension(kb.embeddingModel);
    await createCollection(kb.id, dimension);

    return kb;
  }

  async getKnowledgeBase(id: string) {
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        documents: true,
        testCases: true,
        evaluations: true,
      },
    });

    if (!kb) {
      throw new Error('Knowledge base not found');
    }

    const stats = {
      documentCount: kb.documents.length,
      completedDocuments: kb.documents.filter((d) => d.status === 'completed').length,
      testCaseCount: kb.testCases.length,
      evaluationCount: kb.evaluations.length,
    };

    return { ...kb, stats };
  }

  async listKnowledgeBases() {
    return prisma.knowledgeBase.findMany({
      include: {
        documents: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateKnowledgeBase(id: string, data: Partial<CreateKBDto>) {
    return prisma.knowledgeBase.update({
      where: { id },
      data,
    });
  }

  async deleteKnowledgeBase(id: string) {
    await deleteCollection(id);
    await prisma.knowledgeBase.delete({
      where: { id },
    });
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
