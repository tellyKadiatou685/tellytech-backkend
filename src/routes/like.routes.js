import { Router } from "express";
import * as likeController from "../controllers/like.controller.js";

const router = Router();

router.post("/articles/:articleId/like", likeController.toggle);
router.get("/articles/:articleId/likes", likeController.stats);
router.get("/articles/:articleId/mes-reactions", likeController.mesReactions);

export default router;
