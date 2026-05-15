import express from 'express';
import multer from 'multer';
import courseController from '../controllers/course.controller.js';
import submissionController from '../controllers/submission.controller.js';

import { authenticate, requireAdminOrCoach } from '../middleware/auth.middleware.js';

const router = express.Router();
const storage = multer.memoryStorage();

// ── Multer leçons (vidéo + 2 PDFs) ───────────────────────
const uploadCours = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'video/mp4', 'video/webm', 'video/quicktime',
      'video/x-msvideo', 'application/pdf',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non supporté (mp4, webm, mov, avi, pdf)'));
  },
}).fields([
  { name: 'video',  maxCount: 1 },
  { name: 'pdf',    maxCount: 1 },   // PDF cours
  { name: 'pdfExo', maxCount: 1 },  // PDF exercice ← nouveau
]);

// ── Multer soumissions étudiants (lien OU fichier) ────────
const uploadSubmission = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf', 'application/zip',
      'application/x-zip-compressed', 'image/png', 'image/jpeg',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non supporté (pdf, zip, png, jpg)'));
  },
}).single('file');   // champ "file" — optionnel si l'étudiant soumet un lien

// ── ADMIN / COACH — Modules ───────────────────────────────
router.get(   '/admin/all',         authenticate, requireAdminOrCoach, (req, res) => courseController.getAllCours(req, res));
router.post(  '/admin/modules',     authenticate, requireAdminOrCoach, (req, res) => courseController.creerModule(req, res));
router.put(   '/admin/modules/:id', authenticate, requireAdminOrCoach, (req, res) => courseController.modifierModule(req, res));
router.delete('/admin/modules/:id', authenticate, requireAdminOrCoach, (req, res) => courseController.supprimerModule(req, res));

// ── ADMIN / COACH — Leçons ────────────────────────────────
router.post(  '/admin/lessons',     authenticate, requireAdminOrCoach, uploadCours, (req, res) => courseController.creerLecon(req, res));
router.put(   '/admin/lessons/:id', authenticate, requireAdminOrCoach, uploadCours, (req, res) => courseController.modifierLecon(req, res));
router.delete('/admin/lessons/:id', authenticate, requireAdminOrCoach,              (req, res) => courseController.supprimerLecon(req, res));

// ── ADMIN / COACH — Soumissions ───────────────────────────
router.get(   '/admin/submissions',           authenticate, requireAdminOrCoach, (req, res) => submissionController.getToutesSoumissions(req, res));
router.get(   '/admin/submissions/stats',     authenticate, requireAdminOrCoach, (req, res) => submissionController.getStatistiques(req, res));
router.patch( '/admin/submissions/:id/noter', authenticate, requireAdminOrCoach, (req, res) => submissionController.noter(req, res));

// ── ÉTUDIANT ──────────────────────────────────────────────
router.get( '/submissions/mes-resultats', authenticate,                  (req, res) => submissionController.getMesSoumissions(req, res));
router.post('/submissions',               authenticate, uploadSubmission, (req, res) => courseController.soumettre(req, res));
router.get( '/:formation/progression',   authenticate,                  (req, res) => courseController.getCoursAvecProgression(req, res));

export default router;