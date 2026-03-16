import OpenAI from 'openai';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function batchEmbed(
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
    logger.info(`Embedding batch of ${batch.length} texts`);
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

export async function embedSingle(
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
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
    default:
      return 1536;
  }
}
