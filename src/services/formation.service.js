import prisma from '../config/database.js';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from '../utils/cloudinary.js';
import slugify from 'slugify';

const formationService = {
  // Créer une formation
  createFormation: async (data, files) => {
    try {
      const { titre, description, categorie, duree, prix, prerequis, objectifs, contenu } = data;

      // Validation
      if (!titre || !description || !categorie || !duree || !prix) {
        throw new Error('Tous les champs obligatoires doivent être remplis');
      }

      // Upload des fichiers vers Cloudinary
      let imageUrl = null;
      let brochureUrl = null;

      // Upload image si présente
      if (files?.image?.[0]) {
        console.log('📤 Upload image vers Cloudinary...');
        imageUrl = await uploadToCloudinary(
          files.image[0].buffer,
          'tellytech/formations/images',
          'image'
        );
        console.log('✅ Image uploadée:', imageUrl);
      }

      // Upload brochure si présente
      if (files?.brochure?.[0]) {
        console.log('📤 Upload brochure vers Cloudinary...');
        brochureUrl = await uploadToCloudinary(
          files.brochure[0].buffer,
          'tellytech/formations/brochures',
          'raw'
        );
        console.log('✅ Brochure uploadée:', brochureUrl);
      }

      // Générer le slug
      const slug = slugify(titre, { lower: true, strict: true });

      // Créer la formation
      const formation = await prisma.formation.create({
        data: {
          titre,
          slug,
          description,
          categorie,
          duree: parseInt(duree),
          prix: parseFloat(prix),
          prerequis: prerequis || null,
          objectifs: objectifs || null,
          contenu: contenu || null,
          image: imageUrl,
          brochure: brochureUrl,
        },
      });

      return formation;
    } catch (error) {
      console.error('❌ Erreur création formation:', error);
      throw error;
    }
  },

  // Récupérer toutes les formations
  getAllFormations: async () => {
    try {
      const formations = await prisma.formation.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { inscriptions: true }
          }
        }
      });
      return formations;
    } catch (error) {
      console.error('❌ Erreur récupération formations:', error);
      throw error;
    }
  },

  // Récupérer une formation par ID
  getFormationById: async (id) => {
    try {
      const formation = await prisma.formation.findUnique({
        where: { id },
        include: {
          inscriptions: {
            include: {
              user: {
                select: {
                  id: true,
                  nom: true,
                  prenom: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: { inscriptions: true }
          }
        }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      return formation;
    } catch (error) {
      console.error('❌ Erreur récupération formation:', error);
      throw error;
    }
  },

  // Récupérer une formation par slug
  getFormationBySlug: async (slug) => {
    try {
      const formation = await prisma.formation.findUnique({
        where: { slug },
        include: {
          _count: {
            select: { inscriptions: true }
          }
        }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      return formation;
    } catch (error) {
      console.error('❌ Erreur récupération formation par slug:', error);
      throw error;
    }
  },

  // Mettre à jour une formation
  updateFormation: async (id, data, files) => {
    try {
      // Vérifier si la formation existe
      const existingFormation = await prisma.formation.findUnique({
        where: { id }
      });

      if (!existingFormation) {
        throw new Error('Formation non trouvée');
      }

      const updateData = { ...data };

      // Upload nouvelle image si présente
      if (files?.image?.[0]) {
        console.log('📤 Upload nouvelle image vers Cloudinary...');
        
        // Supprimer l'ancienne image si elle existe
        if (existingFormation.image) {
          const oldPublicId = extractPublicId(existingFormation.image);
          if (oldPublicId) {
            await deleteFromCloudinary(oldPublicId, 'image');
          }
        }

        updateData.image = await uploadToCloudinary(
          files.image[0].buffer,
          'tellytech/formations/images',
          'image'
        );
        console.log('✅ Nouvelle image uploadée:', updateData.image);
      }

      // Upload nouvelle brochure si présente
      if (files?.brochure?.[0]) {
        console.log('📤 Upload nouvelle brochure vers Cloudinary...');
        
        // Supprimer l'ancienne brochure si elle existe
        if (existingFormation.brochure) {
          const oldPublicId = extractPublicId(existingFormation.brochure);
          if (oldPublicId) {
            await deleteFromCloudinary(oldPublicId, 'raw');
          }
        }

        updateData.brochure = await uploadToCloudinary(
          files.brochure[0].buffer,
          'tellytech/formations/brochures',
          'raw'
        );
        console.log('✅ Nouvelle brochure uploadée:', updateData.brochure);
      }

      // Mettre à jour le slug si le titre change
      if (data.titre && data.titre !== existingFormation.titre) {
        updateData.slug = slugify(data.titre, { lower: true, strict: true });
      }

      // Convertir les types si nécessaire
      if (updateData.duree) updateData.duree = parseInt(updateData.duree);
      if (updateData.prix) updateData.prix = parseFloat(updateData.prix);

      // Mettre à jour la formation
      const formation = await prisma.formation.update({
        where: { id },
        data: updateData,
      });

      return formation;
    } catch (error) {
      console.error('❌ Erreur mise à jour formation:', error);
      throw error;
    }
  },

  // Supprimer une formation
  deleteFormation: async (id) => {
    try {
      // Vérifier si la formation existe
      const formation = await prisma.formation.findUnique({
        where: { id },
        include: {
          _count: {
            select: { inscriptions: true }
          }
        }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      // Vérifier s'il y a des inscriptions
      if (formation._count.inscriptions > 0) {
        throw new Error('Impossible de supprimer une formation avec des inscriptions actives');
      }

      // Supprimer les fichiers de Cloudinary
      if (formation.image) {
        const imagePublicId = extractPublicId(formation.image);
        if (imagePublicId) {
          await deleteFromCloudinary(imagePublicId, 'image');
        }
      }

      if (formation.brochure) {
        const brochurePublicId = extractPublicId(formation.brochure);
        if (brochurePublicId) {
          await deleteFromCloudinary(brochurePublicId, 'raw');
        }
      }

      // Supprimer la formation
      await prisma.formation.delete({
        where: { id }
      });

      return { message: 'Formation supprimée avec succès' };
    } catch (error) {
      console.error('❌ Erreur suppression formation:', error);
      throw error;
    }
  },

  // Récupérer les formations par catégorie
  getFormationsByCategorie: async (categorie) => {
    try {
      const formations = await prisma.formation.findMany({
        where: { categorie },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { inscriptions: true }
          }
        }
      });
      return formations;
    } catch (error) {
      console.error('❌ Erreur récupération formations par catégorie:', error);
      throw error;
    }
  },

  // Rechercher des formations
  searchFormations: async (query) => {
    try {
      const formations = await prisma.formation.findMany({
        where: {
          OR: [
            { titre: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { categorie: { contains: query, mode: 'insensitive' } },
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { inscriptions: true }
          }
        }
      });
      return formations;
    } catch (error) {
      console.error('❌ Erreur recherche formations:', error);
      throw error;
    }
  },

  // Récupérer les statistiques d'une formation
  getFormationStats: async (id) => {
    try {
      const formation = await prisma.formation.findUnique({
        where: { id },
        include: {
          inscriptions: {
            include: {
              paiement: true
            }
          }
        }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      // Calculer les statistiques
      const totalInscriptions = formation.inscriptions.length;
      const inscriptionsValidees = formation.inscriptions.filter(
        i => i.statut === 'VALIDEE'
      ).length;
      const inscriptionsEnAttente = formation.inscriptions.filter(
        i => i.statut === 'EN_ATTENTE'
      ).length;
      const inscriptionsAnnulees = formation.inscriptions.filter(
        i => i.statut === 'ANNULEE'
      ).length;

      // Calculer le revenu total
      const revenuTotal = formation.inscriptions
        .filter(i => i.paiement && i.paiement.statut === 'COMPLETE')
        .reduce((sum, i) => sum + (i.paiement.montant || 0), 0);

      return {
        formationId: formation.id,
        titre: formation.titre,
        statistiques: {
          totalInscriptions,
          inscriptionsValidees,
          inscriptionsEnAttente,
          inscriptionsAnnulees,
          revenuTotal,
          prixFormation: formation.prix
        }
      };
    } catch (error) {
      console.error('❌ Erreur récupération stats formation:', error);
      throw error;
    }
  }
};

export default formationService;