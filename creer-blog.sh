#!/bin/bash
set -e

# Lance ce script depuis la racine de ton projet BACKEND (site_telly/)

mkdir -p src/middleware src/services src/controllers src/routes

cat > src/middleware/uploadArticle.middleware.js << 'BLOGEOF'
import multer from "multer";

// Stockage en mémoire : on ne garde jamais le fichier sur disque,
// on le passe directement en buffer à Cloudinary (voir utils/cloudinaryUpload.js)
const storage = multer.memoryStorage();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function fileFilter(req, file, cb) {
  if (file.fieldname === "video") {
    if (!VIDEO_TYPES.includes(file.mimetype)) {
      return cb(new Error("Format vidéo non supporté (mp4, webm, mov uniquement)"));
    }
  } else {
    // "image" (couverture) et "medias" (galerie)
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error("Format image non supporté (jpeg, png, webp, gif uniquement)"));
    }
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 Mo max par fichier (large pour vidéo courte)
  },
});

// Champs acceptés sur les routes de création/modification d'article :
// - image  : 1 fichier, image de couverture
// - medias : jusqu'à 3 fichiers, galerie de l'article
// - video  : 1 fichier, vidéo optionnelle (alternative à videoUrl en texte)
export const uploadArticleFiles = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "medias", maxCount: 3 },
  { name: "video", maxCount: 1 },
]);

// Middleware d'erreur Multer, à placer juste après uploadArticleFiles dans les routes
export function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
}
BLOGEOF

cat > src/middleware/antiSpamCommentaire.middleware.js << 'BLOGEOF'
// Rate limiting simple en mémoire (suffisant pour un seul serveur / trafic modéré).
// Si tu passes un jour à plusieurs instances serveur, remplace par Redis.
const historique = new Map(); // ip -> [timestamps]

const FENETRE_MS = 10 * 60 * 1000; // 10 minutes
const MAX_COMMENTAIRES = 5; // max 5 commentaires / 10 min / IP

export function antiSpamCommentaire(req, res, next) {
  // 1. Honeypot : champ invisible côté formulaire front, jamais rempli par un humain
  if (req.body.siteWeb) {
    // On répond succès (pour ne pas indiquer au bot qu'il a été détecté),
    // mais on n'insère rien en base.
    return res.status(201).json({ success: true, message: "Commentaire envoyé." });
  }

  // 2. Rate limit par IP
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const maintenant = Date.now();
  const timestamps = (historique.get(ip) || []).filter((t) => maintenant - t < FENETRE_MS);

  if (timestamps.length >= MAX_COMMENTAIRES) {
    return res.status(429).json({
      success: false,
      message: "Trop de commentaires envoyés récemment. Réessaie dans quelques minutes.",
    });
  }

  timestamps.push(maintenant);
  historique.set(ip, timestamps);

  next();
}
BLOGEOF

cat > src/services/blogUpload.service.js << 'BLOGEOF'
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;

class BlogUploadService {

  isYouTubeUrl(url) {
    return typeof url === 'string' && YOUTUBE_REGEX.test(url);
  }

  // ========================================
  // 🖼️ IMAGE DE COUVERTURE / GALERIE ARTICLE
  // ========================================

  async uploadArticleImage(file) {
    const result = await uploadToCloudinary(file.buffer, {
      folder: 'tellytech/blog',
      resource_type: 'image',
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async uploadArticleGallery(files = []) {
    // Upload en parallèle, cohérent avec les autres méthodes de UploadService
    return Promise.all(files.map((file) => this.uploadArticleImage(file)));
  }

  // ========================================
  // 🎬 VIDÉO ARTICLE (fichier buffer OU lien YouTube)
  // ========================================

  async uploadArticleVideo(videoFileOrUrl) {
    // ── YouTube → on stocke juste le lien, pas d'upload Cloudinary ──
    if (typeof videoFileOrUrl === 'string') {
      if (this.isYouTubeUrl(videoFileOrUrl)) {
        return { type: 'youtube', url: videoFileOrUrl, publicId: null };
      }
      // Autre lien texte (ex: Cloudinary déjà hébergé ailleurs) : on le garde tel quel
      return { type: 'lien', url: videoFileOrUrl, publicId: null };
    }

    // ── Fichier vidéo → Cloudinary (upload_stream via uploadToCloudinary) ──
    const buffer = videoFileOrUrl.buffer ?? videoFileOrUrl;
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Fichier vidéo invalide : buffer introuvable.');
    }

    const result = await uploadToCloudinary(buffer, {
      folder: 'tellytech/blog/videos',
      resource_type: 'video',
      eager: [{ format: 'mp4', quality: 'auto' }],
      eager_async: true,
      chunk_size: 6_000_000,
    });

    return { type: 'cloudinary', url: result.secure_url, publicId: result.public_id };
  }

  // ========================================
  // 🗑️ SUPPRESSION (par URL, comme le reste du projet)
  // ========================================

  async deleteArticleFile(url, resourceType = 'image') {
    if (!url) return;
    try {
      const publicId = extractPublicId(url);
      if (!publicId) return; // ex: lien YouTube, rien à supprimer côté Cloudinary
      await deleteFromCloudinary(publicId, resourceType);
    } catch (error) {
      console.error('❌ Erreur suppression Cloudinary (blog):', error.message);
    }
  }

  async deleteArticleVideo(url) {
    if (!url || this.isYouTubeUrl(url)) return;
    await this.deleteArticleFile(url, 'video');
  }
}

export default new BlogUploadService();
BLOGEOF

cat > src/services/article.service.js << 'BLOGEOF'
import { PrismaClient } from "@prisma/client";
import blogUploadService from "./blogUpload.service.js";

const prisma = new PrismaClient();
const MAX_MEDIAS = 3;

function slugify(titre) {
  return titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function genererSlugUnique(titre) {
  const base = slugify(titre);
  let slug = base;
  let i = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

/**
 * Liste des articles publiés (pagination + filtre catégorie optionnel).
 */
export async function listerArticlesPublies({ page = 1, limit = 9, categorie } = {}) {
  const where = {
    estPublie: true,
    ...(categorie ? { categorie } : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publieAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        medias: { orderBy: { ordre: "asc" } },
        _count: { select: { commentaires: { where: { estApprouve: true } } } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return { articles, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Liste complète pour l'admin (publiés + brouillons).
 */
export async function listerArticlesAdmin({ page = 1, limit = 20 } = {}) {
  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { medias: true, _count: { select: { commentaires: true, likes: true } } },
    }),
    prisma.article.count(),
  ]);

  return { articles, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * "À la une" = simplement le dernier article publié, trié par date de publication.
 * Pas de champ dédié : comportement automatique.
 */
export async function getArticleALaUne() {
  return prisma.article.findFirst({
    where: { estPublie: true },
    orderBy: { publieAt: "desc" },
    include: { medias: { orderBy: { ordre: "asc" } } },
  });
}

/**
 * Détail d'un article par slug (public). Incrémente le compteur de vues.
 */
export async function getArticleParSlug(slug) {
  return prisma.article.update({
    where: { slug },
    data: { vues: { increment: 1 } },
    include: {
      medias: { orderBy: { ordre: "asc" } },
      commentaires: {
        where: { estApprouve: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getArticleParId(id) {
  return prisma.article.findUnique({
    where: { id: Number(id) },
    include: { medias: true, commentaires: true },
  });
}

/**
 * Création d'un article. `files` vient de multer (req.files) : { image, medias, video }.
 * Un article peut être texte seul (aucun fichier obligatoire).
 */
export async function creerArticle(data, files = {}) {
  const { titre, extrait, contenu, categorie, auteur, metaTitle, metaDescription, motsCles, estPublie, videoUrl } = data;

  if ((files.medias || []).length > MAX_MEDIAS) {
    const err = new Error(`Maximum ${MAX_MEDIAS} photos autorisées dans la galerie.`);
    err.statusCode = 400;
    throw err;
  }

  const slug = await genererSlugUnique(titre);

  // Image de couverture
  let imageUrl = null;
  if (files.image?.[0]) {
    const res = await blogUploadService.uploadArticleImage(files.image[0]);
    imageUrl = res.url;
  }

  // Vidéo : fichier uploadé prioritaire, sinon lien texte (YouTube ou autre)
  let finalVideoUrl = null;
  if (files.video?.[0]) {
    const res = await blogUploadService.uploadArticleVideo(files.video[0]);
    finalVideoUrl = res.url;
  } else if (videoUrl) {
    const res = await blogUploadService.uploadArticleVideo(videoUrl);
    finalVideoUrl = res.url;
  }

  // Galerie (jusqu'à 3 images)
  let mediasUpload = [];
  if (files.medias?.length) {
    mediasUpload = await blogUploadService.uploadArticleGallery(files.medias);
  }

  const publie = estPublie === true || estPublie === "true";

  return prisma.article.create({
    data: {
      titre,
      slug,
      extrait: extrait || null,
      contenu,
      imageUrl,
      videoUrl: finalVideoUrl,
      categorie: categorie || null,
      auteur: auteur || "TellyTech",
      metaTitle: metaTitle || titre,
      metaDescription: metaDescription || extrait || null,
      motsCles: Array.isArray(motsCles) ? motsCles : motsCles ? String(motsCles).split(",").map((m) => m.trim()) : [],
      estPublie: publie,
      publieAt: publie ? new Date() : null,
      medias: mediasUpload.length
        ? { create: mediasUpload.map((m, i) => ({ url: m.url, ordre: i })) }
        : undefined,
    },
    include: { medias: true },
  });
}

/**
 * Modification d'un article existant.
 * Règle importante : publieAt n'est mis à jour que lors du PASSAGE de brouillon → publié,
 * pas à chaque édition, pour ne pas fausser "à la une".
 * Les anciens fichiers Cloudinary remplacés sont supprimés (image, vidéo, galerie).
 */
export async function modifierArticle(id, data, files = {}) {
  const existant = await prisma.article.findUnique({ where: { id: Number(id) }, include: { medias: true } });
  if (!existant) {
    const err = new Error("Article introuvable");
    err.statusCode = 404;
    throw err;
  }

  if ((files.medias || []).length > MAX_MEDIAS) {
    const err = new Error(`Maximum ${MAX_MEDIAS} photos autorisées dans la galerie.`);
    err.statusCode = 400;
    throw err;
  }

  const { titre, extrait, contenu, categorie, auteur, metaTitle, metaDescription, motsCles, estPublie, videoUrl } = data;

  const updateData = {};

  if (titre && titre !== existant.titre) {
    updateData.titre = titre;
    updateData.slug = await genererSlugUnique(titre);
  }
  if (extrait !== undefined) updateData.extrait = extrait;
  if (contenu !== undefined) updateData.contenu = contenu;
  if (categorie !== undefined) updateData.categorie = categorie;
  if (auteur !== undefined) updateData.auteur = auteur;
  if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
  if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
  if (motsCles !== undefined) {
    updateData.motsCles = Array.isArray(motsCles) ? motsCles : String(motsCles).split(",").map((m) => m.trim());
  }

  // Transition brouillon -> publié : on fixe publieAt = maintenant (fait remonter "à la une")
  const nouvelEtatPublie = estPublie === true || estPublie === "true";
  if (estPublie !== undefined) {
    updateData.estPublie = nouvelEtatPublie;
    if (nouvelEtatPublie && !existant.estPublie) {
      updateData.publieAt = new Date();
    }
    if (!nouvelEtatPublie) {
      updateData.publieAt = null; // dépublié = ne peut plus être "à la une"
    }
  }

  // Nouvelle image de couverture : on upload puis on supprime l'ancienne
  if (files.image?.[0]) {
    const res = await blogUploadService.uploadArticleImage(files.image[0]);
    updateData.imageUrl = res.url;
    if (existant.imageUrl) await blogUploadService.deleteArticleFile(existant.imageUrl, "image");
  }

  // Nouvelle vidéo (fichier ou lien) : on remplace puis on supprime l'ancienne si c'était un upload Cloudinary
  if (files.video?.[0]) {
    const res = await blogUploadService.uploadArticleVideo(files.video[0]);
    updateData.videoUrl = res.url;
    if (existant.videoUrl) await blogUploadService.deleteArticleVideo(existant.videoUrl);
  } else if (videoUrl !== undefined && videoUrl !== existant.videoUrl) {
    const res = await blogUploadService.uploadArticleVideo(videoUrl);
    updateData.videoUrl = res.url;
    if (existant.videoUrl) await blogUploadService.deleteArticleVideo(existant.videoUrl);
  }

  // Nouvelle galerie : on upload, on supprime les anciennes images Cloudinary, puis on remplace en base
  if (files.medias?.length) {
    const mediasUpload = await blogUploadService.uploadArticleGallery(files.medias);
    await Promise.all(existant.medias.map((m) => blogUploadService.deleteArticleFile(m.url, "image")));
    await prisma.articleMedia.deleteMany({ where: { articleId: Number(id) } });
    updateData.medias = { create: mediasUpload.map((m, i) => ({ url: m.url, ordre: i })) };
  }

  return prisma.article.update({
    where: { id: Number(id) },
    data: updateData,
    include: { medias: true },
  });
}

/**
 * Publie un article existant (raccourci, équivalent à modifierArticle avec estPublie=true).
 */
export async function publierArticle(id) {
  const existant = await prisma.article.findUnique({ where: { id: Number(id) } });
  if (!existant) {
    const err = new Error("Article introuvable");
    err.statusCode = 404;
    throw err;
  }
  return prisma.article.update({
    where: { id: Number(id) },
    data: { estPublie: true, publieAt: new Date() },
  });
}

/**
 * Supprime une seule image de la galerie d'un article (backend + Cloudinary),
 * sans toucher au reste de l'article. Utilisé par le bouton "X" individuel
 * sur chaque photo dans le formulaire admin.
 */
export async function supprimerMedia(articleId, mediaId) {
  const media = await prisma.articleMedia.findUnique({ where: { id: Number(mediaId) } });

  if (!media || media.articleId !== Number(articleId)) {
    const err = new Error("Média introuvable pour cet article");
    err.statusCode = 404;
    throw err;
  }

  await blogUploadService.deleteArticleFile(media.url, "image");
  await prisma.articleMedia.delete({ where: { id: Number(mediaId) } });

  return { success: true };
}

/**
 * Suppression complète : article + tous ses fichiers Cloudinary associés
 * (image de couverture, vidéo si hébergée sur Cloudinary, galerie).
 */
export async function supprimerArticle(id) {
  const existant = await prisma.article.findUnique({ where: { id: Number(id) }, include: { medias: true } });
  if (!existant) {
    const err = new Error("Article introuvable");
    err.statusCode = 404;
    throw err;
  }

  if (existant.imageUrl) await blogUploadService.deleteArticleFile(existant.imageUrl, "image");
  if (existant.videoUrl) await blogUploadService.deleteArticleVideo(existant.videoUrl);
  await Promise.all(existant.medias.map((m) => blogUploadService.deleteArticleFile(m.url, "image")));

  await prisma.article.delete({ where: { id: Number(id) } });
  return { success: true };
}
BLOGEOF

cat > src/services/commentaire.service.js << 'BLOGEOF'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listerCommentaires(articleId) {
  return prisma.commentaire.findMany({
    where: { articleId: Number(articleId), estApprouve: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Création d'un commentaire, sans compte requis.
 * `nom` et `contenu` obligatoires, `email` optionnel.
 */
export async function creerCommentaire(articleId, { nom, email, contenu }) {
  if (!nom?.trim() || !contenu?.trim()) {
    const err = new Error("Le nom et le commentaire sont obligatoires.");
    err.statusCode = 400;
    throw err;
  }

  const article = await prisma.article.findUnique({ where: { id: Number(articleId) } });
  if (!article) {
    const err = new Error("Article introuvable.");
    err.statusCode = 404;
    throw err;
  }

  return prisma.commentaire.create({
    data: {
      articleId: Number(articleId),
      nom: nom.trim().slice(0, 100),
      email: email?.trim() || null,
      contenu: contenu.trim().slice(0, 2000),
      estApprouve: true, // auto-publié ; modération a posteriori par l'admin
    },
  });
}

/**
 * L'admin peut modifier le texte d'un commentaire (ex: retirer un mot inapproprié).
 */
export async function modifierCommentaire(id, { contenu }) {
  return prisma.commentaire.update({
    where: { id: Number(id) },
    data: { contenu },
  });
}

export async function supprimerCommentaire(id) {
  await prisma.commentaire.delete({ where: { id: Number(id) } });
  return { success: true };
}

/**
 * Liste tous les commentaires (toutes catégories confondues) pour la modération admin.
 */
export async function listerTousPourAdmin({ page = 1, limit = 30 } = {}) {
  const [commentaires, total] = await Promise.all([
    prisma.commentaire.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { article: { select: { titre: true, slug: true } } },
    }),
    prisma.commentaire.count(),
  ]);
  return { commentaires, total, page, totalPages: Math.ceil(total / limit) };
}
BLOGEOF

cat > src/services/like.service.js << 'BLOGEOF'
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export const TYPES_REACTION = ["utile", "jadore", "inspirant"];

/**
 * Génère un identifiant stable pour un visiteur anonyme.
 * Priorité à un identifiant envoyé par le front (ex: stocké en localStorage),
 * sinon fallback sur un hash IP + User-Agent (moins fiable mais suffisant).
 */
export function resoudreIdentifiant(req) {
  const fourni = req.body?.identifiant || req.query?.identifiant;
  if (fourni) return String(fourni).slice(0, 100);
  const brut = `${req.ip}-${req.headers["user-agent"] || ""}`;
  return crypto.createHash("sha256").update(brut).digest("hex");
}

/**
 * Toggle une réaction : si elle existe déjà pour (article, identifiant, type) on la retire,
 * sinon on l'ajoute. Le compteur `nbLikes` sur Article est tenu à jour en transaction.
 */
export async function toggleReaction(articleId, identifiant, type = "utile") {
  if (!TYPES_REACTION.includes(type)) {
    const err = new Error(`Type de réaction invalide. Valeurs possibles : ${TYPES_REACTION.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const existant = await prisma.like.findUnique({
    where: {
      articleId_identifiant_type: {
        articleId: Number(articleId),
        identifiant,
        type,
      },
    },
  });

  if (existant) {
    const [, article] = await prisma.$transaction([
      prisma.like.delete({ where: { id: existant.id } }),
      prisma.article.update({
        where: { id: Number(articleId) },
        data: { nbLikes: { decrement: 1 } },
      }),
    ]);
    return { reagi: false, nbLikes: article.nbLikes };
  }

  const [, article] = await prisma.$transaction([
    prisma.like.create({ data: { articleId: Number(articleId), identifiant, type } }),
    prisma.article.update({
      where: { id: Number(articleId) },
      data: { nbLikes: { increment: 1 } },
    }),
  ]);
  return { reagi: true, nbLikes: article.nbLikes };
}

/**
 * Nombre total de réactions (tous types confondus) + détail par type.
 */
export async function getStatsReactions(articleId) {
  const [article, parType] = await Promise.all([
    prisma.article.findUnique({ where: { id: Number(articleId) }, select: { nbLikes: true } }),
    prisma.like.groupBy({
      by: ["type"],
      where: { articleId: Number(articleId) },
      _count: true,
    }),
  ]);

  const detail = TYPES_REACTION.reduce((acc, type) => {
    acc[type] = parType.find((p) => p.type === type)?._count || 0;
    return acc;
  }, {});

  return { total: article?.nbLikes || 0, detail };
}

/**
 * Indique quelles réactions un visiteur donné a déjà mises sur un article
 * (pour afficher les boutons "actifs" côté front).
 */
export async function getMesReactions(articleId, identifiant) {
  const likes = await prisma.like.findMany({
    where: { articleId: Number(articleId), identifiant },
    select: { type: true },
  });
  return likes.map((l) => l.type);
}
BLOGEOF

cat > src/controllers/article.controller.js << 'BLOGEOF'
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
BLOGEOF

cat > src/controllers/commentaire.controller.js << 'BLOGEOF'
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
BLOGEOF

cat > src/controllers/like.controller.js << 'BLOGEOF'
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
BLOGEOF

cat > src/routes/article.routes.js << 'BLOGEOF'
import { Router } from "express";
import * as articleController from "../controllers/article.controller.js";
import { uploadArticleFiles, handleUploadErrors } from "../middleware/uploadArticle.middleware.js";
import { authorize } from "../middleware/auth.middleware.js";

const router = Router();

// --- Routes publiques ---
router.get("/articles", articleController.listerPublies);
router.get("/articles/a-la-une", articleController.alaUne);
router.get("/articles/:slug", articleController.detailParSlug);

// --- Routes admin (protégées) ---
router.get("/admin/articles", authorize(["ADMIN"]), articleController.listerAdmin);
router.get("/admin/articles/:id", authorize(["ADMIN"]), articleController.detailParId);

router.post(
  "/admin/articles",
  authorize(["ADMIN"]),
  uploadArticleFiles,
  handleUploadErrors,
  articleController.creer
);

router.put(
  "/admin/articles/:id",
  authorize(["ADMIN"]),
  uploadArticleFiles,
  handleUploadErrors,
  articleController.modifier
);

router.patch("/admin/articles/:id/publier", authorize(["ADMIN"]), articleController.publier);
router.delete("/admin/articles/:id/medias/:mediaId", authorize(["ADMIN"]), articleController.supprimerMedia);
router.delete("/admin/articles/:id", authorize(["ADMIN"]), articleController.supprimer);

export default router;
BLOGEOF

cat > src/routes/commentaire.routes.js << 'BLOGEOF'
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
BLOGEOF

cat > src/routes/like.routes.js << 'BLOGEOF'
import { Router } from "express";
import * as likeController from "../controllers/like.controller.js";

const router = Router();

router.post("/articles/:articleId/like", likeController.toggle);
router.get("/articles/:articleId/likes", likeController.stats);
router.get("/articles/:articleId/mes-reactions", likeController.mesReactions);

export default router;
BLOGEOF

echo "Fichiers backend du blog crees/mis a jour dans src/"