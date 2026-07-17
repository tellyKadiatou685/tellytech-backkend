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