import { Router, type IRouter } from 'express';
import * as kbController from '../controllers/knowledgeBase.controller';
import * as docController from '../controllers/document.controller';
import * as retrievalController from '../controllers/retrieval.controller';
import * as evalController from '../controllers/evaluation.controller';

const router: IRouter = Router();

router.post('/kb', kbController.createKnowledgeBase);
router.get('/kb', kbController.listKnowledgeBases);
router.get('/kb/:id', kbController.getKnowledgeBase);
router.put('/kb/:id', kbController.updateKnowledgeBase);
router.delete('/kb/:id', kbController.deleteKnowledgeBase);

router.post('/kb/:id/documents', docController.uploadDocument);
router.get('/kb/:id/documents', docController.getDocuments);
router.get('/documents/:docId', docController.getDocument);
router.get('/documents/:docId/logs', docController.getDocumentLogs);
router.delete('/documents/:docId', docController.deleteDocument);

router.post('/kb/:id/search', retrievalController.search);

router.post('/kb/:id/test-cases', evalController.createTestCase);
router.get('/kb/:id/test-cases', evalController.getTestCases);
router.delete('/test-cases/:testCaseId', evalController.deleteTestCase);

router.post('/kb/:id/evaluations', evalController.createEvaluation);
router.get('/kb/:id/evaluations', evalController.getEvaluations);
router.get('/evaluations/:evalId', evalController.getEvaluation);

export default router;
