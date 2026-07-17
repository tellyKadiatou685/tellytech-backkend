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
