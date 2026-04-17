// src/routes/emploiDuTemps.routes.js
import express from "express";
import {
  getEmploiDuTemps,
  getAllEmploiDuTemps,
  createCreneaux,
  createBulkCreneaux,
  updateCreneau,
  deleteCreneau,
  deleteByFormation,
} from "../controllers/emploiDuTemps.controller.js";

import { authenticate, requireAdminOrCoach } from '../middleware/auth.middleware.js';

const router = express.Router();

// ─────────────────────────────────────────────
// ROUTES ÉTUDIANTS (connectés)
// ─────────────────────────────────────────────

// GET /api/emploie?formation=dev-web&cohorte=Cohorte+1
router.get("/", authenticate, getEmploiDuTemps);

// ─────────────────────────────────────────────
// ROUTES ADMIN
// ─────────────────────────────────────────────

// GET /api/emploie/all?formation=dev-web&page=1&limit=50
router.get("/all", authenticate, requireAdminOrCoach, getAllEmploiDuTemps);

// POST /api/emploie
// Body: { formation, cohorte, jour, heureDebut, heureFin, matiere, type, salle? }
router.post("/", authenticate, requireAdminOrCoach, createCreneaux);

// POST /api/emploie/bulk
// Body: { creneaux: [ { formation, cohorte, jour, heureDebut, heureFin, matiere, type, salle? }, ... ] }
router.post("/bulk",authenticate, requireAdminOrCoach, createBulkCreneaux);

// PUT /api/emploie/:id
router.put("/:id", authenticate,requireAdminOrCoach, updateCreneau);

// DELETE /api/emploie/:id
router.delete("/:id", authenticate, requireAdminOrCoach, deleteCreneau);

// DELETE /api/emploie/formation/:formation?cohorte=Cohorte+1
router.delete("/formation/:formation", authenticate, requireAdminOrCoach, deleteByFormation);

export default router;