import express from 'express';
import submissionController from '../controllers/submission.controller.js';
import { authenticate, requireAdminOrCoach } from '../middleware/auth.middleware.js';

const router = express.Router();

// ── Étudiant ──
router.post('/',        authenticate, submissionController.soumettreTD);         // ancienne route
router.post('/lesson',  authenticate, submissionController.soumettreLecon);      // nouvelle
router.get('/me',       authenticate, submissionController.getMesSoumissions);   // anciennes
router.get('/me/lessons', authenticate, submissionController.getMesLessonSoumissions); // nouvelles

// ── Admin / Coach ──
router.get('/stats',    authenticate,  submissionController.getStatistiquesSoumissions);
router.get('/',         authenticate,  submissionController.getToutesSoumissions);       // anciennes
router.get('/lessons',  authenticate,  submissionController.getToutesLessonSoumissions); // nouvelles

router.patch('/lessons/:id/valider', authenticate,  submissionController.validerLessonTD);
router.patch('/lessons/:id/rejeter', authenticate,  submissionController.rejeterLessonTD);
router.patch('/:id/valider', authenticate,  submissionController.validerTD);
router.patch('/:id/rejeter', authenticate, submissionController.rejeterTD);

export default router;