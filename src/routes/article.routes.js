import { Router } from "express";
import * as articleController from "../controllers/article.controller.js";
import { uploadArticleFiles, handleUploadErrors } from "../middleware/uploadArticle.middleware.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = Router();

// --- Routes publiques ---
router.get("/articles", articleController.listerPublies);
router.get("/articles/a-la-une", articleController.alaUne);
router.get("/articles/:slug", articleController.detailParSlug);

// --- Routes admin (protégées) ---
router.get("/admin/articles", authenticate, authorize("ADMIN"), articleController.listerAdmin);
router.get("/admin/articles/:id", authenticate, authorize("ADMIN"), articleController.detailParId);

router.post(
  "/admin/articles",
  authenticate,
  authorize("ADMIN"),
  uploadArticleFiles,
  handleUploadErrors,
  articleController.creer
);

router.put(
  "/admin/articles/:id",
  authenticate,
  authorize("ADMIN"),
  uploadArticleFiles,
  handleUploadErrors,
  articleController.modifier
);

router.patch("/admin/articles/:id/publier", authenticate, authorize("ADMIN"), articleController.publier);
router.delete("/admin/articles/:id/medias/:mediaId", authenticate, authorize("ADMIN"), articleController.supprimerMedia);
router.delete("/admin/articles/:id", authenticate, authorize("ADMIN"), articleController.supprimer);

export default router;