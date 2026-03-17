import OpenAI from 'openai';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const OLLAMA_REQUEST_TIMEOUT_MS = parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS || '300000', 10);
const OLLAMA_BATCH_SIZE = parseInt(process.env.OLLAMA_BATCH_SIZE || '8', 10);
let activeOllamaBaseUrl: string | null = null;

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface EmbedProgressReporter {
  onLog?: (level: 'info' | 'error', message: string) => void | Promise<void>;
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
}

function isOllamaEmbeddingModel(model: string): boolean {
  return model === 'ollama-nomic-embed-text' || model === 'ollama-bge-small' || model.startsWith('ollama:');
}

function getOllamaModelName(model: string): string {
  if (model === 'ollama-nomic-embed-text' || model === 'ollama-bge-small') {
    return OLLAMA_EMBED_MODEL;
  }
  return model.replace(/^ollama:/, '') || OLLAMA_EMBED_MODEL;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function getOllamaBaseUrls(): string[] {
  const configuredUrls = OLLAMA_BASE_URL
    .split(',')
    .map(normalizeBaseUrl)
    .filter(Boolean);

  const urls = [...new Set([
    ...configuredUrls,
    'http://host.docker.internal:11434',
  ])];

  const rank = (url: string) => {
    if (url.includes('://localhost') || url.includes('://127.0.0.1')) {
      return 2;
    }
    return 0;
  };

  return urls.sort((a, b) => rank(a) - rank(b));
}

async function requestOllamaEmbeddings(baseUrl: string, texts: string[], ollamaModel: string) {
  return fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      input: texts,
    }),
    signal: AbortSignal.timeout(OLLAMA_REQUEST_TIMEOUT_MS),
  });
}

async function batchEmbedWithOpenAI(
  texts: string[],
  model: string = 'text-embedding-3-small',
  batchSize: number = 100
): Promise<EmbeddingResult> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  for (const batch of batches) {
    logger.info(`Embedding batch of ${batch.length} texts with OpenAI model ${model}`);
    const response = await openai.embeddings.create({
      model,
      input: batch,
    });

    allEmbeddings.push(...response.data.map((d) => d.embedding));
    totalTokens += response.usage.total_tokens;
  }

  return {
    embeddings: allEmbeddings,
    model,
    usage: {
      prompt_tokens: totalTokens,
      total_tokens: totalTokens,
    },
  };
}

async function batchEmbedWithOllama(
  texts: string[],
  model: string,
  batchSize: number = OLLAMA_BATCH_SIZE,
  progress?: EmbedProgressReporter
): Promise<EmbeddingResult> {
  const ollamaModel = getOllamaModelName(model);
  const candidateUrls = getOllamaBaseUrls();
  const finalBatchSize = Math.max(1, batchSize);
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += finalBatchSize) {
    batches.push(texts.slice(i, i + finalBatchSize));
  }
  const allEmbeddings: number[][] = [];
  let processed = 0;

  logger.info(
    `Embedding ${texts.length} texts with Ollama model ${ollamaModel}, candidates=${candidateUrls.join(',')}, batchSize=${finalBatchSize}`
  );
  await progress?.onLog?.('info', `Embedding ${texts.length} chunks in ${batches.length} batches`);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const recoverableErrorTokens = [
    '(TimeoutError)',
    '(UND_ERR_SOCKET)',
    '(UND_ERR_HEADERS_TIMEOUT)',
    '(ECONNRESET)',
    '(ETIMEDOUT)',
  ];

  const embedBatch = async (batch: string[], label: string, retryCount: number = 0): Promise<number[][]> => {
    const urlsForThisBatch = activeOllamaBaseUrl
      ? [activeOllamaBaseUrl, ...candidateUrls.filter((url) => url !== activeOllamaBaseUrl)]
      : candidateUrls;
    const attemptErrors: string[] = [];

    for (const baseUrl of urlsForThisBatch) {
      try {
        await progress?.onLog?.('info', `Batch ${label}: trying Ollama endpoint ${baseUrl}`);
        const response = await requestOllamaEmbeddings(baseUrl, batch, ollamaModel);
        if (!response.ok) {
          attemptErrors.push(`${baseUrl} (HTTP ${response.status})`);
          await progress?.onLog?.(
            'error',
            `Batch ${label}: endpoint ${baseUrl} returned HTTP ${response.status}`
          );
          continue;
        }

        const data = (await response.json()) as OllamaEmbedResponse;
        if (!Array.isArray(data.embeddings)) {
          attemptErrors.push(`${baseUrl} (INVALID_RESPONSE)`);
          await progress?.onLog?.('error', `Batch ${label}: endpoint ${baseUrl} returned invalid embeddings`);
          continue;
        }

        activeOllamaBaseUrl = baseUrl;
        await progress?.onLog?.('info', `Batch ${label}: connected Ollama endpoint ${baseUrl}`);
        return data.embeddings;
      } catch (error: any) {
        const errorCode = error?.cause?.code || error?.name || 'UNKNOWN_ERROR';
        attemptErrors.push(`${baseUrl} (${errorCode})`);
        await progress?.onLog?.('error', `Batch ${label}: endpoint ${baseUrl} failed ${errorCode}`);
      }
    }

    const recoverableOnly = attemptErrors.length > 0 &&
      attemptErrors.every((err) => recoverableErrorTokens.some((token) => err.includes(token)));
    if (recoverableOnly && batch.length > 1) {
      const leftSize = Math.ceil(batch.length / 2);
      const rightSize = batch.length - leftSize;
      await progress?.onLog?.('info', `Batch ${label}: recoverable failure, split into ${leftSize}+${rightSize}`);
      const left = await embedBatch(batch.slice(0, leftSize), `${label}.1`);
      const right = await embedBatch(batch.slice(leftSize), `${label}.2`);
      return [...left, ...right];
    }
    if (recoverableOnly && batch.length === 1 && retryCount < 2) {
      await progress?.onLog?.('info', `Batch ${label}: recoverable failure, retry ${retryCount + 1}/2`);
      await sleep(1000 * (retryCount + 1));
      return embedBatch(batch, label, retryCount + 1);
    }

    throw new Error(`Ollama connection failed for all endpoints: ${attemptErrors.join(', ') || urlsForThisBatch.join(', ')}`);
  };

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchEmbeddings = await embedBatch(batch, `${batchIndex + 1}/${batches.length}`);
    allEmbeddings.push(...batchEmbeddings);
    processed += batch.length;
    await progress?.onLog?.('info', `Embedding progress: ${processed}/${texts.length} chunks`);
  }

  return {
    embeddings: allEmbeddings,
    model,
    usage: {
      prompt_tokens: 0,
      total_tokens: 0,
    },
  };
}

export async function batchEmbed(
  texts: string[],
  model: string = 'text-embedding-3-small',
  batchSize: number = 100,
  progress?: EmbedProgressReporter
): Promise<EmbeddingResult> {
  if (isOllamaEmbeddingModel(model)) {
    return batchEmbedWithOllama(texts, model, Math.min(batchSize, OLLAMA_BATCH_SIZE), progress);
  }
  return batchEmbedWithOpenAI(texts, model, batchSize);
}

export async function embedSingle(
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  if (isOllamaEmbeddingModel(model)) {
    const result = await batchEmbedWithOllama([text], model, 1);
    if (!result.embeddings[0]) {
      throw new Error('Ollama embed response does not contain vector');
    }
    return result.embeddings[0];
  }

  const response = await openai.embeddings.create({
    model,
    input: text,
  });

  return response.data[0].embedding;
}

export async function evaluateWithLLM(
  query: string,
  chunks: string[]
): Promise<{ score: number; feedback: string }> {
  const prompt = `You are an expert evaluator. Given a query and retrieved context chunks, evaluate the relevance of the context to answer the query.

Query: ${query}

Retrieved Context:
${chunks.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}

Rate the relevance on a scale of 0-10:
- 0: Completely irrelevant
- 5: Partially relevant
- 10: Highly relevant and sufficient to answer

Output format:
Score: [0-10]
Feedback: [brief explanation]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });

  const text = response.choices[0].message.content || '';
  const scoreMatch = text.match(/Score:\s*(\d+)/);
  const feedbackMatch = text.match(/Feedback:\s*(.+)/s);

  return {
    score: parseInt(scoreMatch?.[1] || '0'),
    feedback: feedbackMatch?.[1]?.trim() || '',
  };
}

export function getEmbeddingDimension(model: string): number {
  switch (model) {
    case 'text-embedding-3-small':
      return 1536;
    case 'text-embedding-3-large':
      return 3072;
    case 'ollama-nomic-embed-text':
    case 'ollama:nomic-embed-text':
      return 768;
    case 'ollama-bge-small':
      return 768;
    default:
      if (model.startsWith('ollama:')) {
        return 768;
      }
      return 1536;
  }
}
