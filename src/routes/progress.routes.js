// routes/progress.routes.js

import express from 'express';
import progressController from '../controllers/progress.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * 📊 Récupérer ma progression personnelle
 * GET /api/progress/my
 */
router.get(
  '/my',
  authenticate,
  authorize(['USER']),
  progressController.getMyProgress
);

/**
 * 🔍 Vérifier l'accessibilité d'une partie
 * GET /api/progress/parts/:partId
 */
router.get(
  '/parts/:partId',
  authenticate,
  authorize(['USER']),
  progressController.checkPartAccess
);

/**
 * 📊 Statistiques globales (Admin)
 * GET /api/progress/stats
 */
router.get(
  '/stats',
  authenticate,
  authorize(['ADMIN']),
  progressController.getGlobalStats
);



export default router;


