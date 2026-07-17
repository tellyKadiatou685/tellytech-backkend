import * as likeService from "../services/like.service.js";

export async function toggle(req, res) {
  try {
    const identifiant = likeService.resoudreIdentifiant(req);
    const type = req.body.type || "utile";
    const result = await likeService.toggleReaction(req.params.articleId, identifiant, type);
    res.json({ success: true, identifiant, ...result });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function stats(req, res) {
  try {
    const result = await likeService.getStatsReactions(req.params.articleId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function mesReactions(req, res) {
  try {
    const identifiant = likeService.resoudreIdentifiant(req);
    const reactions = await likeService.getMesReactions(req.params.articleId, identifiant);
    res.json({ success: true, identifiant, reactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
