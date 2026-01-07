import express from 'express';
import submissionController from '../controllers/submission.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// === ROUTES ÉTUDIANT ===
router.post(
  '/',
  authenticate,
  authorize(['USER']),
  submissionController.soumettreTD
);

router.get(
  '/me',
  authenticate,
  authorize(['USER']),
  submissionController.getMesSoumissions
);

// === ROUTES ADMIN ===
router.get(
  '/',
  authenticate,
  authorize(['ADMIN']),
  submissionController.getToutesSoumissions
);

router.get(
  '/stats',
  authenticate,
  authorize(['ADMIN']),
  submissionController.getStatistiquesSoumissions
);

router.patch(
  '/:id/valider',
  authenticate,
  authorize(['ADMIN']),
  submissionController.validerTD
);

router.patch(
  '/:id/rejeter',
  authenticate,
  authorize(['ADMIN']),
  submissionController.rejeterTD
);

export default router;