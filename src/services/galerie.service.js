import { PrismaClient } from "@prisma/client";
import blogUploadService from "./blogUpload.service.js"; // réutilise l'upload Cloudinary déjà en place

const prisma = new PrismaClient();

export async function listerPhotos({ categorie } = {}) {
  return prisma.galerie.findMany({
    where: {
      estActif: true,
      ...(categorie && categorie !== "Tous" ? { categorie } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * "À la une" = la photo la plus récente et active. Automatique, pas de champ dédié.
 */
export async function getPhotoALaUne() {
  return prisma.galerie.findFirst({
    where: { estActif: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function creerPhoto(data, file) {
  const { titre, description, categorie, evenementId } = data;
  if (!titre || !categorie) {
    const err = new Error("Titre et catégorie sont obligatoires");
    err.statusCode = 400;
    throw err;
  }
  if (!file) {
    const err = new Error("Une image est obligatoire");
    err.statusCode = 400;
    throw err;
  }

  const upload = await blogUploadService.uploadArticleImage(file);

  return prisma.galerie.create({
    data: {
      titre,
      description: description || null,
      categorie,
      url: upload.url,
      evenementId: evenementId ? Number(evenementId) : null,
    },
  });
}

export async function supprimerPhoto(id) {
  const photo = await prisma.galerie.findUnique({ where: { id: Number(id) } });
  if (!photo) {
    const err = new Error("Photo introuvable");
    err.statusCode = 404;
    throw err;
  }
  await blogUploadService.deleteArticleFile(photo.url, "image");
  await prisma.galerie.delete({ where: { id: Number(id) } });
  return { success: true };
}