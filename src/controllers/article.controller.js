import * as articleService from "../services/article.service.js";

export async function listerPublies(req, res) {
  try {
    const { page, limit, categorie } = req.query;
    const result = await articleService.listerArticlesPublies({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 9,
      categorie,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function listerAdmin(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await articleService.listerArticlesAdmin({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function alaUne(req, res) {
  try {
    const article = await articleService.getArticleALaUne();
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function detailParSlug(req, res) {
  try {
    const article = await articleService.getArticleParSlug(req.params.slug);
    res.json({ success: true, article });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Article introuvable" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function detailParId(req, res) {
  try {
    const article = await articleService.getArticleParId(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: "Article introuvable" });
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function creer(req, res) {
  try {
    if (!req.body.titre || !req.body.contenu) {
      return res.status(400).json({ success: false, message: "Titre et contenu sont obligatoires" });
    }
    const article = await articleService.creerArticle(req.body, req.files);
    res.status(201).json({ success: true, article });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function modifier(req, res) {
  try {
    const article = await articleService.modifierArticle(req.params.id, req.body, req.files);
    res.json({ success: true, article });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function publier(req, res) {
  try {
    const article = await articleService.publierArticle(req.params.id);
    res.json({ success: true, article });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function supprimer(req, res) {
  try {
    await articleService.supprimerArticle(req.params.id);
    res.json({ success: true, message: "Article supprimé" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function supprimerMedia(req, res) {
  try {
    await articleService.supprimerMedia(req.params.id, req.params.mediaId);
    res.json({ success: true, message: "Photo supprimée" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}
