import prisma from '../config/database.js';
import cloudinary from '../config/cloudinary.js';
import slugify from 'slugify';

class FormationService {
  async createFormation(data, files) {
    try {
      let imageUrl = null;
      let brochureUrl = null;

      // Upload image to Cloudinary
      if (files?.image) {
        const imageResult = await cloudinary.uploader.upload(files.image[0].path, {
          folder: 'formations/images',
          resource_type: 'image'
        });
        imageUrl = imageResult.secure_url;
      }

      // Upload brochure to Cloudinary
      if (files?.brochure) {
        const brochureResult = await cloudinary.uploader.upload(files.brochure[0].path, {
          folder: 'formations/brochures',
          resource_type: 'auto'
        });
        brochureUrl = brochureResult.secure_url;
      }

      const slug = slugify(data.titre, { lower: true, strict: true });

      const formation = await prisma.formation.create({
        data: {
          titre: data.titre,
          slug,
          description: data.description,
          programme: data.programme,
          duree: data.duree,
          tarifPres: data.tarifPres ? parseInt(data.tarifPres) : null,
          tarifOnline: data.tarifOnline ? parseInt(data.tarifOnline) : null,
          imageUrl,
          brochureUrl,
          categorie: data.categorie
        }
      });

      return formation;
    } catch (error) {
      throw new Error(`Erreur lors de la création de la formation: ${error.message}`);
    }
  }

  async getAllFormations() {
    try {
      return await prisma.formation.findMany({
        include: {
          inscriptions: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des formations: ${error.message}`);
    }
  }

  async getFormationById(id) {
    try {
      const formation = await prisma.formation.findUnique({
        where: { id: parseInt(id) },
        include: {
          inscriptions: true
        }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      return formation;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de la formation: ${error.message}`);
    }
  }

  async getFormationBySlug(slug) {
    try {
      const formation = await prisma.formation.findUnique({
        where: { slug },
        include: {
          inscriptions: true
        }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      return formation;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de la formation: ${error.message}`);
    }
  }

  async updateFormation(id, data, files) {
    try {
      const existingFormation = await prisma.formation.findUnique({
        where: { id: parseInt(id) }
      });

      if (!existingFormation) {
        throw new Error('Formation non trouvée');
      }

      let imageUrl = existingFormation.imageUrl;
      let brochureUrl = existingFormation.brochureUrl;

      // Update image if provided
      if (files?.image) {
        // Delete old image from Cloudinary
        if (existingFormation.imageUrl) {
          const publicId = existingFormation.imageUrl.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(`formations/images/${publicId}`);
        }

        const imageResult = await cloudinary.uploader.upload(files.image[0].path, {
          folder: 'formations/images',
          resource_type: 'image'
        });
        imageUrl = imageResult.secure_url;
      }

      // Update brochure if provided
      if (files?.brochure) {
        // Delete old brochure from Cloudinary
        if (existingFormation.brochureUrl) {
          const publicId = existingFormation.brochureUrl.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(`formations/brochures/${publicId}`);
        }

        const brochureResult = await cloudinary.uploader.upload(files.brochure[0].path, {
          folder: 'formations/brochures',
          resource_type: 'auto'
        });
        brochureUrl = brochureResult.secure_url;
      }

      const slug = data.titre ? slugify(data.titre, { lower: true, strict: true }) : existingFormation.slug;

      const formation = await prisma.formation.update({
        where: { id: parseInt(id) },
        data: {
          titre: data.titre || existingFormation.titre,
          slug,
          description: data.description || existingFormation.description,
          programme: data.programme || existingFormation.programme,
          duree: data.duree || existingFormation.duree,
          tarifPres: data.tarifPres ? parseInt(data.tarifPres) : existingFormation.tarifPres,
          tarifOnline: data.tarifOnline ? parseInt(data.tarifOnline) : existingFormation.tarifOnline,
          imageUrl,
          brochureUrl,
          categorie: data.categorie || existingFormation.categorie
        }
      });

      return formation;
    } catch (error) {
      throw new Error(`Erreur lors de la mise à jour de la formation: ${error.message}`);
    }
  }

  async deleteFormation(id) {
    try {
      const formation = await prisma.formation.findUnique({
        where: { id: parseInt(id) }
      });

      if (!formation) {
        throw new Error('Formation non trouvée');
      }

      // Delete images from Cloudinary
      if (formation.imageUrl) {
        const publicId = formation.imageUrl.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(`formations/images/${publicId}`);
      }

      if (formation.brochureUrl) {
        const publicId = formation.brochureUrl.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(`formations/brochures/${publicId}`);
      }

      await prisma.formation.delete({
        where: { id: parseInt(id) }
      });

      return { message: 'Formation supprimée avec succès' };
    } catch (error) {
      throw new Error(`Erreur lors de la suppression de la formation: ${error.message}`);
    }
  }

  async getFormationsByCategorie(categorie) {
    try {
      return await prisma.formation.findMany({
        where: { categorie },
        include: {
          inscriptions: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des formations par catégorie: ${error.message}`);
    }
  }
}

export default new FormationService();