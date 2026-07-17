import { Router } from "express";
import multer from "multer";
import * as galerieController from "../controllers/galerie.controller.js";
import { authorize } from "../middleware/auth.middleware.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// --- Public ---
router.get("/galerie", galerieController.lister);
router.get("/galerie/a-la-une", galerieController.alaUne);

// --- Admin ---
router.post("/admin/galerie", authorize(["ADMIN"]), upload.single("image"), galerieController.creer);
router.delete("/admin/galerie/:id", authorize(["ADMIN"]), galerieController.supprimer);

export default router;