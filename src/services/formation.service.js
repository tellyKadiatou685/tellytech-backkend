import prisma from '../config/database.js';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';
import slugify from 'slugify';

// formation.service.js

// ✅ extraOptions permet de passer format:'pdf' pour les brochures sans casser les images
const uploadFile = async (buffer, folder, resourceType = 'image', extraOptions = {}) => {
  const result = await uploadToCloudinary(buffer, {
    folder,
    resource_type: resourceType,
    ...extraOptions,
  });
  return result.secure_url; // ← string ✓
};

const safeDelete = async (url, resourceType = 'image') => {
  try {
    if (!url) return;
    const pid = extractPublicId(url);
    if (pid) await deleteFromCloudinary(pid, resourceType);
  } catch (err) {
    console.warn('⚠️ Cloudinary delete non bloquant:', err.message);
  }
};

const formationService = {

  // ============================================================
  // CRÉER UNE FORMATION
  // Body  : { titre, description, categorie, niveau,
  //           nombreMois, mensualite, montantInscription,
  //           prerequis, objectifs, programme, disponibilite }
  // Files : { image[1], brochure[1] }
  // ============================================================
  createFormation: async (data, files) => {
    const {
      titre, description, categorie, niveau,
      nombreMois, mensualite, montantInscription,
      prerequis, objectifs, programme, disponibilite
    } = data;

    if (!titre || !description || !categorie) {
      throw new Error('titre, description et catégorie sont obligatoires');
    }

    // Slug unique
    const baseSlug = slugify(titre, { lower: true, strict: true });
    const existing = await prisma.formation.findUnique({ where: { slug: baseSlug } });
    const slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;

    // Upload image principale
    let imageUrl = null;
    if (files?.image?.[0]) {
      imageUrl = await uploadFile(files.image[0].buffer, 'tellytech/formations/images', 'image');
    }

    // ✅ Upload brochure PDF — resource_type:'raw' + format:'pdf' pour forcer l'extension .pdf dans l'URL
    let brochureUrl = null;
    if (files?.brochure?.[0]) {
      brochureUrl = await uploadFile(
        files.brochure[0].buffer,
        'tellytech/formations/brochures',
        'raw',
        { format: 'pdf' }
      );
    }

    const formation = await prisma.formation.create({
      data: {
        titre,
        slug,
        description,
        categorie,
        niveau:             niveau             || 'Débutant',
        nombreMois:         nombreMois         ? parseInt(nombreMois)         : null,
        mensualite:         mensualite         ? parseInt(mensualite)         : null,
        montantInscription: montantInscription ? parseInt(montantInscription) : null,
        prerequis:          prerequis          || null,
        objectifs:          objectifs          || null,
        programme:          programme          || null,
        imageUrl,
        brochureUrl,
        disponibilite: disponibilite || 'Actuellement disponible',
        estActif:      true,
      },
    });

    console.log(`✅ Formation créée [${formation.id}]: ${formation.titre}`);
    return formation;
  },

  // ============================================================
  // LISTER
  // ============================================================
  getAllFormations: async ({ adminMode = false } = {}) => {
    return await prisma.formation.findMany({
      where: adminMode ? {} : { estActif: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ============================================================
  // PAR ID
  // ============================================================
  getFormationById: async (id) => {
    const formation = await prisma.formation.findUnique({
      where: { id: parseInt(id) },
    });
    if (!formation) throw new Error('Formation introuvable');
    return formation;
  },

  // ============================================================
  // PAR SLUG
  // ============================================================
  getFormationBySlug: async (slug) => {
    const formation = await prisma.formation.findFirst({
      where: { slug, estActif: true },
    });
    if (!formation) throw new Error('Formation introuvable');
    return formation;
  },

  // ============================================================
  // METTRE À JOUR
  // ============================================================
  updateFormation: async (id, data, files) => {
    const existing = await prisma.formation.findUnique({ where: { id: parseInt(id) } });
    if (!existing) throw new Error('Formation introuvable');

    const updateData = {};

    // Champs texte
    ['titre', 'description', 'categorie', 'niveau',
     'prerequis', 'objectifs', 'programme', 'disponibilite'
    ].forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });

    // Champs entiers
    ['nombreMois', 'mensualite', 'montantInscription'].forEach(f => {
      if (data[f] !== undefined) updateData[f] = data[f] ? parseInt(data[f]) : null;
    });

    // Nouveau slug si titre change
    if (data.titre && data.titre !== existing.titre) {
      const newSlug = slugify(data.titre, { lower: true, strict: true });
      const conflict = await prisma.formation.findFirst({
        where: { slug: newSlug, NOT: { id: parseInt(id) } }
      });
      if (conflict) throw new Error('Une formation avec ce titre existe déjà');
      updateData.slug = newSlug;
    }

    // Nouvelle image principale → supprime l'ancienne
    if (files?.image?.[0]) {
      await safeDelete(existing.imageUrl, 'image');
      updateData.imageUrl = await uploadFile(
        files.image[0].buffer, 'tellytech/formations/images', 'image'
      );
    }

    // ✅ Nouvelle brochure → supprime l'ancienne + force format pdf
    if (files?.brochure?.[0]) {
      await safeDelete(existing.brochureUrl, 'raw');
      updateData.brochureUrl = await uploadFile(
        files.brochure[0].buffer,
        'tellytech/formations/brochures',
        'raw',
        { format: 'pdf' }
      );
    }

    const formation = await prisma.formation.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    console.log(`✅ Formation mise à jour [${formation.id}]: ${formation.titre}`);
    return formation;
  },

  // ============================================================
  // ACTIVER / DÉSACTIVER
  // ============================================================
  toggleActivation: async (id) => {
    const formation = await prisma.formation.findUnique({ where: { id: parseInt(id) } });
    if (!formation) throw new Error('Formation introuvable');

    const updated = await prisma.formation.update({
      where: { id: parseInt(id) },
      data: { estActif: !formation.estActif },
    });

    return {
      message:   updated.estActif ? '✅ Formation activée' : '⏸️ Formation désactivée',
      estActif:  updated.estActif,
      formation: updated,
    };
  },

  // ============================================================
  // SUPPRIMER + nettoyage Cloudinary
  // ============================================================
  deleteFormation: async (id) => {
    const formation = await prisma.formation.findUnique({ where: { id: parseInt(id) } });
    if (!formation) throw new Error('Formation introuvable');

    const cleanups = [];
    if (formation.imageUrl)    cleanups.push(safeDelete(formation.imageUrl, 'image'));
    if (formation.brochureUrl) cleanups.push(safeDelete(formation.brochureUrl, 'raw'));
    await Promise.allSettled(cleanups);

    await prisma.formation.delete({ where: { id: parseInt(id) } });

    console.log(`🗑️ Formation supprimée [${id}]`);
    return { message: 'Formation supprimée définitivement' };
  },

  // ============================================================
  // RECHERCHE
  // ============================================================
  searchFormations: async (query) => {
    return await prisma.formation.findMany({
      where: {
        estActif: true,
        OR: [
          { titre:       { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { categorie:   { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ============================================================
  // PAR CATÉGORIE
  // ============================================================
  getFormationsByCategorie: async (categorie) => {
    return await prisma.formation.findMany({
      where: { categorie, estActif: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default formationService;