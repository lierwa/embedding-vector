# RAG Knowledge Platform

A local single-user RAG knowledge base management and vector quality evaluation platform.

## Tech Stack

- **Backend**: Node.js + TypeScript + Express + Prisma
- **Frontend**: React + Vite + Material-UI
- **Vector DB**: Qdrant
- **Database**: PostgreSQL
- **Queue**: Redis + BullMQ
- **Embedding**: OpenAI API

## Features

1. **Knowledge Base Management**: Create and manage multiple vector knowledge bases
2. **Document Ingestion**: Upload and process PDF, DOCX, HTML, JSON, TXT, Markdown files
3. **Query Playground**: Test and debug retrieval quality
4. **Evaluation System**: Automated testing of vector database quality

## Quick Start

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Add your OpenAI API key to `.env`

3. Start all services:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Qdrant UI: http://localhost:6333/dashboard

## Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
Frontend (React) → Backend API (Express) → Workers (BullMQ)
                         ↓                      ↓
                   PostgreSQL              Qdrant
                         ↓
                      Redis
```

## License

MIT
