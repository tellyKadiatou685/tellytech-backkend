import * as commentaireService from "../services/commentaire.service.js";

export async function lister(req, res) {
  try {
    const commentaires = await commentaireService.listerCommentaires(req.params.articleId);
    res.json({ success: true, commentaires });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function creer(req, res) {
  try {
    const { nom, email, contenu } = req.body;
    const commentaire = await commentaireService.creerCommentaire(req.params.articleId, { nom, email, contenu });
    res.status(201).json({ success: true, commentaire });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// --- Admin ---
export async function listerAdmin(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await commentaireService.listerTousPourAdmin({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function modifier(req, res) {
  try {
    const commentaire = await commentaireService.modifierCommentaire(req.params.id, { contenu: req.body.contenu });
    res.json({ success: true, commentaire });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function supprimer(req, res) {
  try {
    await commentaireService.supprimerCommentaire(req.params.id);
    res.json({ success: true, message: "Commentaire supprimé" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
