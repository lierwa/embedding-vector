# RAG Knowledge Platform - 详细架构与实现方案

基于 Node.js + TypeScript + PostgreSQL + Qdrant + BullMQ + React 构建的本地单用户 RAG 知识库管理和向量质量评估平台。

---

## 技术栈确认

### Backend
- **Runtime**: Node.js 18+ + TypeScript
- **Framework**: Express.js
- **数据库**: PostgreSQL (元数据) + Qdrant (向量)
- **队列**: Redis + BullMQ
- **ORM**: Prisma
- **文件解析**: pdf-parse, mammoth, cheerio
- **Embedding**: OpenAI API (text-embedding-3-small/large)

### Frontend
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Material-UI (MUI) v5
- **状态管理**: Zustand (轻量级) 或 React Query
- **HTTP客户端**: Axios
- **图表**: Recharts

### Infrastructure
- **容器化**: Docker + Docker Compose
- **服务**: Backend API, Frontend, PostgreSQL, Redis, Qdrant

---

## 系统架构详细设计

### 整体架构图

```
┌──────────────────────────────────────────────────────────┐
│                     Frontend (React)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐   │
│  │ KB Manager  │ │ Playground  │ │ Evaluation       │   │
│  └─────────────┘ └─────────────┘ └──────────────────┘   │
└────────────────────────┬─────────────────────────────────┘
                         │ REST API
┌────────────────────────▼─────────────────────────────────┐
│                  Backend (Express + TS)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │   Routes     │ │  Services    │ │   Controllers    │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
│                                                           │
│  Services:                                                │
│  • KnowledgeBaseService                                   │
│  • DocumentService                                        │
│  • IngestionService                                       │
│  • RetrievalService                                       │
│  • EvaluationService                                      │
└───────┬──────────────────┬──────────────────┬────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ PostgreSQL   │   │  BullMQ      │   │   Qdrant     │
│ (Metadata)   │   │  + Redis     │   │  (Vectors)   │
└──────────────┘   └──────┬───────┘   └──────────────┘
                          │
                    ┌─────▼─────┐
                    │  Workers  │
                    │  • Parse  │
                    │  • Embed  │
                    │  • Index  │
                    └───────────┘
```

---

## 数据库设计

### PostgreSQL Schema (Prisma)

```prisma
// schema.prisma

model KnowledgeBase {
  id              String    @id @default(uuid())
  name            String
  description     String?
  embeddingModel  String    @default("text-embedding-3-small")
  chunkSize       Int       @default(500)
  chunkOverlap    Int       @default(100)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  documents       Document[]
  testCases       TestCase[]
  evaluations     Evaluation[]
}

model Document {
  id              String    @id @default(uuid())
  knowledgeBaseId String
  filename        String
  filetype        String
  filepath        String
  status          String    @default("pending") // pending, processing, completed, failed
  errorMessage    String?
  uploadedAt      DateTime  @default(now())
  processedAt     DateTime?
  
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  chunks          Chunk[]
}

model Chunk {
  id              String    @id @default(uuid())
  documentId      String
  knowledgeBaseId String
  text            String    @db.Text
  tokenCount      Int
  chunkIndex      Int
  createdAt       DateTime  @default(now())
  
  document        Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model TestCase {
  id              String    @id @default(uuid())
  knowledgeBaseId String
  query           String    @db.Text
  expectedAnswer  String?   @db.Text
  expectedDocIds  String[]
  createdAt       DateTime  @default(now())
  
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  results         EvaluationResult[]
}

model Evaluation {
  id              String    @id @default(uuid())
  knowledgeBaseId String
  name            String
  status          String    @default("pending") // pending, running, completed, failed
  topK            Int       @default(5)
  useLLMEval      Boolean   @default(false)
  createdAt       DateTime  @default(now())
  completedAt     DateTime?
  
  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  results         EvaluationResult[]
  metrics         EvaluationMetrics?
}

model EvaluationResult {
  id              String    @id @default(uuid())
  evaluationId    String
  testCaseId      String
  query           String    @db.Text
  retrievedChunks Json      // 存储检索到的chunks
  retrievalScore  Float?    // 余弦相似度平均分
  recallScore     Float?    // 召回率
  llmScore        Float?    // LLM评估分数
  llmFeedback     String?   @db.Text
  createdAt       DateTime  @default(now())
  
  evaluation      Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  testCase        TestCase   @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
}

model EvaluationMetrics {
  id              String    @id @default(uuid())
  evaluationId    String    @unique
  totalQueries    Int
  avgRecall       Float
  avgRetrievalScore Float
  avgLLMScore     Float?
  createdAt       DateTime  @default(now())
  
  evaluation      Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
}
```

### Qdrant Collection Schema

每个 KnowledgeBase 对应一个 Collection:

```typescript
// Collection name: kb_{knowledgeBaseId}

interface VectorPayload {
  chunk_id: string;
  document_id: string;
  kb_id: string;
  text: string;
  token_count: number;
  chunk_index: number;
}

// Vector dimension: 
// - text-embedding-3-small: 1536
// - text-embedding-3-large: 3072
```

---

## 后端模块设计

### 1. Knowledge Base Service

```typescript
// src/services/knowledgeBase.service.ts

export class KnowledgeBaseService {
  async createKnowledgeBase(data: CreateKBDto): Promise<KnowledgeBase> {
    // 1. 在 PostgreSQL 创建记录
    // 2. 在 Qdrant 创建 collection
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    // 1. 删除 Qdrant collection
    // 2. 删除 PostgreSQL 记录（cascade）
  }

  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    // 返回所有知识库
  }

  async getKnowledgeBase(id: string): Promise<KnowledgeBase> {
    // 返回单个知识库及统计信息
  }
}
```

### 2. Document Service

```typescript
// src/services/document.service.ts

export class DocumentService {
  async uploadDocument(
    kbId: string,
    file: Express.Multer.File
  ): Promise<Document> {
    // 1. 保存文件到 /storage/documents
    // 2. 创建 Document 记录
    // 3. 发送到 parse queue
  }

  async getDocuments(kbId: string): Promise<Document[]> {
    // 返回知识库下的所有文档
  }

  async deleteDocument(id: string): Promise<void> {
    // 1. 从文件系统删除
    // 2. 从 Qdrant 删除对应 vectors
    // 3. 从 PostgreSQL 删除（cascade chunks）
  }
}
```

### 3. Ingestion Service

```typescript
// src/services/ingestion.service.ts

export class IngestionService {
  async parseDocument(docId: string): Promise<void> {
    // 根据文件类型解析
    // - PDF: pdf-parse
    // - DOCX: mammoth
    // - HTML: cheerio
    // - JSON/TXT: 原生
  }

  async chunkText(
    text: string,
    chunkSize: number,
    overlap: number
  ): Promise<string[]> {
    // 按 token 分块（使用 tiktoken）
  }

  async embedChunks(chunks: string[], model: string): Promise<number[][]> {
    // 调用 OpenAI Embedding API
    // 批量处理（每批 100 chunks）
  }

  async indexToQdrant(
    kbId: string,
    chunks: ChunkData[]
  ): Promise<void> {
    // 批量写入 Qdrant
  }
}
```

### 4. Retrieval Service

```typescript
// src/services/retrieval.service.ts

export class RetrievalService {
  async search(
    kbId: string,
    query: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    // 1. Embed query
    // 2. Qdrant vector search
    // 3. 补充 chunk metadata
    return results;
  }
}

interface SearchResult {
  score: number;
  chunk_id: string;
  text: string;
  document_id: string;
  filename: string;
}
```

### 5. Evaluation Service

```typescript
// src/services/evaluation.service.ts

export class EvaluationService {
  async runEvaluation(
    evaluationId: string
  ): Promise<void> {
    // 1. 获取所有 test cases
    // 2. 对每个 test case:
    //    - 执行检索
    //    - 计算基础指标（recall, 相似度）
    //    - 可选：LLM 评估
    // 3. 汇总结果
    // 4. 生成报告
  }

  async evaluateWithLLM(
    query: string,
    retrievedChunks: string[]
  ): Promise<{ score: number; feedback: string }> {
    // 使用 GPT-4 评估相关性
  }

  private calculateRecall(
    retrieved: string[],
    expected: string[]
  ): number {
    // 计算召回率
  }
}
```

---

## BullMQ 队列设计

### Queue Definitions

```typescript
// src/queue/queues.ts

export const QUEUES = {
  DOCUMENT_PARSE: 'document:parse',
  DOCUMENT_CHUNK: 'document:chunk',
  EMBEDDING: 'embedding',
  INDEX: 'index',
  EVALUATION: 'evaluation'
};
```

### Job Flow

```
uploadDocument
    │
    ▼
[DOCUMENT_PARSE] → parse file
    │
    ▼
[DOCUMENT_CHUNK] → chunk text
    │
    ▼
[EMBEDDING] → embed chunks (batched)
    │
    ▼
[INDEX] → upsert to Qdrant
    │
    ▼
Update document status: completed
```

### Worker Implementation

```typescript
// src/workers/parse.worker.ts

parseQueue.process(async (job) => {
  const { documentId } = job.data;
  
  // 1. Parse document
  const text = await parseDocument(documentId);
  
  // 2. Enqueue chunk job
  await chunkQueue.add({ documentId, text });
});

// src/workers/chunk.worker.ts

chunkQueue.process(async (job) => {
  const { documentId, text } = job.data;
  
  // 1. Chunk text
  const chunks = await chunkText(text);
  
  // 2. Save chunks to DB
  await saveChunks(documentId, chunks);
  
  // 3. Enqueue embedding job
  await embeddingQueue.add({ documentId, chunks });
});

// src/workers/embedding.worker.ts

embeddingQueue.process(async (job) => {
  const { documentId, chunks } = job.data;
  
  // 1. Batch embed
  const vectors = await embedChunks(chunks);
  
  // 2. Enqueue index job
  await indexQueue.add({ documentId, chunks, vectors });
});

// src/workers/index.worker.ts

indexQueue.process(async (job) => {
  const { documentId, chunks, vectors } = job.data;
  
  // 1. Upsert to Qdrant
  await qdrantClient.upsert(collectionName, {
    points: chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i],
      payload: { /* ... */ }
    }))
  });
  
  // 2. Update document status
  await updateDocumentStatus(documentId, 'completed');
});
```

---

## API 设计

### REST API Endpoints

#### Knowledge Base

```
POST   /api/kb                    创建知识库
GET    /api/kb                    列出所有知识库
GET    /api/kb/:id                获取单个知识库
PUT    /api/kb/:id                更新知识库
DELETE /api/kb/:id                删除知识库
GET    /api/kb/:id/stats          获取统计信息
```

#### Documents

```
POST   /api/kb/:id/documents      上传文档
GET    /api/kb/:id/documents      列出文档
GET    /api/documents/:id         获取文档详情
DELETE /api/documents/:id         删除文档
GET    /api/documents/:id/chunks  获取文档的chunks
```

#### Retrieval

```
POST   /api/kb/:id/search         检索查询
```

Request:
```json
{
  "query": "什么是向量数据库？",
  "topK": 5
}
```

Response:
```json
{
  "results": [
    {
      "score": 0.91,
      "chunk_id": "xxx",
      "text": "...",
      "document_id": "yyy",
      "filename": "intro.pdf"
    }
  ]
}
```

#### Evaluation

```
POST   /api/kb/:id/test-cases     创建测试用例
GET    /api/kb/:id/test-cases     列出测试用例
PUT    /api/test-cases/:id        更新测试用例
DELETE /api/test-cases/:id        删除测试用例

POST   /api/kb/:id/evaluations    创建评估任务
GET    /api/kb/:id/evaluations    列出评估历史
GET    /api/evaluations/:id       获取评估详情
GET    /api/evaluations/:id/results 获取评估结果
```

---

## 前端设计

### 页面结构

```
/                           Dashboard
/kb/new                     创建知识库
/kb/:id                     知识库详情
  /kb/:id/documents         文档管理
  /kb/:id/playground        检索测试
  /kb/:id/test-cases        测试用例管理
  /kb/:id/evaluations       评估历史
  /kb/:id/evaluation/:evalId 评估结果详情
```

### 核心组件

#### 1. Dashboard

```tsx
// src/pages/Dashboard.tsx

功能：
- 显示所有知识库卡片
- 创建新知识库按钮
- 每个卡片显示：
  - 名称、描述
  - 文档数、chunk数
  - 最后更新时间
```

#### 2. Knowledge Base Detail

```tsx
// src/pages/KnowledgeBase/Detail.tsx

Tabs:
- Documents (文档管理)
- Playground (检索测试)
- Test Cases (测试用例)
- Evaluations (评估)
```

#### 3. Document Manager

```tsx
// src/components/DocumentManager.tsx

功能：
- 文件上传（拖拽上传）
- 文档列表（Table）
- 状态显示：pending / processing / completed / failed
- 进度条（如果正在处理）
- 删除文档
```

#### 4. Playground

```tsx
// src/components/Playground.tsx

功能：
- Query 输入框
- TopK 选择器
- 搜索按钮
- 结果展示：
  - 相似度分数
  - Chunk 文本（高亮关键词）
  - 来源文档
  - Chunk index
```

#### 5. Test Case Manager

```tsx
// src/components/TestCaseManager.tsx

功能：
- 创建/编辑测试用例
- 批量导入（CSV/JSON）
- 测试用例列表
- 字段：
  - Query
  - Expected Answer (可选)
  - Expected Documents (可选)
```

#### 6. Evaluation Runner

```tsx
// src/components/EvaluationRunner.tsx

功能：
- 配置评估参数：
  - TopK
  - 是否使用 LLM 评估
- 启动评估
- 实时进度显示
- 结果跳转
```

#### 7. Evaluation Results

```tsx
// src/pages/Evaluation/Results.tsx

功能：
- 总体指标卡片：
  - Total Queries
  - Avg Recall
  - Avg Retrieval Score
  - Avg LLM Score
- 详细结果表格：
  - Query
  - Retrieved Chunks
  - Scores
  - LLM Feedback
- 图表（Recharts）：
  - 分数分布
  - 时间趋势
```

### UI 组件库使用

```tsx
// Material-UI Components

- Card, CardContent, CardActions
- Table, TableBody, TableCell, TableHead, TableRow
- Button, IconButton
- TextField, Select, Slider
- Dialog, DialogTitle, DialogContent, DialogActions
- Tabs, Tab, TabPanel
- Chip (用于状态标签)
- LinearProgress (用于进度条)
- Snackbar (用于通知)
```

---

## Docker Compose 配置

```yaml
# docker-compose.yml

version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: raguser
      POSTGRES_PASSWORD: ragpass
      POSTGRES_DB: ragdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://raguser:ragpass@postgres:5432/ragdb
      REDIS_URL: redis://redis:6379
      QDRANT_URL: http://qdrant:6333
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    volumes:
      - ./storage:/app/storage
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
      - qdrant

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker
    environment:
      DATABASE_URL: postgresql://raguser:ragpass@postgres:5432/ragdb
      REDIS_URL: redis://redis:6379
      QDRANT_URL: http://qdrant:6333
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    volumes:
      - ./storage:/app/storage
    depends_on:
      - postgres
      - redis
      - qdrant

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
  qdrant_data:
```

---

## 项目目录结构

```
rag-knowledge-platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── qdrant.ts
│   │   │   └── queue.ts
│   │   ├── controllers/
│   │   │   ├── knowledgeBase.controller.ts
│   │   │   ├── document.controller.ts
│   │   │   ├── retrieval.controller.ts
│   │   │   └── evaluation.controller.ts
│   │   ├── services/
│   │   │   ├── knowledgeBase.service.ts
│   │   │   ├── document.service.ts
│   │   │   ├── ingestion.service.ts
│   │   │   ├── retrieval.service.ts
│   │   │   └── evaluation.service.ts
│   │   ├── workers/
│   │   │   ├── parse.worker.ts
│   │   │   ├── chunk.worker.ts
│   │   │   ├── embedding.worker.ts
│   │   │   └── index.worker.ts
│   │   ├── utils/
│   │   │   ├── parsers/
│   │   │   │   ├── pdf.parser.ts
│   │   │   │   ├── docx.parser.ts
│   │   │   │   ├── html.parser.ts
│   │   │   │   └── json.parser.ts
│   │   │   ├── chunker.ts
│   │   │   └── openai.client.ts
│   │   ├── routes/
│   │   │   └── index.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts
│   │   │   └── upload.ts
│   │   └── app.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── KnowledgeBaseCard.tsx
│   │   │   ├── DocumentManager.tsx
│   │   │   ├── Playground.tsx
│   │   │   ├── TestCaseManager.tsx
│   │   │   ├── EvaluationRunner.tsx
│   │   │   └── Layout.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── KnowledgeBase/
│   │   │   │   ├── Detail.tsx
│   │   │   │   └── Create.tsx
│   │   │   └── Evaluation/
│   │   │       └── Results.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── stores/
│   │   │   └── knowledgeBase.store.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── storage/
│   └── documents/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 核心实现细节

### 1. Chunk Strategy (分块策略)

```typescript
// src/utils/chunker.ts

import { encoding_for_model } from 'tiktoken';

export class TextChunker {
  private encoder;

  constructor(model: string = 'gpt-3.5-turbo') {
    this.encoder = encoding_for_model(model);
  }

  chunk(text: string, chunkSize: number, overlap: number): string[] {
    const tokens = this.encoder.encode(text);
    const chunks: string[] = [];
    
    let start = 0;
    while (start < tokens.length) {
      const end = Math.min(start + chunkSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      const chunkText = this.encoder.decode(chunkTokens);
      chunks.push(chunkText);
      
      start += chunkSize - overlap;
    }
    
    return chunks;
  }
}
```

### 2. Batch Embedding

```typescript
// src/utils/openai.client.ts

export class OpenAIClient {
  async batchEmbed(
    texts: string[],
    model: string,
    batchSize: number = 100
  ): Promise<number[][]> {
    const batches = chunk(texts, batchSize);
    const allEmbeddings: number[][] = [];
    
    for (const batch of batches) {
      const response = await openai.embeddings.create({
        model,
        input: batch
      });
      
      allEmbeddings.push(...response.data.map(d => d.embedding));
    }
    
    return allEmbeddings;
  }
}
```

### 3. Qdrant Collection Management

```typescript
// src/config/qdrant.ts

export class QdrantManager {
  async createCollection(kbId: string, dimension: number) {
    await this.client.createCollection(
      `kb_${kbId}`,
      {
        vectors: {
          size: dimension,
          distance: 'Cosine'
        }
      }
    );
  }

  async upsertPoints(kbId: string, points: PointStruct[]) {
    await this.client.upsert(
      `kb_${kbId}`,
      { points }
    );
  }

  async search(kbId: string, vector: number[], limit: number) {
    return await this.client.search(
      `kb_${kbId}`,
      {
        vector,
        limit,
        with_payload: true
      }
    );
  }
}
```

### 4. Evaluation Metrics

#### 基础指标（无需 LLM）

```typescript
// src/services/evaluation.service.ts

// 1. Recall@K
calculateRecall(retrievedDocIds: string[], expectedDocIds: string[]): number {
  const intersection = retrievedDocIds.filter(id => 
    expectedDocIds.includes(id)
  );
  return intersection.length / expectedDocIds.length;
}

// 2. MRR (Mean Reciprocal Rank)
calculateMRR(retrievedDocIds: string[], expectedDocIds: string[]): number {
  for (let i = 0; i < retrievedDocIds.length; i++) {
    if (expectedDocIds.includes(retrievedDocIds[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// 3. Average Retrieval Score (平均相似度)
calculateAvgScore(scores: number[]): number {
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
```

#### LLM 评估（可选）

```typescript
// LLM Prompt for Context Relevance

const RELEVANCE_PROMPT = `
You are an expert evaluator. Given a query and retrieved context chunks, 
evaluate the relevance of the context to answer the query.

Query: {query}

Retrieved Context:
{chunks}

Rate the relevance on a scale of 0-10:
- 0: Completely irrelevant
- 5: Partially relevant
- 10: Highly relevant and sufficient to answer

Output format:
Score: [0-10]
Feedback: [brief explanation]
`;

async evaluateWithLLM(query: string, chunks: string[]): Promise<LLMEvalResult> {
  const prompt = RELEVANCE_PROMPT
    .replace('{query}', query)
    .replace('{chunks}', chunks.join('\n\n'));
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0
  });
  
  // Parse response
  const text = response.choices[0].message.content;
  const scoreMatch = text.match(/Score: (\d+)/);
  const feedbackMatch = text.match(/Feedback: (.+)/);
  
  return {
    score: parseInt(scoreMatch?.[1] || '0'),
    feedback: feedbackMatch?.[1] || ''
  };
}
```

---

## 实施路线图

### Phase 1: 基础设施 (Week 1)

- [ ] 项目初始化
- [ ] Docker Compose 配置
- [ ] PostgreSQL + Prisma 设置
- [ ] Qdrant 连接
- [ ] Redis + BullMQ 配置
- [ ] 基础 API 框架

### Phase 2: 知识库管理 (Week 2)

- [ ] Knowledge Base CRUD
- [ ] Qdrant Collection 管理
- [ ] 前端 Dashboard
- [ ] 创建/删除知识库 UI

### Phase 3: 文档摄入 (Week 3-4)

- [ ] 文件上传 API
- [ ] 文档解析器（PDF, DOCX, HTML, JSON, TXT）
- [ ] Chunker 实现
- [ ] BullMQ Workers
- [ ] Embedding 集成
- [ ] Qdrant 索引
- [ ] 前端文档管理 UI
- [ ] 实时状态更新（WebSocket 或轮询）

### Phase 4: 检索功能 (Week 5)

- [ ] 检索 Service
- [ ] 检索 API
- [ ] Playground UI
- [ ] 结果展示优化

### Phase 5: 评估系统 - 基础 (Week 6)

- [ ] Test Case CRUD
- [ ] 基础评估指标（Recall, MRR, Avg Score）
- [ ] 评估任务队列
- [ ] 前端测试用例管理
- [ ] 评估启动 UI

### Phase 6: 评估系统 - LLM (Week 7)

- [ ] LLM 评估集成
- [ ] 评估结果存储
- [ ] 评估报告生成
- [ ] 前端结果展示
- [ ] 图表可视化

### Phase 7: 优化与测试 (Week 8)

- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 单元测试
- [ ] 集成测试
- [ ] 文档完善

---

## 关键技术决策说明

### 1. 为什么选择 PostgreSQL？

- 成熟的关系型数据库
- Prisma ORM 支持良好
- 适合存储结构化元数据
- 事务支持

### 2. 为什么选择 BullMQ？

- 可靠的任务队列
- 支持重试、优先级
- Dashboard 监控
- TypeScript 友好

### 3. 为什么选择 Qdrant？

- 专业的向量数据库
- 高性能
- 支持 payload 过滤
- Docker 部署简单
- REST API 友好

### 4. 混合评估方案的优势

- 基础指标快速、免费
- LLM 评估可选、准确
- 用户可以根据需求选择
- 降低成本

### 5. 为什么使用 Vite？

- 极快的冷启动
- HMR 体验好
- TypeScript 原生支持
- 现代化构建工具

---

## 环境变量配置

```env
# .env.example

# Database
DATABASE_URL=postgresql://raguser:ragpass@localhost:5432/ragdb

# Redis
REDIS_URL=redis://localhost:6379

# Qdrant
QDRANT_URL=http://localhost:6333

# OpenAI
OPENAI_API_KEY=sk-xxx

# Server
PORT=3001
NODE_ENV=development

# Storage
STORAGE_PATH=./storage

# Frontend
VITE_API_URL=http://localhost:3001
```

---

## 性能考虑

### 1. Embedding 批处理

- 每批最多 100 个 chunks
- 避免 OpenAI rate limit
- 并发控制

### 2. Qdrant 批量写入

- 批量 upsert（100-500 points）
- 减少网络往返

### 3. 前端优化

- React Query 缓存
- 虚拟滚动（大列表）
- Lazy loading

### 4. 任务队列优化

- 并发限制
- 优先级队列
- 失败重试

---

## 监控与日志

### 1. BullMQ Dashboard

```
http://localhost:3001/admin/queues
```

### 2. 日志方案

- Winston 日志库
- 分级日志（info, warn, error）
- 文件 + Console 输出

### 3. 错误追踪

- 所有 API 错误统一处理
- Worker 错误记录到 Job
- 前端 Error Boundary

---

## 测试策略

### 1. 单元测试

- Services 层
- Utils 层（chunker, parsers）
- Jest + TypeScript

### 2. 集成测试

- API 端点
- Worker 流程
- Supertest

### 3. E2E 测试（可选）

- Playwright
- 关键用户流程

---

## 后续扩展方向

### 1. Hybrid Search

- BM25 + Vector
- Reciprocal Rank Fusion

### 2. Reranker

- Cross-encoder 重排序
- bge-reranker

### 3. Multi-user Support

- 用户认证
- 权限管理
- 多租户隔离

### 4. Advanced Chunking

- Semantic Chunking
- Recursive Chunking
- Parent-Child Chunking

### 5. RAG Pipeline Optimization

- Query Rewriting
- HyDE (Hypothetical Document Embeddings)
- Multi-query Retrieval

---

## 总结

这是一个完整的 RAG 知识库管理和评估平台架构设计，包含：

1. ✅ 清晰的技术栈选型
2. ✅ 完整的数据库设计
3. ✅ 模块化的后端架构
4. ✅ 异步任务处理流程
5. ✅ 用户友好的前端设计
6. ✅ 灵活的评估系统（基础 + LLM）
7. ✅ Docker 容器化部署
8. ✅ 8 周实施路线图

关键优势：

- 🚀 本地开发友好
- 📦 容器化部署简单
- 🔧 易于调试和扩展
- 💰 成本可控（LLM 评估可选）
- 📊 完整的质量评估体系

现在可以开始实施了！
