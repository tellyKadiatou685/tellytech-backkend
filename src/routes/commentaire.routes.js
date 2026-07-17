import { Router } from "express";
import * as commentaireController from "../controllers/commentaire.controller.js";
import { antiSpamCommentaire } from "../middleware/antiSpamCommentaire.middleware.js";
import { authorize } from "../middleware/auth.middleware.js";

const router = Router();

// --- Public : commenter sans compte ---
router.get("/articles/:articleId/commentaires", commentaireController.lister);
router.post("/articles/:articleId/commentaires", antiSpamCommentaire, commentaireController.creer);

// --- Admin : modération (supprimer / modifier) ---
router.get("/admin/commentaires", authorize(["ADMIN"]), commentaireController.listerAdmin);
router.put("/admin/commentaires/:id", authorize(["ADMIN"]), commentaireController.modifier);
router.delete("/admin/commentaires/:id", authorize(["ADMIN"]), commentaireController.supprimer);

export default router;
