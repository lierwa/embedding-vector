# RAG Knowledge Platform - Setup Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- OpenAI API Key

## Quick Start (Docker)

1. **Clone and navigate to the project:**
```bash
cd d:\work\embedding-vector
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-api-key-here
```

3. **Start all services:**
```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Qdrant (port 6333)
- Backend API (port 3001)
- Worker processes
- Frontend (port 3000)

4. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Qdrant Dashboard: http://localhost:6333/dashboard

5. **Initialize the database:**
The database migrations will run automatically when the backend starts.

## Local Development

### Backend

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env with your settings

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev

# Start workers (in another terminal)
npm run worker
```

### Frontend

```bash
cd frontend
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000

## Database Management

### View database with Prisma Studio:
```bash
cd backend
npx prisma studio
```

### Create a new migration:
```bash
cd backend
npx prisma migrate dev --name migration_name
```

### Reset database:
```bash
cd backend
npx prisma migrate reset
```

## Supported File Types

- PDF
- DOCX/DOC
- HTML/HTM
- JSON
- TXT
- Markdown (MD)

## Architecture

```
Frontend (React + Vite + Material-UI)
    ↓
Backend API (Express + TypeScript)
    ↓
├─ PostgreSQL (metadata)
├─ Qdrant (vectors)
└─ Redis + BullMQ (job queue)
    ↓
Workers (document processing)
```

## Workflow

1. **Create a Knowledge Base**: Choose embedding model and chunk settings
2. **Upload Documents**: Supported formats are automatically processed
3. **Processing Pipeline**:
   - Parse → Chunk → Embed → Index to Qdrant
   - Monitor status in the Documents tab
4. **Query Playground**: Test retrieval with different queries and Top-K
5. **Create Test Cases**: Define queries and expected results
6. **Run Evaluations**: Automated quality assessment with optional LLM evaluation

## Troubleshooting

### Backend not starting
- Check PostgreSQL is running: `docker-compose ps`
- Check logs: `docker-compose logs backend`
- Verify DATABASE_URL in .env

### Documents stuck in "processing"
- Check worker logs: `docker-compose logs worker`
- Verify OpenAI API key is valid
- Check Redis is running

### Qdrant connection errors
- Verify Qdrant is running: `docker-compose ps qdrant`
- Check Qdrant logs: `docker-compose logs qdrant`

### Reset everything
```bash
docker-compose down -v
docker-compose up -d
```

## Production Deployment

1. Set `NODE_ENV=production` in backend
2. Use strong database password
3. Enable HTTPS/SSL
4. Set up proper CORS configuration
5. Configure resource limits in docker-compose.yml
6. Set up monitoring and logging

## API Documentation

### Knowledge Base
- `POST /api/kb` - Create knowledge base
- `GET /api/kb` - List all knowledge bases
- `GET /api/kb/:id` - Get knowledge base details
- `PUT /api/kb/:id` - Update knowledge base
- `DELETE /api/kb/:id` - Delete knowledge base

### Documents
- `POST /api/kb/:id/documents` - Upload document
- `GET /api/kb/:id/documents` - List documents
- `GET /api/documents/:docId` - Get document details
- `DELETE /api/documents/:docId` - Delete document

### Search
- `POST /api/kb/:id/search` - Search knowledge base

### Test Cases
- `POST /api/kb/:id/test-cases` - Create test case
- `GET /api/kb/:id/test-cases` - List test cases
- `DELETE /api/test-cases/:id` - Delete test case

### Evaluations
- `POST /api/kb/:id/evaluations` - Create evaluation
- `GET /api/kb/:id/evaluations` - List evaluations
- `GET /api/evaluations/:id` - Get evaluation details

## Configuration Options

### Embedding Models
- `text-embedding-3-small` (1536 dimensions, faster, cheaper)
- `text-embedding-3-large` (3072 dimensions, better quality)

### Chunk Settings
- **Chunk Size**: 200-1000 tokens (default: 500)
- **Chunk Overlap**: 50-200 tokens (default: 100)

### Evaluation Options
- **Top K**: Number of chunks to retrieve (1-20)
- **LLM Evaluation**: Use GPT-4 for quality assessment (costs OpenAI credits)

## Performance Tips

- Use `text-embedding-3-small` for faster processing
- Adjust chunk size based on document type
- Monitor Qdrant memory usage for large datasets
- Scale workers horizontally for faster processing

## Support

For issues or questions, check the logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f worker
docker-compose logs -f qdrant
```
