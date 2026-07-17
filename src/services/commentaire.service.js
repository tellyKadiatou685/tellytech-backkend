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
