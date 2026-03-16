import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export const qdrantClient = new QdrantClient({ url: QDRANT_URL });

export async function connectQdrant() {
  try {
    await qdrantClient.getCollections();
    console.log('✓ Qdrant connected');
  } catch (error) {
    console.error('✗ Qdrant connection failed:', error);
    process.exit(1);
  }
}

export async function createCollection(kbId: string, dimension: number) {
  const collectionName = `kb_${kbId}`;
  
  const collections = await qdrantClient.getCollections();
  const exists = collections.collections.some(c => c.name === collectionName);
  
  if (!exists) {
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: dimension,
        distance: 'Cosine',
      },
    });
  }
  
  return collectionName;
}

export async function deleteCollection(kbId: string) {
  const collectionName = `kb_${kbId}`;
  try {
    await qdrantClient.deleteCollection(collectionName);
  } catch (error) {
    console.error(`Failed to delete collection ${collectionName}:`, error);
  }
}

export function getCollectionName(kbId: string): string {
  return `kb_${kbId}`;
}
