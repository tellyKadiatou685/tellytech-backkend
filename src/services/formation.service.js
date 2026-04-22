import prisma from '../config/database.js';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';
import slugify from 'slugify';

// formation.service.js

const uploadFile = async (buffer, folder, resourceType = 'image', extraOptions = {}) => {
  const result = await uploadToCloudinary(buffer, {
    folder,
    resource_type: resourceType,
    ...extraOptions,
  });
  return result.secure_url;
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

  createFormation: async (data, files) => {
    const {
      titre, description, categorie, niveau,
      nombreMois, mensualite, montantInscription,
      prerequis, objectifs, programme, disponibilite
    } = data;

    if (!titre || !description || !categorie) {
      throw new Error('titre, description et catégorie sont obligatoires');
    }

    const baseSlug = slugify(titre, { lower: true, strict: true });
    const existing = await prisma.formation.findUnique({ where: { slug: baseSlug } });
    const slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;

    let imageUrl = null;
    if (files?.image?.[0]) {
      imageUrl = await uploadFile(files.image[0].buffer, 'tellytech/formations/images', 'image');
    }

    // ✅ resource_type:'image' + format:'pdf' → Cloudinary sert le bon Content-Type sur mobile
    let brochureUrl = null;
    if (files?.brochure?.[0]) {
      brochureUrl = await uploadFile(
        files.brochure[0].buffer,
        'tellytech/formations/brochures',
        'image',          // ← 'image' et non 'raw' pour que mobile reçoive Content-Type: application/pdf
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

  getAllFormations: async ({ adminMode = false } = {}) => {
    return await prisma.formation.findMany({
      where: adminMode ? {} : { estActif: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  getFormationById: async (id) => {
    const formation = await prisma.formation.findUnique({
      where: { id: parseInt(id) },
    });
    if (!formation) throw new Error('Formation introuvable');
    return formation;
  },

  getFormationBySlug: async (slug) => {
    const formation = await prisma.formation.findFirst({
      where: { slug, estActif: true },
    });
    if (!formation) throw new Error('Formation introuvable');
    return formation;
  },

  updateFormation: async (id, data, files) => {
    const existing = await prisma.formation.findUnique({ where: { id: parseInt(id) } });
    if (!existing) throw new Error('Formation introuvable');

    const updateData = {};

    ['titre', 'description', 'categorie', 'niveau',
     'prerequis', 'objectifs', 'programme', 'disponibilite'
    ].forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });

    ['nombreMois', 'mensualite', 'montantInscription'].forEach(f => {
      if (data[f] !== undefined) updateData[f] = data[f] ? parseInt(data[f]) : null;
    });

    if (data.titre && data.titre !== existing.titre) {
      const newSlug = slugify(data.titre, { lower: true, strict: true });
      const conflict = await prisma.formation.findFirst({
        where: { slug: newSlug, NOT: { id: parseInt(id) } }
      });
      if (conflict) throw new Error('Une formation avec ce titre existe déjà');
      updateData.slug = newSlug;
    }

    if (files?.image?.[0]) {
      await safeDelete(existing.imageUrl, 'image');
      updateData.imageUrl = await uploadFile(
        files.image[0].buffer, 'tellytech/formations/images', 'image'
      );
    }

    // ✅ resource_type:'image' + format:'pdf' → compatible mobile
    if (files?.brochure?.[0]) {
      await safeDelete(existing.brochureUrl, 'image'); // ← 'image' pour matcher le type d'upload
      updateData.brochureUrl = await uploadFile(
        files.brochure[0].buffer,
        'tellytech/formations/brochures',
        'image',          // ← 'image' et non 'raw'
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

  deleteFormation: async (id) => {
    const formation = await prisma.formation.findUnique({ where: { id: parseInt(id) } });
    if (!formation) throw new Error('Formation introuvable');

    const cleanups = [];
    if (formation.imageUrl)    cleanups.push(safeDelete(formation.imageUrl, 'image'));
    if (formation.brochureUrl) cleanups.push(safeDelete(formation.brochureUrl, 'image')); // ← 'image'
    await Promise.allSettled(cleanups);

    await prisma.formation.delete({ where: { id: parseInt(id) } });

    console.log(`🗑️ Formation supprimée [${id}]`);
    return { message: 'Formation supprimée définitivement' };
  },

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

  getFormationsByCategorie: async (categorie) => {
    return await prisma.formation.findMany({
      where: { categorie, estActif: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export default formationService;