// src/routes/devoir.routes.js
import express from "express";
import multer from "multer";

import {
  getAllDevoirs,
  getDevoirById,
  createDevoir,
  updateDevoir,
  deleteDevoir,
  getDeviorsEtudiant,
  soumettreDevoir,
  getSoumissions,
  corrigerSoumission,
} from "../controllers/devoir.controller.js";

import { authenticate, requireAdminOrCoach } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Upload multer (mémoire) ─────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

// ============================================================
// 🎓 ÉTUDIANT — routes authentifiées
// ⚠️  /etudiant DOIT être déclaré avant /:id
// ============================================================

// GET /api/devoirs/etudiant?inscriptionId=<id>
router.get("/etudiant", authenticate, getDeviorsEtudiant);

// POST /api/devoirs/:id/soumettre
// Body (multipart/form-data) : inscriptionId + fichier
router.post("/:id/soumettre", authenticate, upload.single("fichier"), soumettreDevoir);

// ============================================================
// 📝 ADMIN/COACH — CRUD Devoirs
// ============================================================

// GET /api/devoirs?formation=&actif=true&page=&limit=
router.get("/", authenticate, requireAdminOrCoach, getAllDevoirs);

// GET /api/devoirs/:id
router.get("/:id", authenticate, requireAdminOrCoach, getDevoirById);

// POST /api/devoirs
// Body (multipart/form-data) : titre, consigne, formation, cohorte?,
//   ouvertureAt, deadline, dureeMinutes, fichier?
router.post("/", authenticate, requireAdminOrCoach, upload.single("fichier"), createDevoir);

// PUT /api/devoirs/:id
router.put("/:id", authenticate, requireAdminOrCoach, upload.single("fichier"), updateDevoir);

// DELETE /api/devoirs/:id
router.delete("/:id", authenticate, requireAdminOrCoach, deleteDevoir);

// ============================================================
// ✏️  ADMIN/COACH — Soumissions & Correction
// ⚠️  /soumissions/:soumissionId/corriger avant /:id/soumissions
// ============================================================

// PUT /api/devoirs/soumissions/:soumissionId/corriger
// Body (JSON) : { note: number, feedback?: string }
router.put(
  "/soumissions/:soumissionId/corriger",
  authenticate,
  requireAdminOrCoach,
  corrigerSoumission
);

// GET /api/devoirs/:id/soumissions?status=PENDING|APPROVED
router.get("/:id/soumissions", authenticate, requireAdminOrCoach, getSoumissions);

export default router;